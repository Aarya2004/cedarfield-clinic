// Run: node --experimental-strip-types --test src/lib/webmcp/register.test.ts
//
// terminal_history (ticket #6): the run feed at the agent boundary. Two things are load-bearing and
// both are asserted here — the Share-screen gate (identical to terminal_read_screen) and the fact
// that EVERY string leaves through `redactForAgent`. The store itself is deliberately un-redacted
// (runfeed.ts is human-facing UI state), so if this boundary leaks, the secret is on the wire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedToolDefs, historyForAgent } from './register.ts';
import { gateAAdapter, setGateAShare, setTerminalAdapter, type TerminalAdapter } from './adapter.ts';
import { proposals } from './proposals.ts';
import { OUTPUT_BUDGET_CHARS, clampLastN, type TerminalHistoryResult } from './schemas.ts';
import { runFeed, type Run } from '../terminal/runfeed.ts';

const AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

const history = fixedToolDefs().find((d) => d.name === 'terminal_history')!;
/** Chrome 152 calls execute() with a single argument; the handler must not need `options`. */
const call = (input: unknown = {}) => history.execute(input) as Promise<TerminalHistoryResult>;

function run(over: Partial<Run> = {}): Run {
  return {
    id: `r_${Math.random().toString(36).slice(2)}`,
    command: 'echo hi',
    origin: 'human',
    exit_code: 0,
    ms: 12,
    cwd: '/home/dev',
    tail: ['hi'],
    t: 1_756_000_000_000,
    measured: true,
    ...over,
  };
}

function reset(share: boolean) {
  runFeed.clear();
  setGateAShare(share);
}

test('the tool is registered, read-only, and marked untrusted content', () => {
  assert.equal(history.annotations.readOnlyHint, true);
  assert.equal(history.annotations.untrustedContentHint, true);
  // It must never look like something that can act: no execute/propose language in the description.
  assert.match(history.description, /NEVER executes or proposes anything/);
});

test('Share screen off: shared:false, same shape and reason as terminal_read_screen', async () => {
  reset(false);
  runFeed.record(run({ command: 'echo secret_thing' }));
  const res = await call({ last_n: 5 });
  assert.deepEqual(res, { shared: false, reason: "The human has not turned on 'Share screen with agent'." });
  // and nothing about the run leaked into the refusal
  assert.ok(!JSON.stringify(res).includes('secret_thing'));
});

test('no terminal paired: shared:true with an honest empty runs list', async () => {
  reset(true);
  const res = await call();
  assert.deepEqual(res, { shared: true, runs: [], truncated: false, redactions: 0 });
});

test('Share screen on: every string goes through redactForAgent (tail, command, cwd)', async () => {
  reset(true);
  runFeed.record(
    run({
      command: `export AWS_SECRET_ACCESS_KEY=${AWS_SECRET}`,
      cwd: `/home/dev/GITHUB_TOKEN=${AWS_SECRET}`,
      tail: ['starting', `AWS_SECRET_ACCESS_KEY=${AWS_SECRET}`, 'done'],
    }),
  );
  const res = await call();
  assert.ok(res.shared);
  const whole = JSON.stringify(res);
  assert.ok(whole.includes('[redacted]'), 'the secret was replaced with [redacted]');
  assert.ok(!whole.includes(AWS_SECRET), 'the raw secret never reaches the agent');
  assert.ok(!whole.includes('wJalrXUtnFEMI'), 'not even a prefix of it');
  // the store itself keeps the truth for the human — redaction is this boundary, not the store
  assert.ok(runFeed.snapshot()[0].tail[1].includes(AWS_SECRET));
  const r = res.runs[0];
  assert.equal(r.tail[0], 'starting');
  assert.equal(r.tail[2], 'done');
  assert.ok(r.command!.includes('[redacted]'));
  assert.ok(r.cwd!.includes('[redacted]'));
  assert.ok(res.redactions >= 3, `command + cwd + tail each counted (got ${res.redactions})`);
});

test('measured fields are copied, never inferred; rokan passes through with calls', async () => {
  reset(true);
  runFeed.record(run({ command: 'rokan do "x"', origin: 'agent', exit_code: null, ms: null, cwd: null, measured: false, rokan: { ms: 91, replayed: true } }));
  runFeed.record(run({ command: 'rokan do "y"', origin: 'forged', rokan: { ms: 400, replayed: false } }));
  const res = await call();
  assert.ok(res.shared);
  assert.deepEqual(
    res.runs.map((r) => [r.command, r.origin, r.exit_code, r.ms, r.cwd, r.rokan]),
    [
      ['rokan do "x"', 'agent', null, null, null, { ms: 91, replayed: true, calls: 0 }],
      ['rokan do "y"', 'forged', 0, 12, '/home/dev', { ms: 400, replayed: false, calls: null }],
    ],
  );
});

test('last_n returns the most recent runs, oldest first', async () => {
  reset(true);
  for (let i = 1; i <= 5; i++) runFeed.record(run({ command: `echo ${i}`, tail: [] }));
  const res = await call({ last_n: 2 });
  assert.ok(res.shared);
  assert.deepEqual(
    res.runs.map((r) => r.command),
    ['echo 4', 'echo 5'],
  );
  assert.equal(res.truncated, false, 'asking for fewer runs is the agent’s own choice, not truncation');
});

