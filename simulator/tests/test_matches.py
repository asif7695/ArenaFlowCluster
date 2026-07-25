"""Session Safety Guard support: per-node Match bookkeeping in the simulator."""
from simulator import ClusterSimulator, Match, MATCH_DURATION_MAX_TICKS
from nodes import ROSTER


def test_matches_spawn_toward_target_when_allowed():
    sim = ClusterSimulator(scenario="peak", seed=1)
    recs = None
    for _ in range(5):
        recs = sim.tick()
    assert any(r["active_sessions"] > 0 for r in recs), \
        "matches should spawn as load rises from a cold start"


def test_no_spawn_while_draining():
    sim = ClusterSimulator(scenario="peak", seed=1)
    node_id = ROSTER[0].node_id
    for _ in range(5):
        sim.tick()  # warm up normally so the node has something to drain

    prev = next(r for r in sim.tick(draining={node_id})
                if r["node_id"] == node_id)["active_sessions"]
    for _ in range(10):
        rec = next(r for r in sim.tick(draining={node_id}) if r["node_id"] == node_id)
        assert rec["active_sessions"] <= prev, "a draining node's session count must never increase"
        prev = rec["active_sessions"]


def test_matches_eventually_drain_to_zero():
    sim = ClusterSimulator(scenario="peak", seed=1)
    node_id = ROSTER[0].node_id
    for _ in range(5):
        sim.tick()
    final = None
    for _ in range(MATCH_DURATION_MAX_TICKS + 2):
        recs = sim.tick(draining={node_id})
        final = next(r for r in recs if r["node_id"] == node_id)
    assert final["active_sessions"] == 0, \
        "a draining node should empty within the max match duration"


def test_transplant_respects_capacity():
    sim = ClusterSimulator(scenario="peak", seed=1)
    dst_id = ROSTER[0].node_id
    dst_capacity = ROSTER[0].capacity
    sim.clear_matches(dst_id)

    incoming = [Match("m1", players=dst_capacity - 3, started_tick=0, duration_ticks=10),
                Match("m2", players=10, started_tick=0, duration_ticks=10)]
    leftover = sim.transplant_matches(dst_id, incoming)

    dst_total = sum(m.players for m in sim.get_matches(dst_id))
    assert dst_total <= dst_capacity
    assert [m.match_id for m in leftover] == ["m2"], \
        "the second match shouldn't fit once the first nearly filled capacity"


def test_clear_matches_empties_node_and_is_idempotent():
    sim = ClusterSimulator(scenario="peak", seed=1)
    node_id = ROSTER[0].node_id
    for _ in range(5):
        sim.tick()
    sim.clear_matches(node_id)
    assert sim.get_matches(node_id) == []
    assert sim.clear_matches(node_id) == []


def test_offline_node_matches_cleared():
    sim = ClusterSimulator(scenario="peak", seed=1)
    node_id = ROSTER[0].node_id
    for _ in range(5):
        sim.tick()
    sim.tick(offline={node_id})
    assert sim.get_matches(node_id) == []
