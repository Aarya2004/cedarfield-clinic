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
// Never start within 25 s of a wave boundary: the whole choreography must fit inside one wave.
let board = await rpcB('clinic_board');
ok(!board.error, 'visitor B reads the board', board.error ?? `wave ${board.data?.wave}`);
if (board.error) process.exit(1);
{
  const untilNext = Date.parse(board.data.next_wave_at) - Date.parse(board.data.server_now);
  if (untilNext < 25_000) {
    console.log(`· ${Math.round(untilNext / 1000)} s to the next release — waiting for a fresh wave`);
    await new Promise((r) => setTimeout(r, untilNext + 1500));
    board = await rpcB('clinic_board');
  }
}
const open = (board.data?.slots ?? []).filter((s) => s.state === 'open');
ok(open.length >= 2, 'at least two open slots to race over', `${open.length} open`);
if (failures) process.exit(1);
// The page picks the two slots ITSELF once its live board has landed (so they exist in A's DOM and
// are open in the same wave A is looking at); this script reads them back from the step output.


// ── visitor A: the real page, headless, on the LIVE board ────────────────────────────────────
const work = mkdtempSync(join(tmpdir(), 'drop-live-'));
const steps = [
  { allowErrors: ['INFO: Created TensorFlow Lite XNNPACK delegate'], waitFor: "document.querySelector('[data-clinic-route=\"book\"]') !== null", timeout: 20000 },
  { waitFor: "document.querySelector('[data-clinic-tools]')?.getAttribute('data-clinic-tools') === 'registered'", timeout: 20000 },
  // the LIVE board has landed: the wave line says so, and at least two slots are open in A's DOM
  { waitFor: "document.querySelector('[data-clinic-wave-age]')?.textContent?.includes('live for every visitor') === true", timeout: 20000 },
  { waitFor: "document.querySelectorAll('[data-slot-state=\"open\"]').length >= 2", timeout: 20000 },
  // the page nominates B's target and A's target; the script reads them from this line
  { eval: "(() => { const o = [...document.querySelectorAll('[data-slot-state=\"open\"]')].map(e => e.getAttribute('data-clinic-slot')); window.__t = o[0]; window.__a = o[1]; return 'targets:' + o[0] + ',' + o[1]; })()", matches: '^targets:' },
  // B books now (script side); A's page — no reload, no click — must show it gone within seconds
  { waitFor: "document.querySelector('[data-clinic-slot=\"' + window.__t + '\"]')?.getAttribute('data-slot-state') === 'taken_by_other'", timeout: 15000 },
  { eval: "document.querySelector('[data-clinic-slot=\"' + window.__t + '\"]')?.textContent?.includes('Another patient')", equals: true },
  { shot: 'docs/evidence/clinic/live-another-patient.png' },
  // A holds through the real tool; then B (script side) is refused the same slot by the database
  { invoke: 'clinic_hold_slot', inputFrom: { slot_id: 'window.__a' }, outputMatches: 'held.{0,2}:true' },
  { waitFor: "document.querySelector('[data-clinic-slot=\"' + window.__a + '\"]')?.getAttribute('data-slot-state') === 'held_by_you'", timeout: 10000 },
  { eval: "'held:' + window.__a", matches: '^held:' },
  { sleep: 4000 },
  { eval: "document.querySelector('[data-clinic-slot=\"' + window.__a + '\"]')?.getAttribute('data-slot-state')", equals: 'held_by_you' },
  // ── THE CASCADE (SPEC-V5). A gives its hold back; B (script) holds a THIRD slot; A's agent joins
  // the line for it; B lets go — and A's dock arms by itself: "It came back to you". Nobody raced.
  { invoke: 'clinic_release_hold', outputMatches: 'ok.{0,2}:true' },
  { waitFor: "document.querySelector('[data-clinic-slot=\"' + window.__a + '\"]')?.getAttribute('data-slot-state') === 'open'", timeout: 10000 },
  { eval: "(() => { const o = [...document.querySelectorAll('[data-slot-state=\"open\"]')].map(e => e.getAttribute('data-clinic-slot')).filter(id => id !== window.__t); window.__q = o[0]; return 'queue-target:' + o[0]; })()", matches: '^queue-target:' },
  { waitFor: "document.querySelector('[data-clinic-slot=\"' + window.__q + '\"]')?.getAttribute('data-slot-state') === 'held_by_other'", timeout: 15000 },
  { invoke: 'clinic_join_waitlist', inputFrom: { slot_id: 'window.__q' }, outputMatches: 'waiting.{0,2}:true[\\s\\S]*position.{0,2}:1' },
  { waitFor: "document.querySelector('[data-clinic-slot=\"' + window.__q + '\"] [data-clinic-position=\"1\"]') !== null", timeout: 10000 },
  { eval: "'queued:' + window.__q", matches: '^queued:' },
  // B releases (script side) → the sweep hands the slot to A → A's dock arms on its own
  { waitFor: "document.querySelector('[data-clinic-slot=\"' + window.__q + '\"]')?.getAttribute('data-slot-state') === 'held_by_you'", timeout: 15000 },
  { waitFor: "document.querySelector('[data-clinic-dock]')?.getAttribute('data-origin') === 'waitlist'", timeout: 10000 },
  { eval: "document.querySelector('[data-clinic-dock-eyebrow]')?.textContent", matches: 'came back' },
  { shot: 'docs/evidence/clinic/live-cascade-came-back.png' },
  { eval: "'cascade-done'", equals: 'cascade-done' },
];
const caseFile = join(work, 'live.json');
writeFileSync(caseFile, JSON.stringify(steps));

