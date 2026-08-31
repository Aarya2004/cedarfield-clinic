// Run: node --experimental-strip-types --test src/lib/drop/clinic-tools.test.ts
//
// PROVISIONAL SCHEMA — Arav red-lines before lock. Two things here are load-bearing beyond the
// usual: (1) exactly five tools reach the model context, and (2) NOT ONE of them is named anything
// like book or confirm. (2) is the product thesis expressed as an assertion — if a booking tool
// ever appears, this file fails before any demo does.
//
// The fake model context is the forge.test.ts idiom (record registrations + their AbortSignal);
// it is installed on `navigator.modelContext` so the real `getModelContext()` feature detection is
// what runs, alias included. The session under test is the real MockDropDriver folded into a
// DropSession-shaped view, so `driver.hold()` really does move the board the tools read back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DropDriver, DropEvent, Slot } from './types.ts';
import type { DropSession } from '../../components/drop/useDropSession.ts';
import { createMockDriver, type MockDropDriver } from './mock-driver.ts';
import type { ModelContext, ModelContextTool, RegisterToolOptions } from '../webmcp/types.ts';
import {
  CLINIC_TOOL_NAMES,
  HOLD_CHOREOGRAPHY,
  clinicToolDefs,
  registerClinicTools,
  type ClinicToolsView,
  type ClinicToolsSource,
} from './clinic-tools.ts';

// ── fakes ───────────────────────────────────────────────────────────────────────────────────────

interface Reg {
  tool: ModelContextTool<unknown>;
  signal?: AbortSignal;
}

function fakeMc() {
  const regs: Reg[] = [];
  const mc = {
    registerTool: async (tool: ModelContextTool<unknown>, options?: RegisterToolOptions) => {
      regs.push({ tool, signal: options?.signal });
    },
    getTools: async () => regs.filter((r) => !r.signal?.aborted).map((r) => ({ name: r.tool.name, description: r.tool.description, origin: 'test' })),
    ontoolchange: null,
  } as unknown as ModelContext;
  return { mc, regs, live: () => regs.filter((r) => !r.signal?.aborted).map((r) => r.tool.name) };
}

