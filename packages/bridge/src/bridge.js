/**
 * The bridge: one PTY, one WebSocket client at a time, token-gated, 127.0.0.1 only.
 * The PTY receives bytes from exactly one place — `input` frames from the human's browser tab.
 */
import { createServer } from 'node:http';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { chmodSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';
import { AUTH_TIMEOUT_MS, CLIENT_LEDGER_KINDS, CLOSE, IDLE_TIMEOUT_MS, PROTOCOL_VERSION, isAgentFrameAllowed, parseClientFrame } from './protocol.js';
import { OscParser, cleanupShellEnv, prepareShellEnv, shellName } from './shell-integration.js';
import { ROKAN_OUT_MAX, isRokanCommand, parseRokanTrailer } from './rokan-trailer.js';
import { Ledger } from './ledger.js';

const require = createRequire(import.meta.url);

/** pnpm strips the exec bit from node-pty's prebuilt spawn-helper on macOS; repair it once. */
function repairSpawnHelper() {
  try {
    const root = dirname(require.resolve('node-pty/package.json'));
    const helper = join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');
    const mode = statSync(helper).mode;
    if ((mode & 0o111) === 0) chmodSync(helper, mode | 0o755);
  } catch {
    /* not present on this platform — fine */
  }
}

export async function startBridge({ port = 7331, host = '127.0.0.1', token, shell, cwd, ledgerDir, log = () => {}, onIdle, allowedOrigins = [], mode = 'builder', ttlMs = null } = {}) {
  repairSpawnHelper();
  const pty = await import('node-pty');
  const sessionId = randomBytes(6).toString('hex');
  const startedAtIso = new Date().toISOString();
  const expiresAt = ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null;
  const shellPath = shell || process.env.SHELL || '/bin/zsh';
  const { env, integration } = prepareShellEnv(shellPath, process.env);
  const tokenBuf = Buffer.from(token, 'utf8');
  const ledger = new Ledger({ session: sessionId, ...(ledgerDir ? { dir: ledgerDir } : {}) });

  const state = { cwd: cwd || process.env.HOME, running: false, last_exit_code: null, last_command_ms: null, last_command: null, last_rokan: null };
  let cmdOut = ''; // raw output of the running command, for the rokan-do trailer (capped)
  let startedAt = null;
  let sawStart = false;
  let osc = new OscParser();
  const scrollback = [];
  const SCROLLBACK_MAX = 400 * 1024;
  let scrollbackBytes = 0;
  let term = null;
  let termAlive = false;
  let cols = 100;
  let rows = 30;

  let client = null; // the single authenticated human socket (the tab)
  let agent = null; // an optional MCP process socket (role "agent"); relayed to/from the tab only
  let agentTools = []; // last tool list published by the tab
  // No tab paired for IDLE_TIMEOUT_MS → tell the caller, which exits (and so kills the tunnel).
  let unpairedTimer = null;
  let closed = false; // after close() nothing may re-arm a timer (a late tab close used to keep the process alive)
  const armUnpairedTimer = () => {
    clearTimeout(unpairedTimer);
    if (closed) return;
    unpairedTimer = setTimeout(() => {
      if (!client) onIdle?.();
    }, IDLE_TIMEOUT_MS);
  };

  const send = (ws, obj) => {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };
  const sendStatus = () => send(client, { type: 'status', ...state });
  const safe = (fn) => {
    if (!termAlive) return false;
    try {
      fn();
      return true;
    } catch (e) {
      log(`pty call failed: ${e.message}`);
      return false;
    }
  };

  /** Spawn (or respawn after exit) the human's shell. The tab is told either way. */
  const spawnShell = (reason) => {
    term = pty.spawn(shellPath, ['-l'], { name: 'xterm-256color', cols, rows, cwd: cwd || process.env.HOME, env });
    termAlive = true;
    sawStart = false;
    osc = new OscParser();
    state.running = false;
    if (reason) ledger.append('shell_restarted', { reason });
    attach(term);
  };

  const attach = (t) => {
  t.onData((data) => {
    scrollback.push(data);
    scrollbackBytes += data.length;
    while (scrollbackBytes > SCROLLBACK_MAX && scrollback.length > 1) scrollbackBytes -= scrollback.shift().length;
    let endStatus = false;
    if (state.running && cmdOut.length < ROKAN_OUT_MAX) cmdOut += data;
    for (const ev of osc.feed(data)) {
      if (ev.kind === 'start') {
        sawStart = true;
        startedAt = performance.now();
        state.running = true;
        state.last_command = ev.command;
        state.last_rokan = null;
        cmdOut = data.slice(0, ROKAN_OUT_MAX);
        sendStatus();
      } else if (ev.kind === 'end') {
        if (!sawStart) continue; // the shell's first prompt reports $? of nothing
        state.running = false;
        state.last_exit_code = ev.code;
        state.last_command_ms = startedAt === null ? null : Math.round(performance.now() - startedAt);
        // rokan-do prints `  <answer>   <ms>ms[  ⚡]`; ⚡ = replayed with no model call (PLAN §2).
        // Attributed ONLY when the command that ran is rokan / rokan-do — an `echo` of the same
        // line is never a replay (Fable pass-3 P1).
        state.last_rokan = isRokanCommand(state.last_command) ? parseRokanTrailer(cmdOut) : null;
        cmdOut = '';
        ledger.append('executed', {
          command: state.last_command,
          exit_code: ev.code,
          ms: state.last_command_ms,
          cwd: state.cwd,
          ...(state.last_rokan ? { rokan_ms: state.last_rokan.ms, rokan_calls: state.last_rokan.replayed ? 0 : null } : {}),
        });
        endStatus = true; // sent AFTER this data frame so the client sees the end marker (and the last output) first
      } else if (ev.kind === 'cwd') {
        state.cwd = ev.cwd;
      }
    }
    send(client, { type: 'data', data });
    if (endStatus) sendStatus();
  });
  t.onExit(({ exitCode }) => {
    if (t !== term) return;
    termAlive = false;
    if (closed) return; // close() killed it on purpose — never respawn a shell for a closed bridge
    log(`shell exited ${exitCode} — restarting`);
    ledger.append('shell_exited', { exit_code: exitCode });
    send(client, { type: 'exit', code: exitCode });
    // Respawn so a reconnect never touches a dead PTY (Fable review F3); the tab stays paired.
    spawnShell(`exit ${exitCode}`);
    send(client, { type: 'data', data: `\r\n[rokan-terminal] shell exited ${exitCode}; started a new one\r\n` });
  });
  };
  spawnShell(null);

  const http = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('rokan-terminal bridge: connect over WebSocket\n');
  });
  // Browser clients must come from an allowed page origin; non-browser clients (no Origin) pass and
  // still need the token. Refuses a hostile page that somehow holds the token (Fable review P2).
  const verifyClient = ({ origin }) => {
    if (!origin) return true;
    try {
      const u = new URL(origin);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
      return allowedOrigins.some((a) => a === u.origin);
    } catch {
      return false;
    }
  };
  const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024, verifyClient });

  wss.on('connection', (ws) => {
    let authed = false;
    let idleTimer = null;
    const authTimer = setTimeout(() => {
      if (!authed) {
        send(ws, { type: 'error', code: 'timeout', message: 'auth frame not received' });
        ws.close(CLOSE.UNAUTHORIZED, 'auth timeout');
      }
    }, AUTH_TIMEOUT_MS);
    const touch = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => ws.close(CLOSE.IDLE, 'idle 30 min'), IDLE_TIMEOUT_MS);
    };

    ws.on('message', (raw, isBinary) => {
      const parsed = parseClientFrame(isBinary ? null : raw.toString());
      if (!parsed.ok) {
        send(ws, { type: 'error', code: 'bad_frame', message: parsed.reason });
        return ws.close(CLOSE.BAD_FRAME, 'bad frame');
      }
      const f = parsed.frame;
      if (!authed) {
        if (f.type !== 'auth') return ws.close(CLOSE.UNAUTHORIZED, 'auth first');
        const given = Buffer.from(f.token, 'utf8');
        if (given.length !== tokenBuf.length || !timingSafeEqual(given, tokenBuf)) {
          send(ws, { type: 'error', code: 'unauthorized', message: 'bad token' });
          return ws.close(CLOSE.UNAUTHORIZED, 'bad token');
        }
        if (f.role === 'agent') {
          // MCP relay socket: never the PTY. One at a time; replaces a dead one.
          if (agent && agent.readyState === agent.OPEN) {
            send(ws, { type: 'error', code: 'busy', message: 'an agent process is already connected' });
            return ws.close(CLOSE.BUSY, 'busy');
          }
          authed = true;
          ws.role = 'agent';
          clearTimeout(authTimer);
          agent = ws;
          touch();
          send(ws, { type: 'hello', mode, shell: shellName(shellPath), cwd: state.cwd, pid: term.pid, session_id: sessionId, version: PROTOCOL_VERSION, integration, role: 'agent', tab_connected: !!(client && client.readyState === client.OPEN) });
          send(ws, { type: 'agent_tools', tools: agentTools });
          ledger.append('agent_connected', {});
          log('agent (MCP) connected');
          return;
        }
        if (client && client.readyState === client.OPEN) {
          if (mode !== 'judge') {
            send(ws, { type: 'error', code: 'busy', message: 'another tab is already paired with this bridge' });
            return ws.close(CLOSE.BUSY, 'busy');
          }
          // Judge mode: the token is the credential and a stranger has exactly one; a reload (or a
          // socket the proxy has not yet closed — measured 2026-08-28 through the Cloudflare DO
          // proxy) must not lock them out for 30 min. Newest tab wins; the old one is told why.
          const old = client;
          send(old, { type: 'error', code: 'replaced', message: 'another tab paired with your token; this tab was released' });
          old.close(CLOSE.REPLACED, 'replaced');
          ledger.append('tab_replaced', {});
          log('tab replaced by a newer one (judge mode)');
        }
        authed = true;
        clearTimeout(authTimer);
        clearTimeout(unpairedTimer);
        client = ws;
        touch();
        if (f.cols && f.rows) {
          cols = f.cols;
          rows = f.rows;
          safe(() => term.resize(f.cols, f.rows));
        }
        send(ws, {
          type: 'hello',
          mode,
          shell: shellName(shellPath),
          cwd: state.cwd,
          pid: term.pid,
          session_id: sessionId,
          version: PROTOCOL_VERSION,
          integration,
          started_at: startedAtIso,
          ...(ttlMs ? { ttl_ms: ttlMs, expires_at: expiresAt } : {}),
        });
        // Replay recent scrollback so a reconnecting tab sees where it left off.
        for (const chunk of scrollback) send(ws, { type: 'data', data: chunk });
        sendStatus();
        ledger.append('paired', {});
        log('client paired');
        return;
      }
      touch();
      if (ws.role === 'agent') {
        if (!isAgentFrameAllowed(f.type)) {
          send(ws, { type: 'error', code: 'bad_frame', message: `agents may not send ${f.type}` });
          return;
        }
        if (f.type === 'agent_call') {
          if (!client || client.readyState !== client.OPEN) return send(ws, { type: 'agent_result', call_id: f.call_id, error: 'no tab is paired with this bridge' });
          ledger.append('agent_call', { call_id: f.call_id, tool: f.tool });
          send(client, { type: 'agent_call', call_id: f.call_id, tool: f.tool, input: f.input ?? {} });
          return;
        }
        if (f.type === 'ping') send(ws, { type: 'pong' });
        return;
      }
      switch (f.type) {
        case 'agent_tools':
          agentTools = f.tools;
          send(agent, { type: 'agent_tools', tools: agentTools });
          break;
        case 'agent_result':
          send(agent, { type: 'agent_result', call_id: f.call_id, result: f.result, error: f.error });
          break;
        case 'input':
          safe(() => term.write(f.data));
          break;
        case 'resize':
          cols = f.cols;
          rows = f.rows;
          safe(() => term.resize(f.cols, f.rows));
          break;
        case 'ledger': {
          // The client's signed row is stored verbatim under `client` so the bridge signature
          // covers the client's own sig — the two ledgers cross-verify (Opus review P2).
          // Only whitelisted kinds (protocol.js) and only these named fields — nothing from the client
          // can set seq/t/session/origin/prev/sig on the bridge row (Fable review F7).
          // A disallowed (bridge-only) kind is answered with an error frame, never a disconnect.
          if (!CLIENT_LEDGER_KINDS.has(f.row.kind)) {
            send(ws, { type: 'error', code: 'bad_frame', message: `ledger kind not allowed for clients: ${String(f.row.kind).slice(0, 40)}` });
            break;
          }
          const { kind, seq: client_seq, sig: client_sig, t: client_t, session: client_session, fields, ...rest } = f.row;
          const clientFields = fields && typeof fields === 'object' ? fields : rest;
          const row = ledger.append(`client:${kind}`, {
            origin: 'client',
            client_kind: kind,
            client_seq: Number.isInteger(client_seq) ? client_seq : null,
            client_sig: typeof client_sig === 'string' ? client_sig.slice(0, 128) : null,
            client_t: typeof client_t === 'string' ? client_t.slice(0, 40) : null,
            client_session: typeof client_session === 'string' ? client_session.slice(0, 64) : null,
            client: clientFields,
          });
          send(ws, { type: 'ledger_ack', seq: row.seq, sig: row.sig, client_seq: Number.isInteger(client_seq) ? client_seq : null });
          break;
        }
        case 'ping':
          send(ws, { type: 'pong' });
          break;
        default:
          break;
      }
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      clearTimeout(idleTimer);
      if (client === ws) {
        client = null;
        log('client left (shell kept alive for reconnect)');
        armUnpairedTimer();
      }
      if (agent === ws) {
        agent = null;
        log('agent (MCP) left');
      }
    });
  });

  await new Promise((resolve, reject) => {
    http.once('error', (e) => reject(e.code === 'EADDRINUSE' ? new Error(`port ${port} is already in use — is another rokan-terminal running? try --port ${port + 1}`) : e));
    http.listen(port, host, resolve);
  });
  armUnpairedTimer();
  const close = () => {
    closed = true;
    clearTimeout(unpairedTimer);
    cleanupShellEnv(env);
    for (const ws of wss.clients) ws.close(CLOSE.SHUTDOWN, 'bridge shutting down');
    wss.close();
    http.close();
    termAlive = false;
    try {
      term.kill();
    } catch {
      /* already gone */
    }
  };
  let ttlTimer = null;
  if (ttlMs) {
    // Judge mode: the session ends at TTL — tell the tab, then let the caller exit.
    ttlTimer = setTimeout(() => {
      log(`ttl ${ttlMs} ms reached — ending the session`);
      ledger.append('session_ended', { reason: 'ttl', ttl_ms: ttlMs });
      send(client, { type: 'error', code: 'timeout', message: 'session ended: the sandbox time limit was reached' });
      client?.close(CLOSE.SHUTDOWN, 'ttl');
      close();
      onIdle?.();
    }, ttlMs);
  }
  return { port, host, sessionId, ledgerFile: ledger.file, integration, close: () => { clearTimeout(ttlTimer); close(); }, state, mode, expiresAt };
}
