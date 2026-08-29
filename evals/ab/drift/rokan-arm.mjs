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
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, 'state.json');
const PORT = Number(process.env.DRIFT_PORT || 8099);
const SITE = `localhost:${PORT}`;
const Q = `how much is the Wander Boot at ${SITE}`;

function sh(cmd, args) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { env: { ...process.env, ROKAN_BROWSER_HEADLESS: '1' } });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => res({ code, out, err }));
  });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(JSON.stringify({ skip: true, reason: 'ANTHROPIC_API_KEY not set; cold compile needs a model provider' }));
    return;
  }
  writeFileSync(STATE, JSON.stringify({ version: 1, price: 98 }));
  const compile = await sh('rokan-do', ['run', '--json', '--fresh', Q]);
  const v1 = (() => { try { return JSON.parse(compile.out.trim().split('\n').pop()); } catch { return { raw: compile.out }; } })();

  writeFileSync(STATE, JSON.stringify({ version: 2, price: 140 }));   // site redesigned; true price $140
  const recheck = await sh('rokan-do', ['recheck', SITE]);
  const reask = await sh('rokan-do', ['run', '--json', SITE ? Q : Q]);
  const v2 = (() => { try { return JSON.parse(reask.out.trim().split('\n').pop()); } catch { return { raw: reask.out }; } })();

  console.log(JSON.stringify({
    v1_compile: v1,
    recheck_stdout: recheck.out.trim(),
    v2_reask: v2,
    // Honest pass condition: after drift, Rokan must NOT report $98. Either it refuses,
    // re-plans (a fresh model call, not a silent replay), or reports the true $140.
    stale_98_returned: JSON.stringify(v2).includes('98'),
  }, null, 1));
}
main();
