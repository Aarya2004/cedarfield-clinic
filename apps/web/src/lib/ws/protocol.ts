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
  BAD_FRAME: 4400,
  IDLE: 4408,
  SHUTDOWN: 4000,
} as const;

/** Kinds the client may append to the bridge ledger (bridge adds `executed` + `paired` itself). */
export type ClientLedgerKind = 'proposed' | 'dismissed' | 'screen_read' | 'forged' | 'invoked';

export interface ClientLedgerRow {
  kind: ClientLedgerKind;
  [k: string]: string | number | boolean | null | undefined;
}

/** Client → bridge */
export type ClientFrame =
  | { type: 'auth'; token: string; cols?: number; rows?: number }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ledger'; row: ClientLedgerRow }
  | { type: 'ping' };

export type BridgeMode = 'builder' | 'judge';

/** Honest status: every field is set by the bridge from OSC 133 / OSC 7 markers, never inferred. */
export interface BridgeStatus {
  cwd: string;
  running: boolean;
  last_exit_code: number | null;
  last_command_ms: number | null;
  last_command: string | null;
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
    }
  | { type: 'data'; data: string }
  | ({ type: 'status' } & BridgeStatus)
  | { type: 'exit'; code: number }
  | { type: 'error'; code: 'unauthorized' | 'busy' | 'bad_frame' | 'timeout'; message: string }
  | { type: 'ledger_ack'; seq: number; sig: string }
  | { type: 'pong' };

export interface PairingParams {
  ws: string;
  token: string;
}

/** Parse `#ws=…&t=…` from `location.hash`. Returns null when absent or malformed. */
export function parsePairingHash(hash: string): PairingParams | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const ws = q.get('ws');
  const token = q.get('t');
  if (!ws || !token) return null;
  if (!/^wss?:\/\//.test(ws)) return null;
  if (!/^[a-f0-9]{16,64}$/.test(token)) return null;
  return { ws, token };
}
