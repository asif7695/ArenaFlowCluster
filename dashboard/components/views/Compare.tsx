"use client";
import { useDash } from "@/lib/store";
import { C, hexA } from "@/lib/theme";
import type { Scenario } from "@/lib/types";
import LineChart from "../charts/LineChart";

const fmt = (v: number) => "$" + Math.round(v).toLocaleString();
const SCEN: [Scenario, string][] = [["steady", "STEADY"], ["peak", "DAILY PEAK"], ["spike", "TOURNAMENT SPIKE"]];

export default function Compare() {
  const { snap, control } = useDash();
  const cost = snap.cost;
  const s = snap.summary;
  const labels = cost.series_ai.map((_, i) => `t${i}`);

  const util = [
    { name: "AI PREDICTIVE — utilization", val: cost.util_ai, c: C.green, note: "capacity tracks forecast; minimal idle waste" },
    { name: "STATIC — utilization", val: cost.util_static, c: "#f0743a", note: "peak-provisioned; runs idle most of the day" },
  ];

  const maxActive = Math.max(1, s.avg_active_ai, s.avg_active_static);
  const energy = [
    { name: "AI PREDICTIVE — avg active nodes", val: s.avg_active_ai, pct: Math.round(s.avg_active_ai / maxActive * 100), c: C.green, note: "consolidates onto fewer nodes; the rest are parked to rest" },
    { name: "STATIC — avg active nodes", val: s.avg_active_static, pct: Math.round(s.avg_active_static / maxActive * 100), c: "#f0743a", note: "holds its provisioned floor warm at all times" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2 }}>TRAFFIC SCENARIO</span>
        <div style={{ display: "flex", gap: 6 }}>
          {SCEN.map(([key, label]) => {
            const on = snap.scenario === key;
            return (
              <button key={key} onClick={() => control({ scenario: key })} className="mono" style={{
                padding: "6px 12px", borderRadius: 7, fontSize: 10, letterSpacing: ".05em",
                border: `1px solid ${on ? "rgba(255,56,74,.4)" : "rgba(255,255,255,.08)"}`,
                background: on ? "rgba(255,56,74,.14)" : C.panel2, color: on ? C.accent3 : C.muted }}>{label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        <div style={{ background: "linear-gradient(135deg,#1a0d0f,#0b0d10)", border: "1px solid rgba(255,56,74,.25)", borderRadius: 12, padding: 18 }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: C.accent3 }}>COMPUTE COST SAVED</div>
          <div className="mono" style={{ fontWeight: 700, fontSize: 40, color: C.accent, marginTop: 8 }}>{cost.savings_pct}%</div>
          <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>vs. threshold-based static baseline</div>
        </div>
        <div className="panel" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: C.muted2 }}>CUMULATIVE SPEND</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: C.green }} />
            <span className="mono" style={{ fontWeight: 600, fontSize: 19, color: C.green }}>{fmt(cost.cost_ai)}</span>
            <span className="mono" style={{ fontSize: 10, color: C.muted2 }}>AI</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: C.muted }} />
            <span className="mono" style={{ fontWeight: 600, fontSize: 19, color: C.text2 }}>{fmt(cost.cost_static)}</span>
            <span className="mono" style={{ fontSize: 10, color: C.muted2 }}>STATIC</span>
          </div>
        </div>
        <div className="panel" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: C.muted2 }}>PLAYER-FACING INCIDENTS</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 26, color: C.green }}>{cost.incidents_ai}</span>
            <span className="mono" style={{ fontSize: 10, color: C.muted2 }}>AI predictive</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 26, color: C.accent }}>{cost.incidents_static}</span>
            <span className="mono" style={{ fontSize: 10, color: C.muted2 }}>static baseline</span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 10 }}>
          <span className="mono" style={{ fontWeight: 600, fontSize: 12, letterSpacing: ".1em", color: C.text2 }}>CUMULATIVE COMPUTE SPEND</span>
          <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted }}><span style={{ width: 14, height: 2, background: C.green }} />AI PREDICTIVE</span>
          <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted }}><span style={{ width: 14, height: 2, background: C.muted }} />STATIC</span>
        </div>
        <LineChart labels={labels} height={230}
          series={[
            { label: "Static", data: cost.series_static, color: C.muted, fill: "rgba(139,144,153,.08)" },
            { label: "AI", data: cost.series_ai, color: C.green },
          ]} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {util.map((u) => (
          <div key={u.name} className="panel" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
              <span className="mono" style={{ fontSize: 11, color: C.text2 }}>{u.name}</span>
              <span className="mono" style={{ fontWeight: 600, fontSize: 12, color: u.c }}>{u.val}%</span>
            </div>
            <div style={{ height: 9, borderRadius: 5, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${u.val}%`, background: u.c, boxShadow: `0 0 6px ${hexA(u.c, .5)}` }} />
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: C.muted2, marginTop: 9 }}>{u.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
        <div style={{ background: "linear-gradient(135deg,#0d1a13,#0b0d10)", border: "1px solid rgba(34,197,139,.25)",
          borderRadius: 12, padding: 18, flex: "1 1 220px" }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: C.green }}>ENERGY SAVED</div>
          <div className="mono" style={{ fontWeight: 700, fontSize: 40, color: C.green, marginTop: 8 }}>{s.energy_saved_pct}%</div>
          <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
            fewer node-hours than static's always-warm floor · {s.nodes_rested} resting now
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: "2 1 420px" }}>
          {energy.map((u) => (
            <div key={u.name} className="panel" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <span className="mono" style={{ fontSize: 11, color: C.text2 }}>{u.name}</span>
                <span className="mono" style={{ fontWeight: 600, fontSize: 12, color: u.c }}>{u.val}</span>
              </div>
              <div style={{ height: 9, borderRadius: 5, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${u.pct}%`, background: u.c, boxShadow: `0 0 6px ${hexA(u.c, .5)}` }} />
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: C.muted2, marginTop: 9 }}>{u.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
