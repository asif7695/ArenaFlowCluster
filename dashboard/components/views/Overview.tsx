"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDash } from "@/lib/store";
import { C, statusColor, hexA, STATUS, actionColor } from "@/lib/theme";
import type { Status } from "@/lib/types";
import Spark from "../charts/Spark";

const REGIONS = ["us-east-1", "eu-west-1", "ap-south-1", "us-west-2"];
const LEGEND: Status[] = ["healthy", "warning", "degraded", "critical"];

export default function Overview() {
  const { snap } = useDash();
  const router = useRouter();
  const [region, setRegion] = useState<string>("all");
  const nodes = snap.nodes;
  const s = snap.summary;

  const extra = [
    { k: "AVG CPU", v: `${s.avg_cpu}%`, sub: "cluster-wide", c: s.avg_cpu > 75 ? C.accent : s.avg_cpu > 55 ? "#f2c14e" : C.text },
    { k: "AVG MEMORY", v: `${s.avg_mem}%`, sub: "cluster-wide", c: s.avg_mem > 75 ? C.accent : C.text },
    { k: "FAILURE RISK", v: `${s.avg_risk}%`, sub: `peak ${s.max_risk}%`, c: s.avg_risk > 30 ? C.accent : s.avg_risk > 15 ? "#f2c14e" : C.green },
    { k: "COST SAVED", v: `${s.savings_pct}%`, sub: "vs static baseline", c: C.green },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
        {extra.map((m) => (
          <div key={m.k} className="panel" style={{ padding: 15 }}>
            <div className="k-label">{m.k}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 23, marginTop: 7, color: m.c }}>{m.v}</div>
            <div className="mono" style={{ fontSize: 10, color: C.muted3, marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
        {/* matrix */}
        <div className="panel" style={{ flex: "3 1 560px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${C.border2}` }}>
            <span className="mono" style={{ fontWeight: 600, fontSize: 12, letterSpacing: ".14em", color: C.text2 }}>NODE MATRIX · 8×8</span>
            <div style={{ display: "flex", gap: 5, marginLeft: 6 }}>
              {["all", ...REGIONS].map((r) => {
                const on = region === r;
                return (
                  <button key={r} onClick={() => setRegion(r)} className="mono" style={{
                    padding: "4px 9px", borderRadius: 6, fontSize: 9.5, letterSpacing: ".06em",
                    border: `1px solid ${on ? "rgba(255,56,74,.4)" : "rgba(255,255,255,.08)"}`,
                    background: on ? "rgba(255,56,74,.14)" : C.panel2, color: on ? C.accent3 : C.muted }}>
                    {r === "all" ? "ALL" : r.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 13 }}>
              {LEGEND.map((k) => (
                <span key={k} className="mono" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS[k].c }} />{STATUS[k].label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8,minmax(0,1fr))", gap: 8 }}>
              {nodes.map((n) => {
                const c = statusColor(n.status);
                const dim = region !== "all" && n.region !== region;
                const offline = n.status === "offline";
                const pct = offline ? 0 : Math.round(n.cpu_pct);
                const glow = n.status === "critical" ? `0 0 0 1px ${c},0 0 15px ${hexA(c, .5)}`
                  : n.status === "degraded" ? `0 0 11px ${hexA(c, .28)}` : "none";
                return (
                  <button key={n.node_id} title={`${n.node_id} · ${n.region} · ${STATUS[n.status].label}`}
                    onClick={() => router.push(`/node/${n.node_id}`)}
                    style={{ textAlign: "left", background: C.panel2, border: `1px solid ${C.border2}`,
                      borderLeft: `3px solid ${c}`, borderRadius: 7, padding: "7px 6px", display: "flex",
                      flexDirection: "column", gap: 6, minHeight: 62, minWidth: 0, boxShadow: glow,
                      opacity: dim ? 0.28 : 1, transition: "opacity .2s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: c,
                        boxShadow: n.status === "critical" ? `0 0 6px ${c}` : "none",
                        animation: n.status === "critical" ? "afcpulse 1.1s infinite" : "none" }} />
                      <span style={{ fontWeight: 600, fontSize: 11, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span>
                      <span style={{ marginLeft: "auto", fontWeight: 600, fontSize: 11, color: C.text, flex: "none" }}>{offline ? "—" : `${pct}%`}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: c, boxShadow: `0 0 6px ${hexA(c, .6)}` }} />
                    </div>
                    <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: C.muted2, whiteSpace: "nowrap" }}>
                      {offline
                        ? <span style={{ letterSpacing: ".08em" }}>{n.offline_reason === "repair" ? "REPAIR" : "RESTING"}</span>
                        : <><span>{n.active_sessions}s</span><span>{n.latency_ms}ms</span></>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* right column */}
        <div style={{ flex: "1 1 280px", minWidth: 260, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel" style={{ padding: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2 }}>CLUSTER DEMAND</span>
              <span className="mono" style={{ fontSize: 11, color: C.accent2 }}>{snap.demand} / 100</span>
            </div>
            <Spark values={snap.demand_history} h={84} fill="rgba(255,56,74,.12)" stroke={C.accent} />
          </div>

          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="mono" style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border2}`, fontSize: 10, letterSpacing: ".12em", color: C.muted2 }}>SCHEDULER · LIVE</div>
            {snap.log_ai.slice(0, 6).map((d, i) => {
              const col = actionColor(d.label, d.action);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: `1px solid ${C.hair}` }}>
                  <span className="mono" style={{ fontSize: 9, fontWeight: 600, padding: "3px 6px", borderRadius: 4, flex: "none",
                    color: col, background: hexA(col, .12), border: `1px solid ${hexA(col, .3)}` }}>{d.label}</span>
                  <span className="mono" style={{ fontSize: 11, color: "#a9adb4", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.target_node !== "cluster" ? `${d.target_node} → ` : ""}{d.reason.split(" (")[0]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="panel" style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2 }}>ACTIVE ALERTS</span>
              <span className="mono" style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10,
                color: snap.alerts.length ? C.accent3 : C.green, background: snap.alerts.length ? hexA(C.accent, .14) : hexA(C.green, .12) }}>
                {snap.alerts.length}
              </span>
            </div>
            {snap.alerts.slice(0, 4).map((a) => (
              <button key={a.id} onClick={() => router.push(`/node/${a.node_id}`)} style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: `1px solid ${C.hair}`, textAlign: "left", width: "100%" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: statusColor(a.severity), boxShadow: `0 0 6px ${statusColor(a.severity)}` }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 11, color: C.text2 }}>{a.node}</span>{" "}
                  <span className="mono" style={{ fontSize: 10.5, color: C.muted }}>{a.msg}</span>
                </span>
                <span className="mono" style={{ fontSize: 9.5, color: C.accent3 }}>{a.lead}</span>
              </button>
            ))}
            {!snap.alerts.length && <div className="mono" style={{ padding: "12px 14px", fontSize: 10.5, color: C.green }}>all nodes nominal</div>}
          </div>
        </div>
      </div>
    </>
  );
}
