"use client";
// AI vs Static, side by side, from ONE live snapshot. This is real, not
// choreographed: engine._tick() runs BOTH schedulers every tick, so every
// snapshot already carries log_ai/log_static, capacity_ai/static and the cost
// series for both. Reads the *live* snap (not the frozen one) so judge levers
// visibly move these numbers within a poll.
import { useDash } from "@/lib/store";
import { C, hexA, actionColor } from "@/lib/theme";

function Column({ title, tag, tagColor, active, capacity, incidents, spend, decisions }: {
  title: string; tag: string; tagColor: string; active: boolean;
  capacity: number; incidents: number; spend: number;
  decisions: { label: string; action: string; reason: string; target_node: string }[];
}) {
  return (
    <div className="panel" style={{
      flex: "1 1 300px", minWidth: 0, overflow: "hidden",
      border: `1px solid ${active ? hexA(tagColor, .5) : C.border}`,
      boxShadow: active ? `0 0 24px ${hexA(tagColor, .16)}` : "none", transition: "box-shadow .3s, border-color .3s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 15px", borderBottom: `1px solid ${C.border2}` }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{title}</span>
        <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
          color: tagColor, background: hexA(tagColor, .14), border: `1px solid ${hexA(tagColor, .35)}` }}>{tag}</span>
        {active && <span className="mono" style={{ marginLeft: "auto", fontSize: 8.5, color: C.green,
          display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />ACTIVE
        </span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: C.border2 }}>
        {[
          { k: "NODES", v: String(capacity), c: C.text },
          { k: "INCIDENTS", v: String(incidents), c: incidents > 5 ? C.accent : C.green },
          { k: "SPEND", v: `$${Math.round(spend)}`, c: C.text2 },
        ].map((m) => (
          <div key={m.k} style={{ padding: "12px 12px", background: C.panel }}>
            <div className="k-label">{m.k}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 21, marginTop: 5, color: m.c }}>{m.v}</div>
          </div>
        ))}
      </div>
      <div>
        {decisions.slice(0, 4).map((d, i) => {
          const col = actionColor(d.label, d.action);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${C.hair}` }}>
              <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flex: "none",
                color: col, background: hexA(col, .12), border: `1px solid ${hexA(col, .3)}` }}>{d.label}</span>
              <span className="mono" style={{ fontSize: 10, color: "#a9adb4", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.target_node !== "cluster" ? `${d.target_node} → ` : ""}{d.reason.split(" (")[0]}
              </span>
            </div>
          );
        })}
        {!decisions.length && <div className="mono" style={{ padding: "10px 14px", fontSize: 10, color: C.muted }}>no decisions this tick</div>}
      </div>
    </div>
  );
}

export default function ShowdownPanel() {
  const { snap } = useDash();
  const cost = snap.cost;
  const s = snap.summary;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        <Column title="AI Scheduler" tag="PREDICTIVE" tagColor={C.green} active={snap.mode === "ai"}
          capacity={snap.capacity_ai} incidents={cost.incidents_ai} spend={cost.cost_ai} decisions={snap.log_ai} />
        <Column title="Static Baseline" tag="REACTIVE" tagColor="#f2c14e" active={snap.mode === "static"}
          capacity={snap.capacity_static} incidents={cost.incidents_static} spend={cost.cost_static} decisions={snap.log_static} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {[
          { k: "COST SAVED", v: `${s.savings_pct}%`, sub: "AI vs static", c: C.green },
          { k: "ENERGY SAVED", v: `${s.energy_saved_pct}%`, sub: `${s.nodes_rested} nodes rested`, c: C.blue },
          { k: "INCIDENTS AVOIDED", v: String(Math.max(0, cost.incidents_static - cost.incidents_ai)), sub: "fewer than static", c: C.accent2 },
        ].map((m) => (
          <div key={m.k} className="panel" style={{ padding: 14, textAlign: "center" }}>
            <div className="k-label">{m.k}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 26, marginTop: 6, color: m.c }}>{m.v}</div>
            <div className="mono" style={{ fontSize: 9.5, color: C.muted3, marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
