#!/usr/bin/env node
// Arms A (Codex CLI) + B (Claude Code) of the Impact A/B: a vanilla agent answers
// the SAME live-web question cold each run — the model is in the loop EVERY time.
// Honest: wall time is measured here; turns/tokens are the agent's own reported
// numbers. N small (agent runs are slow + cost real tokens). Contrast Arm C: 0
// model calls on every warm run.  Usage: node evals/ab/arm-agents.mjs
import { execFile } from 'node:child_process';

const N = Number(process.env.AB_N || 3);
const TASKS = [
  { label: 'native (allbirds)', q: 'How much are Wool Runners at allbirds.com right now? Reply one short line with the price.' },
  { label: 'compiled (status)', q: 'Is status.python.org showing all systems operational right now? Reply one short line.' },
];

function run(cmd, args, { timeout = 180000 } = {}) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = execFile(cmd, args, { timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ wall: Math.round(performance.now() - t0), stdout: String(stdout), stderr: String(stderr), err: err ? String(err).slice(0, 120) : null });
    });
    child.stdin?.end();
  });
}
async function claudeRun(q) {
  const r = await run('claude', ['-p', q, '--output-format', 'json']);
  let j = null; try { j = JSON.parse(r.stdout); } catch { /* */ }
  return { wall: r.wall, turns: j?.num_turns ?? null, duration_ms: j?.duration_ms ?? null, cost: j?.total_cost_usd ?? null, answer: (j?.result ?? '').slice(0, 90), ok: !!j && !j.is_error };
}
async function codexRun(q) {
  const r = await run('codex', ['exec', '--skip-git-repo-check', '--json', q]);
  let turns = 0, webSearches = 0, inTok = null, outTok = null, answer = '';
  for (const line of r.stdout.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type === 'turn.completed') { turns++; inTok = e.usage?.input_tokens ?? inTok; outTok = e.usage?.output_tokens ?? outTok; }
    if (e.type === 'item.completed' && e.item?.type === 'web_search') webSearches++;
    if (e.type === 'item.completed' && e.item?.type === 'agent_message') answer = String(e.item.text || '').slice(0, 90);
  }
  return { wall: r.wall, turns, web_searches: webSearches, input_tokens: inTok, output_tokens: outTok, answer, ok: !!answer };
}
// Math.round here is right for milliseconds and destroys a dollar figure: it printed
// cost_usd.mean 0 next to min 0.101186 in docs/evidence/ab/arm-agents.json (fixed 2026-08-29).
// toFixed(4) keeps sub-cent costs and is still exact enough for ms/turns.
const stats = (xs) => { const a = xs.filter((x) => typeof x === 'number').sort((p, q) => p - q); return a.length ? { mean: Number((a.reduce((s, x) => s + x, 0) / a.length).toFixed(4)), min: a[0], max: a[a.length - 1], n: a.length } : { mean: null, n: 0 }; };

const out = { arms: {}, n: N, tasks: [] };
for (const task of TASKS) {
  const claude = [], codex = [];
  for (let i = 0; i < N; i++) { claude.push(await claudeRun(task.q)); console.error(`[B claude] ${task.label} #${i + 1}: ${claude.at(-1).turns}t ${claude.at(-1).wall}ms`); }
  for (let i = 0; i < N; i++) { codex.push(await codexRun(task.q)); console.error(`[A codex ] ${task.label} #${i + 1}: ${codex.at(-1).turns}t/${codex.at(-1).web_searches}ws ${codex.at(-1).wall}ms`); }
  out.tasks.push({
    label: task.label, q: task.q,
    // `runs` keeps the per-run values next to the aggregate: the 2026-08-29 file could not have its
    // cost mean recomputed after the Math.round bug because only min/max/n survived. Never again.
    codex: { wall: stats(codex.map((c) => c.wall)), turns: stats(codex.map((c) => c.turns)), web_searches: stats(codex.map((c) => c.web_searches)), all_ok: codex.every((c) => c.ok), sample: codex[0]?.answer, runs: codex.map((c) => ({ wall: c.wall, turns: c.turns, web_searches: c.web_searches, input_tokens: c.input_tokens, output_tokens: c.output_tokens, ok: c.ok })) },
    claude: { wall: stats(claude.map((c) => c.wall)), turns: stats(claude.map((c) => c.turns)), cost_usd: stats(claude.map((c) => c.cost)), all_ok: claude.every((c) => c.ok), sample: claude[0]?.answer, runs: claude.map((c) => ({ wall: c.wall, turns: c.turns, duration_ms: c.duration_ms, cost_usd: c.cost, ok: c.ok })) },
  });
}
console.log(JSON.stringify(out, null, 2));
