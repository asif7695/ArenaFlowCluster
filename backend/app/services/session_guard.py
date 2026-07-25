"""Session Safety and Scale-Down Guard.

Wraps consolidation.plan_offline() (left unmodified) with live-match safety:

  - PARK candidates that still hold live sessions are diverted into a
    `draining` state instead of being parked immediately — engine.py stops
    routing new matches there (via a status override applied before
    scheduler_ai.plan()/consolidation run) while existing matches finish
    naturally. Once a draining node's sessions reach zero, it's promoted to
    real PARK.
  - Forced REPAIR ("must go now", health-critical) still takes the node
    offline this tick regardless — health can't wait — but its live matches
    are migrated to a healthy node with spare capacity when one exists, or
    counted as impacted ("finished") when none does. Either way the outcome
    is recorded on the decision. A node already draining escalates straight
    to forced repair the moment its risk crosses the cutoff, same as any
    other node.

This module only reasons over the same per-tick node dicts consolidation.py
already uses (node_id, label, status, active_sessions, capacity,
failure_risk_score, forecast_sessions_next_5min) plus the current draining
set — it never touches the simulator. It returns *decisions* plus a list of
`migration_events` describing what should happen to matches; engine.py is
responsible for calling simulator get_matches/transplant_matches/
clear_matches to actually carry them out.
"""
from __future__ import annotations

from app import config as C
from app.services import consolidation

GUARD_LABEL = "GUARD"


def guard_offline_plan(nodes: list[dict], target_active: int,
                        current_offline: dict[str, dict], current_draining: dict[str, dict],
                        timestamp: str, park_step: int | None = None,
                        repair_ticks: int | None = None
                        ) -> tuple[dict[str, dict], dict[str, dict], list[dict], list[dict]]:
    """Returns (new_offline, new_draining, decisions, migration_events).

    `current_draining` — {node_id: {"since": ticks}}, aged by engine.py the
    same way `current_offline` already is.
    `migration_events` — [{"kind": "migrate"|"finish", "source": node_id,
    "dest": node_id|None, "players": int}] — only entries with players > 0,
    so engine.py never needs to call the simulator for a no-op.
    """
    by_id = {n["node_id"]: n for n in nodes}
    label_to_id = {n["label"]: n["node_id"] for n in nodes}
    new_draining = dict(current_draining)
    decisions: list[dict] = []
    migration_events: list[dict] = []
    offline_base = dict(current_offline)

    # 1) promote nodes that finished draining (0 active sessions) to real
    #    PARK before delegating.
    for nid in list(new_draining):
        node = by_id.get(nid)
        if node is not None and node["active_sessions"] == 0:
            del new_draining[nid]
            offline_base[nid] = {"reason": "park", "since": 0}
            label = node["label"]
            decisions.append({
                "timestamp": timestamp, "action": "scale_down", "label": "PARK",
                "target_node": label,
                "reason": f"{label} finished draining — 0 active players, now resting",
                "confidence": 90, "mode": "ai", "outcome": "drained", "players": 0,
            })

    # 1b) a still-draining node whose risk crosses the cutoff can't keep
    #     waiting — escalate it straight to forced repair, same urgency as
    #     any other node. Must happen before consolidation runs, since step 2
    #     below hides still-draining nodes from consolidation's own repair
    #     check (see the comment there).
    for nid in list(new_draining):
        node = by_id.get(nid)
        if node is not None and node["failure_risk_score"] >= C.FAIL_CUTOFF:
            del new_draining[nid]
            offline_base[nid] = {"reason": "repair", "since": 0}
            label = node["label"]
            decisions.append({
                "timestamp": timestamp, "action": "scale_down", "label": "DRAIN",
                "target_node": label,
                "reason": f"failure risk {node['failure_risk_score']:.0%} on {label} — "
                          f"draining offline for repair (was waiting on a live match)",
                "confidence": round(85 + node["failure_risk_score"] * 14), "mode": "ai",
            })

    # 2) delegate to the untouched consolidation policy. Nodes still draining
    #    are passed in as synthetic PARK entries purely so consolidation's
    #    energy-target arithmetic (desired_offline vs current_parked) counts
    #    them as already "spoken for" — otherwise it would try to park a
    #    fresh batch of replacement candidates every tick, since a draining
    #    node is never actually in new_offline, causing a runaway draining
    #    spiral. The synthetic `since` value is irrelevant: any decision
    #    consolidation makes about these nodes (e.g. a WAKE) is discarded
    #    below, since new_draining remains the sole source of truth for them.
    consolidation_input = dict(offline_base)
    for nid in new_draining:
        consolidation_input.setdefault(nid, {"reason": "park", "since": 0})

    raw_offline, raw_decisions = consolidation.plan_offline(
        nodes, target_active, consolidation_input, timestamp, park_step, repair_ticks)
    new_offline = {nid: v for nid, v in raw_offline.items() if nid not in new_draining}

    # 3) veto any NEW park with live sessions -> draining instead of offline;
    #    discard any decision consolidation made about an already-draining
    #    node (synthetic bookkeeping only, not a real transition).
    for d in raw_decisions:
        nid = label_to_id.get(d["target_node"])
        if nid in new_draining:
            continue
        if d["label"] == "PARK":
            sess = by_id.get(nid, {}).get("active_sessions", 0) if nid else 0
            if nid and sess > 0:
                new_offline.pop(nid, None)
                new_draining[nid] = {"since": 0}
                decisions.append({
                    **d, "label": GUARD_LABEL,
                    "reason": f"{d['target_node']} has {sess} active players — "
                              f"blocking scale-down, draining instead of parking",
                    "outcome": "blocked", "players": sess,
                })
                continue
        decisions.append({**d, "outcome": d.get("outcome"), "players": d.get("players", 0)})

    # 4) enrich forced-REPAIR (DRAIN) decisions with migrate-or-finish.
    #    `reserved` tracks players already earmarked onto a destination this
    #    tick so two simultaneous drains never double-book the same node.
    reserved: dict[str, int] = {}
    for d in decisions:
        if d["label"] != "DRAIN" or d.get("outcome") is not None:
            continue
        nid = label_to_id.get(d["target_node"])
        sess = by_id.get(nid, {}).get("active_sessions", 0) if nid else 0
        if not nid or sess == 0:
            d["outcome"], d["players"] = "finished", 0
            continue

        def spare(n):
            return n["capacity"] - n["active_sessions"] - reserved.get(n["node_id"], 0)

        candidates = [
            n for n in nodes
            if n["node_id"] != nid and n["status"] == "healthy"
            and n["node_id"] not in new_offline and n["node_id"] not in new_draining
            and spare(n) >= sess
        ]
        if candidates:
            dest = max(candidates, key=spare)
            reserved[dest["node_id"]] = reserved.get(dest["node_id"], 0) + sess
            d["outcome"], d["players"] = "migrated", sess
            d["reason"] = d["reason"] + f" — migrating {sess} players live to {dest['label']}"
            migration_events.append({"kind": "migrate", "source": nid,
                                      "dest": dest["node_id"], "players": sess})
        else:
            d["outcome"], d["players"] = "finished", sess
            d["reason"] = d["reason"] + f" — no node had spare capacity; {sess} players affected"
            migration_events.append({"kind": "finish", "source": nid,
                                      "dest": None, "players": sess})

    # 5) reconcile: a node can never be in both offline and draining.
    for nid in new_offline:
        new_draining.pop(nid, None)

    return new_offline, new_draining, decisions, migration_events
