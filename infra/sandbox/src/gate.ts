/**
 * Gate — per-IP session rate limit, one Durable Object per IP (sqlite-backed).
 * Rules: at most N new sessions per 10 minutes and M concurrent sessions per IP.
 */
import { DurableObject } from 'cloudflare:workers';
import { decide, WINDOW_MS, type GateDecision, type GateRow } from './gate-logic';

export { decide, WINDOW_MS };
export type { GateDecision, GateRow };

export class Gate extends DurableObject {
  private ready = false;

  private init(): void {
    if (this.ready) return;
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
    this.ready = true;
  }

  private rows(): GateRow[] {
    this.init();
    return this.ctx.storage.sql.exec('SELECT sid, created_at, expires_at FROM sessions').toArray() as unknown as GateRow[];
  }

  /** Try to register a new session; returns the decision (and records it when ok). */
  async allow(sid: string, ttlMs: number, perWindow: number, maxConcurrent: number): Promise<GateDecision> {
    const now = Date.now();
    this.init();
    this.ctx.storage.sql.exec('DELETE FROM sessions WHERE expires_at < ?', now - WINDOW_MS);
    const d = decide(this.rows(), now, perWindow, maxConcurrent);
    if (d.ok) this.ctx.storage.sql.exec('INSERT INTO sessions (sid, created_at, expires_at) VALUES (?, ?, ?)', sid, now, now + ttlMs);
    return d;
  }

  async release(sid: string): Promise<void> {
    this.init();
    this.ctx.storage.sql.exec('UPDATE sessions SET expires_at = ? WHERE sid = ?', Date.now(), sid);
  }
}
