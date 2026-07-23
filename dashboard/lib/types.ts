export type Status = "healthy" | "warning" | "degraded" | "critical" | "offline";
export type Mode = "ai" | "static";
export type Scenario = "steady" | "peak" | "spike";

export interface NodeView {
  node_id: string;
  label: string;
  region: string;
  capacity: number;
  cpu_pct: number;
  mem_pct: number;
  active_sessions: number;
  latency_ms: number;
  forecast_sessions_next_5min: number;
  failure_risk_score: number;
  status: Status;
  /** Present only when status === "offline": why the node is parked. */
  offline_reason?: "park" | "repair";
}

export interface Decision {
  timestamp: string;
  action: "scale_up" | "scale_down" | "route_away" | "place";
  label: string;
  target_node: string;
  reason: string;
  confidence: number;
  mode: Mode;
}

export interface Alert {
  id: number;
  severity: Status;
  node: string;
  node_id: string;
  msg: string;
  lead: string;
  confidence: number;
  time: string;
  status: string;
}

export interface Cost {
  cost_ai: number;
  cost_static: number;
  saved: number;
  savings_pct: number;
  incidents_ai: number;
  incidents_static: number;
  series_ai: number[];
  series_static: number[];
  series_saved: number[];
  util_ai: number;
  util_static: number;
}

export interface Summary {
  active_nodes: number;
  total_nodes: number;
  sessions: number;
  avg_latency: number;
  demand_index: number;
  avg_cpu: number;
  avg_mem: number;
  avg_risk: number;
  max_risk: number;
  healthy: number;
  savings_pct: number;
  /** Predictive node parking (consolidation) — energy/sustainability metrics. */
  nodes_rested: number;
  avg_active_ai: number;
  avg_active_static: number;
  energy_saved_pct: number;
}

export interface Counts {
  healthy: number;
  warning: number;
  degraded: number;
  critical: number;
  offline: number;
}

/** Live real-cluster execution state (GET /k8s). enabled:false when K8S_ENABLED unset. */
export interface K8sState {
  enabled: boolean;
  ok?: boolean;
  context?: string | null;
  namespace?: string;
  deployment?: string;
  desired?: number | null;
  ready?: number | null;
  pods?: number | null;
  nodes?: number | null;
  error?: string | null;
}
