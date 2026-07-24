"use client";
// Failure self-healing from the cluster/ops lens: a node crossing the risk
// cutoff is drained offline, repaired, and woken back healthy. Reuses the
// ClusterStage "drain" animation on the real failing node, with the same
// honest real-vs-illustrative framing used elsewhere.
import { useDash } from "@/lib/store";
import { C, hexA } from "@/lib/theme";
import type { NodeView } from "@/lib/types";
import ClusterStage from "@/components/liveprocess/ClusterStage";

const FAIL_CUTOFF = 0.6, REPAIR_TICKS = 10;
const pct = (r: number) => `${Math.round(r * 100)}%`;

export default function SelfHealCard() {
  const { snap } = useDash();
  const nodes = snap.nodes as NodeView[];
  const drain = snap.log_ai.find((d) => d.label === "DRAIN");
  const wake = snap.log_ai.find((d) => d.label === "WAKE");
  const critical = nodes.find((n) => n.status === "critical" || (n.status === "offline" && n.offline_reason === "repair"));
  const highest = nodes.filter((n) => n.status !== "offline")
    .reduce((a, b) => (b.failure_risk_score > a.failure_risk_score ? b : a), nodes[0]);
  const hasReal = !!drain || !!critical;
  const focus = (drain && nodes.find((n) => n.label === drain.target_node)) || critical || highest;

  const lines = hasReal
    ? [
      drain?.reason ?? `${focus.label} crossed the ${pct(FAIL_CUTOFF)} failure cutoff — draining offline for repair.`,
      "The node is pulled fully offline so no player is routed onto failing hardware.",
      wake?.reason ?? `After ~${REPAIR_TICKS} ticks the repair completes and the node wakes back into service healthy.`,
    ]
    : [
      focus ? `${focus.label} is at ${pct(focus.failure_risk_score)} failure risk right now — under the cutoff, serving normally.` : "All nodes healthy.",
      `If risk crosses the ${pct(FAIL_CUTOFF)} cutoff, the scheduler drains that node offline for ${REPAIR_TICKS} ticks to repair — no player waits on failing hardware.`,
      "When repair completes, it wakes back healthy. The animation shows that detect → drain → repair → wake cycle.",
    ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!hasReal && (
        <div className="mono" style={{ alignSelf: "center", fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em",
          padding: "4px 10px", borderRadius: 6, color: "#f2c14e", background: hexA("#f2c14e", .14),
          border: `1px solid ${hexA("#f2c14e", .4)}` }}>⚠ ILLUSTRATIVE — no node is failing right now</div>
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
    </div>
  );
}
