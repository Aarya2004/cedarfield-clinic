/**
 * WebSocket frame protocol v1 between the browser client and the local bridge.
 * Mirrors `apps/web/src/lib/ws/protocol.ts` — change both, commit as `contract:`.
 *
 * Client → bridge
 *   {type:"auth", token, cols?, rows?, role?:"human"|"agent"}   must be the first frame, within AUTH_TIMEOUT_MS
 *   (role "agent" = an MCP process on the same machine: it may only send agent_call and receives
 *    agent_tools / agent_result relayed from the human's tab; it never touches the PTY)
 *   {type:"agent_tools", tools:[{name, description, inputSchema, annotations}]}   tab → bridge → agent (list changed)
 *   {type:"agent_call", call_id, tool, input}                                     agent → bridge → tab
 *   {type:"agent_result", call_id, result?, error?}                               tab → bridge → agent
 *   {type:"input", data}                 raw keystrokes from the human's tab (the only path to the PTY)
 *   {type:"resize", cols, rows}
 *   {type:"ledger", row}                 the client's signed row {seq, kind, fields, sig, …}; bridge countersigns + appends
 *   {type:"ping"}
 *
 * Bridge → client
 *   {type:"hello", mode:"builder"|"judge", shell, cwd, pid, session_id, version, integration:boolean, started_at, ttl_ms?, expires_at?}
 *   {type:"data", data}
 *   {type:"status", cwd, running, last_exit_code, last_command_ms, last_command}
 *   {type:"exit", code}
 *   {type:"ledger_ack", seq, sig, client_seq}   bridge countersignature for the client row
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

const CLIENT_TYPES = new Set(['auth', 'input', 'resize', 'ledger', 'ping', 'agent_tools', 'agent_call', 'agent_result']);
const AGENT_TYPES = new Set(['auth', 'agent_call', 'ping']);
export function isAgentFrameAllowed(type) {
  return AGENT_TYPES.has(type);
}
/** Kinds a client may forward. `executed` / `paired` / `shell_exited` are bridge-only facts. */
export const CLIENT_LEDGER_KINDS = new Set([
  'proposed', 'dismissed', 'screen_read', 'registered', 'unregistered', 'forge_requested', 'forge_rejected',
  'forged', 'invoked', 'restored', 'pinned', 'executed_step', 'paired', 'reconnected', 'disconnected',
]);

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
      if (f.role !== undefined && f.role !== 'human' && f.role !== 'agent') return { ok: false, reason: 'bad role' };
      break;
    case 'agent_call':
      if (typeof f.call_id !== 'string' || typeof f.tool !== 'string' || f.tool.length > 64) return { ok: false, reason: 'agent_call needs call_id + tool' };
      break;
    case 'agent_result':
      if (typeof f.call_id !== 'string') return { ok: false, reason: 'agent_result needs call_id' };
      break;
    case 'agent_tools':
      if (!Array.isArray(f.tools) || f.tools.length > 64) return { ok: false, reason: 'agent_tools needs tools[]' };
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