test('last_n out of range is clamped, never an error (same rule as read_screen.lines)', async () => {
  assert.equal(clampLastN(undefined), 20);
  assert.equal(clampLastN(0), 20); // 0 is not a usable read: fall back to the default
  assert.equal(clampLastN(51), 50);
  assert.equal(clampLastN(1000), 50);
  assert.equal(clampLastN(-5), 1);
  assert.equal(clampLastN('abc'), 20);
  assert.equal(clampLastN(null), 20);
  assert.equal(clampLastN({}), 20);
  assert.equal(clampLastN('3'), 3); // Chrome sometimes hands the input over as JSON-ish strings
  assert.equal(clampLastN(2.9), 2);

  reset(true);
  for (let i = 1; i <= 3; i++) runFeed.record(run({ command: `echo ${i}`, tail: [] }));
  for (const bad of [0, 51, 'abc', null] as unknown[]) {
    const res = await call({ last_n: bad });
    assert.ok(res.shared, 'a bad last_n never fails the read');
    assert.equal(res.runs.length, 3);
  }
});

test('the output budget truncates: newest run keeps its tail, older ones are dropped', async () => {
  reset(true);
  const long = (tag: string) => Array.from({ length: 40 }, (_, i) => `${tag} line ${i} ${'x'.repeat(60)}`);
  runFeed.record(run({ command: 'echo old', tail: long('old') }));
  runFeed.record(run({ command: 'echo new', tail: long('new') }));
  const res = await call();
  assert.ok(res.shared);
  assert.equal(res.truncated, true);
  assert.ok(JSON.stringify(res).length <= OUTPUT_BUDGET_CHARS, `result must fit the ${OUTPUT_BUDGET_CHARS}-char budget (got ${JSON.stringify(res).length})`);
  assert.equal(res.runs.length, 2, 'the metadata of both runs still fits');
  assert.ok(res.runs[1].tail.length > 0, 'the newest run is paid for first');
  assert.equal(res.runs[0].tail.length, 0, 'the older tail is what gets dropped');
  // last lines survive, first lines are the ones cut
  assert.match(res.runs[1].tail.at(-1)!, /new line 39/);
});

test('very many runs: the oldest are dropped so the newest always fit', async () => {
  reset(true);
  for (let i = 0; i < 50; i++) runFeed.record(run({ command: `echo ${i} ${'y'.repeat(40)}`, tail: [] }));
  const res = await call({ last_n: 50 });
  assert.ok(res.shared);
  assert.equal(res.truncated, true);
  assert.ok(res.runs.length < 50);
  assert.ok(JSON.stringify(res).length <= OUTPUT_BUDGET_CHARS);
  assert.match(res.runs.at(-1)!.command!, /^echo 49 /);
});

test('redactions counts only what the agent actually received', () => {
  // the secret sits in the FIRST line of a long tail — the budget drops that line, so counting it
  // would tell the agent about a redaction it never saw.
  const tail = [`AWS_SECRET_ACCESS_KEY=${AWS_SECRET}`, ...Array.from({ length: 60 }, (_, i) => `line ${i} ${'z'.repeat(60)}`)];
  const cut = historyForAgent([run({ tail })], 20);
  assert.equal(cut.truncated, true);
  assert.equal(cut.redactions, 0, 'the redacted line was dropped by the budget and is not counted');
  assert.ok(!JSON.stringify(cut).includes(AWS_SECRET));
  // the same tail, short enough to survive, IS counted
  const kept = historyForAgent([run({ tail: [`AWS_SECRET_ACCESS_KEY=${AWS_SECRET}`, 'ok'] })], 20);
  assert.equal(kept.redactions, 1);
  assert.equal(kept.truncated, false);
});

test('historyForAgent is pure: it does not mutate the store records', () => {
  const r = run({ tail: [`AWS_SECRET_ACCESS_KEY=${AWS_SECRET}`] });
  const before = JSON.stringify(r);
  historyForAgent([r], 20);
  assert.equal(JSON.stringify(r), before);
});

test('terminal_wait: the trailing prompt fragment never reaches the agent', async () => {
  const wait = fixedToolDefs().find((d) => d.name === 'terminal_wait')!;
  const p = proposals.propose('printf "[1]"', 'why');
  const fake: TerminalAdapter = {
    ...gateAAdapter,
    shareScreen: () => true,
    waitProposal: async () => ({ ...proposals.get(p.id)!, status: 'accepted', exit_code: 0, ms: 3, tail: ['printf "[1]"', '[1]', 'judge@rokan:~ %'] }),
  };
  setTerminalAdapter(fake);
  try {
    const res = (await wait.execute({ proposal_id: p.id })) as { status: string; tail: string[] };
    assert.equal(res.status, 'executed');
    assert.deepEqual(res.tail, ['printf "[1]"', '[1]']);
  } finally {
    setTerminalAdapter(gateAAdapter);
    proposals.resolve(p.id, 'dismissed', 'dismissed_by_human');
  }
});
