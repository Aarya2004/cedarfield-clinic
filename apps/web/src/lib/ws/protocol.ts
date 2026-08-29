/**
 * WebSocket frame protocol v1 — browser client ⇄ local bridge (`packages/bridge/src/protocol.js`).
 * Shared contract: change both files in one `contract:` commit and ping in docs/PROGRESS.md.
 *
 * Pairing link: `${app}/#ws=<encodeURIComponent(wsUrl)>&t=<token>` — token lives in the fragment
 * and never reaches the server that hosts the page.
 */
export const PROTOCOL_VERSION = 1;
export const AUTH_TIMEOUT_MS = 5_000;
export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const MAX_FRAME_BYTES = 64 * 1024;

export const CLOSE_CODES = {
  UNAUTHORIZED: 4401,
  BUSY: 4409,
  REPLACED: 4410,
  BAD_FRAME: 4400,
  IDLE: 4408,
  SHUTDOWN: 4000,
} as const;

/** Kinds the bridge accepts from a client (mirrors `CLIENT_LEDGER_KINDS` in protocol.js). */
export const CLIENT_LEDGER_KINDS: ReadonlySet<string> = new Set([
  'proposed', 'dismissed', 'screen_read', 'registered', 'unregistered', 'forge_requested', 'forge_rejected',
  'forged', 'invoked', 'restored', 'pinned', 'executed_step', 'paired', 'reconnected', 'disconnected',
]);

/** The client's own signed ledger row, forwarded verbatim; the bridge countersigns it. */
export interface ClientLedgerRow {
  seq: number;
  t: string;
  session: string;
  kind: string;
  fields: Record<string, string | number | boolean | null>;
  prev: string;
  sig: string;
}

/** A tool definition as published to an MCP process via the bridge (same shape as WebMCP's). */
export interface AgentToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
}

/** Client → bridge */
export type ClientFrame =
  | { type: 'auth'; token: string; cols?: number; rows?: number; role?: 'human' | 'agent' }
  | { type: 'agent_tools'; tools: AgentToolDef[] }
  | { type: 'agent_result'; call_id: string; result?: unknown; error?: string }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ledger'; row: ClientLedgerRow }
  | { type: 'ping' };

export type BridgeMode = 'builder' | 'judge';

/** Honest status: every field is set by the bridge from OSC 133 / OSC 7 markers, never inferred. */
/** Parsed `rokan-do` result line of the last command: `⚡` (replayed) means no model call. */
export interface RokanTrailer {
  ms: number;
  replayed: boolean;
  /** present only when rokan-do used a site's OWN WebMCP tool (Tier 0). Display provenance. */
  native?: { site: string; tool: string };
}

export interface BridgeStatus {
  cwd: string;
  running: boolean;
  last_exit_code: number | null;
  last_command_ms: number | null;
  last_command: string | null;
  /** null unless the last command printed a rokan-do result line (bridge-measured) */
  last_rokan?: RokanTrailer | null;
}

/** Bridge → client */
export type BridgeFrame =
  | {
      type: 'hello';
      mode: BridgeMode;
      shell: string;
      cwd: string;
      pid: number;
      session_id: string;
      version: number;
      /** true when the zsh integration is active and status fields are trustworthy */
      integration: boolean;
      started_at?: string;
      /** judge mode: the session ends at expires_at */
      ttl_ms?: number;
      expires_at?: string;
    }
  | { type: 'data'; data: string }
  | ({ type: 'status' } & BridgeStatus)
  | { type: 'exit'; code: number }
  | { type: 'error'; code: 'unauthorized' | 'busy' | 'bad_frame' | 'timeout' | 'replaced'; message: string }
  | { type: 'ledger_ack'; seq: number; sig: string; client_seq: number | null }
  | { type: 'agent_call'; call_id: string; tool: string; input: Record<string, unknown> }
  | { type: 'pong' };

export interface PairingParams {
  ws: string;
  token: string;
}

/**
 * Hosts a pairing link may point at. Anything else is refused — a crafted link would otherwise
 * turn the tab into a keylogger with a spoofed screen (Opus review P1, 2026-08-28).
 *  - loopback over ws:// (local bridge)
 *  - *.trycloudflare.com over wss:// (quick tunnel)
 *  - hosts listed in `extraHosts` (named tunnel / judge sandbox), exact match, wss:// only
 */
export function isAllowedBridgeUrl(ws: string, extraHosts: readonly string[] = []): boolean {
  let u: URL;
  try {
    u = new URL(ws);
  } catch {
    return false;
  }
  if (u.username || u.password || u.search || u.hash) return false;
  const host = u.hostname.toLowerCase();
  const rootPath = u.pathname === '/' || u.pathname === '';
  if (u.protocol === 'ws:') return rootPath && (host === '127.0.0.1' || host === 'localhost' || host === '[::1]');
  if (u.protocol !== 'wss:') return false;
  if (/^[a-z0-9-]+\.trycloudflare\.com$/.test(host)) return rootPath;
  // The judge Worker proxies at `/ws/<signed sid>` — a path is allowed there and only there
  // (measured 2026-08-28: the live sandbox paired over the proxy but the page refused the URL).
  const judgePath = rootPath || /^\/ws\/[a-f0-9.]{1,96}$/.test(u.pathname);
  return judgePath && extraHosts.some((h) => h.toLowerCase() === host);
}

/** Extra bridge hosts allowed by deployment config (the judge Worker), comma-separated. */
export function configuredBridgeHosts(): string[] {
  const raw = process.env.NEXT_PUBLIC_BRIDGE_HOSTS ?? '';
  return raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/**
 * Read the pairing params from `location.hash` and immediately remove them from the address bar
 * (history.replaceState) so the token is neither on camera nor readable later by a third-party
 * script. The params live only in memory afterwards.
 */
export function consumePairingHash(extraHosts: readonly string[] = configuredBridgeHosts()): PairingParams | null {
  if (typeof window === 'undefined') return null;
  const p = parsePairingHash(window.location.hash, extraHosts);
  if (window.location.hash) {
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
  }
  return p;
}

/** Parse `#ws=…&t=…` from `location.hash`. Returns null when absent, malformed or not allowed. */
export function parsePairingHash(hash: string, extraHosts: readonly string[] = []): PairingParams | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const ws = q.get('ws');
  const token = q.get('t');
  if (!ws || !token) return null;
  if (!/^[a-f0-9]{16,64}$/.test(token)) return null;
  if (!isAllowedBridgeUrl(ws, extraHosts)) return null;
  return { ws, token };
}
