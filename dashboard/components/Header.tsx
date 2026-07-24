"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useDash } from "@/lib/store";
import { C, hexA } from "@/lib/theme";

const TITLES: [string, string, string][] = [
  ["/overview", "Node Matrix", "Real-time condition of all 64 game-server nodes"],
  ["/node", "Node Inspector", "Per-node telemetry, prediction & remediation"],
  ["/forecast", "Predictive Scaling", "Demand forecast & pre-emptive capacity planning"],
  ["/compare", "AI vs Static Baseline", "Cost & reliability over identical simulated traffic"],
  ["/cost", "Cost Analytics", "Spend breakdown, projections & savings drivers"],
  ["/alerts", "Health Alerts", "Anomaly & degradation signals with lead time"],
  ["/decisions", "Scheduler Log", "Auditable record of automated placement & scaling"],
];

export default function Header() {
  const { snap, control, setActiveOverlay } = useDash();
  const pathname = usePathname();
  const [, title, sub] = TITLES.find(([prefix]) => pathname.startsWith(prefix)) ?? TITLES[0];
  const running = snap.running;

  // Wall-clock time is inherently different between server-render and client
  // hydration, so it must never be computed during render — start with a
  // static placeholder and only set the real value client-side (useEffect),
  // then keep it ticking every second.
  const [now, setNow] = useState("--:--:--");
  useEffect(() => {
    const update = () => setNow(new Date().toTimeString().slice(0, 8));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "15px 22px",
      borderBottom: `1px solid ${C.border}`, background: "#0a0b0d" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 16.5 }}>{title}</div>
        <div className="mono" style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setActiveOverlay("session")} className="afc-start-btn mono" style={{
          padding: "8px 13px", borderRadius: 8, fontWeight: 700, fontSize: 11, letterSpacing: ".03em",
          border: `1px solid ${hexA(C.accent, .5)}`, background: "linear-gradient(135deg,#ff4655,#c81e2c)",
          color: "#fff", boxShadow: `0 6px 20px ${hexA(C.accent, .32)}` }}>
          ▸ SESSION FLOW
        </button>
        <button onClick={() => setActiveOverlay("features")} className="afc-start-btn mono" style={{
          padding: "8px 13px", borderRadius: 8, fontWeight: 700, fontSize: 11, letterSpacing: ".03em",
          border: `1px solid rgba(255,255,255,.14)`, background: C.panel3, color: C.text2 }}>
          ◈ SYSTEM FEATURES
        </button>
        <div className="mono" style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 11px",
          background: C.panel2, border: `1px solid rgba(255,255,255,.07)`, borderRadius: 8, fontSize: 12, color: C.text2 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent,
            boxShadow: "0 0 7px #ff384a", animation: "afcblink 1.6s infinite" }} />
          {now}
        </div>
        <button onClick={() => control({ running: !running })} className="mono" style={{
          padding: "8px 13px", borderRadius: 8, fontWeight: 600, fontSize: 11,
          border: `1px solid ${running ? "rgba(255,255,255,.1)" : "rgba(34,197,139,.4)"}`,
          background: running ? C.panel3 : "rgba(34,197,139,.14)", color: running ? C.text2 : C.green }}>
          {running ? "❚❚ PAUSE" : "▶ RESUME"}
        </button>
      </div>
    </header>
  );
}
