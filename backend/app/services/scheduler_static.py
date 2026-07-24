"""Static baseline scheduler (deliberately "dumb", HPA-like).

Holds an over-provisioned fixed floor of nodes and only reacts *after* a hard
CPU/latency threshold is already crossed — no forecasting, no health-aware
routing. Run in parallel with the AI scheduler over identical traffic so the
dashboard can compare cost and player-facing incidents side by side.
"""
from __future__ import annotations

from app import config as C

ACTION_LABELS = {"scale_up": "SCALE↑", "scale_down": "SCALE↓"}


def _decision(action, target, reason, timestamp):
    return {
        "timestamp": timestamp,
        "action": action,
        "label": ACTION_LABELS[action],
        "target_node": target,
        "reason": reason,
        "confidence": 100,           # threshold rules are "certain" once crossed
        "mode": "static",
    }


def plan(nodes, demand, prev_demand, forecast_peak, timestamp):
    """Return (decisions, rerouted_ids, capacity).

    Reacts only to *current* metrics; never routes away (empty rerouted set).
    """
    decisions = []
    capacity = C.STATIC_FLOOR_NODES

    hot = [n for n in nodes
           if n["cpu_pct"] >= C.STATIC_CPU_THRESHOLD or n["latency_ms"] >= C.STATIC_LATENCY_THRESHOLD]
    if hot:
        # only now (after the fact) does it burst to max capacity
        capacity = C.MAX_NODES
        worst = max(hot, key=lambda x: x["cpu_pct"])
        decisions.append(_decision(
            "scale_up", worst["label"],
            f"CPU {worst['cpu_pct']:.0f}% crossed {C.STATIC_CPU_THRESHOLD:.0f}% threshold "
            f"on {worst['label']} — reactive scale-out",
            timestamp,
        ))

    # static never proactively routes new sessions away from degrading nodes
    return decisions, set(), capacity
