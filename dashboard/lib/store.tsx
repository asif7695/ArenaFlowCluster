"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { getJSON, postControl, POLL_MS } from "./api";
import { mockSnapshot, emptySnapshot } from "./mock";
import type { Mode, Scenario, NodeView, Alert } from "./types";

export type Snap = ReturnType<typeof mockSnapshot>;
/** Route segment names under app/(dashboard)/ — each is a real, linkable URL. */
export type View = "overview" | "node" | "forecast" | "compare" | "cost" | "alerts" | "decisions";

interface NodeDetail {
  node: NodeView;
  history: { cpu: number[]; lat: number[] };
  events: Alert[];
}

interface Ctx {
  snap: Snap;
  online: boolean;
  useMock: boolean;
  selected: string;
  setSelected: (id: string) => void;
  nodeDetail: NodeDetail | null;
  control: (b: { running?: boolean; mode?: Mode; scenario?: Scenario }) => void;
}

const DashCtx = createContext<Ctx | null>(null);
const FORCE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";

async function fetchSnapshot(selected: string): Promise<Snap> {
  const [summary, matrix, forecast, comparison, alerts, logAi, logStatic, k8s] = await Promise.all([
    getJSON<any>("/summary"),
    getJSON<any>("/matrix"),
    getJSON<any>("/forecast"),
    getJSON<any>("/comparison"),
    getJSON<any>("/alerts"),
    getJSON<any>("/decisions?mode=ai&limit=40"),
    getJSON<any>("/decisions?mode=static&limit=40"),
    getJSON<any>("/k8s").catch(() => ({ enabled: false })),
  ]);
  return {
    online: true,
    model_mode: summary.model_mode,
    mode: summary.mode,
    scenario: summary.scenario,
    running: summary.running,
    tick: summary.tick,
    nodes: matrix.nodes,
    counts: matrix.counts,
    demand: summary.demand,
    demand_history: forecast.observed,
    predicted_demand: forecast.predicted,
    forecast_peak: forecast.forecast_peak,
    capacity_ai: comparison.capacity_ai,
    capacity_static: comparison.capacity_static,
    summary: summary.summary,
    alerts: alerts.alerts,
    region_forecast: forecast.region_forecast,
    scale_log: forecast.scale_log,
    log_ai: logAi,
    log_static: logStatic,
    cost: comparison.cost,
    node_history: {},
    k8s,
  } as unknown as Snap;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  // Static, deterministic placeholder for the very first render so server-rendered
  // HTML and the client's first hydration pass match exactly. Real (or mock) data
  // is only fetched/generated inside useEffect, which runs client-side only —
  // avoids a hydration mismatch from non-deterministic values (random telemetry,
  // an incrementing tick counter) differing between the SSR pass and hydration.
  const [snap, setSnap] = useState<Snap>(() => emptySnapshot());
  const [online, setOnline] = useState(false);
  const [useMock, setUseMock] = useState(FORCE_MOCK);
  const [selected, setSelected] = useState("node-27");
  const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    let alive = true;
    let timer: any;
    async function tick() {
      if (FORCE_MOCK) {
        if (alive) { setSnap(mockSnapshot()); setOnline(false); setUseMock(true); }
      } else {
        try {
          const s = await fetchSnapshot(selectedRef.current);
          if (alive) { setSnap(s); setOnline(true); setUseMock(false); }
        } catch {
          if (alive) { setSnap(mockSnapshot()); setOnline(false); setUseMock(true); }
        }
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    }
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  // node detail poll (only meaningful when inspector is open)
  useEffect(() => {
    let alive = true;
    let timer: any;
    async function tick() {
      if (!FORCE_MOCK) {
        try {
          const d = await getJSON<NodeDetail>(`/nodes/${selected}`);
          if (alive) setNodeDetail(d);
        } catch { /* fall through to mock below */ }
      }
      if ((FORCE_MOCK || !nodeDetail) && alive) {
        const m = mockSnapshot();
        const n = m.nodes.find((x) => x.node_id === selected) || m.nodes[0];
        setNodeDetail({ node: n, history: m.node_history[selected] || { cpu: [], lat: [] },
          events: m.alerts.filter((a) => a.node_id === selected) });
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    }
    tick();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const control = useCallback((b: { running?: boolean; mode?: Mode; scenario?: Scenario }) => {
    // optimistic local update, then tell the backend
    setSnap((s) => ({ ...s, ...b } as Snap));
    if (!FORCE_MOCK) postControl(b).catch(() => {});
  }, []);

  return (
    <DashCtx.Provider value={{ snap, online, useMock, selected, setSelected, nodeDetail, control }}>
      {children}
    </DashCtx.Provider>
  );
}

export function useDash(): Ctx {
  const v = useContext(DashCtx);
  if (!v) throw new Error("useDash must be used within DashboardProvider");
  return v;
}