const harness = spawn('node', [join(root, 'evals/harness/webmcp-cdp.mjs'), `${url}/clinic/book`, caseFile], {
  env: { ...process.env, ROKAN_EVAL_SHOT_DIR: process.env.ROKAN_EVAL_SHOT_DIR ?? join(root, 'evals/.shots') },
});
// Attach the exit listener NOW: the harness may finish before the choreography below awaits it,
// and a listener attached after the event has fired waits forever.
const harnessExit = new Promise((resolve) => harness.on('exit', resolve));
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

let target = null;
let aTarget = null;
try {
  await waitForLine('"value":"targets:', 90_000);
  const m = out.match(/"value":"targets:([^,"]+),([^"]+)"/);
  if (!m || m[1] === 'undefined' || m[2] === 'undefined') throw new Error('could not read the targets the page nominated');
  target = m[1];
  aTarget = m[2];
  ok(true, 'the page nominated the race', `${target} (B takes) · ${aTarget} (A holds)`);
  const hold = await rpcB('clinic_hold', { slot_id: target });
  ok(!hold.error, `visitor B holds ${target}`, hold.error);
  const book = await rpcB('clinic_book', { slot_id: target });
  ok(!book.error, `visitor B books ${target} (hold-before-book, server-enforced)`, book.error);

  await waitForLine('"value":"held:', 60_000);
  const steal = await rpcB('clinic_hold', { slot_id: aTarget });
  ok(!!steal.error && steal.error.includes('slot_unavailable:held'), `visitor B refused A's held slot by the database`, steal.error ?? 'was allowed!');
  const stealBook = await rpcB('clinic_book', { slot_id: aTarget });
  ok(!!stealBook.error, `visitor B cannot book A's hold`, stealBook.error ?? 'was allowed!');

  // the cascade: B holds the slot A's page nominated for the queue, A joins the line, B lets go
  await waitForLine('"value":"queue-target:', 60_000);
  const q = out.match(/"value":"queue-target:([^"]+)"/)?.[1];
  if (!q || q === 'undefined') throw new Error('could not read the queue target');
  const bHold = await rpcB('clinic_hold', { slot_id: q });
  ok(!bHold.error, `visitor B holds ${q} (A will queue for it)`, bHold.error);
  await waitForLine('"value":"queued:', 60_000);
  const bRelease = await rpcB('clinic_release', { slot_id: q });
  ok(!bRelease.error, `visitor B gives ${q} back — the cascade hands it to A, first in line`, bRelease.error);
  await waitForLine('"value":"cascade-done"', 60_000);
  ok(out.includes('"value":"cascade-done"') && !/"data-origin\\?"\) === 'waitlist'","ok":false/.test(out), "visitor A's dock armed by itself: 'It came back to you' — nobody raced");
} catch (e) {
  ok(false, 'choreography', e instanceof Error ? e.message : String(e));
}

const code = await harnessExit;
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
if (target) {
  const cancel = await rpcB('clinic_cancel', { slot_id: target });
  ok(!cancel.error, 'visitor B cancels its booking (cleanup)', cancel.error);
}
rmSync(work, { recursive: true, force: true });
console.log(failures === 0 ? '\nLIVE BOARD PROVEN WITH TWO VISITORS' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
