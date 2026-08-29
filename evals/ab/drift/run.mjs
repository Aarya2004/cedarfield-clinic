// One command for the drift test. Starts the swappable server, runs the naive
// cached-script arm live (deterministic), then the Rokan arm (gated behind the key),
// and always kills the server. Output is the record for docs/measurements.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, 'state.json');
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

const srv = spawn(process.execPath, [join(HERE, 'server.mjs')], { env });
srv.stderr.on('data', (d) => process.stderr.write(String(d)));
try {
  await sleep(600);
  writeFileSync(STATE, JSON.stringify({ version: 1, price: 98 }));
  const cap = await node('naive-cache.mjs', ['capture']);
  writeFileSync(STATE, JSON.stringify({ version: 2, price: 140 }));   // ship the redesign
  const rep = await node('naive-cache.mjs', ['replay']);
  console.log('# DRIFT TEST — true price after redesign: $140\n');
  console.log('## naive cached script (the failure mode)');
  console.log('v1 capture:', cap.out);
  console.log('v2 replay :', rep.out);
  const lied = JSON.parse(rep.out).answer && JSON.parse(rep.out).answer !== '$140';
  console.log(`=> naive arm ${lied ? 'SILENTLY WRONG (no refusal)' : 'unexpectedly correct'}\n`);

  console.log('## Rokan (verified-or-refused via recheck)');
  const rokan = await node('rokan-arm.mjs');
  console.log(rokan.out || rokan.err);
} finally {
  srv.kill('SIGTERM');
}
