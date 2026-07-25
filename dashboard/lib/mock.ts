// Lightweight client-side mock so the dashboard renders before the backend is
// up (or with NEXT_PUBLIC_USE_MOCK=1). Schema-valid, not physically accurate.
import type { NodeView, Status, Decision } from "./types";

const ROWS = "ABCDEFGH";
const REGIONS = ["us-east-1", "eu-west-1", "ap-south-1", "us-west-2"];
let T = 20;

function regionFor(r: number, c: number) {
  return REGIONS[(r < 4 ? 0 : 2) + (c < 4 ? 0 : 1)];
}

function statusFor(cpu: number, lat: number, risk: number): Status {
  if (risk >= 0.6 || lat >= 175) return "critical";
  if (cpu >= 78 || risk >= 0.4) return "degraded";
  if (cpu >= 66) return "warning";
  return "healthy";
}

// Nodes 38-63 are shown parked (resting) — deterministic, matches the
// capacity_ai=38 constant below, so the mock exercises the offline/grey
// matrix cells even without a live backend to drive real consolidation.
const PARK_FROM_INDEX = 38;

// One node is shown draining — the Session Safety Guard blocked its park
// because it still holds a live match — so the mock also exercises the
// "draining" matrix color without a live backend.
const DRAINING_INDEX = 37;

function nodes(t: number): NodeView[] {
  const out: NodeView[] = [];
  const demand = 52 + 24 * Math.sin(t / 13) + 8 * Math.sin(t / 4);
  for (let i = 0; i < 64; i++) {
    const r = i >> 3, c = i & 7;
    const cap = 24 + (i % 5) * 4;
    if (i >= PARK_FROM_INDEX) {
      out.push({
        node_id: `node-${i}`, label: `${ROWS[r]}${c + 1}`, region: regionFor(r, c),
        capacity: cap, cpu_pct: 2, mem_pct: 6, active_sessions: 0, latency_ms: 4,
        forecast_sessions_next_5min: 0, failure_risk_score: 0, status: "offline",
        offline_reason: "park",
      });
      continue;
    }
    if (i === DRAINING_INDEX) {
      out.push({
        node_id: `node-${i}`, label: `${ROWS[r]}${c + 1}`, region: regionFor(r, c),
        capacity: cap, cpu_pct: 24, mem_pct: 32, active_sessions: 9, latency_ms: 22,
        forecast_sessions_next_5min: 0, failure_risk_score: 0.05, status: "draining",
      });
      continue;
    }
    const load = Math.max(3, Math.min(100, demand + (Math.sin(i + t / 5) * 14) + (i % 7) * 2));
    const risk = i === 27 ? Math.min(1, 0.3 + 0.05 * (t % 12)) : Math.max(0, (load - 82) / 40);
    const cpu = Math.max(1, Math.min(100, load + Math.sin(i) * 4));
    const lat = Math.round(16 + load * 0.7 + risk * 145);
    out.push({
      node_id: `node-${i}`, label: `${ROWS[r]}${c + 1}`, region: regionFor(r, c),
      capacity: cap, cpu_pct: +cpu.toFixed(1), mem_pct: +(cpu * 0.82 + 12).toFixed(1),
      active_sessions: Math.round((load / 100) * cap), latency_ms: lat,
      forecast_sessions_next_5min: Math.round((load / 100) * cap * 1.1),
      failure_risk_score: +risk.toFixed(3), status: statusFor(cpu, lat, risk),
    });
  }
  return out;
}

function counts(ns: NodeView[]) {
  const cc = { healthy: 0, warning: 0, degraded: 0, critical: 0, offline: 0, draining: 0 };
  ns.forEach((n) => (cc[n.status] += 1));
  return cc;
}

