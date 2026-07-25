"use client";
// The Session Flow stage: a row of big candidate node cards + labelled session
// tokens positioned by percentage (responsive, no measuring) and moved with CSS
// transitions. Cards animate through health states and show a climbing risk
// meter during the problem beat, so the "placed → fails → migrates → heals" arc
// is legible. Reduced-motion drops the transitions (instant positioning).
import { useEffect, useState } from "react";
import { C, STATUS, statusColor, hexA } from "@/lib/theme";
import type { NodeView, Status } from "@/lib/types";
import type { SessionPhase } from "./sessionScript";

const CARD_TOP = 46;      // px: cards start below the token float band
const FLOAT_TOP = 6;      // px: hero token hovering above the cards
const TRAY_TOP = 188;     // px: token resting in a card's tray

interface Tok { key: string; leftPct: number; top: number; label?: string; color: string; big?: boolean; hidden?: boolean }

export default function SessionStage({
  nodes, candidateIds, homeId, targetId, phase, sessionCount = 25, active,
}: {
  nodes: NodeView[]; candidateIds: string[]; homeId: string; targetId: string;
  phase: SessionPhase; sessionCount?: number; active: boolean;
}) {
  const [reduce, setReduce] = useState(false);
  const [healed, setHealed] = useState(false);
  useEffect(() => { setReduce(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches); }, []);
  // during recovery, flip the home node back to healthy after a beat
  useEffect(() => {
    setHealed(false);
    if (phase !== "recovery") return;
    const id = setTimeout(() => setHealed(true), reduce ? 0 : 2600);
    return () => clearTimeout(id);
  }, [phase, reduce]);

  const cards = candidateIds.map((id) => nodes.find((n) => n.node_id === id)).filter(Boolean) as NodeView[];
  const num = cards.length || 1;
  const homeIdx = Math.max(0, candidateIds.indexOf(homeId));
  const targetIdx = Math.max(0, candidateIds.indexOf(targetId));
  // a sibling card shown parking during the "guarded" beat, so the contrast
  // with the protected home node (which stays active) is visible
  const guardedSiblingIdx = num > 1 ? (homeIdx + 1) % num : -1;
  const cardX = (i: number) => ((i + 0.5) / num) * 100;

  // per-card display status (home node degrades/heals across the arc)
  const displayStatus = (i: number, base: Status): Status => {
    if (phase === "guarded" && i === guardedSiblingIdx) return "offline";
    if (i !== homeIdx) return base;
    if (phase === "trouble") return "degraded";
    if (phase === "problem" || phase === "migration") return "critical";
    if (phase === "recovery") return healed ? "healthy" : "offline";
    return base;
  };
  const riskFor = (i: number): number => {
    if (i !== homeIdx) return 0;
    if (phase === "trouble") return 0.5;
    if (phase === "problem" || phase === "migration") return 0.9;
    return 0;
  };
  const homeCritical = phase === "problem" || phase === "migration";
  const heroAtTarget = phase === "migration" || phase === "recovery";

  // live session counts that visibly change as the hero lands / the cluster
  // fills / load migrates. "PRED. LOAD" (the decision metric) shows only during
  // scoring; once placed we switch to a live SESSIONS count that moves.
  const showLive = phase !== "arrival" && phase !== "scoring";
  const share = Math.max(1, Math.round(sessionCount / num));
  const filled = ["montage", "guarded", "trouble", "problem", "migration", "recovery"].includes(phase);
  const homeBase = (cards[homeIdx]?.active_sessions ?? 0);
  const homeLoad = homeBase + share + 1; // what the home node was hosting pre-drain
  const sessionsOn = (i: number): number => {
    const base = cards[i].active_sessions;
    const heroHere = ["placement", "montage", "guarded", "trouble", "problem"].includes(phase) && i === homeIdx ? 1 : 0;
    let count = base + (filled ? share : 0) + heroHere;
    if (phase === "guarded" && i === guardedSiblingIdx) count = 0; // parked — no traffic
    if (phase === "migration" || phase === "recovery") {
      if (i === homeIdx) count = phase === "recovery" && healed ? base : 0; // drained/emptied
      else if (i === targetIdx) count = base + share + homeLoad;            // received the migration
    }
    return count;
  };
  const showCompanions = ["montage", "guarded", "trouble", "problem", "migration", "recovery"].includes(phase);
  const showSteer = phase === "trouble" || phase === "problem";
  const trayDots = ["montage", "guarded", "trouble", "problem", "migration", "recovery"].includes(phase);

  // ---- token layer ----------------------------------------------------------
  const heroFloating = phase === "arrival" || phase === "scoring";
  const tokens: Tok[] = [
    {
      key: "hero", label: "YOUR SESSION", big: true, color: C.green,
      leftPct: heroFloating ? 50 : cardX(heroAtTarget ? targetIdx : homeIdx),
      top: heroFloating ? FLOAT_TOP : TRAY_TOP,
    },
  ];
  if (showCompanions) {
    for (let k = 0; k < 3; k++) {
      const at = heroAtTarget ? targetIdx : homeIdx;
      tokens.push({ key: `co${k}`, color: hexA(C.green, .8),
        leftPct: cardX(at) + (k - 1) * 6, top: TRAY_TOP + 22 });
    }
  }
  if (showSteer) {
    for (let k = 0; k < 2; k++) {
      tokens.push({ key: `st${k}`, color: "#f2c14e",
        leftPct: cardX(targetIdx) + (k ? 6 : -6), top: TRAY_TOP - 20 });
    }
  }

  const tr = reduce ? "none" : "left .85s cubic-bezier(.5,.1,.2,1), top .7s ease, opacity .45s ease";

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 780, margin: "0 auto", height: 260 }}>
      {/* cards */}
      <div style={{ position: "absolute", top: CARD_TOP, left: 0, right: 0, display: "flex", gap: 10 }}>
        {cards.map((n, i) => {
          const st = displayStatus(i, n.status);
          const c = statusColor(st);
          const isHome = i === homeIdx;
          const risk = riskFor(i);
          const winner = phase === "scoring" || phase === "placement" ? i === homeIdx : false;
          return (
            <div key={n.node_id} style={{
              flex: 1, minWidth: 0, background: C.panel2, borderRadius: 10,
              border: `1px solid ${winner ? hexA(C.green, .6) : C.border2}`,
              borderTop: `3px solid ${c}`, padding: "10px 10px 12px",
              boxShadow: winner ? `0 0 22px ${hexA(C.green, .35)}`
                : st === "critical" ? `0 0 22px ${hexA(c, .5)}`
                : st === "degraded" ? `0 0 14px ${hexA(c, .3)}` : "none",
              transition: "box-shadow .4s, border-color .4s", minHeight: 150 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: c,
                  boxShadow: st === "critical" ? `0 0 6px ${c}` : "none",
                  animation: st === "critical" ? "afcpulse 1.1s infinite" : "none" }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{n.label}</span>
                {isHome && <span className="mono" style={{ marginLeft: "auto", fontSize: 7.5, fontWeight: 700,
                  padding: "2px 5px", borderRadius: 4, color: C.green, background: hexA(C.green, .14) }}>HOME</span>}
              </div>
              {(() => {
                const live = showLive ? sessionsOn(i) : n.forecast_sessions_next_5min;
                return (
                  <>
                    <div className="mono" style={{ fontSize: 8, letterSpacing: ".1em", color: C.muted2, marginTop: 10 }}>
                      {showLive ? "SESSIONS" : "PRED. LOAD"}
                    </div>
                    <div key={live} className="mono afc-anim" style={{ fontWeight: 700, fontSize: 22,
                      color: winner ? C.green : C.text, marginTop: 1, animation: "afcbootfade .35s ease both" }}>
                      {live}
                    </div>
                  </>
                );
              })()}

              {isHome && risk > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: C.muted2 }}>
                    <span>FAILURE RISK</span><span style={{ color: c }}>{Math.round(risk * 100)}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden", marginTop: 3 }}>
                    <div style={{ height: "100%", width: `${risk * 100}%`, background: c,
                      boxShadow: `0 0 6px ${hexA(c, .6)}`, transition: reduce ? "none" : "width .8s ease" }} />
                  </div>
                </div>
              )}
              {isHome && homeCritical && (
                <span className="mono" style={{ display: "inline-block", marginTop: 8, fontSize: 8, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 4, color: C.accent, background: hexA(C.accent, .15),
                  border: `1px solid ${hexA(C.accent, .4)}` }}>⚠ DRAIN</span>
              )}
              {isHome && phase === "guarded" && (
                <span className="mono" style={{ display: "inline-block", marginTop: 8, fontSize: 8, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 4, color: C.blue, background: hexA(C.blue, .15),
                  border: `1px solid ${hexA(C.blue, .4)}` }}>🛡 PROTECTED</span>
              )}
              {phase === "guarded" && i === guardedSiblingIdx && (
                <span className="mono" style={{ display: "inline-block", marginTop: 8, fontSize: 8, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 4, color: C.muted2, background: "rgba(255,255,255,.05)",
                  border: `1px solid ${C.border2}` }}>PARKED — no live match</span>
              )}

              {trayDots && st !== "offline" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 10 }}>
                  {Array.from({ length: Math.min(6, Math.max(1, Math.round(n.active_sessions / 8))) }).map((_, k) => (
                    <span key={k} style={{ width: 5, height: 5, borderRadius: "50%", background: hexA(c, .7) }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* token layer */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {tokens.map((t) => (
          <div key={t.key} className="afc-anim" style={{
            position: "absolute", left: `${t.leftPct}%`, top: t.top, transform: "translateX(-50%)",
            transition: tr, animation: "afcfade .4s ease both",
            display: "flex", alignItems: "center", gap: 5,
            padding: t.big ? "5px 10px" : 0, borderRadius: 20,
            background: t.big ? hexA("#0b0709", .85) : "transparent",
            border: t.big ? `1px solid ${hexA(t.color, .6)}` : "none",
            boxShadow: t.big ? `0 4px 16px ${hexA(t.color, .4)}` : "none" }}>
            <span style={{ width: t.big ? 9 : 7, height: t.big ? 9 : 7, borderRadius: "50%",
              background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
            {t.label && <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: C.text2, whiteSpace: "nowrap" }}>{t.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
