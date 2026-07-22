"use client";
import { useDash } from "@/lib/store";
import { C, statusColor, hexA, STATUS } from "@/lib/theme";
import Spark from "../charts/Spark";

export default function NodeInspector() {
  const { nodeDetail, selected, setSelected } = useDash();
  if (!nodeDetail) return <div className="mono" style={{ color: C.muted }}>loading node…</div>;
  const { node: n, history, events } = nodeDetail;
  const c = statusColor(n.status);
  const failPct = Math.round(n.failure_risk_score * 100);
  const failColor = n.failure_risk_score > 0.6 ? C.accent : n.failure_risk_score > 0.4 ? "#f0743a" : n.failure_risk_score > 0.2 ? "#f2c14e" : C.green;
  const idx = Number(n.node_id.split("-")[1]) || 0;
  const cyc = (d: number) => setSelected(`node-${(idx + d + 64) % 64}`);

  const metrics = [
    { k: "LOAD", v: `${Math.round(n.cpu_pct)}%`, c },
    { k: "CPU", v: `${Math.round(n.cpu_pct)}%`, c: C.text },
    { k: "MEMORY", v: `${Math.round(n.mem_pct)}%`, c: C.text },
    { k: "LATENCY", v: `${n.latency_ms}ms`, c: n.latency_ms > 120 ? "#f0743a" : C.text },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
      {/* left */}
      <div style={{ flex: "1 1 280px", minWidth: 260, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="panel" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: c, boxShadow: `0 0 12px ${c}` }} />
              <span className="mono" style={{ fontWeight: 700, fontSize: 26 }}>{n.label}</span>
            </div>
            <span className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", padding: "5px 10px", borderRadius: 6,
              color: c, background: hexA(c, .13), border: `1px solid ${hexA(c, .35)}` }}>{STATUS[n.status].label}</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: C.muted2, marginTop: 8 }}>{n.node_id} · {n.region}<br />capacity {n.capacity} sessions</div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => cyc(-1)} className="mono" style={{ flex: 1, padding: 9, background: C.panel3, border: `1px solid rgba(255,255,255,.08)`, borderRadius: 7, color: C.text2, fontSize: 11 }}>← PREV</button>
            <button onClick={() => cyc(1)} className="mono" style={{ flex: 1, padding: 9, background: C.panel3, border: `1px solid rgba(255,255,255,.08)`, borderRadius: 7, color: C.text2, fontSize: 11 }}>NEXT →</button>
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2, marginBottom: 13 }}>FAILURE PREDICTION</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 34, color: failColor }}>{failPct}%</span>
            <span className="mono" style={{ fontSize: 11, color: C.muted2 }}>degrade risk</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,.07)", marginTop: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${failPct}%`, background: failColor, boxShadow: `0 0 8px ${hexA(failColor, .6)}` }} />
          </div>
          <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
            {n.failure_risk_score > 0.4
              ? "Anomaly classifier flags rising failure probability. Health-aware routing is diverting new sessions."
              : "Node operating within expected envelope. Model confidence high."}
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2, marginBottom: 12 }}>FORECAST · NEXT 5 MIN</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 28, color: C.accent2 }}>{n.forecast_sessions_next_5min}</span>
            <span className="mono" style={{ fontSize: 11, color: C.muted2 }}>predicted sessions (now {n.active_sessions})</span>
          </div>
        </div>
      </div>

      {/* right */}
      <div style={{ flex: "3 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {metrics.map((m) => (
            <div key={m.k} className="panel" style={{ padding: 14 }}>
              <div className="k-label">{m.k}</div>
              <div className="mono" style={{ fontWeight: 700, fontSize: 23, marginTop: 7, color: m.c }}>{m.v}</div>
            </div>
          ))}
        </div>
        <div className="panel" style={{ padding: 16 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2, marginBottom: 6 }}>LOAD / CPU % · HISTORY</div>
          <Spark values={history.cpu} h={130} fill="rgba(255,56,74,.1)" stroke={C.accent} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="panel" style={{ padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2, marginBottom: 6 }}>CPU %</div>
            <Spark values={history.cpu} h={90} stroke="#f2c14e" strokeWidth={1.6} />
          </div>
          <div className="panel" style={{ padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2, marginBottom: 6 }}>LATENCY ms</div>
            <Spark values={history.lat} h={90} lo={0} hi={200} stroke="#f0743a" strokeWidth={1.6} />
          </div>
        </div>
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="mono" style={{ padding: "12px 15px", borderBottom: `1px solid ${C.border2}`, fontSize: 10, letterSpacing: ".12em", color: C.muted2 }}>NODE EVENT LOG</div>
          {(events.length ? events : []).map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 11, padding: "10px 15px", borderBottom: `1px solid ${C.hair}` }}>
              <span className="mono" style={{ fontSize: 10, color: C.muted3, flex: "none" }}>{e.time}</span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", marginTop: 5, background: statusColor(e.severity) }} />
              <span className="mono" style={{ fontSize: 11, color: "#a9adb4" }}>{e.msg}</span>
            </div>
          ))}
          {!events.length && <div className="mono" style={{ padding: "12px 15px", fontSize: 11, color: C.green }}>no anomalies recorded in current window</div>}
        </div>
      </div>
    </div>
  );
}
