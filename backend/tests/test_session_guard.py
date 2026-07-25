"""Session Safety and Scale-Down Guard policy tests."""
from app import config as C
from app.services import session_guard

TS = "2026-01-01T00:00:00+00:00"


def _node(label, status="healthy", fsess=10, risk=0.0, sessions=0, capacity=32):
    return {
        "node_id": f"node-{label}", "label": label, "status": status,
        "forecast_sessions_next_5min": fsess, "failure_risk_score": risk,
        "active_sessions": sessions, "capacity": capacity,
    }


# ---- live-match guard (energy PARK path) ------------------------------------

def test_park_candidate_with_live_sessions_diverted_to_draining():
    # A29 has the lowest forecast (would be parked first) but has live players
    nodes = [_node(f"A{i}", fsess=(30 - i), sessions=(6 if i == 29 else 0)) for i in range(30)]
    new_offline, new_draining, decisions, events = session_guard.guard_offline_plan(
        nodes, target_active=C.MIN_ACTIVE_NODES + 4, current_offline={}, current_draining={},
        timestamp=TS, park_step=2)
    assert "node-A29" not in new_offline, "must never park a node with live sessions immediately"
    assert "node-A29" in new_draining, "should divert to draining instead"
    guard_d = [d for d in decisions if d["label"] == "GUARD"]
    assert guard_d and guard_d[0]["target_node"] == "A29" and guard_d[0]["players"] == 6
    assert guard_d[0]["outcome"] == "blocked"


def test_park_candidate_with_zero_sessions_parks_normally():
    nodes = [_node(f"A{i}", fsess=(30 - i), sessions=0) for i in range(30)]
    new_offline, new_draining, decisions, _ = session_guard.guard_offline_plan(
        nodes, target_active=C.MIN_ACTIVE_NODES + 4, current_offline={}, current_draining={},
        timestamp=TS, park_step=2)
    assert "node-A29" in new_offline and new_offline["node-A29"]["reason"] == "park"
    assert not new_draining, "no live sessions anywhere — nothing should be diverted to draining"
    assert not [d for d in decisions if d["label"] == "GUARD"]


def test_draining_node_promotes_to_offline_once_empty():
    # 30-node fleet, target_active leaves exactly one node's worth of desired
    # offline capacity — so the freshly-promoted A1 isn't immediately woken
    # back up by consolidation's own energy-target reconciliation.
    nodes = [_node("A1", status="draining", sessions=0, fsess=0)] + \
            [_node(f"B{i}", sessions=0, fsess=10) for i in range(29)]
    current_draining = {"node-A1": {"since": 3}}
    new_offline, new_draining, decisions, _ = session_guard.guard_offline_plan(
        nodes, target_active=29, current_offline={}, current_draining=current_draining, timestamp=TS)
    assert "node-A1" in new_offline and new_offline["node-A1"]["reason"] == "park"
    assert "node-A1" not in new_draining
    parked = [d for d in decisions if d["label"] == "PARK" and d["target_node"] == "A1"]
    assert parked and parked[0]["outcome"] == "drained"


def test_draining_node_stays_draining_while_sessions_remain():
    nodes = [_node("A1", status="draining", sessions=4, fsess=0)]
    current_draining = {"node-A1": {"since": 3}}
    new_offline, new_draining, _, _ = session_guard.guard_offline_plan(
        nodes, target_active=64, current_offline={}, current_draining=current_draining, timestamp=TS)
    assert "node-A1" not in new_offline
    assert "node-A1" in new_draining


# ---- safe drain (forced REPAIR path) -----------------------------------------

def test_forced_repair_migrates_when_capacity_available():
    a1 = _node("A1", risk=C.FAIL_CUTOFF + 0.05, sessions=10, capacity=32)
    a2 = _node("A2", risk=0.0, sessions=5, capacity=32)  # spare 27 >= 10
    new_offline, _, decisions, events = session_guard.guard_offline_plan(
        [a1, a2], target_active=64, current_offline={}, current_draining={}, timestamp=TS)
    assert new_offline["node-A1"]["reason"] == "repair"
    drains = [d for d in decisions if d["label"] == "DRAIN"]
    assert drains and drains[0]["outcome"] == "migrated" and drains[0]["players"] == 10
    assert events == [{"kind": "migrate", "source": "node-A1", "dest": "node-A2", "players": 10}]