/** Install a fake on `navigator.modelContext` (and a bare `document`, so the real detection runs). */
function withModelContext(mc: ModelContext | null): () => void {
  const hadDoc = 'document' in globalThis;
  const prevNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'document', { value: {}, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', { value: mc ? { modelContext: mc } : {}, configurable: true, writable: true });
  return () => {
    if (!hadDoc) delete (globalThis as { document?: unknown }).document;
    if (prevNav) Object.defineProperty(globalThis, 'navigator', prevNav);
    else delete (globalThis as { navigator?: unknown }).navigator;
  };
}

/**
 * A DropSession-shaped view over the real mock driver: events are folded exactly as far as these
 * tools care (slots + held come off the driver snapshot, the log is what was emitted). `confirm`
 * throws on purpose — no tool in this module may ever reach the human's booking verb.
 */
function makeSource(driver: MockDropDriver): { source: ClinicToolsSource; holds: string[]; releases: string[] } {
  const log: DropEvent[] = [];
  driver.subscribe((e) => log.push(e));
  const holds: string[] = [];
  const releases: string[] = [];
  const seam: DropDriver = {
    subscribe: (cb) => driver.subscribe(cb),
    hold: (id) => {
      holds.push(id);
      driver.hold(id);
    },
    release: (id) => {
      releases.push(id);
      driver.release(id);
    },
    confirm: () => {
      throw new Error('a clinic tool called driver.confirm() — booking is the human path only');
    },
    book: () => {
      throw new Error('a clinic tool called driver.book() — booking is the human path only');
    },
  };
  const source = (): ClinicToolsView => {
    const snap = driver.snapshot();
    const session: DropSession = {
      now: snap.now,
      slots: snap.slots,
      held: snap.hold
        ? { slotId: snap.hold.slotId, ttlSeconds: snap.hold.ttlSeconds, startedAt: snap.now - (snap.hold.ttlSeconds - snap.hold.secondsLeft) * 1000 }
        : null,
      secondsLeft: snap.hold?.secondsLeft ?? 0,
      log: [...log],
      hold: (id) => seam.hold(id),
      confirm: (id) => seam.confirm(id),
      release: (id) => seam.release(id),
    };
    return { driver: seam, session };
  };
  return { source, holds, releases };
}

/** A board that never moves: for the honest "the page did not confirm it" paths. */
function frozenSource(slots: Slot[], calls: string[]): ClinicToolsSource {
  const driver: DropDriver = {
    subscribe: () => () => {},
    hold: (id) => calls.push(`hold:${id}`),
    release: (id) => calls.push(`release:${id}`),
    confirm: (id) => calls.push(`confirm:${id}`),
    book: (id) => calls.push(`book:${id}`),
  };
  return () => ({
    driver,
    session: { now: 0, slots, held: null, secondsLeft: 0, log: [], hold: driver.hold, confirm: driver.confirm, release: driver.release },
  });
}

const FAST = { settleTimeoutMs: 200, settlePollMs: 1 };

/** Every tool answers `{content:[{type:'text',text}]}` carrying one JSON object. */
async function callJson(def: { execute: (input?: unknown) => Promise<{ content: [{ type: 'text'; text: string }] }> }, input?: unknown) {
  const res = await def.execute(input);
  assert.equal(res.content.length, 1);
  assert.equal(res.content[0].type, 'text');
  return JSON.parse(res.content[0].text) as Record<string, unknown>;
}

/** A driver with the wave landed and nothing taken yet. */
function ready(): { driver: MockDropDriver; source: ClinicToolsSource; holds: string[]; releases: string[] } {
  const driver = createMockDriver({ seed: 7, scenario: 'hold-and-book' });
  const s = makeSource(driver);
  driver.advance(1); // land the wave; the first rival take is 1500ms away
  return { driver, ...s };
}

function defsFor(source: ClinicToolsSource) {
  const defs = clinicToolDefs(source, FAST);
  return {
    defs,
    get: (name: string) => defs.find((d) => d.name === name)!,
  };
}

// ── the thesis ──────────────────────────────────────────────────────────────────────────────────

test('THE THESIS: no registered tool offers to book or confirm anything', async () => {
  const { mc, live } = fakeMc();
  const restore = withModelContext(mc);
  try {
    await registerClinicTools(ready().source, () => {});
    const names = live();
    assert.equal(names.length, 5);
    for (const name of names) {
      assert.ok(!/book/i.test(name), `${name} must not contain "book" — only the human books`);
      // The VERB is the thing under test: `clinic_explain_confirm` explains, it does not confirm.
      const action = name.replace(/^clinic_/, '');
      assert.ok(
        !/^(confirm|reserve|purchase|buy|pay|checkout|submit|complete|finalis|finaliz)/i.test(action),
        `${name} must not act like a booking tool`,
      );
    }
    // Exhaustive, so a sixth tool cannot be added without this assertion being re-read.
    assert.deepEqual(names, [...CLINIC_TOOL_NAMES]);
  } finally {
    restore();
  }
});

test('THE THESIS: no tool path ever calls driver.confirm()', async () => {
  // makeSource's `confirm` throws; driving every tool without an exception is the assertion.
  const { source } = ready();
  const { defs, get } = defsFor(source);
  for (const def of defs) await def.execute(def.name === 'clinic_hold_slot' ? { slot_id: 'slot-1' } : {});
  // Every verb exercised (including release), and the board still shows nothing booked.
  await get('clinic_hold_slot').execute({ slot_id: 'slot-1' });
  const status = await callJson(get('clinic_hold_status'));
  assert.equal(status.held, true);
  const board = await callJson(get('clinic_list_drops'));
  const slots = board.slots as { state: string }[];
  assert.ok(!slots.some((s) => s.state === 'booked_yours'), 'no tool can produce a booking');
});

// ── registration ────────────────────────────────────────────────────────────────────────────────

test('exactly five tools register, in a stable order, with stable names', async () => {
  const { mc, regs, live } = fakeMc();
  const restore = withModelContext(mc);
  try {
    const states: unknown[] = [];
    await registerClinicTools(ready().source, (s) => states.push(s));
    assert.equal(regs.length, 5);
    assert.deepEqual(live(), [
      'clinic_list_drops',
      'clinic_hold_slot',
      'clinic_hold_status',
      'clinic_release_hold',
      'clinic_explain_confirm',
    ]);
    assert.deepEqual(live(), [...CLINIC_TOOL_NAMES]);
    assert.deepEqual(states, [{ kind: 'registered', names: [...CLINIC_TOOL_NAMES] }]);
  } finally {
    restore();
  }
});

test('every registered tool carries a description and an input schema; annotations are honest', async () => {
  const { mc, regs } = fakeMc();
  const restore = withModelContext(mc);
  try {
    await registerClinicTools(ready().source, () => {});
    for (const { tool } of regs) {
      assert.ok(tool.description.length > 80, `${tool.name} needs a description that teaches the choreography`);
      assert.equal((tool.inputSchema as { type: string }).type, 'object');
      assert.equal((tool.inputSchema as { additionalProperties: boolean }).additionalProperties, false);
      assert.equal(typeof tool.annotations?.readOnlyHint, 'boolean');
    }
    const byName = new Map(regs.map((r) => [r.tool.name, r.tool]));
    // Reads are read-only; the two that move a hold are not.
    assert.equal(byName.get('clinic_list_drops')!.annotations!.readOnlyHint, true);
    assert.equal(byName.get('clinic_hold_status')!.annotations!.readOnlyHint, true);
    assert.equal(byName.get('clinic_explain_confirm')!.annotations!.readOnlyHint, true);
    assert.equal(byName.get('clinic_hold_slot')!.annotations!.readOnlyHint, false);
    assert.equal(byName.get('clinic_release_hold')!.annotations!.readOnlyHint, false);
  } finally {
    restore();
  }
});

test('schemas are stable: only clinic_hold_slot takes input, and it requires slot_id', () => {
  const { defs, get } = defsFor(ready().source);
  const hold = get('clinic_hold_slot').inputSchema as { required: string[]; properties: Record<string, { type: string }> };
  assert.deepEqual(hold.required, ['slot_id']);
  assert.equal(hold.properties.slot_id.type, 'string');
  for (const def of defs.filter((d) => d.name !== 'clinic_hold_slot')) {
    assert.deepEqual(def.inputSchema, { type: 'object', properties: {}, additionalProperties: false });
  }
});

test('abort unregisters all five (the returned dispose is the AbortController)', async () => {
  const { mc, live } = fakeMc();
  const restore = withModelContext(mc);
  try {
    const dispose = await registerClinicTools(ready().source, () => {});
    assert.equal(live().length, 5);
    dispose();
    assert.deepEqual(live(), []);
  } finally {
    restore();
  }
});

test('feature detect: no modelContext is a silent no-op, and dispose is safe to call', async () => {
  const restore = withModelContext(null);
  try {
    const states: unknown[] = [];
    const dispose = await registerClinicTools(ready().source, (s) => states.push(s));
    assert.deepEqual(states, [{ kind: 'unsupported' }]);
    dispose(); // must not throw
  } finally {
    restore();
  }
});

test('a registerTool that rejects is reported, never thrown at the page', async () => {
  const mc = { registerTool: async () => { throw new Error('nope'); }, ontoolchange: null } as unknown as ModelContext;
  const restore = withModelContext(mc);
  try {
    const states: unknown[] = [];
    await registerClinicTools(ready().source, (s) => states.push(s));
    assert.deepEqual(states, [{ kind: 'error', message: 'nope' }]);
  } finally {
    restore();
  }
});

// ── behaviour ───────────────────────────────────────────────────────────────────────────────────

test('clinic_list_drops reports the live board, honestly labelled as a demo', async () => {
  const { get } = defsFor(ready().source);
  const out = await callJson(get('clinic_list_drops'));
  assert.equal(out.ok, true);
  assert.equal(out.demo, true);
  assert.equal(out.booking, 'human_only');
  const slots = out.slots as { id: string; time: string; clinician: string; kind: string; state: string }[];
  assert.equal(slots.length, 6);
  assert.equal(out.open_count, 6);
  assert.ok(slots.every((s) => s.id && s.time && s.clinician && s.kind && s.state === 'open'));
  assert.equal(out.your_hold, null);
  // We do not know when the next wave is, so we say null rather than inventing one.
  assert.equal(out.next_wave_seconds, null);
  assert.equal(out.wave_landed_seconds_ago, 0);
});

test('clinic_hold_slot invokes driver.hold and returns the choreography sentence verbatim', async () => {
  const { source, holds } = ready();
  const { get } = defsFor(source);
  const out = await callJson(get('clinic_hold_slot'), { slot_id: 'slot-2' });
  assert.deepEqual(holds, ['slot-2']);
  assert.equal(out.ok, true);
  assert.equal(out.held, true);
  assert.equal(out.booking, 'human_only');
  assert.equal(out.next_step, HOLD_CHOREOGRAPHY);
  assert.match(String(out.next_step), /one keypress on the page books it — you cannot/);
  const hold = out.your_hold as { slot_id: string; ttl_seconds: number; seconds_left: number; state: string };
  assert.equal(hold.slot_id, 'slot-2');
  assert.equal(hold.ttl_seconds, 20);
  assert.ok(hold.seconds_left > 0 && hold.seconds_left <= 20);
  assert.equal(hold.state, 'held_by_you');
});

test('clinic_hold_slot accepts the JSON-string input Chrome hands execute()', async () => {
  const { source, holds } = ready();
  const { get } = defsFor(source);
  const out = await callJson(get('clinic_hold_slot'), JSON.stringify({ slot_id: 'slot-3' }));
  assert.equal(out.ok, true);
  assert.deepEqual(holds, ['slot-3']);
});

test('clinic_hold_status reads the live clock and names the human step', async () => {
  const { driver, source } = ready();
  const { get } = defsFor(source);
  const before = await callJson(get('clinic_hold_status'));
  assert.equal(before.held, false);
  assert.equal(before.your_hold, null);
  assert.match(String(before.next_step), /clinic_hold_slot/);

  await get('clinic_hold_slot').execute({ slot_id: 'slot-1' });
  driver.advance(5_000);
  const after = await callJson(get('clinic_hold_status'));
  assert.equal(after.held, true);
  assert.equal(after.next_step, HOLD_CHOREOGRAPHY);
  const hold = after.your_hold as { seconds_left: number };
  assert.ok(hold.seconds_left <= 15 && hold.seconds_left > 14, `seconds_left burned down: ${hold.seconds_left}`);
});

test('clinic_release_hold gives the slot back and says what is open now', async () => {
  const { source, releases } = ready();
  const { get } = defsFor(source);
  await get('clinic_hold_slot').execute({ slot_id: 'slot-4' });
  const out = await callJson(get('clinic_release_hold'));
  assert.deepEqual(releases, ['slot-4']);
  assert.equal(out.ok, true);
  assert.equal(out.released, 'slot-4');
  assert.equal(out.held, false);
  assert.ok((out.open_slot_ids as string[]).includes('slot-4'));
  assert.equal((await callJson(get('clinic_hold_status'))).held, false);
});

test('clinic_explain_confirm names the absent tool and what to say to the human', async () => {
  const { get } = defsFor(ready().source);
  const out = await callJson(get('clinic_explain_confirm'));
  assert.equal(out.ok, true);
  assert.equal(out.tool_that_books, null);
  assert.equal(out.booking, 'human_only');
  assert.deepEqual(out.tools_that_exist, [...CLINIC_TOOL_NAMES]);
  assert.equal(out.what_to_tell_your_human, HOLD_CHOREOGRAPHY);
  assert.match(String(out.reason), /trusted event|browser-trusted/i);
});

// ── errors: informative, never thrown across the boundary ───────────────────────────────────────

test('unknown slot: an error result with the ids that would work', async () => {
  const { get } = defsFor(ready().source);
  const out = await callJson(get('clinic_hold_slot'), { slot_id: 'slot-99' });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'unknown_slot');
  assert.equal((out.open_slot_ids as string[]).length, 6);
});

