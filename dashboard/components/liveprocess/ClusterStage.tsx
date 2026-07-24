"use client";
// Shared 8x8 cluster grid + a canvas overlay that animates the beat in play:
//   intake  — sessions streaming in from the edges onto the placement node
//   reroute — new sessions curving away from the at-risk node to healthier ones
//   drain   — the failing node pulsing, sessions draining off, then healing
// The grid itself is the real cluster (adapted from Overview's node matrix); the
// canvas layer reuses Landing's DPR-aware, reduced-motion-respecting rAF scaffold
// but is fed real grid-cell positions instead of random drift.
import { useEffect, useRef } from "react";
import { C, statusColor, hexA } from "@/lib/theme";
import type { NodeView } from "@/lib/types";

type Anim = "intake" | "reroute" | "drain" | "none";

interface Dot { t0: number; dur: number; sx: number; sy: number; tx: number; ty: number; }

const COLS = 8;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export default function ClusterStage({
  nodes, focusNodeId, animation, sessionCount = 24, active,
}: {
  nodes: NodeView[]; focusNodeId?: string; animation: Anim; sessionCount?: number; active: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusIndex = focusNodeId ? nodes.findIndex((n) => n.node_id === focusNodeId) : -1;

  useEffect(() => {
    const wrap = wrapRef.current, el = canvasRef.current;
    if (!wrap || !el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let W = 0, H = 0, cw = 0, ch = 0, raf = 0, t = 0;
    let dots: Dot[] = [];

    const center = (i: number) => ({ x: (((i % COLS) + 0.5) * cw), y: ((Math.floor(i / COLS) + 0.5) * ch) });
    const edgePoint = () => {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) return { x: Math.random() * W, y: -10 };
      if (side === 1) return { x: W + 10, y: Math.random() * H };
      if (side === 2) return { x: Math.random() * W, y: H + 10 };
      return { x: -10, y: Math.random() * H };
    };
    const healthyCells = () => {
      const idx = nodes.map((n, i) => ({ n, i }))
        .filter(({ n, i }) => n.status === "healthy" && i !== focusIndex).map(({ i }) => i);
      return idx.length ? idx : nodes.map((_, i) => i).filter((i) => i !== focusIndex);
    };

    const spawnDots = () => {
      dots = [];
      const focus = focusIndex >= 0 ? center(focusIndex) : { x: W / 2, y: H / 2 };
      if (animation === "intake") {
        const n = Math.min(40, Math.max(1, sessionCount));
        for (let k = 0; k < n; k++) {
          const s = edgePoint();
          dots.push({ t0: k * 0.14, dur: 1.1 + Math.random() * 0.5, sx: s.x, sy: s.y, tx: focus.x, ty: focus.y });
        }
      } else if (animation === "reroute") {
        const targets = healthyCells();
        for (let k = 0; k < 14; k++) {
          const tgt = center(targets[k % targets.length]);
          dots.push({ t0: k * 0.18, dur: 1.0 + Math.random() * 0.4, sx: focus.x, sy: focus.y, tx: tgt.x, ty: tgt.y });
        }
      } else if (animation === "drain") {
        for (let k = 0; k < 12; k++) {
          const e = edgePoint();
          dots.push({ t0: k * 0.16, dur: 1.0 + Math.random() * 0.5, sx: focus.x, sy: focus.y, tx: e.x, ty: e.y });
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height; cw = W / COLS; ch = H / COLS;
      el.width = W * dpr; el.height = H * dpr;
      el.style.width = `${W}px`; el.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spawnDots();
    };
    resize();

    const dotColor = animation === "reroute" ? "#f2c14e"
      : animation === "drain" ? C.accent : C.green;

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      // focus-node halo
      if (focusIndex >= 0 && animation !== "none") {
        const f = center(focusIndex);
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);
        // drain cycles detect(red) -> offline(grey) -> heal(green) over ~6s
        let halo = animation === "intake" ? C.green : animation === "reroute" ? "#f2c14e" : C.accent;
        if (animation === "drain") {
          const ph = (t % 6) / 6;
          halo = ph < 0.45 ? C.accent : ph < 0.7 ? C.muted3 : C.green;
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.min(cw, ch) * (0.42 + 0.12 * pulse), 0, Math.PI * 2);
        ctx.strokeStyle = hexA(halo, 0.35 + 0.35 * pulse);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (const d of dots) {
        const p = (t - d.t0) / d.dur;
        if (p < 0) continue;
        if (p >= 1) { d.t0 = t + Math.random() * 0.5; continue; }
        const e = easeInOut(p);
        const x = d.sx + (d.tx - d.sx) * e;
        const y = d.sy + (d.ty - d.sy) * e;
        const fade = Math.sin(Math.min(1, p) * Math.PI); // fade in+out along the path
        ctx.shadowBlur = 8; ctx.shadowColor = dotColor;
        ctx.fillStyle = hexA(dotColor, 0.85 * fade);
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };

    if (reduce || !active || animation === "none") {
      ctx.clearRect(0, 0, W, H); // static: grid only, no motion
    } else {
      draw();
    }
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [animation, focusNodeId, focusIndex, sessionCount, active, nodes]);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS},minmax(0,1fr))`, gap: 6 }}>
        {nodes.map((n, i) => {
          const c = statusColor(n.status);
          const offline = n.status === "offline";
          const pct = offline ? 0 : Math.round(n.cpu_pct);
          const isFocus = i === focusIndex;
          const glow = isFocus ? `0 0 0 2px ${c},0 0 18px ${hexA(c, .6)}`
            : n.status === "critical" ? `0 0 0 1px ${c},0 0 12px ${hexA(c, .45)}`
            : n.status === "degraded" ? `0 0 10px ${hexA(c, .25)}` : "none";
          return (
            <div key={n.node_id} style={{
              background: C.panel2, border: `1px solid ${C.border2}`, borderLeft: `3px solid ${c}`,
              borderRadius: 6, padding: "5px 5px", display: "flex", flexDirection: "column", gap: 4,
              minHeight: 44, minWidth: 0, boxShadow: glow,
              opacity: isFocus || focusIndex < 0 ? 1 : 0.62, transition: "opacity .3s, box-shadow .3s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: c,
                  boxShadow: isFocus ? `0 0 6px ${c}` : "none",
                  animation: isFocus || n.status === "critical" ? "afcpulse 1.1s infinite" : "none" }} />
                <span style={{ fontWeight: 600, fontSize: 9.5, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 8.5, color: C.muted2, flex: "none" }}>{offline ? "—" : `${pct}%`}</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: c }} />
              </div>
            </div>
          );
        })}
      </div>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />
    </div>
  );
}
