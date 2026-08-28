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
import { AUTH_TIMEOUT_MS, CLOSE, IDLE_TIMEOUT_MS, PROTOCOL_VERSION, parseClientFrame } from './protocol.js';
import { OscParser, prepareShellEnv, shellName } from './shell-integration.js';
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

export async function startBridge({ port = 7331, host = '127.0.0.1', token, shell, cwd, ledgerDir, log = () => {} } = {}) {
  repairSpawnHelper();
  const pty = await import('node-pty');
  const sessionId = randomBytes(6).toString('hex');
  const shellPath = shell || process.env.SHELL || '/bin/zsh';
  const { env, integration } = prepareShellEnv(shellPath, process.env);
  const tokenBuf = Buffer.from(token, 'utf8');
  const ledger = new Ledger({ session: sessionId, ...(ledgerDir ? { dir: ledgerDir } : {}) });

  const term = pty.spawn(shellPath, ['-l'], { name: 'xterm-256color', cols: 100, rows: 30, cwd: cwd || process.env.HOME, env });
  const state = { cwd: cwd || process.env.HOME, running: false, last_exit_code: null, last_command_ms: null, last_command: null };
  let startedAt = null;
  let sawStart = false;
  const osc = new OscParser();
  const scrollback = [];
  const SCROLLBACK_MAX = 400 * 1024;
  let scrollbackBytes = 0;

  let client = null; // the single authenticated socket

  const send = (ws, obj) => {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };
  const sendStatus = () => send(client, { type: 'status', ...state });

  term.onData((data) => {
    scrollback.push(data);
    scrollbackBytes += data.length;
    while (scrollbackBytes > SCROLLBACK_MAX && scrollback.length > 1) scrollbackBytes -= scrollback.shift().length;
    for (const ev of osc.feed(data)) {
      if (ev.kind === 'start') {
        sawStart = true;
        startedAt = performance.now();
        state.running = true;
        state.last_command = ev.command;
        sendStatus();
      } else if (ev.kind === 'end') {
        if (!sawStart) continue; // the shell's first prompt reports $? of nothing
        state.running = false;
        state.last_exit_code = ev.code;
        state.last_command_ms = startedAt === null ? null : Math.round(performance.now() - startedAt);
        ledger.append('executed', { command: state.last_command, exit_code: ev.code, ms: state.last_command_ms, cwd: state.cwd });
        sendStatus();
      } else if (ev.kind === 'cwd') {
        state.cwd = ev.cwd;
      }
    }
    send(client, { type: 'data', data });
  });
  term.onExit(({ exitCode }) => {
    log(`shell exited ${exitCode}`);
    send(client, { type: 'exit', code: exitCode });
    client?.close(CLOSE.SHUTDOWN, 'shell exited');
  });

  const http = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('rokan-terminal bridge: connect over WebSocket\n');
  });
  const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024 });

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
        if (client && client.readyState === client.OPEN) {
          send(ws, { type: 'error', code: 'busy', message: 'another tab is already paired with this bridge' });
          return ws.close(CLOSE.BUSY, 'busy');
        }
        authed = true;
        clearTimeout(authTimer);
        client = ws;
        touch();
        if (f.cols && f.rows) term.resize(f.cols, f.rows);
        send(ws, {
          type: 'hello',
          mode: 'builder',
          shell: shellName(shellPath),
          cwd: state.cwd,
          pid: term.pid,
          session_id: sessionId,
          version: PROTOCOL_VERSION,
          integration,
        });
        // Replay recent scrollback so a reconnecting tab sees where it left off.
        for (const chunk of scrollback) send(ws, { type: 'data', data: chunk });
        sendStatus();
        ledger.append('paired', {});
        log('client paired');
        return;
      }
      touch();
      switch (f.type) {
        case 'input':
          term.write(f.data);
          break;
        case 'resize':
          term.resize(f.cols, f.rows);
          break;
        case 'ledger': {
          const { kind, ...fields } = f.row;
          const row = ledger.append(kind, { origin: 'client', ...fields });
          send(ws, { type: 'ledger_ack', seq: row.seq, sig: row.sig });
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
      }
    });
  });

  await new Promise((resolve) => http.listen(port, host, resolve));
  const close = () => {
    for (const ws of wss.clients) ws.close(CLOSE.SHUTDOWN, 'bridge shutting down');
    wss.close();
    http.close();
    try {
      term.kill();
    } catch {
      /* already gone */
    }
  };
  return { port, host, sessionId, ledgerFile: ledger.file, integration, close, state };
}
