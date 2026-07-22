"""ArenaFlowCluster traffic/telemetry simulator.

Generates node-level metrics (cpu %, memory %, active sessions, latency ms) for
all 64 nodes on a repeating tick. Traffic follows a daily-cycle-like sine
pattern with random spikes (see patterns.DemandModel). One node carries a
deliberately *planted failure ramp* — its CPU and latency climb steadily over a
window of ticks — so the anomaly model has a real, learnable signal to catch.

Run standalone to emit sample data:

    python simulator.py --ticks 200 --out sample_telemetry.json
    python simulator.py --ticks 20 --pretty          # print to stdout
"""
from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from patterns import DemandModel, clamp
from nodes import ROSTER, NodeSpec

# Emitted telemetry keys (the data contract). Ground-truth fields are kept
# separate on the internal state and only exposed via tick(with_truth=True).
TELEMETRY_FIELDS = ("node_id", "timestamp", "cpu_pct", "mem_pct", "active_sessions", "latency_ms")

TICK_SECONDS = 30  # each tick represents 30s of wall-clock in the emitted timestamps

# Cap on how much load rises on the remaining active nodes when others are
# parked (predictive consolidation) — the same cluster-wide demand is now
# served by fewer nodes, so each active node runs hotter, but this is capped
# so consolidation doesn't manufacture false criticals on its own.
CONSOLIDATION_FACTOR_MAX = 1.7


@dataclass
class NodeState:
    spec: NodeSpec
    base: float
    load: float
    anom: int = 0            # remaining ticks of an active (random) anomaly window
    planted: bool = False    # this node carries the deterministic failure ramp
    ramp: int = 0            # remaining ticks of the planted ramp
    fp_true: float = 0.0     # ground-truth internal failure pressure (0..1)
    # last emitted metrics
    cpu: float = 40.0
    mem: float = 45.0
    sessions: int = 0
    latency: float = 40.0


