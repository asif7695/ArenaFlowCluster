"use client";
// AI vs Static + Live Kubernetes — the interactive finale. Two live columns from
// one snapshot (ShowdownPanel), the real levers (LiveControlBar), and a compact
// live-K8s panel. This is where judges pull Spike Demand / AI↔Static and watch
// the sim actually respond.
import { useDash } from "@/lib/store";
import { C, hexA } from "@/lib/theme";
import ShowdownPanel from "@/components/liveprocess/ShowdownPanel";
import LiveControlBar from "@/components/liveprocess/LiveControlBar";

export default function ShowdownCard() {
  const { snap } = useDash();
  const k = snap.k8s;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="mono" style={{ textAlign: "center", fontSize: 11, color: C.accent3, letterSpacing: ".06em" }}>
        ▼ pull a lever and watch the two schedulers diverge live ▼
      </div>
      <LiveControlBar spotlight />
      <ShowdownPanel />

      <div className="panel" style={{ padding: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: C.muted2 }}>LIVE KUBERNETES EXECUTION</div>
          <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
            AI capacity drives a real Deployment's replica count
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {k?.enabled ? (
            <>
              <span className="mono" style={{ fontSize: 11, color: k.ok ? C.green : "#f2c14e", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: k.ok ? C.green : "#f2c14e",
                  boxShadow: k.ok ? `0 0 6px ${C.green}` : "none" }} />
                {k.ok ? "CONNECTED" : "degraded"}
              </span>
              <div className="mono" style={{ fontWeight: 700, fontSize: 20, color: C.text }}>
                {k.ready ?? "—"}<span style={{ color: C.muted3, fontSize: 14 }}> / {k.desired ?? "—"}</span>
                <span className="mono" style={{ fontSize: 10, color: C.muted2, fontWeight: 500 }}>&nbsp;pods</span>
              </div>
            </>
          ) : (
            <span className="mono" style={{ fontSize: 10.5, color: C.muted2, padding: "6px 12px", borderRadius: 8,
              background: C.panel3, border: `1px solid ${hexA(C.muted3, .3)}` }}>
              opt-in — run backend with K8S_ENABLED=1
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
