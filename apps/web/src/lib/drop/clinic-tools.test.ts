// Run: node --experimental-strip-types --test src/lib/drop/clinic-tools.test.ts
//
// PROVISIONAL SCHEMA — Arav red-lines before lock. Two things here are load-bearing beyond the
// usual: (1) exactly nine tools reach the model context, and (2) NOT ONE of them is named anything
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
  BASE_TOOL_NAMES,
  BOOKED_TOOL_NAMES,
  HOLD_CHOREOGRAPHY,
  CANCEL_CHOREOGRAPHY,
  MOVE_CHOREOGRAPHY,
  holdStatus,
  parseClockText,
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
    cancel: () => {
      throw new Error('a clinic tool called driver.cancel() — cancelling is the human path only');
    },
    move: () => {
      throw new Error('a clinic tool called driver.move() — moving is the human path only');
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
    cancel: (id) => calls.push(`cancel:${id}`),
    move: (a, b) => calls.push(`move:${a}->${b}`),
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
    await registerClinicTools(ready().source, () => {}, { watchMs: 5 });
    const names = live();
    assert.equal(names.length, 7, 'before any booking: the base seven');
    for (const name of names) {
      assert.ok(!/book/i.test(name), `${name} must not contain "book" — only the human books`);
      // The VERB is the thing under test: `clinic_explain_confirm` explains, it does not confirm.
      const action = name.replace(/^clinic_/, '');
      assert.ok(
        !/^(confirm|reserve|purchase|buy|pay|checkout|submit|complete|finalis|finaliz)/i.test(action),
        `${name} must not act like a booking tool`,
      );
    }
    // Exhaustive, so an eighth base tool cannot be added without this assertion being re-read.
    // (The booked three are born later by the human's press — asserted in the next test.)
    assert.deepEqual(names, [...BASE_TOOL_NAMES]);
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

test('seven tools register on load; the booked three are born by the human press and die with the booking', async () => {
  const { mc, regs, live } = fakeMc();
  const restore = withModelContext(mc);
  try {
    const states: unknown[] = [];
    const { driver, source } = ready();
    const dispose = await registerClinicTools(source, (s) => states.push(s), { watchMs: 5 });
    assert.equal(regs.length, 7);
    assert.deepEqual(live(), [
      'clinic_list_drops',
      'clinic_find_slots',
      'clinic_clinicians',
      'clinic_hold_slot',
      'clinic_hold_status',
      'clinic_release_hold',
      'clinic_explain_confirm',
    ]);
    assert.deepEqual(live(), [...BASE_TOOL_NAMES]);
    assert.deepEqual(states, [{ kind: 'registered', names: [...BASE_TOOL_NAMES] }]);
    // THE HUMAN BOOKS (directly on the driver — the test is the person) → three tools are born
    const open = driver.snapshot().slots.find((s) => s.state === 'open')!;
    driver.hold(open.id);
    driver.book(open.id);
    await new Promise((r) => setTimeout(r, 40));
    // registration order: the base seven first, then the three the press created
    assert.deepEqual(live(), [...BASE_TOOL_NAMES, ...BOOKED_TOOL_NAMES], 'after the press: the full ten, booked set included');
    assert.deepEqual([...live()].sort(), [...CLINIC_TOOL_NAMES].sort());
    assert.deepEqual(states.at(-1), { kind: 'registered', names: [...CLINIC_TOOL_NAMES] });
    // THE HUMAN CANCELS → the three are unregistered again
    driver.cancel(open.id);
    await new Promise((r) => setTimeout(r, 40));
    assert.deepEqual(live(), [...BASE_TOOL_NAMES], 'no booking, no booked tools');
    dispose();
    assert.deepEqual(live(), [], 'dispose drops everything');
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

test('schemas are stable: exactly three tools take input, everything else is a bare object', () => {
  const { defs, get } = defsFor(ready().source);
  const hold = get('clinic_hold_slot').inputSchema as { required: string[]; properties: Record<string, { type: string }> };
  assert.deepEqual(hold.required, ['slot_id']);
  assert.equal(hold.properties.slot_id.type, 'string');
  const move = get('clinic_prepare_move').inputSchema as { required: string[]; properties: Record<string, { type: string }> };
  assert.deepEqual(move.required, ['new_slot_id']);
  assert.equal(move.properties.new_slot_id.type, 'string');
  const find = get('clinic_find_slots').inputSchema as { required?: string[]; properties: Record<string, { type: string }> };
  assert.equal(find.required, undefined, 'every clinic_find_slots filter is optional — an empty query is a listing');
  assert.deepEqual(Object.keys(find.properties).sort(), ['after', 'before', 'clinician', 'kind']);
  const WITH_INPUT = ['clinic_hold_slot', 'clinic_prepare_move', 'clinic_find_slots'];
  for (const def of defs.filter((d) => !WITH_INPUT.includes(d.name))) {
    assert.deepEqual(def.inputSchema, { type: 'object', properties: {}, additionalProperties: false });
  }
});

test('abort unregisters all five (the returned dispose is the AbortController)', async () => {
  const { mc, live } = fakeMc();
  const restore = withModelContext(mc);
  try {
    const dispose = await registerClinicTools(ready().source, () => {});
    assert.equal(live().length, 7);
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

test('clinic_list_drops reports the live board, honestly labelled as fictional', async () => {
  const { get } = defsFor(ready().source);
  const out = await callJson(get('clinic_list_drops'));
  assert.equal(out.ok, true);
  assert.equal(out.fictional_clinic, true);
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
  assert.deepEqual(out.tools_that_exist, [...BASE_TOOL_NAMES], 'no booking yet: the base seven');
  assert.deepEqual(out.tools_that_appear_after_your_human_books, [...BOOKED_TOOL_NAMES]);
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
  // SPEC-V2: cancel and move are HUMAN verbs too. The prepare_* tools only arm the dock.
  'clinic_cancel_booking',
  'clinic_cancel',
  'clinic_move_booking',
  'clinic_reschedule',
  'cancel_booking',
  'move_booking',
];

test('no booking tool exists — not in the names, not in the defs, not in any description', () => {
  const defs = clinicToolDefs(frozenSource([], []));
  const names = defs.map((d) => d.name);
  assert.deepEqual(names, [...CLINIC_TOOL_NAMES], 'the defs are exactly the declared ten');
  for (const forbidden of FORBIDDEN_TOOL_NAMES) {
    assert.ok(!(names as string[]).includes(forbidden), `${forbidden} must never be on this page tool surface`);
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

// ── Chrome's character budgets, asserted (secure-tools guidance the README cites) ────────────────
// 500 chars per tool description · 150 per param description · 30 per name · 1.5K per output.
// These are recommendations, not platform limits — but the README says we respect them, so the
// suite must, or the claim is prose. Output is measured on a REAL driven board (wave landed,
// hold live), not an empty fixture, because a busy board is when the payloads are biggest.

test('every tool honours the Chrome budgets: name ≤ 30, description ≤ 500, params ≤ 150', () => {
  const defs = clinicToolDefs(frozenSource([], []));
  for (const d of defs) {
    assert.ok(d.name.length <= 30, `${d.name} name ${d.name.length} > 30`);
    assert.ok(d.description.length <= 500, `${d.name} description ${d.description.length} > 500`);
    const props = (d.inputSchema.properties ?? {}) as Record<string, { description?: string }>;
    for (const [pname, p] of Object.entries(props)) {
      if (p.description) {
        assert.ok(p.description.length <= 150, `${d.name}.${pname} param description ${p.description.length} > 150`);
      }
    }
  }
});

test('worst-case tool outputs stay under 1.5K on a full, live board', async () => {
  const driver = createMockDriver({ seed: 11, scenario: 'hold-and-book' });
  driver.advance(1); // land the wave: six slots, the busiest honest board this demo produces
  const { source } = makeSource(driver);
  const defs = clinicToolDefs(source);
  const byName = new Map(defs.map((d) => [d.name, d]));

  // hold one so hold-bearing payloads (status, hold result) carry their largest shape
  const holdOut = await byName.get('clinic_hold_slot')!.execute({ slot_id: 'slot-1' });
  assert.ok(holdOut.content[0].text.length <= 1500, `hold_slot output ${holdOut.content[0].text.length} > 1500`);

  for (const d of defs) {
    if (d.name === 'clinic_hold_slot') continue; // measured above with its success payload
    const out = await d.execute(d.name === 'clinic_release_hold' ? {} : undefined);
    const len = out.content[0].text.length;
    assert.ok(len <= 1500, `${d.name} output ${len} > 1500 on a live board`);
  }
});

// ── SPEC-V2: the voice surface — find, clinicians, and the two prepare tools ─────────────────────

test('parseClockText reads what a person would say', () => {
  assert.equal(parseClockText('9:00 AM'), 9 * 60);
  assert.equal(parseClockText('9'), 9 * 60);
  assert.equal(parseClockText('11:30 am'), 11 * 60 + 30);
  assert.equal(parseClockText('4 PM'), 16 * 60);
  assert.equal(parseClockText('4'), 16 * 60, 'a bare small hour on a clinic board is afternoon');
  assert.equal(parseClockText('12 am'), 0);
  assert.equal(parseClockText('12:15 pm'), 12 * 60 + 15);
  assert.equal(parseClockText('half past nine'), null);
  assert.equal(parseClockText('25:00'), null);
  assert.equal(parseClockText(7), 7 * 60, 'a bare number is an hour, as Chrome/agents sometimes send it');
  assert.equal(parseClockText(Number.NaN), null);
  assert.equal(parseClockText({}), null);
});

test('clinic_find_slots filters by clinician, kind and window — and names the killing constraint', async () => {
  const { source } = ready();
  const { get } = defsFor(source);
  const all = await callJson(get('clinic_find_slots'), {});
  assert.equal(all.ok, true);
  const matches = all.matches as Array<{ id: string; clinician: string; time: string }>;
  assert.ok(matches.length > 0, 'an open board matches an empty query');
  const clin = matches[0].clinician;
  const byClin = await callJson(get('clinic_find_slots'), { clinician: clin.split(' ').pop() });
  assert.ok((byClin.matches as unknown[]).length >= 1);
  for (const m of byClin.matches as Array<{ clinician: string }>) assert.equal(m.clinician, clin);
  // A window that excludes everything names time_window, not a bare empty list.
  const none = await callJson(get('clinic_find_slots'), { after: '11 PM' });
  assert.equal(none.ok, true);
  assert.deepEqual(none.matches, []);
  assert.equal(none.eliminated_by, 'time_window');
  assert.ok(Array.isArray(none.open_slot_ids), 'the refusal still hands over the live ids');
  // A clinician nobody has names clinician.
  const noClin = await callJson(get('clinic_find_slots'), { clinician: 'Dr. Nobody' });
  assert.equal(noClin.eliminated_by, 'clinician');
  // Unreadable time is refused loudly, not silently unfiltered.
  const bad = await callJson(get('clinic_find_slots'), { after: 'half past nine' });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'bad_time');
});

test('clinic_clinicians groups the board by person, open times only', async () => {
  const { driver, source } = ready();
  const { get } = defsFor(source);
  const out = await callJson(get('clinic_clinicians'));
  assert.equal(out.ok, true);
  const rows = out.clinicians as Array<{ name: string; open_times: string[]; kinds: string[] }>;
  assert.ok(rows.length >= 1);
  const openCount = driver.snapshot().slots.filter((s) => s.state === 'open').length;
  assert.equal(rows.reduce((n, r) => n + r.open_times.length, 0), openCount, 'every open slot is listed under exactly one clinician');
  for (const r of rows) assert.ok(r.kinds.length >= 1);
});

test('clinic_prepare_cancel: refuses without a booking; arms via the callback; NEVER driver.cancel', async () => {
  const { driver, source } = ready();
  const armed: string[] = [];
  const defs = clinicToolDefs(source, { ...FAST, onPrepareCancel: (id) => (armed.push(id), true) });
  const prep = defs.find((d) => d.name === 'clinic_prepare_cancel')!;
  const nothing = await callJson(prep);
  assert.equal(nothing.ok, false);
  assert.equal(nothing.error, 'nothing_booked');
  assert.deepEqual(armed, []);
  // Book one AS THE HUMAN (directly on the driver — the test is the person here).
  const open = driver.snapshot().slots.find((s) => s.state === 'open')!;
  driver.hold(open.id);
  driver.book(open.id);
  const ok = await callJson(prep);
  assert.equal(ok.ok, true);
  assert.equal(ok.armed, 'cancel');
  assert.equal((ok.slot as { id: string }).id, open.id);
  assert.equal(ok.next_step, CANCEL_CHOREOGRAPHY);
  assert.deepEqual(armed, [open.id], 'the page was armed, once, with the booked slot');
  assert.equal(driver.snapshot().slots.find((s) => s.id === open.id)!.state, 'booked_yours', 'the tool cancelled NOTHING');
});

test('clinic_prepare_cancel without the page seam answers dock_not_wired', async () => {
  const { driver, source } = ready();
  const open = driver.snapshot().slots.find((s) => s.state === 'open')!;
  driver.hold(open.id);
  driver.book(open.id);
  const { get } = defsFor(source); // no onPrepareCancel
  const out = await callJson(get('clinic_prepare_cancel'));
  assert.equal(out.ok, false);
  assert.equal(out.error, 'dock_not_wired');
});

test('clinic_prepare_move: every refusal is specific, arming never touches driver.move', async () => {
  const { driver, source } = ready();
  const armed: Array<[string, string]> = [];
  const defs = clinicToolDefs(source, { ...FAST, onPrepareMove: (a, b) => (armed.push([a, b]), true) });
  const prep = defs.find((d) => d.name === 'clinic_prepare_move')!;
  const noBooking = await callJson(prep, { new_slot_id: 'slot-1' });
  assert.equal(noBooking.error, 'nothing_booked');
  const slots = driver.snapshot().slots.filter((s) => s.state === 'open');
  driver.hold(slots[0].id);
  driver.book(slots[0].id);
  assert.equal((await callJson(prep, {})).error, 'new_slot_id_required');
  assert.equal((await callJson(prep, { new_slot_id: 'slot-999' })).error, 'unknown_slot');
  assert.equal((await callJson(prep, { new_slot_id: slots[0].id })).error, 'same_slot');
  assert.deepEqual(armed, [], 'no refusal armed anything');
  const target = driver.snapshot().slots.find((s) => s.state === 'open')!;
  const ok = await callJson(prep, { new_slot_id: target.id });
  assert.equal(ok.ok, true);
  assert.equal(ok.armed, 'move');
  assert.equal((ok.from_slot as { id: string }).id, slots[0].id);
  assert.equal((ok.to_slot as { id: string }).id, target.id);
  assert.equal(ok.next_step, MOVE_CHOREOGRAPHY);
  assert.deepEqual(armed, [[slots[0].id, target.id]]);
  // The board is untouched: still booked where it was, target still open.
  const snap = driver.snapshot();
  assert.equal(snap.slots.find((s) => s.id === slots[0].id)!.state, 'booked_yours');
  assert.equal(snap.slots.find((s) => s.id === target.id)!.state, 'open');
});

test('clinic_prepare_move onto a rival-taken slot is refused with the state', async () => {
  const { driver, source } = ready();
  const open = driver.snapshot().slots.filter((s) => s.state === 'open');
  driver.hold(open[0].id);
  driver.book(open[0].id);
  driver.advance(2000); // the rival takes its first slot at 1500ms
  const taken = driver.snapshot().slots.find((s) => s.state === 'taken_by_rival');
  assert.ok(taken, 'the rival took one');
  const { get } = defsFor(source);
  const out = await callJson(get('clinic_prepare_move'), { new_slot_id: taken!.id });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'slot_unavailable');
  assert.equal(out.slot_state, 'taken_by_rival');
});

test('clinic_prepare_cancel refuses while a hold is live — the book dock keeps priority', async () => {
  const { driver, source } = ready();
  const armed: string[] = [];
  const defs = clinicToolDefs(source, { ...FAST, onPrepareCancel: (id) => (armed.push(id), true) });
  const open = driver.snapshot().slots.filter((s) => s.state === 'open');
  driver.hold(open[0].id);
  driver.book(open[0].id);
  driver.hold(open[1].id); // the agent is mid-way through holding something new
  const out = await callJson(defs.find((d) => d.name === 'clinic_prepare_cancel')!);
  assert.equal(out.ok, false);
  assert.equal(out.error, 'hold_in_progress');
  assert.deepEqual(armed, [], 'nothing was armed behind the live hold');
});

test('clinic_find_slots on an EMPTY board blames no_open_slots, never your filter', async () => {
  const src = frozenSource([], []);
  const defs = clinicToolDefs(src, FAST);
  const out = await callJson(defs.find((d) => d.name === 'clinic_find_slots')!, { clinician: 'Boone' });
  assert.equal(out.ok, true);
  assert.equal(out.eliminated_by, 'no_open_slots', 'an empty board is not the clinician\u2019s fault');
});

test('clinic_prepare_move names the race when the target is taken mid-arm', async () => {
  const booked: Slot = { id: 's1', timeLabel: '9:00 AM', clinician: 'Dr. A', kind: 'Consult', state: 'booked_yours' };
  const target: Slot = { id: 's2', timeLabel: '9:20 AM', clinician: 'Dr. B', kind: 'Consult', state: 'open' };
  const src = frozenSource([booked, target], []);
  const defs = clinicToolDefs(src, {
    ...FAST,
    // The page refuses AND the board shows why: the rival got there first.
    onPrepareMove: () => {
      target.state = 'taken_by_rival';
      return false;
    },
  });
  const out = await callJson(defs.find((d) => d.name === 'clinic_prepare_move')!, { new_slot_id: 's2' });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'slot_unavailable');
  assert.equal(out.slot_state, 'taken_by_rival');
});

test('clinic_prepare_cancel explains a vanished booking instead of dock_not_wired', async () => {
  const booked: Slot = { id: 's1', timeLabel: '9:00 AM', clinician: 'Dr. A', kind: 'Consult', state: 'booked_yours' };
  const src = frozenSource([booked], []);
  const defs = clinicToolDefs(src, {
    ...FAST,
    onPrepareCancel: () => {
      booked.state = 'open'; // the wave rolled under us
      return false;
    },
  });
  const out = await callJson(defs.find((d) => d.name === 'clinic_prepare_cancel')!);
  assert.equal(out.ok, false);
  assert.equal(out.error, 'nothing_booked');
});

test('clinic_hold_status describes the press the dock will ACTUALLY perform', async () => {
  const held: Slot = { id: 's2', timeLabel: '9:20 AM', clinician: 'Dr. B', kind: 'Consult', state: 'held_by_you' };
  const booked: Slot = { id: 's1', timeLabel: '9:00 AM', clinician: 'Dr. A', kind: 'Consult', state: 'booked_yours' };
  // A move's freeze IS a hold — but the armed key moves, and the status must say so.
  const moveView = (): ClinicToolsView => ({
    driver: { subscribe: () => () => {}, hold: () => {}, release: () => {}, confirm: () => {}, book: () => {}, cancel: () => {}, move: () => {} },
    session: {
      now: 0,
      slots: [booked, held],
      held: { slotId: 's2', ttlSeconds: 45, startedAt: 0 },
      secondsLeft: 40,
      log: [],
      hold: () => {},
      confirm: () => {},
      release: () => {},
    },
    armedAct: 'move',
  });
  const moveStatus = holdStatus(moveView());
  assert.equal(moveStatus.held, true);
  assert.equal(moveStatus.armed_act, 'move');
  assert.equal(moveStatus.next_step, MOVE_CHOREOGRAPHY, 'never "books it" while the press moves');
  // An armed cancel holds nothing — but the status must not send the agent hunting for a hold.
  const cancelView = { ...moveView(), armedAct: 'cancel' as const };
  cancelView.session = { ...cancelView.session, held: null, secondsLeft: 0, slots: [booked] };
  const cancelStatus = holdStatus(cancelView);
  assert.equal(cancelStatus.held, false);
  assert.equal(cancelStatus.armed_act, 'cancel');
  assert.equal(cancelStatus.next_step, CANCEL_CHOREOGRAPHY);
  // No armed act: the original sentences, unchanged.
  const plain = holdStatus({ ...moveView(), armedAct: null });
  assert.equal(plain.next_step, HOLD_CHOREOGRAPHY);
  assert.equal('armed_act' in plain, false);
});

test('clinic_prepare_move refuses while a hold is live on a DIFFERENT slot (P1-2)', async () => {
  const { driver, source } = ready();
  const armed: Array<[string, string]> = [];
  const defs = clinicToolDefs(source, { ...FAST, onPrepareMove: (a, b) => (armed.push([a, b]), true) });
  const prep = defs.find((d) => d.name === 'clinic_prepare_move')!;
  const open = driver.snapshot().slots.filter((s) => s.state === 'open');
  driver.hold(open[0].id);
  driver.book(open[0].id);
  driver.hold(open[1].id); // the person may be mid-press on this book dock
  const out = await callJson(prep, { new_slot_id: open[2].id });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'hold_in_progress');
  assert.deepEqual(armed, [], 'the dock was never swapped under the live hold');
  assert.equal(driver.snapshot().hold?.slotId, open[1].id, 'the hold survives untouched');
  // …but moving ONTO the held slot is the legitimate two-step flow and stays allowed.
  const ok = await callJson(prep, { new_slot_id: open[1].id });
  assert.equal(ok.ok, true);
  assert.equal(ok.armed, 'move');
});
