#!/usr/bin/env node
/**
 * Run every evals case headlessly.
 *   node evals/run-all.mjs            prompt-line cases (no shell): evals/cases/*.json except terminal-*
 *   node evals/run-all.mjs --bridge   also starts packages/bridge (--no-tunnel) and runs terminal-*.json
 *                                     against a REAL PTY through the pairing hash
 *   node evals/run-all.mjs --judge=<worker url>   runs terminal-*.json against a deployed judge sandbox:
 *                                     POST /api/session per case (rate limit permitting), pairing hash from the response
 *   --only=<case-substring>   run a subset (exits 1 if it matches no case) · --trace=<dir>  keep every
 *                             case's per-step harness output (with `ms`)
 *   --judge mode retries a failed case once (labelled RETRY / attempt 2), at most 3 retries per suite,
 *   and reports `N retried` on the last line. The last line counts the cases actually RUN, with
 *   `(N skipped)` for judge-only cases skipped in builder mode — never a total that includes them.
 * Starts the built web app on a free port for the run and stops everything afterwards.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const withBridge = process.argv.includes('--bridge');
const judgeUrl = process.argv.find((a) => a.startsWith('--judge='))?.slice(8) ?? null;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
// --trace=<dir>: keep every case's full harness output (one JSON line per step, with `ms`) — the
// per-step timings are the only way to size a wait budget against a remote (judge) PTY instead of guessing.
const traceDir = process.argv.find((a) => a.startsWith('--trace='))?.slice(8) ?? null;
if (traceDir) mkdirSync(traceDir, { recursive: true });
// --bridge --mode=judge: run the local bridge exactly as the container does (judge mode, TTL) to reproduce judge-only failures without a sandbox session
const bridgeMode = process.argv.find((a) => a.startsWith('--mode='))?.slice(7) ?? 'builder';
const bridgeModeArgs = bridgeMode === 'judge' ? ['--mode', 'judge', '--ttl-ms', '1800000'] : [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolved before the build and the server start: an `--only` typo used to build the app, boot it,
// find nothing to run and exit 0 — a green line for a suite that never ran.
const cases = readdirSync(`${root}evals/cases`)
  .filter((x) => x.endsWith('.json'))
  .filter((x) => (withBridge || judgeUrl ? x.startsWith('terminal-') : !x.startsWith('terminal-')))
  .filter((x) => !only || x.includes(only))
  .sort();
if (cases.length === 0) {
  console.error(only ? `--only=${only} matched no case in evals/cases (mode: ${withBridge || judgeUrl ? 'terminal-*' : 'prompt-line'})` : 'no cases found in evals/cases');
  process.exit(1);
}

// One Chrome profile root per run. Cleanup reaps only what this run started, instead of the old
// global `pkill -f user-data-dir=/tmp/webmcp-cdp`, which killed a parallel reviewer's browser too.
const chromeProfileRoot = mkdtempSync(join(tmpdir(), 'webmcp-cdp-run-'));

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
// A stale `.next` (older than the newest source file, or absent) silently tests an old build — both
// of Opus's VERIFY-pass failures were this after a `git pull`. Build first when that is the case.
function newestMtime(dir) {
  let m = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${ent.name}`;
    m = Math.max(m, ent.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs);
  }
  return m;
}
{
  const web = `${root}apps/web`;
  // Judge mode: the page refuses any pairing host not in NEXT_PUBLIC_BRIDGE_HOSTS (read at BUILD
  // time — protocol.ts configuredBridgeHosts). A build made with that env unset (a plain `pnpm build`
  // in a shell without it) silently refuses the live Worker's ws URL: the WS never opens, every case
  // fails to pair with `sentTypes: []`. Measured twice (2026-08-28 and -29). So for --judge we derive
  // the allowlist from the judge URL, pass it to the build, and force a rebuild whenever the current
  // .next was NOT built with this host — never trust a stale build's baked-in env.
  const buildEnv = { ...process.env };
  if (judgeUrl) {
    // The page refuses any pairing host not in NEXT_PUBLIC_BRIDGE_HOSTS, which is read at BUILD time
    // (protocol.ts configuredBridgeHosts). A build without it silently refuses the live Worker's ws
    // URL — the WS never opens and every case fails to pair with sentTypes:[] (measured 2026-08-28/29).
    // The value can't be reliably detected inside .next (the host also appears in the CSP), so for
    // --judge we ALWAYS rebuild with the allowlist derived from the judge URL. A Turbopack rebuild is
    // a few seconds and this build does not create a judge session, so it costs no per-IP slot.
    const host = new URL(judgeUrl).host;
    const existing = (process.env.NEXT_PUBLIC_BRIDGE_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
    buildEnv.NEXT_PUBLIC_BRIDGE_HOSTS = [...new Set([...existing, host])].join(',');
    buildEnv.NEXT_PUBLIC_SANDBOX_URL = judgeUrl;
    console.log(`judge mode — rebuilding web with NEXT_PUBLIC_BRIDGE_HOSTS=${buildEnv.NEXT_PUBLIC_BRIDGE_HOSTS}`);
    const b = spawnSync('pnpm', ['build'], { cwd: web, stdio: 'inherit', env: buildEnv });
    if (b.status !== 0) { console.error('web build failed'); process.exit(1); }
  } else {
    let buildAt = 0;
    try {
      buildAt = statSync(`${web}/.next/BUILD_ID`).mtimeMs;
    } catch {
      /* no build */
    }
    const srcAt = Math.max(newestMtime(`${web}/src`), statSync(`${web}/package.json`).mtimeMs);
    if (buildAt < srcAt) {
      console.log(`web build is ${buildAt ? 'older than the newest source file' : 'missing'} — building`);
      const b = spawnSync('pnpm', ['build'], { cwd: web, stdio: 'inherit' });
      if (b.status !== 0) {
        console.error('web build failed');
        process.exit(1);
      }
    }
  }
}
const srv = spawn('pnpm', ['start', '-p', String(WEB_PORT)], { cwd: `${root}apps/web`, stdio: 'ignore', detached: true });
let bridge = null;
// Every exit path — success, the two startup failures, Ctrl-C, a pkill from another agent, an
// uncaught error — must reap the detached web server (its whole process group), the bridge and the
// harness's Chrome. Measured 2026-08-28 (Opus VERIFY): 16 leaked `next start`, 767 MB RSS.
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  for (const sig of ['SIGTERM', 'SIGKILL']) {
    try {
      process.kill(-srv.pid, sig);
    } catch {
      /* gone */
    }
    try {
      if (bridge && bridge.exitCode === null) bridge.kill(sig);
    } catch {
      /* gone */
    }
    if (sig === 'SIGTERM') {
      const t = Date.now();
      while (Date.now() - t < 300) {
        /* give SIGTERM a moment before SIGKILL */
      }
    }
  }
  // Only this run's browsers: the profile root is unique per run, so this cannot touch anyone else's.
  try {
    execSync(`pkill -f "user-data-dir=${chromeProfileRoot}"`, { stdio: 'ignore' });
  } catch {
    /* none running */
  }
  try {
    rmSync(chromeProfileRoot, { recursive: true, force: true });
  } catch {
    /* gone */
  }
};
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { console.error(e); cleanup(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); cleanup(); process.exit(1); });
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


