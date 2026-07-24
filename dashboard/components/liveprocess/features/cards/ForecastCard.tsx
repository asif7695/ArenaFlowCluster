"use client";
// Predictive forecasting: observed-vs-predicted demand (same construction as
// the Forecast screen), with a plain-English note on the 5-min-ahead model.
import { useDash } from "@/lib/store";
import { C, hexA } from "@/lib/theme";
import LineChart from "@/components/charts/LineChart";

export default function ForecastCard() {
  const { snap } = useDash();
  const observed = snap.demand_history;
  const predicted = snap.predicted_demand;
  const peak = Math.max(0, ...(predicted.length ? predicted : [0]));
  const needed = Math.ceil((snap.demand / 100) * 64);
  const labels = [...observed.map((_, i) => `t-${observed.length - i}`), ...predicted.map((_, i) => `+${i + 1}`)];
  const obsData: (number | null)[] = [...observed, ...predicted.map(() => null)];
  const predData: (number | null)[] = [
    ...observed.slice(0, -1).map(() => null),
    observed.length ? observed[observed.length - 1] : null, ...predicted,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { k: "PREDICTED PEAK", v: String(peak), sub: "demand index · +5 min", c: C.accent2 },
          { k: "CURRENT NEED", v: String(needed), sub: "nodes to serve now", c: C.text },
          { k: "AI CAPACITY", v: String(snap.capacity_ai), sub: "incl. 15% buffer", c: C.green },
        ].map((m) => (
          <div key={m.k} className="panel" style={{ padding: 13 }}>
            <div className="k-label">{m.k}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 22, marginTop: 6, color: m.c }}>{m.v}</div>
            <div className="mono" style={{ fontSize: 9.5, color: C.muted3, marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
          <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted }}>
            <span style={{ width: 14, height: 2, background: C.accent }} />OBSERVED</span>
          <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted }}>
            <span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.accent3}` }} />PREDICTED +5m</span>
        </div>
        <LineChart labels={labels} height={220} yMax={100} series={[
          { label: "Observed", data: obsData, color: C.accent, fill: "rgba(255,56,74,.1)" },
          { label: "Predicted", data: predData, color: C.accent3, dashed: true },
        ]} />
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: C.text2, textAlign: "center", maxWidth: 680, marginInline: "auto" }}>
        A RandomForest forecasts demand <span style={{ color: C.accent3, fontWeight: 600 }}>~5 minutes ahead</span> from 17
        signals — load trend, latency slope and time-of-day cycles. Capacity is <span style={{ color: C.accent3, fontWeight: 600 }}>pre-warmed
        before</span> the surge, so players never wait on a cold start.
      </p>
    </div>
  );
}
