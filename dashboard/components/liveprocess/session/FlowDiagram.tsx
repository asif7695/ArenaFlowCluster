"use client";
// A compact end-to-end flow diagram for the recap screen: the same beats the
// judge just watched, condensed into one connected strip so the whole arc
// ("predict → place → protect → steer → detect → migrate → heal") reads at
// a glance.
import { C, hexA } from "@/lib/theme";

const STEPS: { icon: string; label: string; color: string }[] = [
  { icon: "●", label: "ARRIVAL", color: C.text2 },
  { icon: "◎", label: "SCORING", color: C.text2 },
  { icon: "◆", label: "PLACED", color: C.green },
  { icon: "⚡", label: "AT SCALE", color: C.green },
  { icon: "⬡", label: "PROTECTED", color: C.blue },
  { icon: "⚠", label: "TROUBLE", color: "#f2c14e" },
  { icon: "✖", label: "DETECTED", color: C.accent },
  { icon: "⇄", label: "MIGRATED", color: C.blue },
  { icon: "✓", label: "HEALED", color: C.green },
];

export default function FlowDiagram() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      flexWrap: "wrap", gap: 0, rowGap: 14 }}>
      {STEPS.map((s, i) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 74 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 15, color: s.color, background: hexA(s.color, .12),
              border: `1px solid ${hexA(s.color, .45)}`, boxShadow: `0 0 10px ${hexA(s.color, .25)}` }}>
              {s.icon}
            </div>
            <span className="mono" style={{ fontSize: 7.5, letterSpacing: ".06em", color: C.muted2, textAlign: "center" }}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <span className="mono" style={{ color: C.muted3, fontSize: 13, margin: "0 2px 16px" }}>→</span>
          )}
        </div>
      ))}
    </div>
  );
}
