/**
 * WebSocket frame protocol v1 between the browser client and the local bridge.
 * Mirrors `apps/web/src/lib/ws/protocol.ts` — change both, commit as `contract:`.
 *
 * Client → bridge
 *   {type:"auth", token, cols?, rows?}   must be the first frame, within AUTH_TIMEOUT_MS
 *   {type:"input", data}                 raw keystrokes from the human's tab (the only path to the PTY)
 *   {type:"resize", cols, rows}
 *   {type:"ledger", row}                 client-originated row (proposed / screen_read / forged …); bridge signs + appends
 *   {type:"ping"}
 *
 * Bridge → client
 *   {type:"hello", mode:"builder", shell, cwd, pid, session_id, version, integration:boolean}
 *   {type:"data", data}
 *   {type:"status", cwd, running, last_exit_code, last_command_ms, last_command}
 *   {type:"exit", code}
 *   {type:"error", code, message}        code ∈ unauthorized | busy | bad_frame | timeout
 *   {type:"pong"}
 */
export const PROTOCOL_VERSION = 1;
export const AUTH_TIMEOUT_MS = 5_000;
export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const MAX_FRAME_BYTES = 64 * 1024;

/** Close codes (4xxx = application). */
export const CLOSE = {
  UNAUTHORIZED: 4401,
  BUSY: 4409,
  BAD_FRAME: 4400,
  IDLE: 4408,
  SHUTDOWN: 4000,
};

const CLIENT_TYPES = new Set(['auth', 'input', 'resize', 'ledger', 'ping']);

/** Parse + validate one client frame. Returns {ok:true, frame} or {ok:false, reason}. */
export function parseClientFrame(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_FRAME_BYTES) return { ok: false, reason: 'frame too large or not text' };
  let f;
  try {
    f = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not JSON' };
  }
  if (!f || typeof f !== 'object' || !CLIENT_TYPES.has(f.type)) return { ok: false, reason: 'unknown type' };
  switch (f.type) {
    case 'auth':
      if (typeof f.token !== 'string' || f.token.length > 256) return { ok: false, reason: 'bad token' };
      break;
    case 'input':
      if (typeof f.data !== 'string') return { ok: false, reason: 'input.data must be a string' };
      break;
    case 'resize':
      if (!isDim(f.cols) || !isDim(f.rows)) return { ok: false, reason: 'bad dimensions' };
      break;
    case 'ledger':
      if (!f.row || typeof f.row !== 'object' || typeof f.row.kind !== 'string') return { ok: false, reason: 'ledger.row.kind required' };
      break;
    default:
      break;
  }
  return { ok: true, frame: f };
}

function isDim(n) {
  return Number.isInteger(n) && n >= 2 && n <= 1000;
}
