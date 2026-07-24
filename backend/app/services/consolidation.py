"""Predictive node parking (consolidation) — pure, unit-testable policy.

Decides which nodes should be offline this tick and why, given the current
offline set and a target number of *active* nodes. Two independent reasons
feed into one offline set, both shown grey in the matrix but distinct in the
decision log:

  - REPAIR (forced): any node at/above the failure cutoff is drained
    immediately — health-aware, one step further than route_away (the node is
    taken fully out of service to "heal", not just avoided). It returns to
    service automatically after config.REPAIR_TICKS.
  - PARK (energy, optional): to hit the energy target, the lowest predicted-
    load HEALTHY nodes are parked to rest — reversible, purely about avoiding
    idle compute cost. Movement toward the target is capped at PARK_STEP nodes
    per tick (hysteresis) so the cluster doesn't thrash.

This module only decides *what should happen*; engine.py owns the offline
state across ticks and feeds the result into the simulator. The static
scheduler never calls this — see engine.py's mode gating.
"""
from __future__ import annotations

from app import config as C

REPAIR_REASON = "repair"
PARK_REASON = "park"

_ACTION_LABELS = {"park": "PARK", "wake": "WAKE", "drain": "DRAIN"}


def _decision(kind: str, contract_action: str, target: str, reason: str,
               confidence: int, timestamp: str) -> dict:
    return {
        "timestamp": timestamp,
        "action": contract_action,        # scale_up | scale_down (data contract)
        "label": _ACTION_LABELS[kind],     # PARK | WAKE | DRAIN (design-facing)
        "target_node": target,
        "reason": reason,
        "confidence": confidence,
        "mode": "ai",
    }


def plan_offline(nodes: list[dict], target_active: int, current_offline: dict[str, dict],
                  timestamp: str, park_step: int | None = None,
                  repair_ticks: int | None = None) -> tuple[dict[str, dict], list[dict]]:
    """Decide the next offline set and emit PARK/WAKE/DRAIN decisions.

    `nodes` — this tick's node dicts (node_id, label, status,
    failure_risk_score, forecast_sessions_next_5min, ...).
    `current_offline` — {node_id: {"reason": "park"|"repair", "since": ticks}}
    carried over from the previous tick (engine ages `since` before calling).
    `target_active` — desired number of online nodes this tick (from scheduler
    capacity). Returns (new_offline, decisions).
    """
    park_step = park_step if park_step is not None else C.PARK_STEP
    repair_ticks = repair_ticks if repair_ticks is not None else C.REPAIR_TICKS
    by_id = {n["node_id"]: n for n in nodes}
    decisions: list[dict] = []
    new_offline = dict(current_offline)

    # 1) Repaired nodes that have healed long enough return to service.
    healed = [nid for nid, v in new_offline.items()
              if v["reason"] == REPAIR_REASON and v["since"] >= repair_ticks]
    for nid in healed:
        label = by_id.get(nid, {}).get("label", nid)
        del new_offline[nid]
        decisions.append(_decision(
            "wake", "scale_up", label,
            f"{label} completed repair cycle — returning to service healthy",
            90, timestamp,
        ))

    # 2) REPAIR (forced): any currently-online node at/above the failure
    #    cutoff is drained immediately, regardless of the energy target.
    for n in nodes:
        nid = n["node_id"]
        if nid in new_offline:
            continue
        if n["failure_risk_score"] >= C.FAIL_CUTOFF:
            new_offline[nid] = {"reason": REPAIR_REASON, "since": 0}
            decisions.append(_decision(
                "drain", "scale_down", n["label"],
                f"failure risk {n['failure_risk_score']:.0%} on {n['label']} — "
                f"draining offline for repair",
                round(85 + n["failure_risk_score"] * 14), timestamp,
            ))

    # 3) Energy parking: hit the target active count by parking/waking
    #    healthy nodes, moving at most `park_step` per tick.
    n_total = len(nodes)
    repaired_count = sum(1 for v in new_offline.values() if v["reason"] == REPAIR_REASON)
    target = max(C.MIN_ACTIVE_NODES, target_active)
    desired_offline = max(0, n_total - target - repaired_count)
    parked_ids = [nid for nid, v in new_offline.items() if v["reason"] == PARK_REASON]
    current_parked = len(parked_ids)

    if current_parked < desired_offline:
        candidates = [n for n in nodes
                      if n["node_id"] not in new_offline and n["status"] == "healthy"]
        candidates.sort(key=lambda x: x["forecast_sessions_next_5min"])
        room = desired_offline - current_parked
        for n in candidates[:min(park_step, room)]:
            new_offline[n["node_id"]] = {"reason": PARK_REASON, "since": 0}
            decisions.append(_decision(
                "park", "scale_down", n["label"],
                f"demand low — parking {n['label']} to rest "
                f"(predicted {n['forecast_sessions_next_5min']} sessions)",
                80, timestamp,
            ))
    elif current_parked > desired_offline:
        # wake the longest-parked first (fairness / even wear)
        wakeable = sorted(parked_ids, key=lambda nid: -new_offline[nid]["since"])
        room = current_parked - desired_offline
        for nid in wakeable[:min(park_step, room)]:
            label = by_id.get(nid, {}).get("label", nid)
            del new_offline[nid]
            decisions.append(_decision(
                "wake", "scale_up", label,
                f"forecast demand rising — waking {label} ahead of the ramp",
                88, timestamp,
            ))

    return new_offline, decisions
