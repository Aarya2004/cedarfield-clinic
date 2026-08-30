// Rokan's half of the drift test, resting on the built-in `recheck` (Rokan repo
// packages/rokan-do/src/rokan_do/recheck.py): replay every remembered op with
// planning FORBIDDEN; an op that no longer verifies is retired — a dead ledger row.
// That retirement IS the refusal a cached script never makes.
//
// Flow: compile on v1 (one cold model call) -> ship v2 -> recheck -> expect the op
// retired (dead), and a re-ask must NOT return the stale $98.
//
// Cold compile needs a model provider, so this arm is gated behind ANTHROPIC_API_KEY
// exactly like evals/ab/arm-agents.mjs. Without it: SKIP with the reason (honest),
// never a fabricated verdict.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, 'state.json');
// state.json is a TRACKED fixture; restored in the finally below whatever happens.
const V1 = JSON.stringify({ version: 1, price: 98 }) + '\n';   // byte-identical to the committed fixture (trailing newline)
const V2 = JSON.stringify({ version: 2, price: 140 }) + '\n';
const PORT = Number(process.env.DRIFT_PORT || 8099);
// 127.0.0.1, not localhost: rokan-do keys a browser session by `vault.normalize_host`, which accepts
// dotted hosts/IPs and rejects a bare `localhost` (no dot) with INVALID_URL — a terminal reason in
// the cascade, so the compile abstained before any planning (found live 2026-08-29).
const SITE = `127.0.0.1:${PORT}`;
const Q = `how much is the Wander Boot at ${SITE}`;
const ROKAN_MCP_HOME = mkdtempSync(join(tmpdir(), 'ab-drift-'));

function sh(cmd, args) {
  return new Promise((res) => {
    // Isolated store (like arm-c): never learn into, or read from, the operator's real ~/.rokan.
    const p = spawn(cmd, args, { env: { ...process.env, ROKAN_BROWSER_HEADLESS: '1', ROKAN_MCP_HOME } });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => res({ code, out, err }));
  });
}

// A non-zero rokan-do exit with empty stdout used to fall through the JSON.parse catch and be
// reported as `{raw: ""}` — indistinguishable from a refusal, which is the one thing this arm
// must never fake. Every result is now explicitly an error object or a parsed payload.
function parseResult(r, what) {
  if (r.code !== 0) return { error: `rokan-do exited ${r.code} (${what})`, stderr: r.err.trim().slice(0, 400) };
  const last = r.out.trim().split('\n').pop() ?? '';
  try { return JSON.parse(last); } catch { return { error: `rokan-do (${what}) printed no JSON result line`, raw: r.out.slice(-400) }; }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(JSON.stringify({ skip: true, reason: 'ANTHROPIC_API_KEY not set; cold compile needs a model provider' }));
    return;
  }
  writeFileSync(STATE, V1);
  const compile = await sh('rokan-do', ['run', '--json', '--fresh', Q]);
  const v1 = parseResult(compile, 'v1 compile');
  if (v1.error) { console.log(JSON.stringify({ error: v1.error, stage: 'v1_compile', stderr: v1.stderr, v1_compile_code: compile.code }, null, 1)); return; }

  writeFileSync(STATE, V2);   // site redesigned; true price $140
  const recheck = await sh('rokan-do', ['recheck', SITE]);
  if (recheck.code !== 0) { console.log(JSON.stringify({ error: `rokan-do exited ${recheck.code} (recheck)`, stage: 'recheck', stderr: recheck.err.trim().slice(0, 400), recheck_code: recheck.code }, null, 1)); return; }
  const reask = await sh('rokan-do', ['run', '--json', Q]);
  // A refusal is a *successful* run that reports status:error — so a non-zero process exit here is
  // still a harness failure, not a verdict.
  const v2 = parseResult(reask, 'v2 re-ask');
  if (v2.error) { console.log(JSON.stringify({ error: v2.error, stage: 'v2_reask', stderr: v2.stderr, v2_reask_code: reask.code }, null, 1)); return; }

  console.log(JSON.stringify({
    v1_compile: v1,
    v1_compile_code: compile.code,
    recheck_stdout: recheck.out.trim(),
    recheck_code: recheck.code,
    v2_reask: v2,
    v2_reask_code: reask.code,
    // Honest pass condition: after drift, Rokan must NOT report $98. Either it refuses,
    // re-plans (a fresh model call, not a silent replay), or reports the true $140.
    // run.mjs turns this into the process exit code.
    stale_98_returned: JSON.stringify(v2).includes('98'),
  }, null, 1));
}

try {
  await main();
} finally {
  writeFileSync(STATE, V1);                       // tracked fixture back to v1
  rmSync(ROKAN_MCP_HOME, { recursive: true, force: true });   // isolated store is scratch, not evidence
}
