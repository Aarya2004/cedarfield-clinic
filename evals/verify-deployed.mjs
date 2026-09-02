#!/usr/bin/env node
/**
 * The one command to run the moment the site is deployed.
 *
 * Everything the repo asserts locally, re-asserted against the real origin a judge will open: the
 * routes answer, the nine tools register in a real browser, no booking/cancel/move tool is on the surface, a
 * synthetic press is refused, a trusted press books, and axe finds nothing on any route. It exits
 * non-zero if any of that is untrue, so "deployed" and "verified" stop being separate claims.
 *
 *   node evals/verify-deployed.mjs --url=https://example.vercel.app
 *
 * Why it is not part of run-all: run-all builds and serves the app itself, which is the wrong thing
 * to do when the question is whether the *deployed* artefact behaves. This drives the origin as-is.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
if (!url) {
  console.error('usage: node evals/verify-deployed.mjs --url=https://…');
  process.exit(2);
}
const origin = url.replace(/\/+$/, '');
const work = mkdtempSync(join(tmpdir(), 'drop-verify-'));
let failures = 0;
const ok = (pass, label, detail = '') => {
  console.log(`${pass ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
};

// ── 1. the routes answer at all ────────────────────────────────────────────────────────────────
for (const path of ['/', '/clinic', '/clinic/book']) {
  try {
    const res = await fetch(`${origin}${path}`, { redirect: 'follow' });
    ok(res.ok, `GET ${path}`, String(res.status));
  } catch (e) {
    ok(false, `GET ${path}`, e instanceof Error ? e.message : String(e));
  }
}

// ── 2. the product's own cases, against the deployed origin ────────────────────────────────────
const cases = [
  ['clinic-thesis.json', '/clinic/book'],
  ['clinic-voice-tour.json', '/clinic/book'],
  ['clinic-cancel.json', '/clinic/book'],
  ['clinic-move.json', '/clinic/book'],
  ['clinic-agent-edges.json', '/clinic/book'],
  ['clinic-responsive.json', '/clinic/book'],
  ['clinic-rival-race.json', '/clinic/book'],
  ['clinic-hold-lapses.json', '/clinic/book'],
  ['clinic-receipt.json', '/clinic/book'],
  ['clinic-landing-frontdoor.json', '/'],
  ['clinic-landing-phone.json', '/clinic'],
  ['clinic-chaos.json', '/clinic/book'],
  ['clinic-phone-acts.json', '/clinic/book'],
  ['clinic-delegation.json', '/clinic/book'],
  ['clinic-activity-log.json', '/clinic/book'],
  ['clinic-voice-names.json', '/clinic/book'],
  ['clinic-guide.json', '/clinic/book'],
  // clinic-soak.json is deliberately NOT here: its walk-away-and-wait beats (180 s arm expiry, a
  // full deferred wave rollover) can exceed the per-case timeout. Run it by hand:
  //   node evals/harness/webmcp-cdp.mjs '<origin>/clinic/book?test=1' evals/cases/clinic-soak.json
];
for (const [file, path] of cases) {
  // `_doc` headers are prose (the harness skips them too) and `shot` steps write into the repo's
  // committed evidence, which a verification run must never do. NB: the harness reads `allowErrors`
  // from steps[0] — if a case ever sets it on its `_doc` header, hoist it before filtering.
  const raw = JSON.parse(readFileSync(join(root, 'evals/cases', file), 'utf8'));
  // The harness reads allowErrors from steps[0]; a case that declares it on its _doc header must
  // keep it after the header is filtered out (the NB below, honored the day it came true).
  const steps = raw.filter((s) => !s._doc && !s.shot);
  if (raw[0]?.allowErrors !== undefined && steps[0] && steps[0].allowErrors === undefined) {
    steps[0] = { ...steps[0], allowErrors: raw[0].allowErrors };
  }
  const tmp = join(work, file);
  writeFileSync(tmp, JSON.stringify(steps));
  // ?test=1 pins the seeded in-page board (SPEC-V3): these cases assert a deterministic world and
  // must never mutate the shared live inventory real visitors are on.
  const testPath = `${path}${path.includes('?') ? '&' : '?'}test=1`;
  const run = spawnSync('node', [join(root, 'evals/harness/webmcp-cdp.mjs'), `${origin}${testPath}`, tmp], {
    encoding: 'utf8',
    timeout: 360_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const summary = (run.stdout ?? '')
    .split('\n')
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .find((d) => d && d.summary)?.summary;
  ok(!!summary && summary.failed === 0, file, summary ? `${summary.steps} steps, ${summary.failed} failed` : 'no summary');
}

// ── 3. accessibility on the deployed origin ────────────────────────────────────────────────────
const a11y = spawnSync('node', [join(root, 'evals/a11y.mjs'), `--url=${origin}`, '--routes=/,/clinic,/clinic/book'], {
  encoding: 'utf8',
  timeout: 300_000,
  maxBuffer: 32 * 1024 * 1024,
});
process.stdout.write(a11y.stdout ?? '');
ok(a11y.status === 0, 'axe on the deployed origin');

rmSync(work, { recursive: true, force: true });
console.log(failures === 0 ? `\nDEPLOYED AND VERIFIED — ${origin}` : `\n${failures} check(s) failed against ${origin}`);
process.exitCode = failures === 0 ? 0 : 1;
