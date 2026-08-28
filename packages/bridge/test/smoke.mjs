/**
 * Real-PTY smoke: start the bridge on a random port with a temp ledger dir, pair over ws,
 * run `echo hi; exit-code probe`, assert data + honest status + ledger rows + HMAC chain +
 * second-client refusal + bad-token refusal. Exit 0 only if everything holds.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
import { startBridge } from '../src/bridge.js';
import { crossVerify, verifyLedger } from '../src/ledger.js';

const token = randomBytes(16).toString('hex');
const ledgerDir = mkdtempSync(join(tmpdir(), 'rokan-ledger-'));
const port = 20000 + Math.floor(Math.random() * 20000);
const t0 = performance.now();
const bridge = await startBridge({ port, token, ledgerDir, shell: '/bin/zsh' });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

const connect = () => new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const frames = [];
  ws.on('message', (m) => frames.push(JSON.parse(m.toString())));
  ws.on('open', () => resolve({ ws, frames }));
  ws.on('error', reject);
});
const until = (frames, pred, ms = 12000) => new Promise((resolve) => {
  const start = Date.now();
  const tick = () => {
    const hit = frames.find(pred);
    if (hit) return resolve(hit);
    if (Date.now() - start > ms) return resolve(null);
    setTimeout(tick, 25);
  };
  tick();
});

// 1. bad token refused
{
  const { ws, frames } = await connect();
  ws.send(JSON.stringify({ type: 'auth', token: 'nope' }));
  const err = await until(frames, (f) => f.type === 'error');
  check('bad token refused', err?.code === 'unauthorized', JSON.stringify(err));
  ws.close();
}

// 2. pair, run a command, read status
const { ws, frames } = await connect();
ws.send(JSON.stringify({ type: 'auth', token, cols: 100, rows: 30 }));
const hello = await until(frames, (f) => f.type === 'hello');
check('hello received', !!hello && hello.mode === 'builder', JSON.stringify(hello));
check('shell integration on', hello?.integration === true);
// Readiness = a command's own marker round-trips, not the first prompt paint. Grepping raw `data`
// for the first `]133;A` is fragile (the marker can split across frames under CI load; the bridge's
// OscParser handles splits, this grep does not). So we prove the shell is live by running a no-op
// and seeing its status frame. The line editor can also drop the first byte on a slow PTY, so each
// attempt clears the line first (Ctrl-U) and retries a few times.
const typeCommand = async (cmd, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    ws.send(JSON.stringify({ type: 'input', data: '\x15' + cmd + '\r' })); // Ctrl-U clears any partial line
    const st = await until(frames, (f) => f.type === 'status' && f.last_command === cmd && f.running === false, 6000);
    if (st) return st;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
};

const ready = await typeCommand(':', 6); // zsh no-op; its precmd/preexec markers prove the shell is up
check('shell ready (command marker round-trips)', !!ready, `${Math.round(performance.now() - t0)} ms since start`);
await typeCommand('echo hi_from_pty; false');
const gotEcho = await until(frames, (f) => f.type === 'data' && f.data.includes('hi_from_pty') && !f.data.includes('echo hi_from_pty'), 8000);
check('command output streamed back', !!gotEcho);
const status = await until(frames, (f) => f.type === 'status' && f.last_command === 'echo hi_from_pty; false' && f.running === false && f.last_exit_code !== null, 8000);
check('status reports honest exit code (false → 1)', status?.last_exit_code === 1, JSON.stringify(status));
check('status carries measured ms', Number.isInteger(status?.last_command_ms) && status.last_command_ms >= 0, `${status?.last_command_ms} ms`);
check('status carries the command text', status?.last_command === 'echo hi_from_pty; false', JSON.stringify(status?.last_command));
// Fable pass 2 F1: the data frame carrying the end marker (and whatever output shares it) must be
// delivered BEFORE the end status, or the client's tail misses the last lines.
const endData = frames.find((f) => f.type === 'data' && f.data.includes(']133;D;1'));
check('end-marker data frame precedes its status frame (tail complete)', !!endData && !!status && frames.indexOf(endData) < frames.indexOf(status), `data#${frames.indexOf(endData)} status#${frames.indexOf(status)}`);

// rokan-do trailer → status.last_rokan + ledger fields (PLAN §2); the `rokan` shim is on the PTY PATH
const rk = await typeCommand("echo '  GitHub blocks files larger than 100 MiB.   312ms  ⚡'");
check('rokan trailer: replayed answer parsed (ms + calls:0)', rk?.last_rokan?.ms === 312 && rk?.last_rokan?.replayed === true, JSON.stringify(rk?.last_rokan));
const rk2 = await typeCommand("echo '  planned answer   6100ms'");
check('rokan trailer: planned answer parsed, calls unknown', rk2?.last_rokan?.ms === 6100 && rk2?.last_rokan?.replayed === false, JSON.stringify(rk2?.last_rokan));
const rk3 = await typeCommand('echo plain');
check('rokan trailer: cleared for a non-rokan command', rk3?.last_rokan === null, JSON.stringify(rk3?.last_rokan));
await typeCommand('which rokan');
const shimOut = await until(frames, (f) => f.type === 'data' && /shims\/rokan/.test(f.data), 4000);
check('`rokan` shim is on the PTY PATH', !!shimOut);

await typeCommand('cd /tmp');
const cwdStatus = await until(frames, (f) => f.type === 'status' && f.last_command === 'cd /tmp' && f.running === false, 8000);
check('cwd tracked via OSC 7', /\/tmp$/.test(cwdStatus?.cwd ?? ''), JSON.stringify(cwdStatus?.cwd));

// 3. client-originated ledger row (with a nested object, so the digest must cover depth)
ws.send(JSON.stringify({ type: 'ledger', row: { kind: 'proposed', proposal_id: 'p_smoke', command: 'ls', params: [{ name: 'n', example: '5' }] } }));
const ack = await until(frames, (f) => f.type === 'ledger_ack');
check('client ledger row acknowledged with sig', typeof ack?.sig === 'string' && ack.sig.length === 64);

// 3b. F7: a client row cannot claim a bridge kind or override reserved fields
{
  const okRow = { type: 'ledger', row: { kind: 'forged', seq: 1, t: '1999-01-01T00:00:00Z', session: 'sessB', fields: { origin: 'bridge', seq: 1, session: 'sessB', hash: 'abc' } } };
  ws.send(JSON.stringify(okRow));
  const ack2 = await until(frames, (f) => f.type === 'ledger_ack' && f.client_seq === 1);
  check('override attempt acked as client row', !!ack2);
}

// 3b'. a bridge-only kind from the client → error frame, socket stays paired
{
  ws.send(JSON.stringify({ type: 'ledger', row: { kind: 'executed', seq: 2, fields: { command: 'rm -rf /', exit_code: 0 } } }));
  const err = await until(frames, (f) => f.type === 'error' && /not allowed/.test(f.message));
  ws.send(JSON.stringify({ type: 'ping' }));
  const pong = await until(frames, (f) => f.type === 'pong');
  check('bridge-only ledger kind rejected without disconnect', !!err && !!pong, JSON.stringify(err));
}

// 3c. F3: shell exit → respawn; the pairing survives and the new shell works
{
  ws.send(JSON.stringify({ type: 'input', data: 'exit\r' }));
  const ex = await until(frames, (f) => f.type === 'exit', 8000);
  check('exit frame on shell exit', !!ex, JSON.stringify(ex));
  const restarted = await until(frames, (f) => f.type === 'data' && f.data.includes('started a new one'), 8000);
  check('shell respawned after exit', !!restarted);
  ws.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));
  // The new shell running a command (with its marker) is the real proof it is live and writable —
  // stronger and less fragile than grepping raw data for a post-respawn prompt marker.
  const alive = await typeCommand('echo alive_after_respawn', 6);
  check('new shell runs commands (write/resize on live PTY)', alive?.last_exit_code === 0, JSON.stringify(alive));
}

// 4. second client refused while paired
{
  const second = await connect();
  second.ws.send(JSON.stringify({ type: 'auth', token }));
  const err = await until(second.frames, (f) => f.type === 'error');
  check('second tab refused (busy)', err?.code === 'busy', JSON.stringify(err));
  second.ws.close();
}

// 4b. judge mode: hello carries ttl/expires; TTL ends the session and calls onIdle
{
  let idle = false;
  const j = await startBridge({ port: port + 1, token, ledgerDir: mkdtempSync(join(tmpdir(), 'rokan-judge-')), shell: '/bin/zsh', mode: 'judge', ttlMs: 1500, onIdle: () => (idle = true) });
  const c = await new Promise((resolve, reject) => {
    const s = new WebSocket(`ws://127.0.0.1:${port + 1}`);
    const fr = [];
    s.on('message', (m) => fr.push(JSON.parse(m.toString())));
    s.on('open', () => resolve({ ws: s, frames: fr }));
    s.on('error', reject);
  });
  c.ws.send(JSON.stringify({ type: 'auth', token, cols: 80, rows: 24 }));
  const h = await until(c.frames, (f) => f.type === 'hello');
  check('judge hello carries mode/ttl/expires', h?.mode === 'judge' && h?.ttl_ms === 1500 && typeof h?.expires_at === 'string', JSON.stringify(h));
  const ended = await until(c.frames, (f) => f.type === 'error' && f.code === 'timeout', 5000);
  await new Promise((r) => setTimeout(r, 100));
  check('judge TTL ends the session and signals onIdle', !!ended && idle, JSON.stringify(ended));
  c.ws.close();
  j.close();
}

// 4c. cross-verify: a page export whose rows carry the bridge countersignature
{
  ws.send(JSON.stringify({ type: 'ledger', row: { kind: 'invoked', seq: 9, sig: 'a'.repeat(64), fields: { tool: 'forged_x' } } }));
  const ack9 = await until(frames, (f) => f.type === 'ledger_ack' && f.client_seq === 9);
  const good = { rows: [{ seq: 9, t: 'x', session: 'tab', kind: 'invoked', fields: { tool: 'forged_x' }, prev: '', sig: 'a'.repeat(64), bridge_sig: ack9.sig, bridge_seq: ack9.seq }] };
  const cv = crossVerify(good, { dir: ledgerDir });
  check('crossVerify: countersigned export row verifies against the bridge ledger', cv.ok && cv.verified === 1, JSON.stringify(cv));
  const bad = { rows: [{ ...good.rows[0], sig: 'b'.repeat(64) }] };
  const cv2 = crossVerify(bad, { dir: ledgerDir });
  check('crossVerify: a re-signed export row is caught', !cv2.ok && cv2.mismatches.length === 1, JSON.stringify(cv2.mismatches));
}

// 5. ledger on disk + HMAC chain verifies
const lines = readFileSync(join(ledgerDir, 'ledger.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const kinds = lines.map((r) => r.kind);
check('ledger has paired/executed/client:proposed rows', kinds.includes('paired') && kinds.includes('executed') && kinds.includes('client:proposed'), kinds.join(','));
const clientRow = lines.find((r) => r.kind === 'client:proposed');
check('client row is nested under client{} with bridge-owned seq/session/origin', clientRow?.origin === 'client' && clientRow?.client?.command === 'ls' && clientRow?.client?.params?.[0]?.example === '5' && clientRow.session === bridge.sessionId, JSON.stringify(clientRow).slice(0, 200));
const override = lines.find((r) => r.kind === 'client:forged');
check('F7: reserved fields are bridge-owned on the override attempt', override?.origin === 'client' && override?.session === bridge.sessionId && override?.seq !== 1 && override?.client?.origin === 'bridge' && !override?.t.startsWith('1999'), JSON.stringify(override).slice(0, 220));
// The client's forwarded kind:'executed' must never be stored (it is rejected as bad_frame). Every
// `executed`/`client:executed` row here is bridge-origin; none may carry origin 'client'. (Command
// retries on slow CI make the exact executed count vary, so assert provenance, not a count.)
check('F7: bridge-only kinds cannot be forwarded', !lines.some((r) => r.kind === 'executed' && r.origin === 'client') && !kinds.includes('client:executed'), kinds.join(','));
const v = verifyLedger(bridge.sessionId, { dir: ledgerDir });
check('HMAC chain verifies', v.ok && v.rows === lines.length, JSON.stringify(v));
// tamper (top-level scalar) → must fail
const { writeFileSync } = await import('node:fs');
const tampered = lines.map((r) => (r.kind === 'executed' ? { ...r, exit_code: 0 } : r));
writeFileSync(join(ledgerDir, 'ledger.jsonl'), tampered.map((r) => JSON.stringify(r)).join('\n') + '\n');
const v2 = verifyLedger(bridge.sessionId, { dir: ledgerDir });
check('tampered ledger detected (top-level)', v2.ok === false, JSON.stringify(v2));
// tamper (nested key) → must also fail — the Opus-review regression
const nested = lines.map((r) => (r.kind === 'client:proposed' ? { ...r, client: { ...r.client, params: [{ name: 'n', example: '999' }] } } : r));
writeFileSync(join(ledgerDir, 'ledger.jsonl'), nested.map((r) => JSON.stringify(r)).join('\n') + '\n');
const v3 = verifyLedger(bridge.sessionId, { dir: ledgerDir });
check('tampered ledger detected (nested object)', v3.ok === false, JSON.stringify(v3));
// key order must not matter
const reordered = lines.map((r) => Object.fromEntries(Object.entries(r).reverse()));
writeFileSync(join(ledgerDir, 'ledger.jsonl'), reordered.map((r) => JSON.stringify(r)).join('\n') + '\n');
const v4 = verifyLedger(bridge.sessionId, { dir: ledgerDir });
check('key order does not affect verification', v4.ok === true, JSON.stringify(v4));

ws.close();
bridge.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed in ${Math.round(performance.now() - t0)} ms (N=1 run)`);
process.exit(failed.length ? 1 : 0);
