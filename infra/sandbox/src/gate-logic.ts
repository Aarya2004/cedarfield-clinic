/** Pure per-IP session gate + model-budget decisions — no platform imports so node:test covers them. */

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
export const DAY_MS = 24 * 60 * 60_000;

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

/**
 * The Gate key for a client address. An IPv6 client owns a whole /64 (often a /56), so keying on the full
 * address would give it unlimited fresh identities (security review A1); the /64 is the household.
 */
export function gateKey(ip: string): string {
  if (!ip) return '0.0.0.0';
  if (!ip.includes(':')) return ip;
  const [head] = ip.split('::');
  const groups = head.split(':').filter(Boolean);
  while (groups.length < 4) groups.push('0');
  return `${groups.slice(0, 4).join(':')}::/64`;
}

// ---- model budget (proxy) ------------------------------------------------------------------

export interface ModelCaps {
  /** weighted calls per session (sid) */
  perSid: number;
  /** weighted calls per sid per rolling minute */
  perSidPerMin: number;
  /** un-settled calls per sid at once (rokan-do is sequential) */
  perSidInflight: number;
  /** weighted calls per client IP per WINDOW_MS (the IP recorded at /api/session — proxy traffic itself arrives from Cloudflare's egress) */
  perIpPerWindow: number;
  /** weighted calls per rolling day, all sessions */
  perDay: number;
  /** all-time spend in micro-dollars (estimates replaced by settled usage) */
  usdTotalMicros: number;
}

export interface ModelCounts {
  sidCalls: number;
  sidCallsLastMin: number;
  sidInflight: number;
  ipCallsInWindow: number;
  ipOldestAt: number | null;
  dayCalls: number;
  dayOldestAt: number | null;
  usdTotalMicros: number;
}

export interface ChargeDecision {
  ok: boolean;
  reason?: 'usd' | 'day' | 'ip' | 'sid' | 'burst' | 'inflight' | 'unbound';
  retry_after_s?: number;
}

const secs = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

/**
 * Pure: may this call be charged? Precedence usd → day → ip → sid → burst → inflight (the widest wall
 * first, so a trip is reported at the level that actually binds). `estUsdMicros` is the pessimistic
 * pre-charge; `weight` is 1 (haiku) or 3 (sonnet).
 */
export function decideCharge(c: ModelCounts, weight: number, estUsdMicros: number, caps: ModelCaps, now: number, sessionExpiresAt: number): ChargeDecision {
  if (sessionExpiresAt <= now) return { ok: false, reason: 'sid', retry_after_s: 1 };
  if (c.usdTotalMicros + estUsdMicros > caps.usdTotalMicros) return { ok: false, reason: 'usd', retry_after_s: 86_400 };
  if (c.dayCalls + weight > caps.perDay) return { ok: false, reason: 'day', retry_after_s: c.dayOldestAt === null ? 3600 : secs(c.dayOldestAt + DAY_MS - now) };
  if (c.ipCallsInWindow + weight > caps.perIpPerWindow) return { ok: false, reason: 'ip', retry_after_s: c.ipOldestAt === null ? 60 : secs(c.ipOldestAt + WINDOW_MS - now) };
  if (c.sidCalls + weight > caps.perSid) return { ok: false, reason: 'sid', retry_after_s: secs(sessionExpiresAt - now) };
  if (c.sidCallsLastMin + weight > caps.perSidPerMin) return { ok: false, reason: 'burst', retry_after_s: 10 };
  if (c.sidInflight >= caps.perSidInflight) return { ok: false, reason: 'inflight', retry_after_s: 5 };
  return { ok: true };
}
