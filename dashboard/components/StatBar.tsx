"use client";
import { useDash } from "@/lib/store";
import { C } from "@/lib/theme";

export default function StatBar() {
  const { snap } = useDash();
  const s = snap.summary;
  const counts = snap.counts;

  const items: { k: string; v: string; sub: string; color?: string }[] = [
    { k: "ACTIVE NODES", v: `${s.active_nodes}/${s.total_nodes}`, sub: counts.critical ? `${counts.critical} crit` : "ok" },
    { k: "NODES RESTED", v: String(s.nodes_rested), sub: `-${s.energy_saved_pct}% energy`, color: s.nodes_rested ? C.green : undefined },
    { k: "SESSIONS", v: s.sessions.toLocaleString(), sub: "live" },
    { k: "AVG LATENCY", v: `${s.avg_latency}ms`, sub: "p50", color: s.avg_latency > 90 ? "#f0743a" : undefined },
    { k: "DEMAND INDEX", v: String(s.demand_index), sub: "/100", color: C.accent2 },
    { k: "HEALTH", v: String(s.healthy), sub: "nominal", color: C.green },
    { k: "COST vs STATIC", v: `-${s.savings_pct}%`, sub: "saved", color: C.green },
  ];

  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: "#0a0b0d" }}>
      {items.map((it) => (
        <div key={it.k} style={{ flex: 1, padding: "11px 16px", borderRight: "1px solid rgba(255,255,255,.04)" }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".12em", color: C.muted2 }}>{it.k}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 20, color: it.color || C.text }}>{it.v}</span>
            <span className="mono" style={{ fontSize: 10, color: C.muted3 }}>{it.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