test('missing slot_id: an error result, not a throw', async () => {
  const { get } = defsFor(ready().source);
  const out = await callJson(get('clinic_hold_slot'), {});
  assert.equal(out.ok, false);
  assert.equal(out.error, 'slot_id_required');
});

test('the rival got there first: slot_not_open, with the state and the alternatives', async () => {
  const { driver, source } = ready();
  const { get } = defsFor(source);
  driver.advance(3_000); // at least one rival take has landed
  const taken = driver.snapshot().slots.find((s) => s.state === 'taken_by_rival')!;
  const out = await callJson(get('clinic_hold_slot'), { slot_id: taken.id });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'slot_not_open');
  assert.equal(out.slot_state, 'taken_by_rival');
  assert.ok(!(out.open_slot_ids as string[]).includes(taken.id));
});

test('holding the slot you already hold is reported, not silently re-held', async () => {
  const { source, holds } = ready();
  const { get } = defsFor(source);
  await get('clinic_hold_slot').execute({ slot_id: 'slot-5' });
  const out = await callJson(get('clinic_hold_slot'), { slot_id: 'slot-5' });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'already_held_by_you');
  assert.deepEqual(holds, ['slot-5']); // the driver was not asked twice
});

test('moving the hold to another slot reports which hold was released', async () => {
  const { source } = ready();
  const { get } = defsFor(source);
  await get('clinic_hold_slot').execute({ slot_id: 'slot-1' });
  const out = await callJson(get('clinic_hold_slot'), { slot_id: 'slot-2' });
  assert.equal(out.ok, true);
  assert.equal(out.released_previous_hold, 'slot-1');
  assert.equal((out.your_hold as { slot_id: string }).slot_id, 'slot-2');
});