def test_forced_repair_finishes_when_no_capacity_available():
    a1 = _node("A1", risk=C.FAIL_CUTOFF + 0.05, sessions=10, capacity=32)
    _, _, decisions, events = session_guard.guard_offline_plan(
        [a1], target_active=64, current_offline={}, current_draining={}, timestamp=TS)
    drains = [d for d in decisions if d["label"] == "DRAIN"]
    assert drains and drains[0]["outcome"] == "finished" and drains[0]["players"] == 10
    assert events == [{"kind": "finish", "source": "node-A1", "dest": None, "players": 10}]


def test_forced_repair_with_zero_sessions_needs_no_migration_event():
    a1 = _node("A1", risk=C.FAIL_CUTOFF + 0.05, sessions=0)
    _, _, decisions, events = session_guard.guard_offline_plan(
        [a1], target_active=64, current_offline={}, current_draining={}, timestamp=TS)
    drains = [d for d in decisions if d["label"] == "DRAIN"]
    assert drains and drains[0]["outcome"] == "finished" and drains[0]["players"] == 0
    assert events == []


def test_forced_repair_is_never_blocked_by_the_guard():
    a1 = _node("A1", risk=C.FAIL_CUTOFF + 0.05, sessions=30, capacity=32)
    new_offline, new_draining, _, _ = session_guard.guard_offline_plan(
        [a1], target_active=64, current_offline={}, current_draining={}, timestamp=TS)
    assert "node-A1" in new_offline, "health-critical drain must never wait for a live match"
    assert "node-A1" not in new_draining


def test_migration_prefers_destination_with_most_spare_capacity():
    a1 = _node("A1", risk=C.FAIL_CUTOFF + 0.05, sessions=5, capacity=32)
    a2 = _node("A2", sessions=25, capacity=32)   # spare 7
    a3 = _node("A3", sessions=10, capacity=32)   # spare 22
    _, _, _, events = session_guard.guard_offline_plan(
        [a1, a2, a3], target_active=64, current_offline={}, current_draining={}, timestamp=TS)
    assert events[0]["dest"] == "node-A3", "should prefer the destination with more headroom"


# ---- reconciliation + general invariants -------------------------------------

def test_draining_node_that_becomes_critical_escalates_to_offline():
    nodes = [_node("A1", status="draining", sessions=8, risk=C.FAIL_CUTOFF + 0.1, capacity=32)]
    current_draining = {"node-A1": {"since": 2}}
    new_offline, new_draining, _, _ = session_guard.guard_offline_plan(
        nodes, target_active=64, current_offline={}, current_draining=current_draining, timestamp=TS)
    assert "node-A1" in new_offline and new_offline["node-A1"]["reason"] == "repair"
    assert "node-A1" not in new_draining, "a node can never be both offline and draining"


def test_draining_does_not_runaway_across_ticks():
    # Every node has live sessions. Over several ticks, the draining set must
    # converge to the energy target instead of growing every tick — a
    # regression guard for a bug where consolidation's own energy-target math
    # didn't count already-draining nodes as "spoken for," so it kept
    # selecting fresh park candidates every tick (which the guard then also
    # diverted to draining), spiraling toward the whole fleet.
    nodes = [_node(f"A{i}", fsess=(40 - i), sessions=5) for i in range(40)]
    offline: dict = {}
    draining: dict = {}
    target = 30  # desired_offline should settle at 10 and stay there
    for _ in range(8):
        offline, draining, _, _ = session_guard.guard_offline_plan(
            nodes, target_active=target, current_offline=offline, current_draining=draining,
            timestamp=TS, park_step=2)
    assert len(offline) + len(draining) <= 10, \
        "draining+offline must converge to the energy target, not grow unbounded"


def test_decisions_always_carry_nonempty_reason():
    nodes = [_node(f"A{i}", fsess=(30 - i), sessions=(6 if i == 29 else 0)) for i in range(30)]
    nodes.append(_node("B1", risk=C.FAIL_CUTOFF + 0.05, sessions=10, capacity=32))
    nodes.append(_node("B2", sessions=5, capacity=32))
    _, _, decisions, _ = session_guard.guard_offline_plan(
        nodes, target_active=C.MIN_ACTIVE_NODES + 4, current_offline={}, current_draining={},
        timestamp=TS, park_step=2)
    assert decisions, "expected at least one decision"
    assert all(d["reason"].strip() for d in decisions)
