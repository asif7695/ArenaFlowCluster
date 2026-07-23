"use client";
import { C } from "@/lib/theme";

const LINES = [
  "telemetry stream connected · 64 nodes",
  "forecasting model loaded · scikit-learn",
  "anomaly classifier armed",
  "scheduler online · predictive mode",
];

/** Initialization sequence shown for ~1.75s between the landing page and the
 *  dashboard (see store.startSim). Purely presentational. */
export default function Boot() {
  return (
    <div className="afc-anim" style={{ position: "fixed", inset: 0, zIndex: 50,
      background: "radial-gradient(ellipse at 50% 45%,#180b0e,#07080a 70%)", color: C.text,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      animation: "afcbootfade .3s ease both" }}>

      {/* dual-ring spinner */}
      <div style={{ position: "relative", width: 70, height: 70, marginBottom: 30 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(255,56,74,.18)", borderTopColor: C.accent, animation: "afcspin .9s linear infinite" }} />
        <div style={{ position: "absolute", inset: 10, borderRadius: "50%", border: "2px solid rgba(255,56,74,.12)", borderBottomColor: C.accent3, animation: "afcspin 1.4s linear infinite reverse" }} />
        <div className="mono" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: C.accent3 }}>AF</div>
      </div>

      <div className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".3em", color: C.text2, marginBottom: 22 }}>INITIALIZING CLUSTER</div>

      <div style={{ width: 340, maxWidth: "78vw", height: 4, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", background: "linear-gradient(90deg,#c81e2c,#ff5b66)", boxShadow: "0 0 12px rgba(255,56,74,.7)", animation: "afcbootbar 1.5s cubic-bezier(.6,.02,.2,1) forwards" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 26, width: 340, maxWidth: "78vw" }}>
        {LINES.map((txt, i) => (
          <div key={txt} className="mono" style={{ fontWeight: 500, fontSize: 10.5, color: C.muted,
            opacity: 0, animation: `afcbootfade .3s ease ${(0.25 + i * 0.32).toFixed(2)}s forwards` }}>
            <span style={{ color: C.green }}>▸</span>&nbsp;{txt}
          </div>
        ))}
      </div>
    </div>
  );
}
