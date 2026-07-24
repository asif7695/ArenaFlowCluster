"use client";
import { useRouter } from "next/navigation";
import { useDash } from "@/lib/store";
import { C, statusColor, hexA, STATUS } from "@/lib/theme";

const GRID = "90px 70px minmax(0,1fr) 90px 90px 90px";

export default function Alerts() {
  const { snap } = useDash();
  const router = useRouter();
  const alerts = snap.alerts;

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "12px 18px", borderBottom: `1px solid ${C.border}` }}>
        {["SEVERITY", "NODE", "SIGNAL", "LEAD TIME", "CONF.", "STATUS"].map((h) => (
          <span key={h} className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: C.muted3 }}>{h}</span>
        ))}
      </div>
      {alerts.map((a) => {
        const col = statusColor(a.severity);
        return (
          <button key={a.id} onClick={() => router.push(`/node/${a.node_id}`)} style={{
            display: "grid", gridTemplateColumns: GRID, gap: 10, alignItems: "center", padding: "13px 18px",
            borderBottom: `1px solid ${C.hair}`, textAlign: "left", width: "100%" }}>
            <span className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".06em", padding: "4px 8px", borderRadius: 5,
              color: col, background: hexA(col, .13), border: `1px solid ${hexA(col, .3)}`, justifySelf: "start" }}>{STATUS[a.severity].label}</span>
            <span className="mono" style={{ fontWeight: 600, fontSize: 12, color: C.text2 }}>{a.node}</span>
            <span className="mono" style={{ fontSize: 11.5, color: "#a9adb4", minWidth: 0 }}>{a.msg}</span>
            <span className="mono" style={{ fontSize: 11, color: C.accent3 }}>{a.lead}</span>
            <span className="mono" style={{ fontSize: 11, color: C.muted }}>{a.confidence}%</span>
            <span className="mono" style={{ fontSize: 9, fontWeight: 600, padding: "4px 8px", borderRadius: 5, color: C.accent, background: hexA(C.accent, .12), justifySelf: "start" }}>{a.status}</span>
          </button>
        );
      })}
      {!alerts.length && <div className="mono" style={{ padding: "16px 18px", fontSize: 12, color: C.green }}>No active alerts — all 64 nodes nominal.</div>}
    </div>
  );
}
