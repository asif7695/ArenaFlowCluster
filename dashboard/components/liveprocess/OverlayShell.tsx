"use client";
// Shared full-screen chrome for both explainer overlays: radial backdrop, a top
// bar with a live dot + title + close, esc-to-close, and body scroll-lock while
// open. Children render the overlay body; the footer slot holds persistent
// controls (levers / progress rail). Effects run only after mount — hydration
// safe, matching Header.tsx / Landing.tsx.
import { useEffect } from "react";
import { C } from "@/lib/theme";

export default function OverlayShell({
  title, badge, onClose, footer, children,
}: {
  title: string; badge?: string; onClose: () => void;
  footer?: React.ReactNode; children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="afc-anim" style={{
      position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column",
      color: C.text, animation: "afcfade .35s ease both",
      background: "radial-gradient(ellipse at 50% 26%,#1a0d10 0%,#0a0709 55%,#060708 100%)" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px",
        borderBottom: `1px solid ${C.border}` }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent,
          boxShadow: `0 0 8px ${C.accent}`, animation: "afcblink 1.6s infinite" }} />
        <span className="mono" style={{ fontWeight: 700, fontSize: 12, letterSpacing: ".16em", color: C.text2 }}>
          {title}
        </span>
        {badge && <span className="mono" style={{ fontSize: 10, color: C.muted2 }}>· {badge}</span>}
        <button onClick={onClose} className="mono afc-start-btn" style={{
          marginLeft: "auto", padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
          border: "1px solid rgba(255,255,255,.12)", background: C.panel3, color: C.text2 }}>
          ✕ CLOSE&nbsp;&nbsp;<span style={{ color: C.muted3 }}>esc</span>
        </button>
      </div>

      <div className="scrolly" style={{ flex: 1, overflowY: "auto", padding: "26px 22px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>{children}</div>
      </div>

      {footer && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 22px", display: "flex",
          flexDirection: "column", gap: 12, background: "rgba(0,0,0,.2)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}
