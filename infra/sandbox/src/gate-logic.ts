/** Pure per-IP session gate logic — no platform imports so it is unit-tested with node:test. */

export interface GateRow {
  sid: string;
  created_at: number;
  expires_at: number;
}

export interface GateDecision {
  ok: boolean;
  retry_after_s?: number;
  reason?: 'rate' | 'concurrent';
  active: number;
}

export const WINDOW_MS = 10 * 60_000;

/** Pure: given existing rows for this IP, may a new session start at `now`? */
export function decide(rows: GateRow[], now: number, perWindow: number, maxConcurrent: number): GateDecision {
  const active = rows.filter((r) => r.expires_at > now);
  const recent = rows.filter((r) => r.created_at > now - WINDOW_MS);
  if (active.length >= maxConcurrent) {
    const soonest = Math.min(...active.map((r) => r.expires_at));
    return { ok: false, reason: 'concurrent', retry_after_s: Math.max(1, Math.ceil((soonest - now) / 1000)), active: active.length };
  }
  if (recent.length >= perWindow) {
    const oldest = Math.min(...recent.map((r) => r.created_at));
    return { ok: false, reason: 'rate', retry_after_s: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)), active: active.length };
  }
  return { ok: true, active: active.length };
}

