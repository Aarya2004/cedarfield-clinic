#!/usr/bin/env node
// Arm C of the Impact A/B (COMPOSE §2.2b): Rokan `rokan do`, cold then warm.
// The thesis it measures: the model leaves the hot path on repeat — cold costs a
// model call, every warm run is 0 calls. Honest: every number is rokan-do's own
// `--json` (speed, model_calls, ms), a fresh store per run of the harness.
// Usage: node evals/ab/arm-c.mjs   (needs ANTHROPIC_API_KEY; headless browser)
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WARM = Number(process.env.AB_WARM || 5);
const TASKS = [
  { label: 'native (allbirds)', q: 'how much are wool runners at allbirds.com' },
  { label: 'compiled (status)', q: 'is status.python.org all systems operational' },
];

function rokanDo(q, env) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    execFile('rokan-do', [q, '--json'], { env, timeout: 120000 }, (err, stdout) => {
      const wall = Math.round(performance.now() - t0);
      const line = String(stdout).split('\n').reverse().find((l) => l.trim().startsWith('{'));
      let j = null;
      try { j = line ? JSON.parse(line) : null; } catch { j = null; }
      resolve({ wall, ...(j || { status: 'error', speed: 'error', model_calls: null, ms: null }) });
    });
  });
}
function kill() { return new Promise((r) => execFile('pkill', ['-f', 'rokan_browser_daemon'], () => r())); }
const stats = (xs) => {
  const a = xs.filter((x) => typeof x === 'number').sort((p, q) => p - q);
  if (!a.length) return { mean: null, min: null, max: null, n: 0 };
  return { mean: Math.round(a.reduce((s, x) => s + x, 0) / a.length), min: a[0], max: a[a.length - 1], n: a.length };
};

const env = { ...process.env, ROKAN_BROWSER_HEADLESS: '1', ROKAN_MCP_HOME: mkdtempSync(join(tmpdir(), 'ab-c-')) };
const out = { arm: 'C (Rokan)', warm: WARM, tasks: [] };
for (const task of TASKS) {
  const cold = await rokanDo(task.q, env); await kill();
  const warm = [];
  for (let i = 0; i < WARM; i++) { warm.push(await rokanDo(task.q, env)); await kill(); }
  const warmCalls = warm.map((w) => w.model_calls);
  out.tasks.push({
    label: task.label, q: task.q,
    cold: { speed: cold.speed, model_calls: cold.model_calls, ms: cold.ms, wall: cold.wall, status: cold.status },
    warm: {
      speeds: [...new Set(warm.map((w) => w.speed))],
      model_calls: warmCalls,
      all_zero_calls: warmCalls.every((c) => c === 0),
      ms: stats(warm.map((w) => w.ms)),
      wall: stats(warm.map((w) => w.wall)),
      answers_ok: warm.every((w) => w.status === 'ok'),
    },
  });
  console.error(`[arm-c] ${task.label}: cold ${cold.speed}/${cold.model_calls}c/${cold.ms}ms · warm ${WARM}× calls=[${warmCalls}] ms≈${out.tasks.at(-1).warm.ms.mean}`);
}
console.log(JSON.stringify(out, null, 2));
