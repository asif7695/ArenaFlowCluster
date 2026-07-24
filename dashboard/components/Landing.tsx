"use client";
import { useEffect, useRef } from "react";
import { C, hexA } from "@/lib/theme";

const CHIPS: [string, string][] = [
  ["Predict", C.accent2], ["Optimize", C.blue], ["Scale", C.green], ["Heal", "#f2c14e"],
];

/** Living cluster-network background: drifting nodes with proximity links,
 *  a few "hot" (red-glow) nodes. Client-only (uses Math.random + canvas), set
 *  up in useEffect so there is no SSR/hydration mismatch. */
function useClusterNet(ref: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, raf = 0, t = 0;
    let pts: { x: number; y: number; vx: number; vy: number; r: number; ph: number; hot: boolean }[] = [];
    const LINK = 132;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = el.getBoundingClientRect();
      W = r.width; H = r.height;
      el.width = W * dpr; el.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const N = Math.round(Math.min(64, Math.max(34, W / 22)));
      pts = Array.from({ length: N }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
        r: 1.1 + Math.random() * 1.8, ph: Math.random() * Math.PI * 2,
        hot: Math.random() < 0.14,
      }));
    };
    resize();

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(255,56,74,${((1 - d / LINK) * 0.4).toFixed(3)})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 1.6 + p.ph);
        const rr = p.r * (p.hot ? 1.5 : 1);
        ctx.shadowBlur = p.hot ? 14 : 6;
        ctx.shadowColor = p.hot ? "rgba(255,56,74,.9)" : "rgba(255,56,74,.5)";
        ctx.fillStyle = p.hot
          ? `rgba(255,110,120,${(0.75 * pulse).toFixed(3)})`
          : `rgba(255,90,102,${(0.5 * pulse).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };

    if (reduce) { draw(); cancelAnimationFrame(raf); } // one static frame
    else draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [ref]);
}

const corner = (pos: React.CSSProperties): React.CSSProperties => ({
  position: "absolute", width: 30, height: 30, ...pos,
});

export default function Landing({ onStart }: { onStart: () => void }) {
  const netRef = useRef<HTMLCanvasElement>(null);
  useClusterNet(netRef);

  return (
    <div className="afc-anim" style={{ position: "relative", height: "100vh", width: "100%", overflow: "hidden",
      background: "radial-gradient(ellipse at 50% 32%,#1c0e11 0%,#0b0709 55%,#060708 100%)",
      color: C.text, display: "flex", alignItems: "center", justifyContent: "center" }}>

      {/* animated cluster network */}
      <canvas ref={netRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1, opacity: 0.9 }} />

      {/* vignette + panning grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 40%,transparent 20%,rgba(6,7,8,.55) 75%),linear-gradient(180deg,rgba(6,7,8,.5) 0%,rgba(11,7,9,.35) 45%,rgba(28,14,17,.7) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,56,74,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,56,74,.06) 1px,transparent 1px)",
        backgroundSize: "44px 44px", animation: "afcgridpan 14s linear infinite",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 40%,#000 30%,transparent 78%)",
        maskImage: "radial-gradient(ellipse at 50% 40%,#000 30%,transparent 78%)" }} />
      <div style={{ position: "absolute", top: -140, left: "50%", transform: "translateX(-50%)", width: 640, height: 360,
        pointerEvents: "none", background: "radial-gradient(ellipse,rgba(255,56,74,.22),transparent 70%)", filter: "blur(20px)" }} />

      {/* corner brackets */}
      <div style={{ position: "absolute", inset: 24, pointerEvents: "none", zIndex: 2 }}>
        <div style={corner({ top: 0, left: 0, borderTop: `1.5px solid ${hexA(C.accent, .45)}`, borderLeft: `1.5px solid ${hexA(C.accent, .45)}` })} />
        <div style={corner({ top: 0, right: 0, borderTop: `1.5px solid ${hexA(C.accent, .45)}`, borderRight: `1.5px solid ${hexA(C.accent, .45)}` })} />
        <div style={corner({ bottom: 0, left: 0, borderBottom: `1.5px solid ${hexA(C.accent, .45)}`, borderLeft: `1.5px solid ${hexA(C.accent, .45)}` })} />
        <div style={corner({ bottom: 0, right: 0, borderBottom: `1.5px solid ${hexA(C.accent, .45)}`, borderRight: `1.5px solid ${hexA(C.accent, .45)}` })} />
      </div>

      {/* content */}
      <div style={{ position: "relative", zIndex: 3, textAlign: "center", padding: 40, maxWidth: 820, animation: "afcfade .7s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 34 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, boxShadow: `0 0 8px ${C.accent}`, animation: "afcblink 1.6s infinite" }} />
          <span className="mono" style={{ fontWeight: 500, fontSize: 10, letterSpacing: ".34em", color: C.muted }}>CLUSTER&nbsp;INTELLIGENCE&nbsp;·&nbsp;LIVE&nbsp;SIMULATION</span>
        </div>

        {/* AF diamond mark */}
        <div style={{ position: "relative", width: 104, height: 104, margin: "0 auto 30px" }}>
          <div style={{ position: "absolute", inset: -16, borderRadius: "50%", border: `1.5px dashed ${hexA(C.accent, .4)}`, animation: "afcring 9s linear infinite" }} />
          <div style={{ position: "absolute", inset: -8, borderRadius: 26, border: `1px solid ${hexA(C.accent3, .35)}`, boxShadow: `0 0 22px ${hexA(C.accent, .4)},inset 0 0 12px ${hexA(C.accent, .2)}`, transform: "rotate(45deg)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#ff4655,#c81e2c)", borderRadius: 24, transform: "rotate(45deg)", boxShadow: `0 0 46px ${hexA(C.accent, .6)},inset 0 0 20px rgba(255,255,255,.14)`, animation: "afcfloat 5s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 26, background: "#0b0709", borderRadius: 11, transform: "rotate(45deg)" }} />
          <div className="mono" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 32, color: C.accent3 }}>AF</div>
        </div>

        {/* glitch title */}
        <div style={{ position: "relative", display: "inline-block" }}>
          <h1 style={{ margin: 0, position: "relative", fontWeight: 700, fontSize: 66, letterSpacing: "-.02em", lineHeight: 1, textShadow: `0 0 40px ${hexA(C.accent, .35)}`, animation: "afcglitch 5s infinite" }}>
            Arena<span style={{ color: C.accent }}>Flow</span>Cluster
          </h1>
          <span aria-hidden style={{ position: "absolute", inset: 0, fontWeight: 700, fontSize: 66, letterSpacing: "-.02em", lineHeight: 1, color: "#ff2d55", mixBlendMode: "screen", pointerEvents: "none", animation: "afcglitchR 5s infinite" }}>ArenaFlowCluster</span>
          <span aria-hidden style={{ position: "absolute", inset: 0, fontWeight: 700, fontSize: 66, letterSpacing: "-.02em", lineHeight: 1, color: "#22d3ee", mixBlendMode: "screen", pointerEvents: "none", animation: "afcglitchC 5s infinite" }}>ArenaFlowCluster</span>
        </div>
        <p style={{ margin: "20px 0 0", fontWeight: 500, fontSize: 19, color: C.text2, lineHeight: 1.5 }}>
          AI-Powered Kubernetes Orchestrator<br />for Online Gaming Platforms
        </p>

        {/* capability chips */}
        <div style={{ display: "flex", gap: 11, justifyContent: "center", flexWrap: "wrap", margin: "30px 0 0" }}>
          {CHIPS.map(([label, c]) => (
            <span key={label} style={{ padding: "7px 15px", borderRadius: 8, fontWeight: 600, fontSize: 12,
              color: c, background: hexA(c, .13), border: `1px solid ${hexA(c, .35)}` }}>{label}</span>
          ))}
        </div>

        <div className="mono" style={{ fontWeight: 600, fontSize: 13, letterSpacing: ".16em", color: C.muted, margin: "30px 0 40px" }}>
          INTELLIGENT&nbsp;·&nbsp;AUTONOMOUS&nbsp;·&nbsp;ADAPTIVE
        </div>

        <button onClick={onStart} className="afc-start-btn" style={{ position: "relative", overflow: "hidden", padding: "17px 46px",
          border: `1px solid ${hexA(C.accent, .5)}`, borderRadius: 12, background: "linear-gradient(135deg,#ff4655,#c81e2c)",
          color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: ".04em", cursor: "pointer", boxShadow: `0 10px 34px ${hexA(C.accent, .4)}` }}>
          <span style={{ position: "absolute", top: 0, bottom: 0, width: "40%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent)", animation: "afcscan 2.6s linear infinite" }} />
          <span style={{ position: "relative" }}>▶&nbsp;&nbsp;START SIMULATION</span>
        </button>
      </div>
    </div>
  );
}
