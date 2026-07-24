"use client";
// Energy saving via predictive consolidation: idle nodes parked to rest when
// demand is low, woken ahead of a rising forecast. Shows the real parked count,
// energy-saved %, and the PARK/WAKE decisions from the AI log.
import { useDash } from "@/lib/store";
import { C, hexA, statusColor, actionColor } from "@/lib/theme";
import type { NodeView } from "@/lib/types";

export default function EnergyCard() {
  const { snap } = useDash();
  const nodes = snap.nodes as NodeView[];
  const parkWake = snap.log_ai.filter((d) => d.label === "PARK" || d.label === "WAKE").slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { k: "NODES RESTED", v: String(snap.summary.nodes_rested), sub: "parked, drawing ~0 power", c: C.blue },
          { k: "ENERGY SAVED", v: `${snap.summary.energy_saved_pct}%`, sub: "vs always-on static", c: C.green },
          { k: "ACTIVE SERVERS", v: String(snap.summary.active_nodes), sub: `of ${snap.summary.total_nodes}`, c: C.text },
        ].map((m) => (
          <div key={m.k} className="panel" style={{ padding: 13 }}>
            <div className="k-label">{m.k}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 22, marginTop: 6, color: m.c }}>{m.v}</div>
            <div className="mono" style={{ fontSize: 9.5, color: C.muted3, marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2, marginBottom: 10 }}>
          CLUSTER — parked nodes dimmed
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(16,1fr)", gap: 4 }}>
          {nodes.map((n) => {
            const off = n.status === "offline";
            const c = statusColor(n.status);
            return (
              <div key={n.node_id} title={`${n.label} · ${off ? (n.offline_reason === "repair" ? "repairing" : "resting") : n.status}`}
                style={{ aspectRatio: "1", borderRadius: 3, background: off ? "rgba(255,255,255,.05)" : hexA(c, .8),
                  border: off ? `1px dashed ${hexA(C.muted3, .5)}` : "none",
                  boxShadow: off ? "none" : `0 0 5px ${hexA(c, .5)}` }} />
            );
          })}
        </div>
      </div>

      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="mono" style={{ padding: "11px 14px", borderBottom: `1px solid ${C.border2}`, fontSize: 10, letterSpacing: ".12em", color: C.muted2 }}>
          RECENT PARK / WAKE DECISIONS
        </div>
        {parkWake.map((d, i) => {
          const col = actionColor(d.label, d.action);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: `1px solid ${C.hair}` }}>
              <span className="mono" style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flex: "none",
                color: col, background: hexA(col, .12), border: `1px solid ${hexA(col, .3)}` }}>{d.label}</span>
              <span className="mono" style={{ fontSize: 11, color: "#a9adb4", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.reason}</span>
            </div>
          );
        })}
        {!parkWake.length && <div className="mono" style={{ padding: "11px 14px", fontSize: 11, color: C.muted }}>demand steady — no parking action this tick</div>}
      </div>
    </div>
  );
}
