/**
 * Gate — two jobs, one sqlite-backed Durable Object class:
 *   • per-IP (per /64) session rate limit: one instance per client key, `allow/confirm/release`, and an
 *     alarm that destroys a session's sandbox at its TTL (idle instances otherwise count against
 *     max_instances until sleepAfter).
 *   • the model budget, one singleton instance (`MODEL_BUDGET_NAME`): sid→IP binding, per-sid / per-IP /
 *     per-day weighted call counters and the all-time USD ledger behind the `/api/model/:sid` proxy.
 *     Reserve-before-forward: a call is charged at its pessimistic estimate, then settled from `usage`.
 */
import { DurableObject } from 'cloudflare:workers';
import { getSandbox } from '@cloudflare/sandbox';
import { decide, decideCharge, DAY_MS, WINDOW_MS, type ChargeDecision, type GateDecision, type GateRow, type ModelCaps, type ModelCounts } from './gate-logic';

export { decide, WINDOW_MS };
export type { GateDecision, GateRow, ModelCaps, ChargeDecision };

export const MODEL_BUDGET_NAME = 'model-budget';
/** An un-settled call older than this is treated as abandoned (client gave up; the reservation stays charged). */
const INFLIGHT_STALE_MS = 120_000;

interface GateEnv {
  Sandbox: DurableObjectNamespace;
}

export class Gate extends DurableObject<GateEnv> {
  private ready = false;

  private init(): void {
    if (this.ready) return;
    const sql = this.ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
    try {
      sql.exec('ALTER TABLE sessions ADD COLUMN sandbox_id TEXT');
    } catch {
      /* column exists */
    }
    try {
      sql.exec('ALTER TABLE sessions ADD COLUMN destroyed INTEGER NOT NULL DEFAULT 0');
    } catch {
      /* column exists */
    }
    sql.exec('CREATE TABLE IF NOT EXISTS model_sessions (sid TEXT PRIMARY KEY, ip TEXT NOT NULL, expires_at INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS model_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, sid TEXT NOT NULL, ip TEXT NOT NULL, at INTEGER NOT NULL, weight INTEGER NOT NULL, usd_micros INTEGER NOT NULL, status INTEGER)');
    sql.exec('CREATE TABLE IF NOT EXISTS model_totals (k TEXT PRIMARY KEY, usd_micros INTEGER NOT NULL, calls INTEGER NOT NULL)');
    this.ready = true;
  }

  private rows(): GateRow[] {
    this.init();
    return this.ctx.storage.sql.exec('SELECT sid, created_at, expires_at FROM sessions').toArray() as unknown as GateRow[];
  }

  // ---- per-IP session gate -------------------------------------------------------------------

  /** Try to register a new session; returns the decision (and records it when ok). */
  async allow(sid: string, ttlMs: number, perWindow: number, maxConcurrent: number, sandboxId?: string): Promise<GateDecision> {
    const now = Date.now();
    this.init();
    this.ctx.storage.sql.exec('DELETE FROM sessions WHERE expires_at < ? AND destroyed = 1', now - WINDOW_MS);
    const d = decide(this.rows(), now, perWindow, maxConcurrent);
    if (d.ok) this.ctx.storage.sql.exec('INSERT INTO sessions (sid, created_at, expires_at, sandbox_id, destroyed) VALUES (?, ?, ?, ?, 0)', sid, now, now + ttlMs, sandboxId ?? null);
    return d;
  }

  /** A session is recorded provisionally (short expiry) until the container answers; then it gets its full TTL and a destroy alarm. */
  async confirm(sid: string, ttlMs: number): Promise<void> {
    this.init();
    const expiresAt = Date.now() + ttlMs;
    this.ctx.storage.sql.exec('UPDATE sessions SET expires_at = ? WHERE sid = ?', expiresAt, sid);
    await this.scheduleSweep();
  }

  async release(sid: string): Promise<void> {
    this.init();
    this.ctx.storage.sql.exec('UPDATE sessions SET expires_at = ? WHERE sid = ?', Date.now(), sid);
    await this.scheduleSweep();
  }