let pairingHash = '';
async function judgeHash() {
  const t0 = Date.now();
  // /api/session is issued to the app's Origin or to the eval secret (worker.ts). The secret comes from
  // ROKAN_EVAL_SECRET or infra/sandbox/.dev.vars (EVAL_SECRET=…; gitignored) — never from a case file.
  const evalSecret = process.env.ROKAN_EVAL_SECRET ?? (() => { try { return /^EVAL_SECRET=(.+)$/m.exec(readFileSync(`${root}infra/sandbox/.dev.vars`, 'utf8'))?.[1]?.trim() ?? ''; } catch { return ''; } })();
  const r = await fetch(`${judgeUrl.replace(/\/$/, '')}/api/session`, { method: 'POST', headers: evalSecret ? { 'x-rokan-eval': evalSecret } : {} });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`judge session: non-JSON reply ${r.status} ${r.headers.get('content-type')}: ${text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 240)}`);
  }
  if (!r.ok) throw new Error(`judge session refused: ${r.status} ${JSON.stringify(body)}`);
  console.log(`judge sandbox ready: cold_ms=${body.cold_ms} (worker) / ${Date.now() - t0} ms (client)`);
  return `#ws=${encodeURIComponent(body.ws)}&t=${body.token}`;
}
if (judgeUrl) pairingHash = await judgeHash();
if (withBridge) {
  bridge = spawn('node', [`${root}packages/bridge/bin/rokan-terminal.js`, '--no-tunnel', ...bridgeModeArgs, '--port', String(BRIDGE_PORT), '--app', `http://localhost:${WEB_PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
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

let failed = 0;
let retried = 0;
let skipped = 0;
let executed = 0;
// Judge mode retries a transient once per case; capped for the whole suite so a genuinely broken
// deployment cannot burn the per-IP session budget one retry at a time.
const MAX_RETRIES = 3;
for (const f of cases) {
  // A case may start with {"query": "tour=1"} to add page query params for that run.
  const first = JSON.parse(readFileSync(`${root}evals/cases/${f}`, 'utf8'))[0] ?? {};
  if (first.judgeOnly && !judgeUrl) { console.log(`SKIP ${f} (judge-only; builder shell legitimately has a key)`); skipped++; continue; }
  executed++;
  const extraQuery = typeof first.query === 'string' ? `&${first.query}` : '';
  // `clinic-*` cases drive the Drop product's own route instead of Rokan's terminal at `/`.
  // They need no bridge and no pairing hash — the page is the whole product (SPEC-V1 §7.2).
  // `/` is the product (the clinic landing) since 2026-08-31; Rokan's terminal moved to `/terminal`
  // and its cases drive it there. clinic-* cases drive the booking route.
  const routePath = f === 'clinic-landing-frontdoor.json' ? '/' : f.startsWith('clinic-landing') ? '/clinic' : f.startsWith('clinic-') ? '/clinic/book' : '/terminal';
  const url = `http://localhost:${WEB_PORT}${routePath}?test=1${extraQuery}${withBridge || judgeUrl ? pairingHash : ''}`;
  // Judge runs own the committed evidence (docs/evidence/demo/*.png); every other mode shoots to scratch.
  // Judge runs own the committed evidence, so they must shoot to the case's declared path — set the
  // redirect to '' rather than omitting it, or an exported ROKAN_EVAL_SHOT_DIR in the operator's
  // shell would silently divert the evidence run.
  const shotEnv = judgeUrl ? { ROKAN_EVAL_SHOT_DIR: '' } : { ROKAN_EVAL_SHOT_DIR: traceDir ?? `${root}evals/.shots` };
  const runCase = () => spawnSync('node', [`${root}evals/harness/webmcp-cdp.mjs`, url, `${root}evals/cases/${f}`], {
    encoding: 'utf8',
    // A hung case used to hang the suite: the harness has its own per-send timeout, this is the backstop.
    timeout: 900000,
    env: {
      ...process.env,
      ...shotEnv,
      ROKAN_EVAL_CHROME_PROFILE_ROOT: chromeProfileRoot,
      // Gesture cases get Chrome's fake camera so the wasm→model→getUserMedia pipeline is provable
      // headlessly; every other case keeps the stock launch (and a stray operator export is unset).
      ROKAN_EVAL_CHROME_FLAGS: f.includes('gesture') || f.includes('voice-unavailable')
        ? `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream ${process.env.ROKAN_EVAL_CHROME_FLAGS ?? ''}`.trim()
        : '',
    },
  });
  let r = runCase();
  let attempt = 1;
  // spawnSync returns null stdout when the child could not be spawned or was killed on timeout;
  // `null + string` used to write the literal "null" into the trace and crash the summary split.
  const stdoutOf = (x) => x.stdout ?? '';
  const stderrOf = (x) => x.stderr ?? '';
  if (traceDir) writeFileSync(`${traceDir}/${f.replace(/\.json$/, '')}.jsonl`, stdoutOf(r) + (stderrOf(r) ? `\n# stderr\n${stderrOf(r)}` : ''));
  if (r.status !== 0 && judgeUrl && retried < MAX_RETRIES) {
    // Judge mode: the PTY is a `basic` (¼ vCPU) container across a WAN hop. Measured 2026-08-29
    // (--trace, 12 cases): every wait finishes within 6 % of its budget (worst 259 ms / 4000), so a
    // budget miss there is a multi-second container/WS stall, not a tight budget. One labelled retry
    // separates that transient from a real regression; the final line counts retries so it can't hide.
    if (traceDir) writeFileSync(`${traceDir}/${f.replace(/\.json$/, '')}.attempt1.jsonl`, stdoutOf(r) + (stderrOf(r) ? `\n# stderr\n${stderrOf(r)}` : ''));
    console.log(`RETRY ${f} (judge-mode transient? ${retried + 1}/${MAX_RETRIES}) ${stdoutOf(r).trim().split('\n').pop()}`);
    await sleep(1500);
    r = runCase();
    attempt = 2;
    retried++;
    if (traceDir) writeFileSync(`${traceDir}/${f.replace(/\.json$/, '')}.jsonl`, stdoutOf(r) + (stderrOf(r) ? `\n# stderr\n${stderrOf(r)}` : ''));
  } else if (r.status !== 0 && judgeUrl) {
    console.log(`NO RETRY ${f} — suite retry budget spent (${MAX_RETRIES})`);
  }
  const summary = stdoutOf(r).trim().split('\n').pop();
  console.log(`${r.status === 0 ? 'PASS' : 'FAIL'} ${f}${attempt > 1 ? ` (attempt ${attempt})` : ''} ${summary}`);
  if (r.status !== 0) {
    failed++;
    console.log(
      stdoutOf(r)
        .split('\n')
        .filter((l) => l.includes('"ok":false') || l.includes('"diag"') || l.includes('NO_RESPONSE') || l.includes('CDP_ERROR') || l.includes('"error"'))
        .slice(0, 8)
        .join('\n'),
    );
    if (stderrOf(r)) console.log(stderrOf(r).slice(0, 500));
  }
  if (judgeUrl && f !== cases[cases.length - 1]) {
    // one tab per bridge: the previous page is gone, the same session can be re-paired (token unchanged)
    //
    // ACCEPTED TRADEOFF: unlike --bridge (which restarts the bridge between cases, below), judge mode
    // reuses ONE container shell for the whole suite, so cases see each other's cwd, env and history.
    // The alternative — a fresh POST /api/session per case — is refused by the per-IP rate limit
    // (1 new session / 10 min, SANDBOX-PLAN §2.2), which would make the suite unrunnable. Cases must
    // therefore not depend on a pristine shell; a case that does belongs in the --bridge set.
    await sleep(500);
  }
  if (withBridge) {
    // each case needs a fresh, unpaired bridge (one tab at a time): restart it
    bridge.kill('SIGTERM');
    await sleep(300);
    if (bridge.exitCode === null) bridge.kill('SIGKILL');
    bridge = spawn('node', [`${root}packages/bridge/bin/rokan-terminal.js`, '--no-tunnel', ...bridgeModeArgs, '--port', String(BRIDGE_PORT), '--app', `http://localhost:${WEB_PORT}`, '--token', pairingHash.split('&t=')[1]], { stdio: ['ignore', 'pipe', 'pipe'] });
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
cleanup();
console.log(`evals${withBridge ? ' (real PTY)' : judgeUrl ? ' (judge sandbox)' : ''}: ${failed} failed of ${executed} run${skipped ? ` (${skipped} skipped)` : ''}${retried ? `, ${retried} retried` : ''}`);
process.exit(failed ? 1 : 0);
