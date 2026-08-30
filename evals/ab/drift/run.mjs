// One command for the drift test. Starts the swappable server, runs the naive
// cached-script arm live (deterministic), then the Rokan arm (gated behind the key),
// and always kills the server. Output is the record for docs/measurements.
//
// The verdict is the EXIT CODE, not the prose: this exits 1 when the test stops proving
// what it claims (see PASS CONDITION below), so a green run in CI is worth something.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, 'state.json');
// state.json is a TRACKED fixture. Every path out of this script puts it back, so a run never
// leaves the working tree dirty (it did, until 2026-08-29).
const V1 = JSON.stringify({ version: 1, price: 98 }) + '\n';   // byte-identical to the committed fixture (trailing newline)
const V2 = JSON.stringify({ version: 2, price: 140 }) + '\n';
const PORT = Number(process.env.DRIFT_PORT || 8099);
const env = { ...process.env, DRIFT_PORT: String(PORT) };

function node(script, args = []) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [join(HERE, script), ...args], { env });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => res({ code, out: out.trim(), err: err.trim() }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll /health instead of guessing at a sleep: a fixed 600 ms was a coin flip on a loaded machine,
// and a server that never bound produced a "naive arm unexpectedly correct" line instead of an error.
async function serverUp(timeoutMs = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (r.ok) return true;
    } catch { /* not listening yet */ }
    await sleep(100);
  }
  return false;
}

let exitCode = 0;
const fail = (why) => { console.error(`FAIL: ${why}`); exitCode = 1; };

writeFileSync(STATE, V1);
const srv = spawn(process.execPath, [join(HERE, 'server.mjs')], { env });
srv.stderr.on('data', (d) => process.stderr.write(String(d)));
try {
  if (!await serverUp()) {
    throw new Error(`drift server never bound 127.0.0.1:${PORT} within 10 s (another process on the port? set DRIFT_PORT)`);
  }
  const cap = await node('naive-cache.mjs', ['capture']);
  writeFileSync(STATE, V2);   // ship the redesign
  const rep = await node('naive-cache.mjs', ['replay']);
  console.log('# DRIFT TEST — true price after redesign: $140\n');
  console.log('## naive cached script (the failure mode)');
  console.log('v1 capture:', cap.out);
  console.log('v2 replay :', rep.out);
  let lied = false;
  try {
    const answer = JSON.parse(rep.out).answer;
    lied = !!answer && answer !== '$140';
  } catch { /* unparseable: not a lie, a broken arm — caught below */ }
  console.log(`=> naive arm ${lied ? 'SILENTLY WRONG (no refusal)' : 'unexpectedly correct'}\n`);
  // PASS CONDITION 1: the failure mode this test exists to reproduce must still reproduce.
  if (!lied) fail(`the naive arm did not silently lie (replay: ${rep.out || '<no output>'}) — the contrast this test rests on is gone`);

  console.log('## Rokan (verified-or-refused via recheck)');
  const rokan = await node('rokan-arm.mjs');
  console.log(rokan.out || rokan.err);
  let r = null;
  try { r = JSON.parse(rokan.out); } catch { /* handled below */ }
  if (!r) {
    fail(`rokan arm produced no parseable JSON (exit ${rokan.code}): ${(rokan.err || rokan.out || '<silent>').slice(0, 300)}`);
  } else if (r.skip) {
    console.log('(rokan arm skipped — no ANTHROPIC_API_KEY; only the naive assertion ran)');
  } else if (r.error) {
    fail(`rokan arm errored: ${r.error}`);
  } else {
    // PASS CONDITION 2: after drift Rokan must not report the stale $98. `stale_98_returned` is the
    // arm's own JSON.stringify(v2_reask).includes('98') — recompute here so a missing field can't pass.
    const stale = r.stale_98_returned ?? JSON.stringify(r.v2_reask ?? '').includes('98');
    if (stale) fail(`Rokan returned the stale 98 after drift: ${JSON.stringify(r.v2_reask)}`);
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  srv.kill('SIGTERM');
  writeFileSync(STATE, V1);   // tracked fixture: always back to v1
}
process.exit(exitCode);