  /** The alarm fires at the earliest not-yet-destroyed expiry; each sweep destroys what has expired. */
  private async scheduleSweep(): Promise<void> {
    const r = this.ctx.storage.sql.exec('SELECT MIN(expires_at) AS next FROM sessions WHERE destroyed = 0 AND sandbox_id IS NOT NULL').one() as { next: number | null };
    if (r.next !== null) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, r.next + 5000));
  }

  async alarm(): Promise<void> {
    this.init();
    const now = Date.now();
    const due = this.ctx.storage.sql.exec('SELECT sid, sandbox_id FROM sessions WHERE destroyed = 0 AND sandbox_id IS NOT NULL AND expires_at <= ?', now).toArray() as unknown as { sid: string; sandbox_id: string }[];
    for (const s of due) {
      try {
        await getSandbox(this.env.Sandbox as never, s.sandbox_id).destroy();
      } catch (e) {
        console.error('sandbox destroy at ttl failed', s.sid.slice(0, 8), e instanceof Error ? e.message : String(e));
      }
      this.ctx.storage.sql.exec('UPDATE sessions SET destroyed = 1 WHERE sid = ?', s.sid);
    }
    await this.scheduleSweep();
  }

  // ---- model budget (singleton instance) ------------------------------------------------------

  /** Called from /api/session once the bridge is up: the sid's owner IP and expiry, for the proxy's caps. */
  async bindModelSession(sid: string, ip: string, expiresAt: number): Promise<void> {
    this.init();
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO model_sessions (sid, ip, expires_at) VALUES (?, ?, ?)', sid, ip, expiresAt);
    this.ctx.storage.sql.exec('DELETE FROM model_sessions WHERE expires_at < ?', Date.now() - DAY_MS);
  }

  private counts(sid: string, ip: string, now: number): ModelCounts {
    const sql = this.ctx.storage.sql;
    const one = <T,>(q: string, ...args: unknown[]): T => sql.exec(q, ...args).one() as T;
    const sid1 = one<{ n: number | null; m: number | null; f: number | null }>(
      'SELECT COALESCE(SUM(weight),0) AS n, COALESCE(SUM(CASE WHEN at > ? THEN weight ELSE 0 END),0) AS m, COALESCE(SUM(CASE WHEN status IS NULL AND at > ? THEN 1 ELSE 0 END),0) AS f FROM model_calls WHERE sid = ?',
      now - 60_000, now - INFLIGHT_STALE_MS, sid,
    );
    const ip1 = one<{ n: number | null; o: number | null }>('SELECT COALESCE(SUM(weight),0) AS n, MIN(at) AS o FROM model_calls WHERE ip = ? AND at > ?', ip, now - WINDOW_MS);
    const day = one<{ n: number | null; o: number | null }>('SELECT COALESCE(SUM(weight),0) AS n, MIN(at) AS o FROM model_calls WHERE at > ?', now - DAY_MS);
    const tot = sql.exec("SELECT usd_micros FROM model_totals WHERE k = 'all'").toArray() as unknown as { usd_micros: number }[];
    return {
      sidCalls: sid1.n ?? 0,
      sidCallsLastMin: sid1.m ?? 0,
      sidInflight: sid1.f ?? 0,
      ipCallsInWindow: ip1.n ?? 0,
      ipOldestAt: ip1.o ?? null,
      dayCalls: day.n ?? 0,
      dayOldestAt: day.o ?? null,
      usdTotalMicros: tot[0]?.usd_micros ?? 0,
    };
  }

  /** Reserve a call at its pessimistic estimate. Fails closed: an unbound sid is refused. */
  async chargeModel(sid: string, weight: number, estUsdMicros: number, caps: ModelCaps): Promise<ChargeDecision & { charge_id?: number }> {
    this.init();
    const now = Date.now();
    const sql = this.ctx.storage.sql;
    sql.exec('DELETE FROM model_calls WHERE at < ?', now - DAY_MS - WINDOW_MS);
    const bound = sql.exec('SELECT ip, expires_at FROM model_sessions WHERE sid = ?', sid).toArray() as unknown as { ip: string; expires_at: number }[];
    if (bound.length === 0) return { ok: false, reason: 'unbound', retry_after_s: 1 };
    const { ip, expires_at } = bound[0];
    const d = decideCharge(this.counts(sid, ip, now), weight, estUsdMicros, caps, now, expires_at);
    if (!d.ok) return d;
    sql.exec('INSERT INTO model_calls (sid, ip, at, weight, usd_micros, status) VALUES (?, ?, ?, ?, ?, NULL)', sid, ip, now, weight, estUsdMicros);
    const id = (sql.exec('SELECT last_insert_rowid() AS id').one() as { id: number }).id;
    sql.exec("INSERT INTO model_totals (k, usd_micros, calls) VALUES ('all', ?, ?) ON CONFLICT(k) DO UPDATE SET usd_micros = usd_micros + excluded.usd_micros, calls = calls + excluded.calls", estUsdMicros, weight);
    return { ok: true, charge_id: id };
  }

  /** Replace the estimate with the settled cost (from upstream `usage`) and record the upstream status. */
  async settleModel(chargeId: number, usdMicros: number, status: number): Promise<void> {
    this.init();
    const sql = this.ctx.storage.sql;
    const prev = sql.exec('SELECT usd_micros FROM model_calls WHERE id = ?', chargeId).toArray() as unknown as { usd_micros: number }[];
    if (prev.length === 0) return;
    sql.exec('UPDATE model_calls SET usd_micros = ?, status = ? WHERE id = ?', usdMicros, status, chargeId);
    sql.exec("UPDATE model_totals SET usd_micros = usd_micros + ? WHERE k = 'all'", usdMicros - prev[0].usd_micros);
  }

  /** Operator read-out for `wrangler tail` probes (never exposed on a route). */
  async budgetSnapshot(): Promise<{ usd_micros: number; calls: number; day_calls: number }> {
    this.init();
    const tot = this.ctx.storage.sql.exec("SELECT usd_micros, calls FROM model_totals WHERE k = 'all'").toArray() as unknown as { usd_micros: number; calls: number }[];
    const day = this.ctx.storage.sql.exec('SELECT COALESCE(SUM(weight),0) AS n FROM model_calls WHERE at > ?', Date.now() - DAY_MS).one() as { n: number };
    return { usd_micros: tot[0]?.usd_micros ?? 0, calls: tot[0]?.calls ?? 0, day_calls: day.n ?? 0 };
  }
}
