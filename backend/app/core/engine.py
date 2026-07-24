"""Background engine: sim -> features -> ML -> both schedulers -> cost -> state.

Runs on its own thread, ticking every config.TICK_INTERVAL_SEC. Each tick it
builds a complete snapshot that the REST layer serves. The *active* scheduler
(ai|static) drives what the live cluster does (e.g. health-aware rerouting is
only applied in ai mode); both schedulers are always scored for the comparison.
"""
from __future__ import annotations

import math
import threading
import time
from collections import deque

import os

from .. import _paths  # noqa: F401  (side effect: sim + ml on sys.path)
from simulator import ClusterSimulator  # type: ignore
from nodes import ROSTER, REGIONS  # type: ignore
from features import WINDOW, FEATURE_NAMES, extract_features, to_vector  # type: ignore
from forecast_model import ForecastModel  # type: ignore
from anomaly_model import AnomalyModel  # type: ignore

from app import config as C
from app.services import scheduler_ai, scheduler_static, consolidation, k8s_executor
from app.services.cost import CostTracker
from app.core.state import STORE

_SESS = FEATURE_NAMES.index("sess")
_LAT = FEATURE_NAMES.index("lat")
_LAT_SLOPE = FEATURE_NAMES.index("lat_slope")


class _HeuristicForecast:
    """Fallback when trained model is absent: naive persistence + small growth."""
    def predict(self, X):
        return [row[_SESS] * 1.05 for row in X]


class _HeuristicAnomaly:
    """Fallback: latency-trend rule mapped to a 0..1 risk score."""
    threshold = C.ROUTE_AWAY_RISK

    def risk_scores(self, X):
        out = []
        for row in X:
            s = max(0.0, (row[_LAT] - 120.0) / 120.0) + max(0.0, row[_LAT_SLOPE]) * 0.04
            out.append(min(1.0, s))
        return out


def _load_models():
    """Trained models if available (and not forced off), else heuristics."""
    if os.environ.get("USE_MOCK") == "1":
        return _HeuristicForecast(), _HeuristicAnomaly(), "heuristic (USE_MOCK=1)"
    try:
        return ForecastModel.load(), AnomalyModel.load(), "trained"
    except Exception:
        return _HeuristicForecast(), _HeuristicAnomaly(), "heuristic (models not trained)"


