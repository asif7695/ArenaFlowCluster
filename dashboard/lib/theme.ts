import type { Status } from "./types";

// Palette lifted from the dashboard design (dark, red accent).
export const C = {
  bg: "#08090b",
  panel: "#0b0d10",
  panel2: "#0d0f13",
  panel3: "#12151a",
  border: "rgba(255,255,255,.06)",
  border2: "rgba(255,255,255,.05)",
  hair: "rgba(255,255,255,.03)",
  text: "#e7e9ec",
  text2: "#c9ccd1",
  // muted/muted2/muted3 are all tuned to clear WCAG AA's 4.5:1 text contrast
  // minimum against the lightest panel surface in the app (panel3, #12151a) —
  // the original muted2 (~4.0:1) and muted3 (~2.9:1) both failed it.
  muted: "#8b9099",
  muted2: "#828b9c",
  muted3: "#78808e",
  accent: "#ff384a",
  accent2: "#ff5b66",
  accent3: "#ff8791",
  green: "#22c58b",
  blue: "#5b9bff",
};

export const STATUS: Record<Status, { c: string; label: string }> = {
  healthy: { c: "#22c58b", label: "HEALTHY" },
  warning: { c: "#f2c14e", label: "WARNING" },
  degraded: { c: "#f0743a", label: "DEGRADED" },
  critical: { c: "#ff384a", label: "CRITICAL" },
  offline: { c: "#78808e", label: "OFFLINE" }, // matches the WCAG-fixed muted3
  draining: { c: "#5b9bff", label: "DRAINING" }, // still serving — waiting on a live match to end
};

export function statusColor(s: Status): string {
  return (STATUS[s] || STATUS.healthy).c;
}

export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// design-facing action tag colors, keyed by the wire contract's `action`.
export const ACTION_COLOR: Record<string, string> = {
  place: "#22c58b",
  scale_up: "#ff5b66",
  scale_down: "#5b9bff",
  route_away: "#f2c14e",
};

// PARK/WAKE/DRAIN ride scale_down/scale_up on the wire (see ACTION_COLOR above)
// but read better with their own hues — keyed by the decision's `label`, and
// checked first (see actionColor()) so they override the generic action color.
export const LABEL_COLOR: Record<string, string> = {
  PARK: "#8b9099",   // resting — neutral/muted, not urgent
  WAKE: "#22c58b",   // returning to service — good news
  DRAIN: "#ff384a",  // health issue — matches critical
  GUARD: "#f2c14e",  // scale-down blocked by a live match — matches warning
};

export function actionColor(label: string | undefined, action: string): string {
  return (label && LABEL_COLOR[label]) || ACTION_COLOR[action] || "#8b9099";
}
