import type { Mode, Scenario } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export const POLL_MS = Number(process.env.NEXT_PUBLIC_POLL_MS || 2000);

export async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export async function postControl(body: {
  running?: boolean;
  mode?: Mode;
  scenario?: Scenario;
}): Promise<void> {
  await fetch(`${API_BASE}/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
