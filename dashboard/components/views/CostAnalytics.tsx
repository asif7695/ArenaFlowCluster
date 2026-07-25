"use client";
import { useDash } from "@/lib/store";
import { C, hexA } from "@/lib/theme";
import LineChart from "../charts/LineChart";

const fmt = (v: number) => "$" + Math.round(v).toLocaleString();

export default function CostAnalytics() {
  const { snap } = useDash();
  const cost = snap.cost;
  const ratio = cost.cost_static > 0 ? cost.cost_ai / cost.cost_static : 1;

  const NODE_HR = 0.4, HRS_MO = 720;
  const monthlyStatic = 58 * NODE_HR * HRS_MO;
  const monthlyAI = Math.round(monthlyStatic * ratio);
  const savedMo = Math.round(monthlyStatic - monthlyAI);
  const rateAI = (snap.capacity_ai * NODE_HR);

  const impacted = snap.summary.players_impacted;
  const dropped = snap.summary.players_dropped;

  const cards = [
    { k: "SPEND RATE", v: `$${rateAI.toFixed(1)}/h`, sub: "AI predictive, live", c: C.text },
    { k: "PROJECTED 30-DAY", v: fmt(monthlyAI), sub: "at current traffic", c: C.accent2 },
    { k: "STATIC 30-DAY", v: fmt(monthlyStatic), sub: "peak-provisioned", c: C.muted },
    { k: "SAVED / 30-DAY", v: fmt(savedMo), sub: `${cost.savings_pct}% lower spend`, c: C.green },
    { k: "PLAYER IMPACT", v: String(impacted), sub: dropped ? `${dropped} dropped, ${impacted - dropped} migrated` : "0 dropped — all migrated", c: dropped ? "#f0743a" : C.green },
  ];

  const regions = snap.region_forecast;
  const totLoad = regions.reduce((a, r) => a + r.value, 0) || 1;
  const byRegion = regions.map((r) => ({ name: r.name, val: fmt(Math.round(monthlyAI * r.value / totLoad)), pct: Math.round(r.value / totLoad * 100) }));

  const drivers = [
    { k: "Base compute", ai: fmt(monthlyAI * 0.70), st: fmt(monthlyStatic * 0.55), note: "nodes required to serve live demand" },
    { k: "Idle / over-provisioned", ai: fmt(monthlyAI * 0.10), st: fmt(monthlyStatic * 0.40), note: "capacity running below utilization" },
    { k: "Forecast buffer", ai: fmt(monthlyAI * 0.20), st: fmt(monthlyStatic * 0.03), note: "headroom pre-warmed for predicted spikes" },
    { k: "Incident remediation", ai: fmt(cost.incidents_ai * 140), st: fmt(cost.incidents_static * 140), note: "emergency scale-out + SLA credits" },
  ];

  const labels = cost.series_saved.map((_, i) => `t${i}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
        {cards.map((m) => (
          <div key={m.k} className="panel" style={{ padding: 16 }}>
            <div className="k-label">{m.k}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 25, marginTop: 8, color: m.c }}>{m.v}</div>
            <div className="mono" style={{ fontSize: 10, color: C.muted3, marginTop: 5 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span className="mono" style={{ fontWeight: 600, fontSize: 12, letterSpacing: ".1em", color: C.text2 }}>CUMULATIVE SAVINGS vs STATIC</span>
          <span className="mono" style={{ fontSize: 10, color: C.green }}>running total avoided spend</span>
        </div>
        <LineChart labels={labels} height={200}
          series={[{ label: "Saved", data: cost.series_saved, color: C.green, fill: "rgba(34,197,139,.12)" }]} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
        <div className="panel" style={{ flex: "1 1 280px", minWidth: 260, padding: 18 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2, marginBottom: 15 }}>SPEND BY REGION · 30-DAY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {byRegion.map((r) => (
              <div key={r.name}>
                <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a9adb4", marginBottom: 7 }}>
                  <span>{r.name}</span><span style={{ color: C.accent3 }}>{r.val}</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${r.pct}%`, background: C.accent, boxShadow: `0 0 6px ${hexA(C.accent, .5)}` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ flex: "2 1 440px", minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 100px", gap: 10, padding: "13px 18px", borderBottom: `1px solid ${C.border}` }}>
            <span className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: C.muted3 }}>COST DRIVER · 30-DAY</span>
            <span className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: C.green, textAlign: "right" }}>AI</span>
            <span className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: C.muted3, textAlign: "right" }}>STATIC</span>
          </div>
          {drivers.map((d) => (
            <div key={d.k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 100px", gap: 10, alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.hair}` }}>
              <span>
                <span className="mono" style={{ fontSize: 12, color: C.text2, display: "block" }}>{d.k}</span>
                <span className="mono" style={{ fontSize: 10, color: C.muted2 }}>{d.note}</span>
              </span>
              <span className="mono" style={{ textAlign: "right", fontWeight: 600, fontSize: 12, color: C.green }}>{d.ai}</span>
              <span className="mono" style={{ textAlign: "right", fontWeight: 600, fontSize: 12, color: C.muted }}>{d.st}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
