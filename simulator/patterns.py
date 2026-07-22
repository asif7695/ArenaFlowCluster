"""Demand + failure signal generators.

Ported from the dashboard design's client-side reference simulation so the
Python backend produces the same shape of traffic the design was built against:

    cluster demand = 52 + amp*sin(t/13) + 8*sin(t/4) + spike + noise   (clamped 5..100)

`amp` (and spike behaviour) depend on the traffic scenario, letting the
AI-vs-static comparison be exercised under steady / peak / tournament-spike load.
"""
from __future__ import annotations

import math
import random

# scenario -> base amplitude of the daily-cycle sine wave
SCENARIO_AMP = {"steady": 9.0, "peak": 24.0, "spike": 32.0}


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


class DemandModel:
    """Stateful cluster-wide demand generator with occasional traffic spikes."""

    def __init__(self, scenario: str = "peak", seed: int | None = None):
        self.scenario = scenario if scenario in SCENARIO_AMP else "peak"
        self.rng = random.Random(seed)
        self._spike_ticks = 0

    def set_scenario(self, scenario: str) -> None:
        if scenario in SCENARIO_AMP:
            self.scenario = scenario

    def demand(self, t: int) -> float:
        """Cluster demand index (0-100) at tick t."""
        amp = SCENARIO_AMP[self.scenario]
        spike = 0.0
        if self.scenario == "spike" and self._spike_ticks <= 0 and self.rng.random() < 0.11:
            self._spike_ticks = 6
        if self._spike_ticks > 0:
            spike = 24.0 * (self._spike_ticks / 6.0)  # decaying burst
            self._spike_ticks -= 1
        base = (
            52.0
            + amp * math.sin(t / 13.0)
            + 8.0 * math.sin(t / 4.0)
            + spike
            + self.rng.uniform(-4.0, 4.0)
        )
        return clamp(base, 5.0, 100.0)

    def forecast(self, t: int, horizon: int) -> list[float]:
        """Noise-light look-ahead of demand for the next `horizon` ticks.

        Uses the deterministic sine component (what a forecaster can actually
        learn) rather than the random spike/noise, so it represents an
        achievable prediction of near-future demand.
        """
        amp = SCENARIO_AMP[self.scenario]
        out = []
        for k in range(1, horizon + 1):
            v = (
                52.0
                + amp * math.sin((t + k) / 13.0)
                + 8.0 * math.sin((t + k) / 4.0)
                + self.rng.uniform(-3.0, 3.0)
            )
            out.append(clamp(v, 5.0, 100.0))
        return out
