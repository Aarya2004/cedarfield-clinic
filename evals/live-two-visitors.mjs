#!/usr/bin/env node
/**
 * THE LIVE BOARD, PROVEN WITH TWO VISITORS (SPEC-V3).
 *
 * Visitor A is a real headless Chrome on the live page (no ?test=1 — the shared board). Visitor B is
 * a second anonymous session driven from this script through the same public API a browser uses.
 * B holds and books a slot while A's page is open; A's page must show that slot as
 * `taken_by_other` ("Another patient") within a few seconds, without a reload — realtime, not a
 * poll fallback. Then A holds a different slot and B must be refused it by the database.
 *
 *   node evals/live-two-visitors.mjs --url=https://rokan-terminal.vercel.app
 *   node evals/live-two-visitors.mjs --url=http://localhost:3000
 *
 * Exits 1 on any failed step. Mutates the shared inventory (one booking, cancelled at the end) —
 * that is the point; run it, do not schedule it.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6).replace(/\/+$/, '');
if (!url) {
  console.error('usage: node evals/live-two-visitors.mjs --url=https://…');
  process.exit(2);
}

// supabase-js lives in apps/web; import it from there so this script has no install step of its own
const { createClient } = await import(pathToFileURL(join(root, 'apps/web/node_modules/@supabase/supabase-js/dist/index.mjs')).href);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://hxqpaquhkmnrnjfutuyu.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_5vuucxEB_4VUDmspqoqAJA_YtN22qUK';

let failures = 0;
const ok = (pass, label, detail = '') => {
  console.log(`${pass ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
};

// ── visitor B: a second anonymous session, the same API the page uses ────────────────────────
const b = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
{
  const { error } = await b.auth.signInAnonymously();
  ok(!error, 'visitor B signed in anonymously', error?.message);
  if (error) process.exit(1);
}
const rpcB = async (fn, args) => {
  const { data, error } = await b.rpc(fn, args);
  return { data, error: error?.message ?? null };
};
const board = await rpcB('clinic_board');
ok(!board.error, 'visitor B reads the board', board.error ?? `wave ${board.data?.wave}`);
const open = (board.data?.slots ?? []).filter((s) => s.state === 'open');
ok(open.length >= 2, 'at least two open slots to race over', `${open.length} open`);
if (failures) process.exit(1);
const target = open[0].id; // B will take this one while A watches
const aTarget = open[1].id; // A will hold this one; B must be refused it

// ── visitor A: the real page, headless, on the LIVE board ────────────────────────────────────
const work = mkdtempSync(join(tmpdir(), 'drop-live-'));
const steps = [
  { allowErrors: ['INFO: Created TensorFlow Lite XNNPACK delegate'], waitFor: "document.querySelector('[data-clinic-route=\"book\"]') !== null", timeout: 20000 },
  { waitFor: "document.querySelector('[data-clinic-tools]')?.getAttribute('data-clinic-tools') === 'registered'", timeout: 15000 },
  // the live board has landed (the connecting line is gone) and B's target is visible and open
  { waitFor: `document.querySelector('[data-clinic-slot="${target}"]')?.getAttribute('data-slot-state') === 'open'`, timeout: 20000 },
  { eval: "document.querySelector('[data-clinic-wave-age]')?.textContent?.includes('live for every visitor')", equals: true },
  // hand the script a beat to book as B, then watch A's page — no reload, no click — show it gone
  { eval: "'watching'", equals: 'watching' },
  { waitFor: `document.querySelector('[data-clinic-slot="${target}"]')?.getAttribute('data-slot-state') === 'taken_by_other'`, timeout: 15000 },
  { eval: `document.querySelector('[data-clinic-slot="${target}"]')?.textContent?.includes('Another patient')`, equals: true },
  { shot: 'docs/evidence/clinic/live-another-patient.png' },
  // A holds through the real tool; then B (below) is refused the same slot by the database
  { invoke: 'clinic_hold_slot', input: { slot_id: aTarget }, outputMatches: 'held.{0,2}:true' },
  { waitFor: `document.querySelector('[data-clinic-slot="${aTarget}"]')?.getAttribute('data-slot-state') === 'held_by_you'`, timeout: 8000 },
  { eval: "'held'", equals: 'held' },
  { sleep: 4000 },
  { eval: `document.querySelector('[data-clinic-slot="${aTarget}"]')?.getAttribute('data-slot-state')`, equals: 'held_by_you' },
];
const caseFile = join(work, 'live.json');
writeFileSync(caseFile, JSON.stringify(steps));

const harness = spawn('node', [join(root, 'evals/harness/webmcp-cdp.mjs'), `${url}/clinic/book`, caseFile], {
  env: { ...process.env, ROKAN_EVAL_SHOT_DIR: process.env.ROKAN_EVAL_SHOT_DIR ?? join(root, 'evals/.shots') },
});
let out = '';
harness.stdout.on('data', (d) => {
  out += d.toString();
  process.stdout.write(d);
});
harness.stderr.on('data', (d) => process.stderr.write(d));

// script-side choreography keyed on the page's own step output
const waitForLine = (needle, ms) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      if (out.includes(needle)) return resolve();
      if (Date.now() - t0 > ms) return reject(new Error(`timed out waiting for "${needle}"`));
      setTimeout(tick, 100);
    };
    tick();
  });

try {
  await waitForLine('"value":"watching"', 60_000);
  const hold = await rpcB('clinic_hold', { slot_id: target });
  ok(!hold.error, `visitor B holds ${target}`, hold.error);
  const book = await rpcB('clinic_book', { slot_id: target });
  ok(!book.error, `visitor B books ${target} (hold-before-book, server-enforced)`, book.error);

  await waitForLine('"value":"held"', 60_000);
  const steal = await rpcB('clinic_hold', { slot_id: aTarget });
  ok(!!steal.error && steal.error.includes('slot_unavailable'), `visitor B refused A's held slot by the database`, steal.error ?? 'was allowed!');
  const stealBook = await rpcB('clinic_book', { slot_id: aTarget });
  ok(!!stealBook.error, `visitor B cannot book A's hold`, stealBook.error ?? 'was allowed!');
} catch (e) {
  ok(false, 'choreography', e instanceof Error ? e.message : String(e));
}

const code = await new Promise((resolve) => harness.on('exit', resolve));
const summary = out
  .split('\n')
  .map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  })
  .find((d) => d && d.summary)?.summary;
ok(code === 0 && summary && summary.failed === 0, "visitor A's page: every step", summary ? `${summary.steps} steps, ${summary.failed} failed` : `exit ${code}`);

// leave the shared world as we found it
const cancel = await rpcB('clinic_cancel', { slot_id: target });
ok(!cancel.error, 'visitor B cancels its booking (cleanup)', cancel.error);
rmSync(work, { recursive: true, force: true });
console.log(failures === 0 ? '\nLIVE BOARD PROVEN WITH TWO VISITORS' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
