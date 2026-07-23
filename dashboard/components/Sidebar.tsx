"use client";
import { useDash, View } from "@/lib/store";
import { C } from "@/lib/theme";

const NAV: [View, string][] = [
  ["overview", "Node Matrix"],
  ["node", "Node Inspector"],
  ["forecast", "Predictive Scaling"],
  ["compare", "AI vs Static"],
  ["cost", "Cost Analytics"],
  ["alerts", "Health Alerts"],
  ["decisions", "Scheduler Log"],
];

export default function Sidebar() {
  const { snap, view, setView, control, online, useMock, goHome } = useDash();
  const mode = snap.mode;

  return (
    <aside style={{ width: 236, flex: "none", display: "flex", flexDirection: "column",
      background: "linear-gradient(180deg,#0c0d10,#0a0b0d)", borderRight: `1px solid ${C.border}` }}>
      {/* logo — click to return to the front page */}
      <button onClick={goHome} title="Back to front page" style={{ display: "flex", alignItems: "center", gap: 11,
        padding: "18px 18px 16px", borderBottom: `1px solid ${C.border2}`, textAlign: "left", cursor: "pointer" }}>
        <div style={{ position: "relative", width: 30, height: 30, flex: "none" }}>
          <div style={{ position: "absolute", inset: 0, background: C.accent, borderRadius: 7,
            transform: "rotate(45deg)", boxShadow: "0 0 14px rgba(255,56,74,.6)" }} />
          <div style={{ position: "absolute", inset: 9, background: "#0a0b0d", borderRadius: 3,
            transform: "rotate(45deg)" }} />
        </div>
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>ArenaFlow<span style={{ color: C.accent }}>Cluster</span></div>
          <div className="mono" style={{ fontSize: 8.5, letterSpacing: ".18em", color: C.muted2, marginTop: 2 }}>
            CLUSTER&nbsp;INTELLIGENCE
          </div>
        </div>
      </button>

      {/* nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 3, padding: "14px 12px", flex: 1, overflowY: "auto" }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: ".16em", color: C.muted3, padding: "4px 8px 9px" }}>NAVIGATION</div>
        {NAV.map(([key, label], i) => {
          const active = view === key;
          return (
            <button key={key} onClick={() => setView(key)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
              borderRadius: 8, border: `1px solid ${active ? "rgba(255,56,74,.3)" : "transparent"}`,
              background: active ? "linear-gradient(90deg,rgba(255,56,74,.14),rgba(255,56,74,.02))" : "transparent",
              color: active ? "#f4f5f6" : C.muted, fontWeight: active ? 600 : 500, fontSize: 12.5, textAlign: "left" }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, flex: "none",
                background: active ? C.accent : "#3a3f47", boxShadow: active ? "0 0 8px #ff384a" : "none" }} />
              <span style={{ flex: 1 }}>{label}</span>
              <span className="mono" style={{ fontSize: 9.5, opacity: 0.5 }}>{String(i + 1).padStart(2, "0")}</span>
            </button>
          );
        })}
      </nav>

      {/* scheduler toggle */}
      <div style={{ padding: 12, borderTop: `1px solid ${C.border2}` }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: ".16em", color: C.muted3, padding: "2px 4px 9px" }}>ACTIVE SCHEDULER</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["ai", "static"] as const).map((m) => {
            const on = mode === m;
            return (
              <button key={m} onClick={() => control({ mode: m })} className="mono" style={{
                flex: 1, padding: "9px 6px", borderRadius: 7, fontWeight: 600, fontSize: 9.5, letterSpacing: ".04em",
                border: `1px solid ${on ? "rgba(255,56,74,.45)" : "rgba(255,255,255,.08)"}`,
                background: on ? "linear-gradient(90deg,rgba(255,56,74,.18),rgba(255,56,74,.05))" : C.panel2,
                color: on ? C.accent3 : C.muted }}>
                {m === "ai" ? "AI PREDICTIVE" : "STATIC"}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, padding: "9px 10px",
          background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%",
            background: online ? C.green : "#f2c14e", boxShadow: `0 0 8px ${online ? C.green : "#f2c14e"}`,
            animation: "afcpulse 1.4s infinite" }} />
          <span className="mono" style={{ fontSize: 10, color: C.muted }}>
            {online ? "LIVE BACKEND" : useMock ? "MOCK DATA" : "CONNECTING"}
          </span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: C.muted3 }}>t+{snap.tick}</span>
        </div>

        {/* real Kubernetes execution — only shown when the backend runs with
            K8S_ENABLED=1; proves decisions drive actual pods */}
        {snap.k8s?.enabled && (() => {
          const k = snap.k8s;
          const live = !!k.ok;
          const col = live ? C.green : "#f2c14e";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "9px 10px",
              background: C.panel2, border: `1px solid ${live ? "rgba(34,197,139,.3)" : C.border}`, borderRadius: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none",
                background: col, boxShadow: `0 0 8px ${col}`, animation: live ? "afcpulse 1.4s infinite" : "none" }} />
              <span className="mono" style={{ fontSize: 10, color: C.muted }}>
                {live ? "LIVE CLUSTER" : "CLUSTER DOWN"}
              </span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: live ? C.green : C.muted3 }}>
                {live ? `${k.ready ?? 0}/${k.desired ?? 0} pods · ${k.nodes ?? "?"}n` : "unreachable"}
              </span>
            </div>
          );
        })()}
      </div>
    </aside>
  );
}
