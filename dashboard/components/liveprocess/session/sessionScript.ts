// Beat/script builder for the Session Flow story — ONLY session control:
// placement (by predicted load), the Session Safety Guard blocking a
// cost-driven park mid-match, then the problem → detect → migrate → recover
// arc for a health-driven drain on the hero session's home node. Pure: same
// input → same beats.
//
// The problem arc (and the guard beat) are deliberately *illustrative*
// teaching scenarios applied to the hero's home node ("if your node develops
// a fault…" / "if the scheduler wants to park your node…"), using the real
// config thresholds/labels — never claiming the simulator literally singles
// out this one session (route_away steers only NEW sessions; a drain or park
// acts on the whole node). See the plan's honesty note.
import type { Snap } from "@/lib/store";
import type { NodeView } from "@/lib/types";

export const ROUTE_AWAY_RISK = 0.4;
export const FAIL_CUTOFF = 0.6;
export const REPAIR_TICKS = 10;

export type SessionPhase =
  | "arrival" | "scoring" | "placement" | "montage" | "guarded"
  | "trouble" | "problem" | "migration" | "recovery" | "recap";

export interface SessionBeat {
  id: string;
  phase: SessionPhase;
  title: string;
  subtitle?: string;
  durationMs: number;      // Infinity on the recap (judge-paced, holds the CTA)
  captions: string[];
  illustrative?: boolean;
}

export interface SessionScript {
  beats: SessionBeat[];
  candidateIds: string[];  // the ~5 nodes shown as cards
  homeId: string;          // placement winner = hero's home node
  targetId: string;        // healthy node the hero migrates to
}

function healthyPool(nodes: NodeView[]): NodeView[] {
  const healthy = nodes.filter((n) => n.status === "healthy");
  return (healthy.length >= 5 ? healthy : nodes.filter((n) => n.status !== "offline"))
    .slice()
    .sort((a, b) => a.forecast_sessions_next_5min - b.forecast_sessions_next_5min);
}

/** 5 candidate cards spread across the predicted-load range, home = lowest. */
function pickCandidates(pool: NodeView[]): NodeView[] {
  if (pool.length <= 5) return pool;
  const idx = [0, Math.floor(pool.length / 4), Math.floor(pool.length / 2),
    Math.floor((pool.length * 3) / 4), pool.length - 1];
  const seen = new Set<number>();
  const out: NodeView[] = [];
  for (const i of idx) if (!seen.has(i)) { seen.add(i); out.push(pool[i]); }
  return out;
}

export function buildSessionScript(snap: Snap, sessionCount: number): SessionScript {
  const nodes = snap.nodes as NodeView[];
  const N = Math.max(1, Math.min(200, Math.round(sessionCount)));
  const pool = healthyPool(nodes);
  const candidates = pickCandidates(pool);
  const home = candidates[0] ?? nodes[0];
  const target = candidates.find((n) => n.node_id !== home.node_id && n.status === "healthy")
    ?? candidates[1] ?? home;

  const placeDec = snap.log_ai.find((d) => d.label === "PLACE");
  const placeReason = placeDec?.reason
    ?? `placed new session on ${home.label} — lowest predicted 5-min load (${home.forecast_sessions_next_5min} sessions)`;

  const pctRisk = (r: number) => `${Math.round(r * 100)}%`;

  const beats: SessionBeat[] = [
    {
      id: "arrival", phase: "arrival", title: "A player connects",
      subtitle: "one new session", durationMs: 3500,
      captions: ["A new player joins — their match needs a home node."],
    },
    {
      id: "scoring", phase: "scoring", title: "Scoring the candidates",
      subtitle: "predicted 5-min load", durationMs: 7000,
      captions: [
        "The scheduler ranks nodes by *predicted* 5-minute load — not just what they're doing right now.",
        "Lowest predicted load wins: room to grow without crowding a node that's about to spike.",
      ],
    },
    {
      id: "placement", phase: "placement", title: "Placed on the safest node",
      subtitle: home.label, durationMs: 5000,
      captions: [placeReason.split(" (")[0] + (placeReason.includes("(") ? ` (${placeReason.split("(")[1]}` : "")],
    },
    {
      id: "montage", phase: "montage", title: "Every session, the same way",
      subtitle: `${N} placed`, durationMs: Math.min(12000, Math.max(6000, 6000 + N * 30)),
      captions: [`The same rule places all ${N} of your sessions in milliseconds — balanced across healthy nodes.`],
    },
    {
      id: "guarded", phase: "guarded", title: "Protected mid-match", illustrative: true,
      subtitle: `${home.label} · scale-down blocked`, durationMs: 6500,
      captions: [
        `Demand dips and the scheduler looks to park idle nodes to cut cost — ${home.label} is a candidate.`,
        "But your match is still live there. The Session Safety Guard blocks the park: no new matches route to it, and it keeps serving you until you're done.",
      ],
    },
    {
      id: "trouble", phase: "trouble", title: "Trouble brewing", illustrative: true,
      subtitle: `${home.label} · risk climbing`, durationMs: 6500,
      captions: [
        `Minutes later, *${home.label}* starts to struggle — latency and failure-risk climbing past ${pctRisk(ROUTE_AWAY_RISK)}.`,
        "The model sees it *before* players feel any lag — and new matches already steer elsewhere.",
      ],
    },
    {
      id: "problem", phase: "problem", title: "Problem detected", illustrative: true,
      subtitle: `${home.label} · over the cutoff`, durationMs: 6000,
      captions: [`Risk crosses the ${pctRisk(FAIL_CUTOFF)} failure cutoff — ${home.label} is flagged to drain for repair.`],
    },
    {
      id: "migration", phase: "migration", title: "Your session migrates", illustrative: true,
      subtitle: `${home.label} → ${target.label}`, durationMs: 8000,
      captions: [
        "A draining server hands its live matches to healthy nodes *first* — so nobody drops.",
        `Your session hops to *${target.label}* and keeps playing, uninterrupted.`,
      ],
    },
    {
      id: "recovery", phase: "recovery", title: "Self-healing", illustrative: true,
      subtitle: `${home.label} repairing`, durationMs: 5000,
      captions: [`${home.label} goes offline to self-repair (~${REPAIR_TICKS} ticks), then rejoins the pool healthy.`],
    },
    {
      id: "recap", phase: "recap", title: "That's session control",
      subtitle: "predict · guard · steer · protect", durationMs: Infinity,
      captions: [
        "*Predict* → place on the safest node. *Guard* → block a scale-down while you're mid-match. *Steer* → move new matches off rising risk. *Protect* → migrate live players off a failure.",
        "Now explore the rest of the system →",
      ],
    },
  ];

  return { beats, candidateIds: candidates.map((n) => n.node_id), homeId: home.node_id, targetId: target.node_id };
}
