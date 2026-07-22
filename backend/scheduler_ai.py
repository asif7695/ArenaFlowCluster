"""AI predictive scheduler (rule-based, explainable).

Combines the forecast model (near-future demand) and the anomaly model
(failure risk) to emit scale_up / scale_down / route_away / place decisions,
each with a human-readable `reason`. Explainability is a core selling point of
the concept note, so every decision states why it was made.
"""
from __future__ import annotations

import math

import config as C

# design-facing labels for each contract action
ACTION_LABELS = {
    "scale_up": "SCALE↑",
    "scale_down": "SCALE↓",
    "route_away": "REROUTE",
    "place": "PLACE",
}


def _decision(action, target, reason, confidence, timestamp):
    return {
        "timestamp": timestamp,
        "action": action,
        "label": ACTION_LABELS[action],   # extension for the design's decision log
        "target_node": target,
        "reason": reason,
        "confidence": confidence,
        "mode": "ai",
    }


def plan(nodes, demand, prev_demand, forecast_peak, timestamp):
    """Return (decisions, rerouted_ids, capacity).

    `nodes` is a list of dicts each with: node_id, label, cpu_pct, latency_ms,
    forecast_sessions_next_5min, failure_risk_score, status.
    """
    decisions = []
    rerouted: set[str] = set()

    # --- health-aware routing: steer away from degrading/critical nodes ---
    degrading = [n for n in nodes if n["failure_risk_score"] >= C.ROUTE_AWAY_RISK]
    for n in sorted(degrading, key=lambda x: -x["failure_risk_score"])[:4]:
        rerouted.add(n["node_id"])
        decisions.append(_decision(
            "route_away", n["label"],
            f"failure risk {n['failure_risk_score']:.0%} on {n['label']} — "
            f"steering new matches away before it degrades",
            round(70 + n["failure_risk_score"] * 28), timestamp,
        ))

    # --- predictive capacity: act on forecast, not current load ---
    needed = math.ceil(demand / 100.0 * C.MAX_NODES)
    capacity = max(C.MIN_NODES, min(C.MAX_NODES,
                                    needed + math.ceil(needed * C.CAPACITY_BUFFER_PCT / 100.0)))
    trend = forecast_peak - demand
    if trend > 5:
        decisions.append(_decision(
            "scale_up", "cluster",
            f"forecast demand +{trend:.0f} in 5min exceeds current capacity — "
            f"pre-warming to {capacity} nodes",
            round(80 + min(18, trend)), timestamp,
        ))
    elif trend < -5:
        decisions.append(_decision(
            "scale_down", "cluster",
            f"forecast demand receding {trend:.0f} in 5min — "
            f"releasing idle capacity to {capacity} nodes",
            round(78 + min(18, -trend)), timestamp,
        ))

    # --- placement: put the next session on the lowest predicted-load healthy node ---
    healthy = [n for n in nodes if n["status"] == "healthy"]
    if healthy:
        best = min(healthy, key=lambda x: x["forecast_sessions_next_5min"])
        decisions.append(_decision(
            "place", best["label"],
            f"placed new session on {best['label']} — lowest predicted 5-min load "
            f"({best['forecast_sessions_next_5min']} sessions)",
            round(85 + (10 if best["failure_risk_score"] < 0.1 else 0)), timestamp,
        ))

    return decisions, rerouted, capacity
