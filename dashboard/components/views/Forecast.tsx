"use client";
import { useDash } from "@/lib/store";
import { C, hexA, actionColor } from "@/lib/theme";
import LineChart from "../charts/LineChart";

export default function Forecast() {
  const { snap } = useDash();
  const observed = snap.demand_history;
  const predicted = snap.predicted_demand;
  const needed = Math.ceil((snap.demand / 100) * 64);
  const recommended = snap.capacity_ai;
  const delta = recommended - needed;
  const peak = Math.max(0, ...(predicted.length ? predicted : [0]));

  const labels = [...observed.map((_, i) => `t-${observed.length - i}`), ...predicted.map((_, i) => `+${i + 1}`)];
  const obsData: (number | null)[] = [...observed, ...predicted.map(() => null)];
  const predData: (number | null)[] = [
    ...observed.slice(0, -1).map(() => null),
    observed.length ? observed[observed.length - 1] : null,
    ...predicted,
  ];

  const cards = [
    { k: "PREDICTED PEAK", v: String(peak), sub: "demand index / +5min", c: C.accent2 },
    { k: "CURRENT NEED", v: String(needed), sub: "nodes to serve now", c: C.text },
    { k: "RECOMMENDED", v: String(recommended), sub: "incl 15% buffer", c: C.green },
    { k: "ACTION", v: delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : "HOLD", sub: delta > 0 ? "pre-warm" : delta < 0 ? "release" : "steady", c: delta > 0 ? C.accent2 : delta < 0 ? C.blue : C.muted },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {cards.map((m) => (
          <div key={m.k} className="panel" style={{ padding: 16 }}>
            <div className="k-label">{m.k}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 25, marginTop: 8, color: m.c }}>{m.v}</div>
            <div className="mono" style={{ fontSize: 10, color: C.muted3, marginTop: 5 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 10 }}>
          <span className="mono" style={{ fontWeight: 600, fontSize: 12, letterSpacing: ".1em", color: C.text2 }}>DEMAND FORECAST</span>
          <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted }}>
            <span style={{ width: 14, height: 2, background: C.accent }} />OBSERVED</span>
          <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted }}>
            <span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.accent3}` }} />PREDICTED +5m</span>
        </div>
        <LineChart labels={labels} height={250} yMax={100}
          series={[
            { label: "Observed", data: obsData, color: C.accent, fill: "rgba(255,56,74,.1)" },
            { label: "Predicted", data: predData, color: C.accent3, dashed: true },
          ]} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
        <div className="panel" style={{ flex: "3 1 480px", minWidth: 0, overflow: "hidden" }}>
          <div className="mono" style={{ padding: "13px 16px", borderBottom: `1px solid ${C.border2}`, fontSize: 10, letterSpacing: ".12em", color: C.muted2 }}>SCALING TIMELINE</div>
          {(snap.scale_log.length ? snap.scale_log : []).map((d, i) => {
            const col = actionColor(d.label, d.action);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.hair}` }}>
                <span className="mono" style={{ fontSize: 9, fontWeight: 600, padding: "3px 6px", borderRadius: 4, color: col, background: hexA(col, .12), border: `1px solid ${hexA(col, .3)}` }}>{d.label}</span>
                <span className="mono" style={{ fontSize: 11, color: "#a9adb4", flex: 1 }}>{d.reason}</span>
              </div>
            );
          })}
          {!snap.scale_log.length && <div className="mono" style={{ padding: "12px 16px", fontSize: 11, color: C.muted }}>capacity matched to forecast — no scaling action</div>}
        </div>

        <div className="panel" style={{ flex: "1 1 280px", minWidth: 260, padding: 16 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2, marginBottom: 14 }}>FORECAST BY REGION</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {snap.region_forecast.map((r) => {
              const col = r.value > 80 ? C.accent : r.value > 65 ? "#f0743a" : C.green;
              return (
                <div key={r.name}>
                  <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a9adb4", marginBottom: 6 }}>
                    <span>{r.name}</span><span style={{ color: col }}>{r.value}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${r.value}%`, background: col, boxShadow: `0 0 6px ${hexA(col, .5)}` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
