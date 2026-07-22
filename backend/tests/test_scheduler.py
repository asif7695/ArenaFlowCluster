"""Scheduler decision-logic tests (the core of the concept's explainability claim)."""
import config as C
import scheduler_ai
import scheduler_static

TS = "2026-01-01T00:00:00+00:00"


def _node(label, cpu=40.0, lat=40.0, fsess=10, risk=0.0, status="healthy"):
    return {
        "node_id": f"node-{label}", "label": label, "cpu_pct": cpu, "latency_ms": lat,
        "forecast_sessions_next_5min": fsess, "failure_risk_score": risk, "status": status,
    }


def _actions(decisions):
    return {d["action"] for d in decisions}


# ---- AI scheduler ----------------------------------------------------------

def test_ai_scales_up_on_forecast_overload():
    nodes = [_node("A1", cpu=50), _node("A2", cpu=48)]
    decisions, _, cap = scheduler_ai.plan(nodes, demand=55, prev_demand=52,
                                          forecast_peak=90, timestamp=TS)
    up = [d for d in decisions if d["action"] == "scale_up"]
    assert up, "expected a scale_up when forecast peak far exceeds current demand"
    assert up[0]["reason"].strip(), "every AI decision must carry a non-empty reason"
    assert up[0]["mode"] == "ai"


def test_ai_routes_away_from_degrading_node():
    hot = _node("B3", cpu=70, lat=160, risk=0.8, status="critical")
    nodes = [_node("A1"), hot, _node("C2")]
    decisions, rerouted, _ = scheduler_ai.plan(nodes, demand=60, prev_demand=60,
                                               forecast_peak=61, timestamp=TS)
    routes = [d for d in decisions if d["action"] == "route_away"]
    assert routes, "expected route_away for a high-risk node"
    assert "node-B3" in rerouted
    assert any("B3" in d["target_node"] for d in routes)


def test_ai_places_on_lowest_forecast_healthy_node():
    nodes = [_node("A1", fsess=30), _node("A2", fsess=5), _node("A3", fsess=18)]
    decisions, _, _ = scheduler_ai.plan(nodes, demand=52, prev_demand=52,
                                        forecast_peak=52, timestamp=TS)
    place = [d for d in decisions if d["action"] == "place"]
    assert place and place[0]["target_node"] == "A2", "should place on lowest predicted-load node"


# ---- static baseline -------------------------------------------------------

def test_static_idle_below_threshold():
    nodes = [_node("A1", cpu=60, lat=90), _node("A2", cpu=70, lat=120)]
    decisions, rerouted, cap = scheduler_static.plan(nodes, demand=60, prev_demand=60,
                                                     forecast_peak=95, timestamp=TS)
    assert decisions == [], "static must not act until a hard threshold is crossed"
    assert rerouted == set(), "static never routes away (no health awareness)"
    assert cap == C.STATIC_FLOOR_NODES


def test_static_reacts_after_threshold_crossed():
    nodes = [_node("A1", cpu=85, lat=100)]  # cpu over 80% threshold
    decisions, _, cap = scheduler_static.plan(nodes, demand=90, prev_demand=70,
                                             forecast_peak=90, timestamp=TS)
    assert any(d["action"] == "scale_up" for d in decisions)
    assert cap == C.MAX_NODES, "static bursts to max only reactively"