class ClusterSimulator:
    """Stateful 64-node cluster. Call tick() once per step."""

    def __init__(self, scenario: str = "peak", seed: int | None = 7,
                 planted_node_index: int = 27, route_away_fp: float = 0.4):
        self.rng = random.Random(seed)
        self.demand_model = DemandModel(scenario, seed=None if seed is None else seed + 1)
        self.route_away_fp = route_away_fp
        self.t = 0
        self._start = datetime.now(timezone.utc)
        self.nodes: list[NodeState] = [
            NodeState(spec=s, base=self.rng.uniform(28, 62), load=self.rng.uniform(30, 55))
            for s in ROSTER
        ]
        # plant the failure ramp on one node (default C4-ish, index 27)
        self.planted_index = planted_node_index % len(self.nodes)
        self.nodes[self.planted_index].planted = True

    # -- control hooks used by the backend engine --------------------------
    def set_scenario(self, scenario: str) -> None:
        self.demand_model.set_scenario(scenario)

    def demand(self) -> float:
        return self._last_demand

    def timestamp(self) -> str:
        return (self._start + timedelta(seconds=self.t * TICK_SECONDS)).isoformat()

    # -- main step ---------------------------------------------------------
    def tick(self, rerouted: set[str] | None = None, offline: set[str] | None = None,
             repairing: set[str] | None = None, active_count: int | None = None,
             with_truth: bool = False) -> list[dict]:
        """Advance one tick and return telemetry records for all nodes.

        `rerouted` is an optional set of node_ids the scheduler has steered new
        sessions away from this tick (health-aware routing feedback); their load
        is relieved. `offline` is the set of node_ids currently parked (resting)
        or drained (repair) — they carry no traffic and idle metrics; their
        failure pressure is frozen (parked) or actively healed (repairing).
        `active_count` lets the caller state how many of the 64 nodes are
        actually serving traffic this tick, so the *same* cluster-wide demand
        concentrates onto fewer nodes (predictive consolidation) instead of
        silently vanishing when nodes are taken offline. `with_truth=True` also
        attaches ground-truth failure fields used for training/evaluation
        (never part of the wire contract). None of these new parameters are
        used by generate()/dataset.py's training path, so existing trained
        models remain valid.
        """
        self.t += 1
        rerouted = rerouted or set()
        offline = offline or set()
        repairing = repairing or set()
        demand = self.demand_model.demand(self.t)
        self._last_demand = demand
        ts = self.timestamp()

        active_n = active_count if active_count else (len(self.nodes) - len(offline))
        factor = clamp(len(self.nodes) / max(1, active_n), 1.0, CONSOLIDATION_FACTOR_MAX)

        records: list[dict] = []
        for n in self.nodes:
            is_offline = n.spec.node_id in offline
            is_repair = n.spec.node_id in repairing

            if is_offline:
                # resting or under repair: no traffic, idle metrics. A parked
                # node's failure pressure decays gently (nothing to heal); a
                # repairing node is actively driven back toward healthy.
                n.load = clamp(n.load * 0.5, 0.0, 100.0)
                n.cpu = clamp(2.0 + self.rng.uniform(-1, 1), 0, 8)
                n.mem = clamp(6.0 + self.rng.uniform(-1, 1), 0, 12)
                n.sessions = 0
                n.latency = round(4 + self.rng.uniform(0, 3))
                n.fp_true = max(0.0, n.fp_true - (0.16 if is_repair else 0.03))
            else:
                self._advance_failure_pressure(n)
                target = clamp((n.base + (demand - 52.0) * 0.85) * factor + self.rng.uniform(-6, 6), 3, 100)
                n.load += (target - n.load) * 0.34
                if n.spec.node_id in rerouted:
                    n.load *= 0.6  # relieved by health-aware routing
                n.load = clamp(n.load, 2, 100)

                n.cpu = clamp(n.load + self.rng.uniform(-5, 5), 1, 100)
                n.mem = clamp(n.load * 0.82 + 12 + self.rng.uniform(-4, 4), 5, 100)
                n.latency = round(16 + n.load * 0.7 + n.fp_true * 145 + self.rng.uniform(-3, 5))
                n.sessions = round(n.load / 100.0 * n.spec.capacity)

            rec = {
                "node_id": n.spec.node_id,
                "timestamp": ts,
                "cpu_pct": round(n.cpu, 1),
                "mem_pct": round(n.mem, 1),
                "active_sessions": n.sessions,
                "latency_ms": round(n.latency, 1),
            }
            if with_truth:
                # ground-truth degradation label: internal pressure high enough
                # that the node is genuinely trending to failure this tick.
                rec["_failing"] = 1 if n.fp_true > 0.4 else 0
                rec["_fp_true"] = round(n.fp_true, 3)
            records.append(rec)
        return records

    def _advance_failure_pressure(self, n: NodeState) -> None:
        """Evolve a node's internal failure pressure (ground truth).

        The planted node follows a deterministic ramp on a fixed cadence so the
        anomaly model always has a clean example; every node can also enter a
        shorter random anomaly window.
        """
        # planted deterministic ramp: fire roughly every 60 ticks, climb ~10 ticks
        if n.planted and n.ramp <= 0 and self.t % 60 == 12:
            n.ramp = 11
        if n.ramp > 0:
            n.ramp -= 1
            n.fp_true = min(1.0, n.fp_true + 0.085)
            return

        if n.anom > 0:
            n.anom -= 1
            n.fp_true = min(1.0, n.fp_true + self.rng.uniform(0.03, 0.09))
        else:
            n.fp_true = max(0.0, n.fp_true - 0.045)
            if self.rng.random() < 0.007:
                n.anom = round(self.rng.uniform(5, 12))


def generate(ticks: int, scenario: str, seed: int | None, with_truth: bool = False) -> list[dict]:
    sim = ClusterSimulator(scenario=scenario, seed=seed)
    out: list[dict] = []
    for _ in range(ticks):
        out.extend(sim.tick(with_truth=with_truth))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="ArenaFlowCluster telemetry simulator")
    ap.add_argument("--ticks", type=int, default=200)
    ap.add_argument("--scenario", choices=["steady", "peak", "spike"], default="peak")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default=None, help="write JSON here (default: stdout)")
    ap.add_argument("--truth", action="store_true", help="include ground-truth failure labels")
    ap.add_argument("--pretty", action="store_true")
    args = ap.parse_args()

    data = generate(args.ticks, args.scenario, args.seed, with_truth=args.truth)
    text = json.dumps(data, indent=2 if args.pretty else None)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        planted = ROSTER[27].label
        print(f"wrote {len(data)} records ({args.ticks} ticks x 64 nodes) to {args.out}")
        print(f"planted failure ramp on node index 27 ({planted})")
    else:
        print(text)


if __name__ == "__main__":
    main()
