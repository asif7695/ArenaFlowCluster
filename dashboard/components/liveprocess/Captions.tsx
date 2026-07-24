"use client";
// Progressive caption reveal + an eased 0→N counter. Both start their timers
// inside useEffect (never during render) — hydration-safe. Reduced-motion shows
// everything at once. Shared by the session story and the feature cards.
import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/theme";

// turn *word* into an accent-colored emphasis span (captions use it sparingly)
function emph(s: string): string {
  const safe = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return safe.replace(/\*([^*]+)\*/g, `<span style="color:${C.accent3};font-weight:600">$1</span>`);
}

export function Captions({ resetKey, lines, durationMs, align = "center" }: {
  resetKey: string; lines: string[]; durationMs: number; align?: "center" | "left";
}) {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    setShown(1);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || lines.length <= 1) { setShown(lines.length); return; }
    const step = Math.min(2600, Math.max(1400, (isFinite(durationMs) ? durationMs : 8000) / lines.length));
    const id = setInterval(() => setShown((s) => Math.min(lines.length, s + 1)), step);
    return () => clearInterval(id);
  }, [resetKey, lines.length, durationMs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 680,
      margin: align === "center" ? "0 auto" : undefined }}>
      {lines.slice(0, shown).map((l, i) => (
        <p key={i} className="afc-anim" style={{
          margin: 0, fontSize: i === 0 ? 15.5 : 13.5, lineHeight: 1.5,
          color: i === 0 ? C.text : C.text2, textAlign: align,
          animation: "afcfade .5s ease both" }}
          dangerouslySetInnerHTML={{ __html: emph(l) }} />
      ))}
    </div>
  );
}

/** Eases a counter 0 → to across durationMs (rAF, started in useEffect). */
export function Counter({ to, durationMs }: { to: number; durationMs: number }) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(to); return; }
    const start = performance.now();
    const dur = Math.min(durationMs, 6000);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); // easeOutCubic
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, durationMs]);
  return <>{v}</>;
}
