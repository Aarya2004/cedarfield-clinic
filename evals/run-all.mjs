#!/usr/bin/env node
/**
 * Run every evals case headlessly.
 *   node evals/run-all.mjs            prompt-line cases (no shell): evals/cases/*.json except terminal-*
 *   node evals/run-all.mjs --bridge   also starts packages/bridge (--no-tunnel) and runs terminal-*.json
 *                                     against a REAL PTY through the pairing hash
 *   node evals/run-all.mjs --judge=<worker url>   runs terminal-*.json against a deployed judge sandbox:
 *                                     POST /api/session per case (rate limit permitting), pairing hash from the response
 * Restarts the built web app on :3311 for the run and stops everything afterwards.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const withBridge = process.argv.includes('--bridge');
const judgeUrl = process.argv.find((a) => a.startsWith('--judge='))?.slice(8) ?? null;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Take free ports (never kill someone else's :3311 — a second reviewer / Aarya may be serving there).
// ROKAN_EVAL_WEB_PORT / ROKAN_EVAL_BRIDGE_PORT pin them when a fixed URL is wanted.
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
const WEB_PORT = Number(process.env.ROKAN_EVAL_WEB_PORT) || (await freePort());
const BRIDGE_PORT = Number(process.env.ROKAN_EVAL_BRIDGE_PORT) || (await freePort());
const srv = spawn('pnpm', ['start', '-p', String(WEB_PORT)], { cwd: `${root}apps/web`, stdio: 'ignore', detached: true });
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await sleep(250);
  try {
    up = (await fetch(`http://localhost:${WEB_PORT}/`)).ok;
  } catch {
    /* booting */
  }
}
if (!up) {
  console.error('web app did not start');
  process.exit(1);
}

let bridge = null;
let pairingHash = '';
async function judgeHash() {
  const t0 = Date.now();
  const r = await fetch(`${judgeUrl.replace(/\/$/, '')}/api/session`, { method: 'POST' });
  const body = await r.json();
  if (!r.ok) throw new Error(`judge session refused: ${r.status} ${JSON.stringify(body)}`);
  console.log(`judge sandbox ready: cold_ms=${body.cold_ms} (worker) / ${Date.now() - t0} ms (client)`);
  return `#ws=${encodeURIComponent(body.ws)}&t=${body.token}`;
}
if (judgeUrl) pairingHash = await judgeHash();
if (withBridge) {
  bridge = spawn('node', [`${root}packages/bridge/bin/rokan-terminal.js`, '--no-tunnel', '--port', String(BRIDGE_PORT), '--app', `http://localhost:${WEB_PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  let link = '';
  const t0 = Date.now();
  await new Promise((resolve) => {
    const onData = (buf) => {
      const m = /#ws=[^\s]+/.exec(buf.toString());
      if (m && !link) {
        link = m[0];
        resolve();
      }
    };
    bridge.stdout.on('data', onData);
    bridge.stderr.on('data', onData);
    setTimeout(resolve, 15000);
  });
  if (!link) {
    console.error('bridge did not print a pairing link');
    process.exit(1);
  }
  pairingHash = link;
  console.log(`bridge up in ${Date.now() - t0} ms on :${BRIDGE_PORT}`);
}

const cases = readdirSync(`${root}evals/cases`)
  .filter((x) => x.endsWith('.json'))
  .filter((x) => (withBridge || judgeUrl ? x.startsWith('terminal-') : !x.startsWith('terminal-')))
  .filter((x) => !only || x.includes(only))
  .sort();
let failed = 0;
for (const f of cases) {
  // A case may start with {"query": "tour=1"} to add page query params for that run.
  const first = JSON.parse(readFileSync(`${root}evals/cases/${f}`, 'utf8'))[0] ?? {};
  const extraQuery = typeof first.query === 'string' ? `&${first.query}` : '';
  const url = `http://localhost:${WEB_PORT}/?test=1${extraQuery}${withBridge || judgeUrl ? pairingHash : ''}`;
  const r = spawnSync('node', [`${root}evals/harness/webmcp-cdp.mjs`, url, `${root}evals/cases/${f}`], { encoding: 'utf8' });
  const summary = r.stdout.trim().split('\n').pop();
  console.log(`${r.status === 0 ? 'PASS' : 'FAIL'} ${f} ${summary}`);
  if (r.status !== 0) {
    failed++;
    console.log(
      r.stdout
        .split('\n')
        .filter((l) => l.includes('"ok":false') || l.includes('NO_RESPONSE') || l.includes('CDP_ERROR') || l.includes('"error"'))
        .slice(0, 6)
        .join('\n'),
    );
    if (r.stderr) console.log(r.stderr.slice(0, 500));
  }
  if (judgeUrl && f !== cases[cases.length - 1]) {
    // one tab per bridge: the previous page is gone, the same session can be re-paired (token unchanged)
    await sleep(500);
  }
  if (withBridge) {
    // each case needs a fresh, unpaired bridge (one tab at a time): restart it
    bridge.kill('SIGTERM');
    await sleep(300);
    if (bridge.exitCode === null) bridge.kill('SIGKILL');
    bridge = spawn('node', [`${root}packages/bridge/bin/rokan-terminal.js`, '--no-tunnel', '--port', String(BRIDGE_PORT), '--app', `http://localhost:${WEB_PORT}`, '--token', pairingHash.split('&t=')[1]], { stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve) => {
      const onData = (buf) => {
        if (/#ws=/.test(buf.toString())) resolve();
      };
      bridge.stdout.on('data', onData);
      bridge.stderr.on('data', onData);
      setTimeout(resolve, 10000);
    });
  }
}
try {
  process.kill(-srv.pid);
} catch {
  /* gone */
}
bridge?.kill('SIGTERM');
try {
  execSync('pkill -f "user-data-dir=/tmp/webmcp-cdp"', { stdio: 'ignore' });
} catch {
  /* none */
}
console.log(`evals${withBridge ? ' (real PTY)' : judgeUrl ? ' (judge sandbox)' : ''}: ${failed} failed of ${cases.length}`);
process.exit(failed ? 1 : 0);
