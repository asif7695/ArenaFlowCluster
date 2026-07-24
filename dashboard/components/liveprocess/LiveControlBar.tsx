"use client";
// Persistent judge levers. Every button reuses the store's existing control(),
// which optimistically updates local state and POSTs to /control — so when a
// backend is connected these genuinely perturb the running simulator, and the
// next poll (~2s) shows the effect. Offline/mock: control() no-ops the network
// call and just nudges local state, and we flag it as SIMULATED.
import { useDash } from "@/lib/store";
import { C, hexA } from "@/lib/theme";

function Lever({ label, sub, color, active, onClick }: {
  label: string; sub?: string; color: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="mono afc-start-btn" style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1,
      padding: "8px 14px", borderRadius: 9, minWidth: 92,
      border: `1px solid ${active ? hexA(color, .55) : "rgba(255,255,255,.1)"}`,
      background: active ? hexA(color, .16) : C.panel3,
      color: active ? color : C.text2 }}>
      <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: ".03em" }}>{label}</span>
      {sub && <span style={{ fontSize: 8.5, color: C.muted2, letterSpacing: ".04em" }}>{sub}</span>}
    </button>
  );
}

export default function LiveControlBar({ spotlight }: { spotlight?: boolean }) {
  const { snap, online, control } = useDash();
  const running = snap.running;
  const mode = snap.mode;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "10px 14px", borderRadius: 12,
      border: `1px solid ${spotlight ? hexA(C.accent, .4) : C.border}`,
      background: spotlight ? hexA(C.accent, .06) : C.panel,
      boxShadow: spotlight ? `0 0 26px ${hexA(C.accent, .18)}` : "none",
      transition: "box-shadow .3s, border-color .3s" }}>
      <span className="mono" style={{ fontSize: 9.5, letterSpacing: ".14em", color: C.muted2, marginRight: 2 }}>
        LIVE LEVERS
      </span>
      <Lever label={running ? "❚❚ PAUSE" : "▶ RESUME"} sub={running ? "sim running" : "sim paused"}
        color={running ? C.text2 : C.green} active={!running} onClick={() => control({ running: !running })} />
      <Lever label={mode === "ai" ? "◆ AI SCHEDULER" : "▣ STATIC BASELINE"}
        sub="tap to switch" color={mode === "ai" ? C.green : "#f2c14e"} active
        onClick={() => control({ mode: mode === "ai" ? "static" : "ai" })} />
      <span className="mono" style={{ marginLeft: "auto", fontSize: 9, letterSpacing: ".08em",
        color: online ? C.green : C.muted2, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: online ? C.green : C.muted2,
          boxShadow: online ? `0 0 6px ${C.green}` : "none" }} />
        {online ? "LIVE — driving real sim" : "SIMULATED — no backend"}
      </span>
    </div>
  );
}
