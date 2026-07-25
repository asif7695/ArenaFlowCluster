"use client";
// Session Safety and Scale-Down Guard — never drop a live match. A scale-down
// candidate still holding sessions is diverted to draining (new matches stop
// routing there) instead of being parked immediately. A health-critical drain
// still goes down right away — health can't wait — but its match is migrated
// live to a node with spare capacity when one exists, or recorded as lost
// when none does. Reuses ClusterStage's "drain" animation and the same
// real-vs-illustrative framing as SelfHealCard.
import { useDash } from "@/lib/store";
import { C, hexA, actionColor } from "@/lib/theme";
import type { NodeView } from "@/lib/types";
import ClusterStage from "@/components/liveprocess/ClusterStage";

export default function SafetyGuardCard() {
  const { snap } = useDash();
  const nodes = snap.nodes as NodeView[];
  const s = snap.summary;

  const guard = snap.log_ai.find((d) => d.label === "GUARD");
  const drain = snap.log_ai.find((d) => d.label === "DRAIN" && d.outcome);
  const draining = nodes.find((n) => n.status === "draining");
  const drainFocus = drain ? nodes.find((n) => n.label === drain.target_node) : undefined;
  const focus = draining || drainFocus;
  const hasReal = !!guard || !!drain;

  const kpis = [
    { k: "SCALE-DOWNS BLOCKED", v: String(s.blocked_scaledowns), sub: "live match in progress", c: C.blue },
    { k: "PLAYERS PROTECTED", v: String(s.players_migrated), sub: "moved, zero drop", c: C.green },
    { k: "SAFE DRAINS", v: String(s.safe_drains), sub: "migrated or finished", c: C.text },
  ];

  const lines = hasReal
    ? [
      guard?.reason ?? "No scale-down is currently being blocked by a live match.",
      drain?.reason ?? "No health-critical drain has happened yet this run.",
      `${s.players_impacted} players touched by a scaling action so far — `
        + `${s.players_migrated} migrated safely, ${s.players_dropped} dropped.`,
    ]
    : [
      "Every scale-down so far had zero active players — nothing to protect yet.",
      "If a park candidate still has live players, the guard diverts it to draining "
        + "instead: new matches stop routing there and it waits until empty before resting.",
      "If a node must go down immediately (health-critical), its match is migrated live "
        + "to a node with spare capacity, or finished if none exists — either way it's recorded here.",
    ];

  const guardLog = snap.log_ai.filter((d) => d.label === "GUARD" || d.label === "DRAIN").slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {kpis.map((m) => (
          <div key={m.k} className="panel" style={{ padding: 13 }}>
            <div className="k-label">{m.k}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 22, marginTop: 6, color: m.c }}>{m.v}</div>
            <div className="mono" style={{ fontSize: 9.5, color: C.muted3, marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {!hasReal && (
        <div className="mono" style={{ alignSelf: "center", fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em",
          padding: "4px 10px", borderRadius: 6, color: "#f2c14e", background: hexA("#f2c14e", .14),
          border: `1px solid ${hexA("#f2c14e", .4)}` }}>⚠ ILLUSTRATIVE — nothing blocked or drained yet this run</div>
      )}
      <div className="panel" style={{ padding: 16 }}>
        <ClusterStage nodes={nodes} focusNodeId={focus?.node_id} animation="drain" active />
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, maxWidth: 700, marginInline: "auto" }}>
        {lines.map((l, i) => (
          <li key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: i === 0 ? C.text : C.text2 }}>
            <span className="mono" style={{ color: C.accent3, fontWeight: 700, flex: "none" }}>{i + 1}.</span>{l}
          </li>
        ))}
      </ul>

      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="mono" style={{ padding: "11px 14px", borderBottom: `1px solid ${C.border2}`, fontSize: 10, letterSpacing: ".12em", color: C.muted2 }}>
          RECENT GUARD / DRAIN DECISIONS
        </div>
        {guardLog.map((d, i) => {
          const col = actionColor(d.label, d.action);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: `1px solid ${C.hair}` }}>
              <span className="mono" style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flex: "none",
                color: col, background: hexA(col, .12), border: `1px solid ${hexA(col, .3)}` }}>{d.label}</span>
              <span className="mono" style={{ fontSize: 11, color: "#a9adb4", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.reason}</span>
              {typeof d.players === "number" && d.players > 0 && (
                <span className="mono" style={{ fontSize: 10, color: C.muted3, flex: "none" }}>{d.players}p</span>
              )}
            </div>
          );
        })}
        {!guardLog.length && <div className="mono" style={{ padding: "11px 14px", fontSize: 11, color: C.muted }}>no guard/drain activity yet this run</div>}
      </div>
    </div>
  );
}
