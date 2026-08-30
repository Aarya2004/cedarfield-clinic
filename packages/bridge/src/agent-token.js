/**
 * Role by mechanism, not by self-declaration (review P0-2, 2026-08-29).
 *
 * The pairing token in the URL fragment is the HUMAN credential: it may type into the PTY.
 * An MCP process on the same machine gets a DERIVED credential, `HMAC-SHA256(token, "agent")`,
 * which is the only value written to ~/.rokan-terminal/current.json. The bridge accepts the
 * derived token only with `role: "agent"` and the pairing token only for the tab — so a process
 * that reads current.json cannot pair as the human, and a tab that holds the pairing link cannot
 * pose as the agent. The derivation is one-way: the agent token never yields the pairing token.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function deriveAgentToken(token) {
  return createHmac('sha256', String(token)).update('agent').digest('hex');
}

/** Constant-time string compare (both sides utf8). */
export function tokenEquals(a, b) {
  const ab = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
