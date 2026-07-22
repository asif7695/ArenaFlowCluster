"""Feature engineering shared by training and live inference.

Both ML models consume the *same* feature vector, built from a short rolling
window of a single node's recent telemetry plus a cyclic time-of-day phase.
Keeping this in one place guarantees the backend computes features at inference
time exactly the way they were computed at training time.
"""
from __future__ import annotations

import math

WINDOW = 6            # rolling-window length in ticks used for means / slopes
HORIZON_TICKS = 10    # forecast target is sessions this many ticks ahead (~5 min @30s/tick)

# Fixed feature order — the vector fed to scikit-learn must always match this.
FEATURE_NAMES = [
    "cpu", "mem", "lat", "sess",
    "sess_mean", "cpu_mean", "lat_mean",
    "sess_delta", "cpu_delta", "lat_delta",
    "sess_slope", "cpu_slope", "lat_slope",
    "tod_sin13", "tod_cos13", "tod_sin4", "tod_cos4",
]


def _mean(v: list[float]) -> float:
    return sum(v) / len(v) if v else 0.0


def _slope(v: list[float]) -> float:
    """Average per-step change across the window (simple trend estimate)."""
    return (v[-1] - v[0]) / max(1, len(v) - 1) if len(v) > 1 else 0.0


def extract_features(window: list[dict], tick: int) -> dict:
    """Build features for the newest record in `window` (oldest..newest, one node)."""
    newest = window[-1]
    prev = window[-2] if len(window) > 1 else newest
    sess = [r["active_sessions"] for r in window]
    cpu = [r["cpu_pct"] for r in window]
    lat = [r["latency_ms"] for r in window]

    return {
        "cpu": newest["cpu_pct"],
        "mem": newest["mem_pct"],
        "lat": newest["latency_ms"],
        "sess": newest["active_sessions"],
        "sess_mean": _mean(sess),
        "cpu_mean": _mean(cpu),
        "lat_mean": _mean(lat),
        "sess_delta": newest["active_sessions"] - prev["active_sessions"],
        "cpu_delta": newest["cpu_pct"] - prev["cpu_pct"],
        "lat_delta": newest["latency_ms"] - prev["latency_ms"],
        "sess_slope": _slope(sess),
        "cpu_slope": _slope(cpu),
        "lat_slope": _slope(lat),
        # cyclic phase of the demand curve (period ~81 and ~25 ticks) — lets the
        # forecaster exploit the daily-cycle structure of traffic.
        "tod_sin13": math.sin(tick / 13.0),
        "tod_cos13": math.cos(tick / 13.0),
        "tod_sin4": math.sin(tick / 4.0),
        "tod_cos4": math.cos(tick / 4.0),
    }


def to_vector(feats: dict) -> list[float]:
    return [feats[name] for name in FEATURE_NAMES]
