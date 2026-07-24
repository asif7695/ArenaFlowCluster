"""Predictive node parking (consolidation) policy tests."""
from app import config as C
from app.services import consolidation

TS = "2026-01-01T00:00:00+00:00"


def _node(label, status="healthy", fsess=10, risk=0.0):
    return {
        "node_id": f"node-{label}", "label": label, "status": status,
        "forecast_sessions_next_5min": fsess, "failure_risk_score": risk,
    }


# ---- energy parking ---------------------------------------------------------

def test_parks_lowest_load_healthy_nodes_up_to_step():
    # enough total nodes that the MIN_ACTIVE_NODES floor doesn't mask parking
    nodes = [_node(f"A{i}", fsess=(30 - i)) for i in range(30)]  # A29 has lowest forecast
    offline, decisions = consolidation.plan_offline(
        nodes, target_active=C.MIN_ACTIVE_NODES + 4, current_offline={}, timestamp=TS, park_step=2)
    assert len(offline) == 2, "should move toward target by at most park_step per tick"
    parked_labels = {n["label"] for n in nodes if n["node_id"] in offline}
    assert parked_labels == {"A29", "A28"}, "should park the lowest predicted-load nodes first"
    assert all(d["label"] == "PARK" and d["action"] == "scale_down" for d in decisions)


def test_never_parks_a_non_healthy_node():
    nodes = [_node("A1", status="degraded", fsess=1), _node("A2", status="healthy", fsess=50)]
    offline, decisions = consolidation.plan_offline(
        nodes, target_active=0, current_offline={}, timestamp=TS, park_step=2)
    assert "node-A1" not in offline, "must never park a non-healthy node for energy reasons"


def test_respects_min_active_floor():
    nodes = [_node(f"A{i}", fsess=i) for i in range(30)]
    offline, _ = consolidation.plan_offline(
        nodes, target_active=0, current_offline={}, timestamp=TS, park_step=30)
    active = len(nodes) - len(offline)
    assert active >= C.MIN_ACTIVE_NODES


def test_wakes_nodes_when_target_rises():
    # 30 total nodes, well above MIN_ACTIVE_NODES, so the target isn't floored
    nodes = [_node(f"A{i}") for i in range(30)]
    current = {f"node-A{i}": {"reason": "park", "since": 5} for i in range(10)}  # 10 parked, 20 active
    offline, decisions = consolidation.plan_offline(
        nodes, target_active=26, current_offline=current, timestamp=TS, park_step=2)
    assert len(offline) == 8, "should wake toward the new (higher) target, capped by park_step"
    assert all(d["label"] == "WAKE" and d["action"] == "scale_up" for d in decisions)


def test_wakes_longest_parked_first():
    nodes = [_node("A1"), _node("A2")]
    current = {"node-A1": {"reason": "park", "since": 2}, "node-A2": {"reason": "park", "since": 9}}
    offline, decisions = consolidation.plan_offline(
        nodes, target_active=1, current_offline=current, timestamp=TS, park_step=1)
    assert "node-A2" not in offline, "the longest-parked node should wake first"
    assert decisions[0]["target_node"] == "A2"


# ---- health-driven repair (drain) -------------------------------------------

def test_drains_a_failing_node_regardless_of_energy_target():
    nodes = [_node("A1", risk=C.FAIL_CUTOFF + 0.05), _node("A2")]
    offline, decisions = consolidation.plan_offline(
        nodes, target_active=64, current_offline={}, timestamp=TS)  # no energy pressure at all
    assert "node-A1" in offline and offline["node-A1"]["reason"] == "repair"
    drains = [d for d in decisions if d["label"] == "DRAIN"]
    assert drains and drains[0]["action"] == "scale_down"
    assert drains[0]["reason"].strip(), "every decision must carry a non-empty reason"


def test_repaired_node_wakes_after_repair_ticks():
    nodes = [_node("A1")]  # now healthy again post-repair
    current = {"node-A1": {"reason": "repair", "since": C.REPAIR_TICKS}}
    offline, decisions = consolidation.plan_offline(
        nodes, target_active=1, current_offline=current, timestamp=TS, repair_ticks=C.REPAIR_TICKS)
    assert "node-A1" not in offline
    assert any(d["label"] == "WAKE" for d in decisions)


def test_repaired_node_stays_offline_before_repair_ticks_elapse():
    nodes = [_node("A1")]
    current = {"node-A1": {"reason": "repair", "since": C.REPAIR_TICKS - 1}}
    offline, decisions = consolidation.plan_offline(
        nodes, target_active=1, current_offline=current, timestamp=TS, repair_ticks=C.REPAIR_TICKS)
    assert "node-A1" in offline, "must not return before completing the repair window"