class Engine:
    def __init__(self):
        self.sim = ClusterSimulator(scenario="peak", seed=7)
        self.forecast, self.anomaly, self.model_mode = _load_models()
        self.cost = CostTracker()

        n = len(ROSTER)
        self.windows: list[deque] = [deque(maxlen=WINDOW) for _ in range(n)]
        self.cpu_hist: list[deque] = [deque(maxlen=C.HISTORY_LEN) for _ in range(n)]
        self.lat_hist: list[deque] = [deque(maxlen=C.HISTORY_LEN) for _ in range(n)]
        self.demand_hist: deque = deque(maxlen=C.HISTORY_LEN)

        self.alerts: list[dict] = []
        self.log_ai: deque = deque(maxlen=60)
        self.log_static: deque = deque(maxlen=60)
        self.scale_log: deque = deque(maxlen=12)
        self._alert_id = 0
        self._prev_status = ["healthy"] * n
        self._last_rerouted: set[str] = set()
        self._prev_demand = 52.0

        # predictive node parking (AI mode only): node_id -> {"reason","since"}
        self.offline: dict[str, dict] = {}

        # optional real-cluster execution (opt-in via K8S_ENABLED=1). Defensive:
        # None when disabled, and a no-op executor if no cluster is reachable —
        # the pure-simulation demo never depends on it.
        self.k8s = k8s_executor.maybe_create(os.environ.get("K8S_ENABLED") == "1")

        # control (driven by POST /control from the dashboard)
        self.running = True
        self.mode = "ai"        # active scheduler shown live
        self.scenario = "peak"

        self._thread: threading.Thread | None = None

    # ---------------------------------------------------------------- control
    def apply_control(self, running=None, mode=None, scenario=None):
        if running is not None:
            self.running = bool(running)
        if mode in ("ai", "static"):
            if mode == "static" and self.mode != "static":
                # static never consolidates or health-drains — switching to it
                # brings the whole fleet back online immediately.
                self.offline = {}
            self.mode = mode
        if scenario in ("steady", "peak", "spike"):
            self.scenario = scenario
            self.sim.set_scenario(scenario)

    def start(self):
        if self._thread:
            return
        # provision the real workload once (idempotent no-op when K8s is off/unreachable)
        if self.k8s:
            self.k8s.ensure_workload()
        # warm up so the first response already has history + trained context
        for _ in range(WINDOW + 12):
            self._tick()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):
        while True:
            if self.running:
                self._tick()
            time.sleep(C.TICK_INTERVAL_SEC)

    # ------------------------------------------------------------------- tick
    def _tick(self):
        # age currently-offline nodes before deciding anything new this tick
        for v in self.offline.values():
            v["since"] += 1

        # offline only has real effect in AI mode (static never consolidates;
        # self.offline is guaranteed empty there — enforced in apply_control)
        offline_ids = set(self.offline.keys()) if self.mode == "ai" else set()
        repairing_ids = {nid for nid, v in self.offline.items() if v["reason"] == "repair"} \
            if self.mode == "ai" else set()
        active_hint = len(ROSTER) - len(offline_ids)

        applied = self._last_rerouted if self.mode == "ai" else set()
        recs = self.sim.tick(rerouted=applied, offline=offline_ids, repairing=repairing_ids,
                             active_count=active_hint if active_hint else None)
        t = self.sim.t
        demand = self.sim.demand()
        self.demand_hist.append(round(demand, 1))
        ts = recs[0]["timestamp"]

        # Build features for all online nodes and run ONE batched model call
        # each (instead of 64 individual predict() calls — sklearn's per-call
        # overhead dominates for single-row inputs, ~40x slower in aggregate
        # than batching the same 64 rows together).
        nodes: list[dict | None] = []
        online_indices: list[int] = []
        online_vecs: list[list[float]] = []
        for i, rec in enumerate(recs):
            spec = ROSTER[i]
            self.windows[i].append(rec)
            self.cpu_hist[i].append(round(rec["cpu_pct"], 1))
            self.lat_hist[i].append(round(rec["latency_ms"], 1))

            if spec.node_id in offline_ids:
                # resting or under repair: skip ML inference, force display
                nodes.append({
                    "node_id": spec.node_id, "label": spec.label, "region": spec.region,
                    "capacity": spec.capacity,
                    "cpu_pct": rec["cpu_pct"], "mem_pct": rec["mem_pct"],
                    "active_sessions": 0, "latency_ms": rec["latency_ms"],
                    "forecast_sessions_next_5min": 0, "failure_risk_score": 0.0,
                    "status": "offline",
                    "offline_reason": self.offline[spec.node_id]["reason"],
                })
                continue

            nodes.append(None)  # placeholder, filled in below after batch predict
            online_indices.append(i)
            online_vecs.append(to_vector(extract_features(list(self.windows[i]), t)))

        fsess_batch = self.forecast.predict(online_vecs) if online_vecs else []
        risk_batch = self.anomaly.risk_scores(online_vecs) if online_vecs else []

        total_forecast = 0
        total_sessions = 0
        for j, i in enumerate(online_indices):
            spec = ROSTER[i]
            rec = recs[i]
            fsess = int(round(max(0.0, float(fsess_batch[j]))))
            risk = float(risk_batch[j])
            status = C.status_for(rec["cpu_pct"], rec["latency_ms"], risk)
            total_forecast += fsess
            total_sessions += rec["active_sessions"]
            nodes[i] = {
                "node_id": spec.node_id, "label": spec.label, "region": spec.region,
                "capacity": spec.capacity,
                "cpu_pct": rec["cpu_pct"], "mem_pct": rec["mem_pct"],
                "active_sessions": rec["active_sessions"], "latency_ms": rec["latency_ms"],
                "forecast_sessions_next_5min": fsess,
                "failure_risk_score": round(risk, 3),
                "status": status,
            }

        # cluster demand forecast (ML per-node forecasts aggregated to an index)
        ratio = total_forecast / max(1, total_sessions)
        forecast_peak = min(100.0, demand * ratio)
        predicted_series = self.sim.demand_model.forecast(t, C.FORECAST_HORIZON_TICKS)

        # schedulers (both scored; active one drives live routing next tick)
        dec_ai, rerouted, cap_ai = scheduler_ai.plan(nodes, demand, self._prev_demand, forecast_peak, ts)
        dec_static, _, cap_static = scheduler_static.plan(nodes, demand, self._prev_demand, forecast_peak, ts)
        self._last_rerouted = rerouted

        # predictive node parking — AI mode only; decides offline state for
        # NEXT tick (mirrors how `rerouted` feedback already applies with a
        # one-tick lag). Folded into this tick's AI decision batch.
        if self.mode == "ai":
            self.offline, park_decisions = consolidation.plan_offline(
                nodes, target_active=cap_ai, current_offline=self.offline, timestamp=ts)
            dec_ai = dec_ai + park_decisions

            # orchestrator-native execution: mirror AI capacity onto real pods.
            # Rate-limited inside reconcile(); a no-op when K8s is off/unreachable.
            if self.k8s and self.k8s.ok:
                self.k8s.reconcile(
                    cap_ai, [n["label"] for n in nodes if n["status"] == "critical"])

        for d in dec_ai:
            self.log_ai.appendleft(d)
            if d["action"] in ("scale_up", "scale_down"):
                self.scale_log.appendleft(d)
        for d in dec_static:
            self.log_static.appendleft(d)

        # cost + incidents
        critical = {n["node_id"] for n in nodes if n["status"] == "critical"}
        self.cost.update(demand, cap_ai, cap_static, critical, rerouted)

        # alerts on transitions into degraded/critical
        for i, n in enumerate(nodes):
            was, now = self._prev_status[i], n["status"]
            if now in ("degraded", "critical") and was not in ("degraded", "critical"):
                self._push_alert(n, ts)
            self._prev_status[i] = now

        self._prev_demand = demand
        STORE.set(self._snapshot(nodes, demand, forecast_peak, predicted_series,
                                 cap_ai, cap_static, t, ts))

    def _push_alert(self, n, ts):
        self._alert_id += 1
        risk = n["failure_risk_score"]
        if n["status"] == "critical":
            lead = max(1, min(4, round(1 + (1 - risk) * 3)))
            sev, msg = "critical", "failure risk crossed cutoff — draining recommended"
        else:
            lead = max(2, min(9, round(3 + (0.6 - risk) * 14)))
            sev, msg = "degraded", "degradation trend detected in latency + load"
        self.alerts.insert(0, {
            "id": self._alert_id, "severity": sev, "node": n["label"],
            "node_id": n["node_id"], "msg": msg, "lead": f"~{lead}m",
            "confidence": round(78 + risk * 18), "time": ts.split("T")[-1][:8],
            "status": "ACTIVE",
        })
        del self.alerts[18:]

    # --------------------------------------------------------------- snapshot
    def _snapshot(self, nodes, demand, forecast_peak, predicted, cap_ai, cap_static, t, ts):
        counts = {k: 0 for k in ("healthy", "warning", "degraded", "critical", "offline")}
        sess = lat = cpu = mem = risk_sum = risk_max = 0
        for n in nodes:
            counts[n["status"]] += 1
            sess += n["active_sessions"]; lat += n["latency_ms"]
            cpu += n["cpu_pct"]; mem += n["mem_pct"]
            risk_sum += n["failure_risk_score"]; risk_max = max(risk_max, n["failure_risk_score"])
        nn = len(nodes)

        # per-region aggregates for the forecast/cost screens
        region_load = {r: [] for r in REGIONS}
        for n in nodes:
            region_load[n["region"]].append(n["cpu_pct"])
        region_forecast = []
        for r in REGIONS:
            arr = region_load[r] or [0]
            avg = sum(arr) / len(arr)
            proj = max(0.0, min(100.0, avg + (forecast_peak - 52) * 0.5))
            region_forecast.append({"name": r, "value": round(proj)})

        cost = self.cost.snapshot()
        energy = self.cost.energy_snapshot()
        # node history for the inspector
        node_hist = {
            ROSTER[i].node_id: {"cpu": list(self.cpu_hist[i]), "lat": list(self.lat_hist[i])}
            for i in range(nn)
        }
        return {
            "ready": True, "tick": t, "timestamp": ts, "model_mode": self.model_mode,
            "mode": self.mode, "scenario": self.scenario, "running": self.running,
            "capacity_ai": cap_ai, "capacity_static": cap_static,
            "demand": round(demand), "forecast_peak": round(forecast_peak),
            "demand_history": list(self.demand_hist),
            "predicted_demand": [round(v) for v in predicted],
            "nodes": nodes,
            "counts": counts,
            "summary": {
                "active_nodes": nn - counts["offline"], "total_nodes": nn,
                "sessions": sess, "avg_latency": round(lat / nn), "demand_index": round(demand),
                "avg_cpu": round(cpu / nn), "avg_mem": round(mem / nn),
                "avg_risk": round(risk_sum / nn * 100), "max_risk": round(risk_max * 100),
                "healthy": counts["healthy"] + counts["warning"],
                "savings_pct": cost["savings_pct"],
                "nodes_rested": len(self.offline),
                "avg_active_ai": energy["avg_active_ai"],
                "avg_active_static": energy["avg_active_static"],
                "energy_saved_pct": energy["energy_saved_pct"],
            },
            "alerts": list(self.alerts),
            "region_forecast": region_forecast,
            "scale_log": list(self.scale_log),
            "log_ai": list(self.log_ai), "log_static": list(self.log_static),
            "cost": cost,
            "node_history": node_hist,
            "k8s": self.k8s.cluster_state() if self.k8s else {"enabled": False},
        }


ENGINE = Engine()
