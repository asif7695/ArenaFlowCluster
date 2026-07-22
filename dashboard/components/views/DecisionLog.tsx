"use client";
import { useDash } from "@/lib/store";
import { C, hexA, actionColor } from "@/lib/theme";

const GRID = "80px 110px 90px minmax(0,1fr) 70px";

export default function DecisionLog() {
  const { snap } = useDash();
  const mode = snap.mode;
  const log = mode === "static" ? snap.log_static : snap.log_ai;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="mono" style={{ fontSize: 10, color: C.muted2 }}>
        showing <span style={{ color: C.accent3 }}>{mode === "static" ? "STATIC BASELINE" : "AI PREDICTIVE"}</span> scheduler — switch via the sidebar toggle
      </div>
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "12px 18px", borderBottom: `1px solid ${C.border}` }}>
          {["TIME", "ACTION", "TARGET", "RATIONALE", "CONF."].map((h) => (
            <span key={h} className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: C.muted3 }}>{h}</span>
          ))}
        </div>
        {log.map((d, i) => {
          const col = actionColor(d.label, d.action);
          const t = d.timestamp ? d.timestamp.split("T")[1]?.slice(0, 8) || "" : "";
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${C.hair}` }}>
              <span className="mono" style={{ fontSize: 10.5, color: C.muted3 }}>{t}</span>
              <span className="mono" style={{ fontSize: 9, fontWeight: 600, padding: "3px 6px", borderRadius: 4, justifySelf: "start",
                color: col, background: hexA(col, .12), border: `1px solid ${hexA(col, .3)}` }}>{d.label}</span>
              <span className="mono" style={{ fontWeight: 600, fontSize: 11.5, color: C.text2 }}>{d.target_node}</span>
              <span className="mono" style={{ fontSize: 11, color: "#a9adb4", minWidth: 0 }}>{d.reason}</span>
              <span className="mono" style={{ fontSize: 11, color: C.green }}>{d.confidence}%</span>
            </div>
          );
        })}
        {!log.length && <div className="mono" style={{ padding: "16px 18px", fontSize: 12, color: C.muted }}>No decisions yet in this window.</div>}
      </div>
    </div>
  );
}
