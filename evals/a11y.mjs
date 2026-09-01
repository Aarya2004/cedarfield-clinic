#!/usr/bin/env node
/**
 * Accessibility gate — axe-core against the product's real routes, in a real browser.
 *
 * Why this exists as its own runner rather than an `evals/cases/*.json`: the case would have to
 * carry 553 KB of inlined axe-core, twice. Here the library is read from node_modules at run time
 * and injected into the page through the same CDP harness the WebMCP evals use, so the audit sees
 * exactly what a judge's browser sees — after hydration, after the wave has dropped, with the board
 * live — not a static render.
 *
 * It is a gate, not a report: any violation exits non-zero. An entry that argues accessibility
 * cannot fail the first audit anyone runs on it. (2026-08-31: it found three on the first pass —
 * no `<main>`, no `<h1>`, thirteen nodes outside any landmark. Fixed in ClinicFrame/Landing/Booking.)
 *
 *   node evals/a11y.mjs                                    # builds + serves apps/web, audits /, /clinic, /clinic/book
 *   node evals/a11y.mjs --url=https://…                    # audits a deployed origin instead
 *   node evals/a11y.mjs --routes=/clinic,/clinic/book      # pick the routes
 *   node evals/a11y.mjs --tags=wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa   # narrow the rule set
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'apps/web/package.json'));
const flag = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;

const routes = flag('routes', '/,/clinic,/clinic/book').split(',').filter(Boolean);
// Default rule set: the WCAG tags a judge (or an audit tool) would actually cite. `best-practice`
// rules are advisory and deliberately out — we gate on the standard, not on taste.
const tags = flag('tags', 'wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22a,wcag22aa').split(',');
const externalUrl = flag('url', null);

const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');
const work = mkdtempSync(join(tmpdir(), 'rokan-a11y-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () =>
  new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
    s.on('error', rej);
  });

/** Steps: wait for hydration (the hooks only exist once React runs), inject axe, run it. */
function stepsFor(route) {
  // `/` and `/clinic` both render the landing; only the booking route has slots. Getting this
  // wrong is not cosmetic: the first version waited for `[data-slot-state]` on `/`, which never
  // appears there, so the audit sat out a silent 30 s timeout per run and the failed wait was
  // ignored — an audit that cannot fail its own readiness check is not a gate (found 2026-08-31
  // in self-review; the summary check below closes the second half of that hole).
  const ready = route.startsWith('/clinic/book')
    ? "!!document.querySelector('[data-slot-state]')"
    : "!!document.querySelector('[data-clinic-route=\"landing\"]')";
  return [
    { waitFor: ready, timeout: 30000 },
    { sleep: 700 },
    // axe.min.js is a UMD bundle whose global is an object, not a function (first version
    // asserted 'function' and failed on every route once the gate started reading step results).
    { eval: `${axeSource}; typeof axe`, equals: 'object' },
    {
      eval:
        `axe.run(document, { runOnly: { type: 'tag', values: ${JSON.stringify(tags)} }, resultTypes: ['violations'] })` +
        `.then((r) => JSON.stringify({ violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: (v.nodes[0] && v.nodes[0].html || '').slice(0, 160) })) }))`,
    },
  ];
}

let server;
let base = externalUrl;
try {
  if (!base) {
    console.log('· building apps/web (production, the way a judge sees it) …');
    const built = spawnSync('pnpm', ['-s', 'build'], { cwd: join(root, 'apps/web'), stdio: 'inherit' });
    if (built.status !== 0) throw new Error('build failed');
    const port = await freePort();
    base = `http://localhost:${port}`;
    server = spawn('pnpm', ['-s', 'start', '--port', String(port)], { cwd: join(root, 'apps/web') });
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${base}/clinic`)).ok) break;
      } catch {
        /* not up yet */
      }
      await sleep(500);
    }
  }

  let violations = 0;
  for (const route of routes) {
    const stepsFile = join(work, `steps${route.replace(/\W+/g, '_')}.json`);
    writeFileSync(stepsFile, JSON.stringify(stepsFor(route)));
    const run = spawnSync('node', [join(root, 'evals/harness/webmcp-cdp.mjs'), `${base}${route}${route.includes('?') ? '&' : '?'}test=1`, stepsFile], {
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 32 * 1024 * 1024, // axe's own source echoes back in the step log; 1 MB is not enough
    });
    const lines = (run.stdout ?? '').split('\n').filter(Boolean);
    const parsed = lines.map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    });
    const found = parsed.find((d) => d && typeof d.value === 'string' && d.value.includes('violations'));
    const summary = parsed.find((d) => d && d.summary)?.summary;
    if (summary && summary.failed > 0) {
      // A failed readiness wait or a failed injection means the audit ran against a page state we
      // did not intend — treat it as a violation of the gate itself, never as a clean pass.
      console.log(`✖ ${route} — ${summary.failed} harness step(s) failed before/around the audit`);
      violations += 1;
      continue;
    }
    if (!found) {
      console.error(`✖ ${route}: the audit produced no result (harness failed)`);
      console.error((run.stderr ?? '').slice(-800));
      violations += 1;
      continue;
    }
    const list = JSON.parse(found.value).violations;
    violations += list.length;
    if (list.length === 0) {
      console.log(`✔ ${route} — 0 violations (${tags.join(', ')})`);
    } else {
      console.log(`✖ ${route} — ${list.length} violation${list.length === 1 ? '' : 's'}`);
      for (const v of list) console.log(`    ${v.impact.padEnd(8)} ${v.id} ×${v.nodes}  ${v.help}\n      ${v.sample}`);
    }
  }
  console.log(violations === 0 ? '\na11y: clean' : `\na11y: ${violations} violation(s)`);
  process.exitCode = violations === 0 ? 0 : 1;
} finally {
  server?.kill();
  rmSync(work, { recursive: true, force: true });
}