test('releasing nothing: nothing_held, and the driver is never called', async () => {
  const calls: string[] = [];
  const { get } = defsFor(frozenSource([{ id: 'slot-1', timeLabel: '9:00 AM', clinician: 'Dr. Boone', kind: 'Consult', state: 'open' }], calls));
  const out = await callJson(get('clinic_release_hold'));
  assert.equal(out.ok, false);
  assert.equal(out.error, 'nothing_held');
  assert.deepEqual(calls, []);
});

test('a driver that ignores hold(): hold_not_confirmed, never a fabricated hold', async () => {
  const calls: string[] = [];
  const source = frozenSource([{ id: 'slot-1', timeLabel: '9:00 AM', clinician: 'Dr. Boone', kind: 'Consult', state: 'open' }], calls);
  const def = clinicToolDefs(source, { settleTimeoutMs: 5, settlePollMs: 1 }).find((d) => d.name === 'clinic_hold_slot')!;
  const out = await callJson(def, { slot_id: 'slot-1' });
  assert.deepEqual(calls, ['hold:slot-1']);
  assert.equal(out.ok, false);
  assert.equal(out.error, 'hold_not_confirmed');
  assert.equal(out.slot_state, 'open');
});

// ── The invariant, asserted by name ───────────────────────────────────────────────────────────────
// The product is defined as much by the tool that is absent as by the five that are present. If a
// late commit ever adds a booking verb to the surface, this is the test that fails first.
const FORBIDDEN_TOOL_NAMES = [
  'clinic_book_slot',
  'clinic_confirm',
  'clinic_confirm_booking',
  'clinic_book',
  'book_slot',
  'confirm_booking',
];

test('no booking tool exists — not in the names, not in the defs, not in any description', () => {
  const defs = clinicToolDefs(frozenSource([], []));
  const names = defs.map((d) => d.name);
  assert.deepEqual(names, [...CLINIC_TOOL_NAMES], 'the registered defs are exactly the declared five');
  for (const forbidden of FORBIDDEN_TOOL_NAMES) {
    assert.ok(!names.includes(forbidden), `${forbidden} must never be on this page's tool surface`);
    assert.ok(
      !(CLINIC_TOOL_NAMES as readonly string[]).includes(forbidden),
      `${forbidden} must never be declared`,
    );
  }
  // and nothing may advertise a booking capability the page does not grant an agent
  for (const d of defs) {
    assert.ok(
      !/\byou (can|may) (now )?book\b/i.test(d.description),
      `${d.name} must not tell an agent it can book`,
    );
  }
});
