"""Cost + incident accounting for the AI-vs-static comparison.

Each tick both schedulers declare a provisioned node count; we bill both at the
same per-node rate and count player-facing incidents. The AI path is cheaper
(capacity tracks forecast demand + a small buffer) and suffers fewer incidents
(it routes new sessions away from degrading nodes); the static path over-provisions
yet still takes incidents because it keeps routing onto nodes that are failing.
"""
from __future__ import annotations

import math

import config as C


class CostTracker:
    def __init__(self):
        self.cost_ai = 0.0
        self.cost_static = 0.0
        self.inc_ai = 0
        self.inc_static = 0
        self.series_ai: list[float] = []      # cumulative spend
        self.series_static: list[float] = []
        self.series_saved: list[float] = []   # cumulative avoided spend
        self.util_ai: list[float] = []        # % utilization
        self.util_static: list[float] = []
        self.active_ai_sum = 0.0              # running sum for the energy comparison
        self.active_static_sum = 0.0
        self.energy_ticks = 0

    def update(self, demand, cap_ai, cap_static, critical_nodes, rerouted):
        needed = math.ceil(demand / 100.0 * C.MAX_NODES)

        # billing
        self.cost_ai += cap_ai * C.NODE_COST_PER_TICK
        self.cost_static += cap_static * C.NODE_COST_PER_TICK

        # energy comparison: how many nodes each scheduler runs on average.
        # Uses the same cap_ai/cap_static targets as billing (computed every
        # tick regardless of which scheduler is live), so it stays a fair,
        # always-on hypothetical rather than reverting to 64 whenever the
        # other scheduler is actually driving the visible cluster.
        self.active_ai_sum += cap_ai
        self.active_static_sum += cap_static
        self.energy_ticks += 1

        # incidents: AI only takes a hit on a critical node it did NOT reroute;
        # static takes a hit on every critical node (no health-aware routing).
        ai_unhandled = [n for n in critical_nodes if n not in rerouted]
        self.inc_ai += len(ai_unhandled)
        self.inc_static += len(critical_nodes)
        # under-provisioning incidents (AI can occasionally clip a spike)
        if needed > cap_ai:
            self.inc_ai += 1
        if needed > cap_static:
            self.inc_static += 1

        # utilization = demand-driven need vs provisioned capacity
        self.util_ai.append(round(min(100.0, needed / max(1, cap_ai) * 100.0), 1))
        self.util_static.append(round(min(100.0, needed / max(1, cap_static) * 100.0), 1))
        self.series_ai.append(round(self.cost_ai, 1))
        self.series_static.append(round(self.cost_static, 1))
        self.series_saved.append(round(self.cost_static - self.cost_ai, 1))
        for s in (self.series_ai, self.series_static, self.series_saved,
                  self.util_ai, self.util_static):
            if len(s) > C.HISTORY_LEN:
                s.pop(0)

    def savings_pct(self) -> int:
        if self.cost_static <= 0:
            return 0
        return round((1 - self.cost_ai / self.cost_static) * 100)

    def energy_snapshot(self) -> dict:
        avg_ai = self.active_ai_sum / self.energy_ticks if self.energy_ticks else 0.0
        avg_static = self.active_static_sum / self.energy_ticks if self.energy_ticks else 0.0
        saved_pct = round((1 - avg_ai / avg_static) * 100) if avg_static else 0
        return {
            "avg_active_ai": round(avg_ai, 1),
            "avg_active_static": round(avg_static, 1),
            "energy_saved_pct": saved_pct,
        }

    def snapshot(self) -> dict:
        return {
            "cost_ai": round(self.cost_ai, 1),
            "cost_static": round(self.cost_static, 1),
            "saved": round(self.cost_static - self.cost_ai, 1),
            "savings_pct": self.savings_pct(),
            "incidents_ai": self.inc_ai,
            "incidents_static": self.inc_static,
            "series_ai": list(self.series_ai),
            "series_static": list(self.series_static),
            "series_saved": list(self.series_saved),
            "util_ai": self.util_ai[-1] if self.util_ai else 0,
            "util_static": self.util_static[-1] if self.util_static else 0,
        }
