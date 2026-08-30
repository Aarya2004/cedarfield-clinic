// node --test evals/test/runner-cleanup.test.mjs — the eval runner must never leak its detached web
// server: not on its own failure paths, not on Ctrl-C (Opus VERIFY 2026-08-28: 16 leaked `next start`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runner = `${root}evals/run-all.mjs`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
const listeners = (port) => { try { return execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const nextProcs = (port) => { try { return execSync(`pgrep -f "next start -p ${port}$"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const reaped = async (port) => { for (let i = 0; i < 12; i++) { if (!nextProcs(port) && !listeners(port)) return true; await sleep(250); } return false; };

// `--only=tour`, not a filter that matches nothing: a zero-match --only now exits 1 before the
// build (see the third test), which would make these two prove nothing.
test('startup failure path reaps the web server (port 1 cannot bind → "web app did not start" → exit 1, nothing left)', async () => {
  const p = spawn(process.execPath, [runner, '--only=tour'], { cwd: root, env: { ...process.env, ROKAN_EVAL_WEB_PORT: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const code = await new Promise((res) => p.on('exit', res));
  assert.equal(code, 1);
  assert.ok(await reaped(1), 'a `next start -p 1` process survived the failure path');
});

test('--only that matches no case exits 1 with a message, before building or serving anything', async () => {
  const p = spawn(process.execPath, [runner, '--only=nothing-matches'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  const code = await new Promise((res) => p.on('exit', res));
  assert.equal(code, 1, 'a suite that ran zero cases must not report success');
  assert.match(err, /--only=nothing-matches matched no case/);
});

test('SIGINT mid-run reaps the web server and frees its port', async () => {
  const port = await freePort();
  const p = spawn(process.execPath, [runner, '--only=tour'], { cwd: root, env: { ...process.env, ROKAN_EVAL_WEB_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    await sleep(250);
    try { up = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch { /* booting */ }
  }
  assert.ok(up, 'web server never came up (is apps/web built?)');
  p.kill('SIGINT');
  await new Promise((res) => p.on('exit', res));
  assert.ok(await reaped(port), `port ${port} still served / a next process survived SIGINT`);
});
