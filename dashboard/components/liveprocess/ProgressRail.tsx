"use client";
// Step dots + playback controls for the walkthrough. Dots are clickable to jump.
import { C, hexA } from "@/lib/theme";

/** Minimal shape the rail needs from a beat/step. */
interface Beat { id: string; title: string }

export default function ProgressRail({
  beats, stepIndex, playing, atEnd, onJump, onPrev, onToggle, onNext, onRestart,
}: {
  beats: Beat[]; stepIndex: number; playing: boolean; atEnd: boolean;
  onJump: (i: number) => void; onPrev: () => void; onToggle: () => void;
  onNext: () => void; onRestart: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {beats.map((b, i) => {
          const done = i < stepIndex, cur = i === stepIndex;
          return (
            <button key={b.id} onClick={() => onJump(i)} title={b.title} style={{
              display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: cur ? 11 : 9, height: cur ? 11 : 9, borderRadius: "50%",
                background: cur ? C.accent : done ? hexA(C.accent, .5) : "rgba(255,255,255,.14)",
                boxShadow: cur ? `0 0 10px ${C.accent}` : "none", transition: "all .25s" }} />
              {i < beats.length - 1 && <span style={{ width: 18, height: 2, borderRadius: 2,
                background: done ? hexA(C.accent, .45) : "rgba(255,255,255,.1)" }} />}
            </button>
          );
        })}
      </div>

      <span className="mono" style={{ fontSize: 10, color: C.muted2, letterSpacing: ".08em" }}>
        STEP {stepIndex + 1} / {beats.length}
      </span>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <Ctl label="↺ Restart" onClick={onRestart} />
        <Ctl label="‹ Back" onClick={onPrev} disabled={stepIndex === 0} />
        <Ctl label={playing ? "❚❚ Pause" : "▶ Play"} onClick={onToggle} accent />
        <Ctl label="Next ›" onClick={onNext} disabled={atEnd} />
      </div>
    </div>
  );
}

function Ctl({ label, onClick, disabled, accent }: {
  label: string; onClick: () => void; disabled?: boolean; accent?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="mono" style={{
      padding: "7px 12px", borderRadius: 8, fontWeight: 600, fontSize: 11,
      border: `1px solid ${accent ? hexA(C.accent, .45) : "rgba(255,255,255,.1)"}`,
      background: accent ? hexA(C.accent, .14) : C.panel3,
      color: disabled ? C.muted3 : accent ? C.accent3 : C.text2,
      opacity: disabled ? 0.45 : 1 }}>{label}</button>
  );
}
