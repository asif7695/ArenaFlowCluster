"""Tunable knobs for the scheduler / cost engine.

These correspond to the sliders that exist in the dashboard design's internal
state (horizon / degrade / fail / buffer). They live here as backend config
rather than a settings screen (see plan deviation #4).
"""
from __future__ import annotations

# --- engine ---
TICK_INTERVAL_SEC = 1.6           # background tick cadence (matches design)
HISTORY_LEN = 48                  # points kept for time-series charts

# --- forecasting / prediction ---
FORECAST_HORIZON_TICKS = 10       # ~5 min ahead at 30s/tick (matches ml.features)

# --- display status thresholds (5-level matrix colouring) ---
WARNING_PCT = 66.0                # cpu above -> warning
DEGRADE_PCT = 78.0                # cpu above -> degraded
FAIL_CUTOFF = 0.60               # failure_risk_score above -> critical
CRITICAL_LATENCY_MS = 175.0      # latency above -> critical

# --- AI scheduler ---
ROUTE_AWAY_RISK = 0.40           # route new sessions away from nodes above this risk
CAPACITY_BUFFER_PCT = 15         # headroom AI keeps above forecast demand
MAX_NODES = 64
MIN_NODES = 8

# --- static baseline (HPA-like) ---
STATIC_FLOOR_NODES = 58          # over-provisioned fixed floor
STATIC_CPU_THRESHOLD = 80.0      # only reacts once cpu crosses this
STATIC_LATENCY_THRESHOLD = 150.0

# --- cost ---
NODE_COST_PER_TICK = 0.85        # $ per provisioned node per tick

# --- predictive node parking (consolidation, AI mode only) ---
PARK_STEP = 2                    # max nodes parked or woken per tick (anti-thrash)
MIN_ACTIVE_NODES = 20            # never park below this many active nodes
REPAIR_TICKS = 10                # ticks a drained failing node stays offline to heal

# --- Kubernetes execution (opt-in via K8S_ENABLED=1; AI mode only) ---
# The kind cluster is a scaled-down live mirror of the 64-node simulated fleet:
# a laptop can't run 64 pods, so the AI scheduler's capacity (8..64) is mapped
# proportionally onto a real Deployment's replica count (1..K8S_MAX_REPLICAS).
K8S_NAMESPACE = "arenaflow"
K8S_DEPLOYMENT = "arenaflow-gameserver"
K8S_MAX_REPLICAS = 8             # cap on real pods (fits a local kind cluster)
K8S_NODE_DIVISOR = 8             # replicas = clamp(round(cap_ai / this), 1, MAX)


def replicas_for(cap_ai: int) -> int:
    """Map simulated AI capacity (MIN_NODES..MAX_NODES) to real pod replicas."""
    return max(1, min(K8S_MAX_REPLICAS, round(cap_ai / K8S_NODE_DIVISOR)))


def status_for(cpu_pct: float, latency_ms: float, risk: float) -> str:
    """Map telemetry + failure risk to the dashboard's 5-level status."""
    if risk >= FAIL_CUTOFF or latency_ms >= CRITICAL_LATENCY_MS:
        return "critical"
    if cpu_pct >= DEGRADE_PCT or risk >= ROUTE_AWAY_RISK:
        return "degraded"
    if cpu_pct >= WARNING_PCT:
        return "warning"
    return "healthy"
