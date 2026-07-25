"use client";
// Button 2 — System Features gallery. A menu of four cards; click one for its
// focused panel, or "Play all in sequence" to walk them in order via ProgressRail.
// Reuses OverlayShell + the four card components.
import { useEffect, useState } from "react";
import { useDash } from "@/lib/store";
import { C, hexA } from "@/lib/theme";
import OverlayShell from "../OverlayShell";
import ProgressRail from "../ProgressRail";
import ForecastCard from "./cards/ForecastCard";
import SelfHealCard from "./cards/SelfHealCard";
import EnergyCard from "./cards/EnergyCard";
import ShowdownCard from "./cards/ShowdownCard";
import SafetyGuardCard from "./cards/SafetyGuardCard";

const FEATURES = [
  { id: "forecast", icon: "📈", title: "Predictive Forecasting", hook: "See demand 5 minutes before it arrives.", accent: C.accent3, Comp: ForecastCard },
  { id: "selfheal", icon: "🛠", title: "Failure Self-Healing", hook: "Detect, drain, repair, and wake failing nodes.", accent: "#f2c14e", Comp: SelfHealCard },
  { id: "energy", icon: "🌙", title: "Energy Saving", hook: "Park idle nodes to rest — wake them ahead of demand.", accent: C.blue, Comp: EnergyCard },
  { id: "guard", icon: "🛡", title: "Session Safety Guard", hook: "Never drop a live match — migrate or finish, always recorded.", accent: "#f2c14e", Comp: SafetyGuardCard },
  { id: "showdown", icon: "⚔", title: "AI vs Static + Live K8s", hook: "Pull real levers and watch the two diverge.", accent: C.green, Comp: ShowdownCard },
];
const AUTO_MS = 9000;

export default function FeaturesOverlay() {
  const { activeOverlay, setActiveOverlay } = useDash();
  const open = activeOverlay === "features";
  const [selected, setSelected] = useState<number | null>(null);
  const [playAll, setPlayAll] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!open) { setSelected(null); setPlayAll(false); setPlaying(true); }
  }, [open]);

  const atEnd = selected !== null && selected >= FEATURES.length - 1;
  useEffect(() => {
    if (!open || !playAll || !playing || selected === null || atEnd) return;
    const id = setTimeout(() => setSelected((i) => Math.min(FEATURES.length - 1, (i ?? 0) + 1)), AUTO_MS);
    return () => clearTimeout(id);
  }, [open, playAll, playing, selected, atEnd]);

  if (!open) return null;

  const inDetail = selected !== null;
  const feat = inDetail ? FEATURES[selected!] : null;
  const FeatComp = feat?.Comp ?? null;

  return (
    <OverlayShell title="SYSTEM FEATURES" onClose={() => setActiveOverlay(null)}
      footer={inDetail && playAll ? (
        <ProgressRail beats={FEATURES.map((f) => ({ id: f.id, title: f.title })) as any}
          stepIndex={selected!} playing={playing} atEnd={atEnd}
          onJump={(i) => setSelected(i)}
          onPrev={() => setSelected((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setSelected((i) => Math.min(FEATURES.length - 1, (i ?? 0) + 1))}
          onToggle={() => setPlaying((p) => !p)}
          onRestart={() => { setSelected(0); setPlaying(true); }} />
      ) : undefined}>

      {!inDetail ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ margin: 0, fontWeight: 700, fontSize: 30 }}>Explore the system</h1>
            <p style={{ margin: "10px 0 0", fontSize: 14.5, color: C.text2 }}>
              Open any capability — or play through all four in sequence.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            {FEATURES.map((f, i) => (
              <button key={f.id} onClick={() => { setSelected(i); setPlayAll(false); }} className="afc-start-btn"
                style={{ textAlign: "left", padding: 20, borderRadius: 14, background: C.panel,
                  border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 30, filter: `drop-shadow(0 0 10px ${hexA(f.accent, .5)})` }}>{f.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 17, color: C.text }}>{f.title}</span>
                  <span className="mono" style={{ marginLeft: "auto", fontSize: 16, color: f.accent }}>→</span>
                </div>
                <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{f.hook}</span>
              </button>
            ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <button onClick={() => { setSelected(0); setPlayAll(true); setPlaying(true); }} className="afc-start-btn mono"
              style={{ padding: "13px 30px", borderRadius: 12, fontWeight: 700, fontSize: 13, letterSpacing: ".04em",
                border: `1px solid ${hexA(C.accent, .5)}`, background: "linear-gradient(135deg,#ff4655,#c81e2c)",
                color: "#fff", boxShadow: `0 8px 26px ${hexA(C.accent, .35)}` }}>
              ▶ PLAY ALL IN SEQUENCE
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!playAll && (
              <button onClick={() => setSelected(null)} className="mono afc-start-btn" style={{
                padding: "7px 13px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                border: "1px solid rgba(255,255,255,.12)", background: C.panel3, color: C.text2 }}>
                ‹ BACK TO FEATURES
              </button>
            )}
            <span style={{ fontSize: 22 }}>{feat!.icon}</span>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: C.text }}>{feat!.title}</h2>
            {playAll && <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: C.muted2, letterSpacing: ".08em" }}>
              FEATURE {selected! + 1} / {FEATURES.length}</span>}
          </div>
          {FeatComp && <FeatComp />}
        </div>
      )}
    </OverlayShell>
  );
}
