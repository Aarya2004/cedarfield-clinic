#!/usr/bin/env node
// Restart the built web app on :3311 and run every evals/cases/*.json through the CDP harness.
import { spawn, spawnSync, execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
try { execSync('lsof -ti :3311 | xargs kill', { stdio: 'ignore', shell: '/bin/zsh' }); } catch {}
const srv = spawn('pnpm', ['start', '-p', '3311'], { cwd: `${root}apps/web`, stdio: 'ignore', detached: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let up = false;
for (let i = 0; i < 40 && !up; i++) { await sleep(250); try { up = (await fetch('http://localhost:3311/')).ok; } catch {} }
if (!up) { console.error('web app did not start on :3311'); process.exit(1); }
let failed = 0;
for (const f of readdirSync(`${root}evals/cases`).filter((x) => x.endsWith('.json')).sort()) {
  const r = spawnSync('node', [`${root}evals/harness/webmcp-cdp.mjs`, 'http://localhost:3311/?test=1', `${root}evals/cases/${f}`], { encoding: 'utf8' });
  const summary = r.stdout.trim().split('\n').pop();
  console.log(`${r.status === 0 ? 'PASS' : 'FAIL'} ${f} ${summary}`);
  if (r.status !== 0) { failed++; console.log(r.stdout.split('\n').filter((l) => l.includes('"ok":false') || l.includes('NO_RESPONSE') || l.includes('"error"')).slice(0, 5).join('\n')); }
}
try { process.kill(-srv.pid); } catch {}
console.log(`evals: ${failed} failed`);
process.exit(failed ? 1 : 0);
