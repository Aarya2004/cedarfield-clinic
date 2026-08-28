/**
 * A judge session survives a page reload: the Worker's `{ws, token}` and its expiry are kept in
 * sessionStorage (this tab only — the token never leaves the tab, same posture as the URL fragment)
 * and re-used on load while unexpired. The bridge's judge-mode takeover makes the reconnect win
 * over the old socket. Pure helpers, unit-tested; `session.ts` wires them.
 */
export const JUDGE_KEY = 'rokan.judge';

export interface JudgePairing {
  ws: string;
  token: string;
  expires_at: number;
}

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function saveJudgePairing(storage: StorageLike | null, p: { ws: string; token: string }, ttlMs: number, now = Date.now()): void {
  if (!storage || !Number.isFinite(ttlMs) || ttlMs <= 0) return;
  try {
    storage.setItem(JUDGE_KEY, JSON.stringify({ ws: p.ws, token: p.token, expires_at: now + ttlMs } satisfies JudgePairing));
  } catch {
    /* storage unavailable */
  }
}

/** The stored pairing when it exists and has at least 60 s left; otherwise null (and the stale entry is removed). */
export function loadJudgePairing(storage: StorageLike | null, now = Date.now()): JudgePairing | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(JUDGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<JudgePairing>;
    if (typeof p.ws !== 'string' || typeof p.token !== 'string' || typeof p.expires_at !== 'number' || p.expires_at - now < 60_000) {
      storage.removeItem(JUDGE_KEY);
      return null;
    }
    return { ws: p.ws, token: p.token, expires_at: p.expires_at };
  } catch {
    return null;
  }
}

export function clearJudgePairing(storage: StorageLike | null): void {
  try {
    storage?.removeItem(JUDGE_KEY);
  } catch {
    /* ignore */
  }
}