// Pure function of `t` — same input always produces the same output, so it is
// safe to call during both server-side rendering and client hydration without
// a mismatch. `mockSnapshot()` (below) is the only place that advances the
// mutable tick counter, and it must only ever be called client-side (inside
// useEffect), never during render.
function buildSnapshot(T: number) {
  const ns = nodes(T);
  const cc = counts(ns);
  const demand = Math.round(52 + 24 * Math.sin(T / 13) + 8 * Math.sin(T / 4));
  const hist = Array.from({ length: 24 }, (_, k) =>
    Math.round(52 + 24 * Math.sin((T - 24 + k) / 13) + 8 * Math.sin((T - 24 + k) / 4))
  );
  const predicted = Array.from({ length: 10 }, (_, k) =>
    Math.round(52 + 24 * Math.sin((T + k) / 13) + 8 * Math.sin((T + k) / 4))
  );
  const sessions = ns.reduce((a, n) => a + n.active_sessions, 0);
  const avgLat = Math.round(ns.reduce((a, n) => a + n.latency_ms, 0) / ns.length);
  const avgCpu = Math.round(ns.reduce((a, n) => a + n.cpu_pct, 0) / ns.length);
  const seriesAI = Array.from({ length: 24 }, (_, k) => +(38 * 0.85 * (T - 24 + k)).toFixed(1));
  const seriesS = Array.from({ length: 24 }, (_, k) => +(58 * 0.85 * (T - 24 + k)).toFixed(1));
  const savings = 34;
  const decAI: Decision[] = [
    { timestamp: "", action: "place", label: "PLACE", target_node: "A6", reason: "placed new session on A6 — lowest predicted 5-min load (12 sessions)", confidence: 95, mode: "ai" },
    { timestamp: "", action: "route_away", label: "REROUTE", target_node: "D4", reason: "failure risk 78% on D4 — steering new matches away before it degrades", confidence: 92, mode: "ai" },
    { timestamp: "", action: "scale_down", label: "GUARD", target_node: "F3", reason: "F3 has 9 active players — blocking scale-down, draining instead of parking", confidence: 90, mode: "ai", outcome: "blocked", players: 9 },
    { timestamp: "", action: "scale_down", label: "DRAIN", target_node: "C6", reason: "failure risk 81% on C6 — draining offline for repair — migrating 14 players live to D2", confidence: 92, mode: "ai", outcome: "migrated", players: 14 },
    { timestamp: "", action: "scale_down", label: "PARK", target_node: "H8", reason: "demand low — parking H8 to rest (predicted 2 sessions)", confidence: 80, mode: "ai" },
    { timestamp: "", action: "scale_up", label: "SCALE↑", target_node: "cluster", reason: "forecast demand +12 in 5min exceeds current capacity — pre-warming", confidence: 88, mode: "ai" },
  ];
  const decS: Decision[] = [
    { timestamp: "", action: "scale_up", label: "SCALE↑", target_node: "G2", reason: "CPU 81% crossed 80% threshold on G2 — reactive scale-out", confidence: 100, mode: "static" },
  ];
  const alerts = ns
    .filter((n) => n.status === "critical" || n.status === "degraded")
    .slice(0, 8)
    .map((n, i) => ({
      id: i, severity: n.status, node: n.label, node_id: n.node_id,
      msg: n.status === "critical" ? "failure risk crossed cutoff — draining recommended" : "degradation trend detected in latency + load",
      lead: n.status === "critical" ? "~2m" : "~6m", confidence: 88, time: "00:00:00", status: "ACTIVE",
    }));
  const region_forecast = REGIONS.map((name, i) => ({ name, value: 60 + i * 4 }));

  return {
    online: false, model_mode: "mock (frontend)", mode: "ai", scenario: "peak", running: true, tick: T,
    nodes: ns, counts: cc, demand, demand_history: hist, predicted_demand: predicted,
    forecast_peak: Math.max(...predicted), capacity_ai: 38, capacity_static: 58,
    summary: {
      active_nodes: ns.length - cc.offline, total_nodes: ns.length, sessions,
      avg_latency: avgLat, demand_index: demand,
      avg_cpu: avgCpu, avg_mem: Math.round(avgCpu * 0.82 + 12), avg_risk: 12, max_risk: 90,
      healthy: cc.healthy + cc.warning, savings_pct: savings,
      nodes_rested: cc.offline, avg_active_ai: 38, avg_active_static: 58, energy_saved_pct: 34,
      draining_nodes: cc.draining, players_migrated: 14, players_dropped: 0,
      players_impacted: 14, blocked_scaledowns: 3, safe_drains: 1,
    },
    alerts, region_forecast,
    scale_log: decAI.filter((d) => d.action.startsWith("scale")),
    log_ai: decAI, log_static: decS,
    cost: {
      cost_ai: seriesAI[seriesAI.length - 1], cost_static: seriesS[seriesS.length - 1],
      saved: seriesS[seriesS.length - 1] - seriesAI[seriesAI.length - 1], savings_pct: savings,
      incidents_ai: 1, incidents_static: 24, series_ai: seriesAI, series_static: seriesS,
      series_saved: seriesS.map((v, k) => +(v - seriesAI[k]).toFixed(1)),
      util_ai: 82, util_static: 55,
    },
    node_history: Object.fromEntries(
      ns.map((n) => [n.node_id, {
        cpu: Array.from({ length: 24 }, (_, k) => +(n.cpu_pct + Math.sin(k) * 6).toFixed(1)),
        lat: Array.from({ length: 24 }, (_, k) => Math.round(n.latency_ms + Math.sin(k) * 8)),
      }])
    ),
    // real-cluster execution is opt-in (backend K8S_ENABLED=1); the mock never
    // has one, so it always reports disabled.
    k8s: { enabled: false } as import("./types").K8sState,
  };
}

/** Advances the mutable tick counter — client-only (call from useEffect, never render). */
export function mockSnapshot() {
  T += 1;
  return buildSnapshot(T);
}

/** Deterministic placeholder (fixed t=0) safe to use as SSR/first-hydration state. */
export function emptySnapshot() {
  return { ...buildSnapshot(0), online: false, model_mode: "loading" };
}
