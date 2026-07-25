"use client";
// Button 1 — the "follow one session through a failure" story. Auto-starts on
// open (freezes one snapshot, no intro screen), auto-plays beats, Back/Play/
// Pause/Next via ProgressRail, and ends on a recap that hands off to the System
// Features gallery. All timers start in useEffect (hydration-safe).
import { useEffect, useMemo, useState } from "react";
import { useDash, type Snap } from "@/lib/store";
import { C, hexA } from "@/lib/theme";
import OverlayShell from "../OverlayShell";
import { Captions } from "../Captions";
import ProgressRail from "../ProgressRail";
import SessionStage from "./SessionStage";
import FlowDiagram from "./FlowDiagram";
import { buildSessionScript, FAIL_CUTOFF, REPAIR_TICKS, type SessionBeat } from "./sessionScript";

const SESSION_COUNT = 25; // fixed sample size — no selection screen

export default function SessionOverlay() {
  const { snap, activeOverlay, setActiveOverlay } = useDash();
  const open = activeOverlay === "session";
  const [frozen, setFrozen] = useState<Snap | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const script = useMemo(() => (frozen ? buildSessionScript(frozen, SESSION_COUNT) : null), [frozen]);
  const beats = script?.beats ?? [];
  const beat = beats[stepIndex];
  const atEnd = stepIndex >= beats.length - 1;

  // freeze one snapshot and start immediately when opened; reset when closed
  useEffect(() => {
    if (open && !frozen) { setFrozen(snap); setStepIndex(0); setPlaying(true); }
    if (!open) { setFrozen(null); setStepIndex(0); setPlaying(true); }
  }, [open, frozen, snap]);

  useEffect(() => {
    if (!frozen || !playing || !beat || !isFinite(beat.durationMs)) return;
    const id = setTimeout(() => setStepIndex((i) => Math.min(beats.length - 1, i + 1)), beat.durationMs);
    return () => clearTimeout(id);
  }, [frozen, playing, stepIndex, beat, beats.length]);

  if (!open) return null;

  const restart = () => { setFrozen(snap); setStepIndex(0); setPlaying(true); };

  return (
    <OverlayShell title="SESSION FLOW" badge={frozen ? `frozen at tick #${frozen.tick}` : undefined}
      onClose={() => setActiveOverlay(null)}
      footer={frozen && beats.length > 0 ? (
        <ProgressRail beats={beats} stepIndex={stepIndex} playing={playing} atEnd={atEnd}
          onJump={(i) => setStepIndex(i)}
          onPrev={() => setStepIndex((i) => Math.max(0, i - 1))}
          onNext={() => setStepIndex((i) => Math.min(beats.length - 1, i + 1))}
          onToggle={() => setPlaying((p) => !p)} onRestart={restart} />
      ) : undefined}>

      {beat && script && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <BeatHeader beat={beat} />
          {beat.phase !== "recap" && (
            <SessionStage nodes={frozen!.nodes as any} candidateIds={script.candidateIds}
              homeId={script.homeId} targetId={script.targetId} phase={beat.phase}
              sessionCount={SESSION_COUNT} active />
          )}
          <Captions resetKey={beat.id} lines={beat.captions} durationMs={beat.durationMs} />
          {beat.phase === "recap" && (
            <RecapSummary frozen={frozen!} script={script} onReplay={restart} />
          )}
        </div>
      )}
    </OverlayShell>
  );
}

function RecapSummary({ frozen, script, onReplay }: {
  frozen: Snap; script: NonNullable<ReturnType<typeof buildSessionScript>>; onReplay: () => void;
}) {
  const nodes = frozen.nodes as any[];
  const home = nodes.find((n) => n.node_id === script.homeId);
  const target = nodes.find((n) => n.node_id === script.targetId);

  const tiles = [
    { k: "SESSIONS SIMULATED", v: String(SESSION_COUNT), sub: "this walkthrough", c: C.text },
    { k: "SCALE-DOWN BLOCKED", v: home?.label ?? "—", sub: "guard kept you online mid-match", c: C.blue },
    { k: "NODE AFFECTED", v: home?.label ?? "—", sub: `crossed ${Math.round(FAIL_CUTOFF * 100)}% risk cutoff`, c: C.accent },
    { k: "MIGRATED TO", v: target?.label ?? "—", sub: "zero dropped sessions", c: C.blue },
    { k: "BACK ONLINE", v: `~${REPAIR_TICKS} ticks`, sub: "self-healed", c: C.green },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 4 }}>
      <div className="panel" style={{ padding: "20px 16px" }}>
        <FlowDiagram />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {tiles.map((t) => (
          <div key={t.k} className="panel" style={{ padding: 13, textAlign: "center" }}>
            <div className="k-label">{t.k}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 19, marginTop: 6, color: t.c }}>{t.v}</div>
            <div className="mono" style={{ fontSize: 9, color: C.muted3, marginTop: 3 }}>{t.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={onReplay} className="mono afc-start-btn" style={ctl(false)}>↺ REPLAY</button>
      </div>
    </div>
  );
}

function BeatHeader({ beat }: { beat: SessionBeat }) {
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <h2 style={{ margin: 0, fontWeight: 700, fontSize: 22, color: C.text }}>{beat.title}</h2>
      {beat.subtitle && (beat.illustrative
        ? <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", padding: "4px 10px",
            borderRadius: 6, color: "#f2c14e", background: hexA("#f2c14e", .14), border: `1px solid ${hexA("#f2c14e", .4)}` }}>
            ⚠ ILLUSTRATIVE · {beat.subtitle}</span>
        : <span className="mono" style={{ fontSize: 11, letterSpacing: ".1em", color: C.muted2 }}>{beat.subtitle}</span>)}
    </div>
  );
}

const ctl = (accent: boolean): React.CSSProperties => ({
  padding: "12px 22px", borderRadius: 10, fontWeight: 700, fontSize: 12.5, letterSpacing: ".03em",
  border: `1px solid ${accent ? hexA(C.accent, .5) : "rgba(255,255,255,.12)"}`,
  background: accent ? "linear-gradient(135deg,#ff4655,#c81e2c)" : C.panel3,
  color: accent ? "#fff" : C.text2, boxShadow: accent ? `0 8px 24px ${hexA(C.accent, .35)}` : "none",
});
