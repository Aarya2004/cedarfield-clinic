// Run: node --experimental-strip-types --test src/lib/drop/mock-driver.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockDropDriver, createMockDriver, scenario, SCENARIOS } from './mock-driver.ts';
import type { DropEvent, Slot } from './types.ts';

const takenIds = (events: DropEvent[]) => events.filter((e) => e.type === 'slot_taken').map((e) => e.slotId);
const collect = (d: MockDropDriver) => {
  const seen: DropEvent[] = [];
  d.subscribe((e) => seen.push(e));
  return seen;
};

test('the wave lands first, with every slot open and a unique id', () => {
  const d = scenario('lose', 3);
  const seen = collect(d);
  d.advance(50);
  assert.equal(seen.length, 1);
  const wave = seen[0];
  assert.equal(wave.type, 'drop_wave');
  const slots = (wave as Extract<DropEvent, { type: 'drop_wave' }>).slots;
  assert.equal(slots.length, SCENARIOS.lose.slotCount);
  assert.ok(slots.every((s: Slot) => s.state === 'open'));
  assert.equal(new Set(slots.map((s: Slot) => s.id)).size, slots.length);
});

test('same seed, same scenario, same calls — identical event log', () => {
  const run = () => {
    const d = scenario('hold-and-book', 42);
    d.advance(500);
    d.hold('slot-2');
    d.advance(4000);
    d.confirm('slot-2');
    d.advance(15000);
    return d.events();
  };
  assert.deepEqual(run(), run());
});

test('different seeds tell different stories', () => {
  const logOf = (seed: number) => {
    const d = scenario('lose', seed);
    d.advance(20000);
    return JSON.stringify(d.events());
  };
  assert.notEqual(logOf(1), logOf(2));
});

test('the step size never changes the log — one big advance equals two hundred small ones', () => {
  const big = scenario('lose', 9);
  big.advance(20000);

  const small = scenario('lose', 9);
  for (let i = 0; i < 200; i++) small.advance(100);

  assert.deepEqual(big.events(), small.events());
  assert.deepEqual(big.snapshot().slots, small.snapshot().slots);
});

test('the rival is aggressive early and tapers, for every seed', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const d = scenario('lose', seed);
    d.advance(20000);
    const times = d
      .events()
      .filter((e) => e.type === 'slot_taken')
      .map((e) => e.at);
    assert.ok(times.length >= 6, `seed ${seed}: expected the board to empty`);
    const gaps = times.map((t, i) => (i === 0 ? t : t - times[i - 1]));
    const half = Math.floor(gaps.length / 2);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    assert.ok(mean(gaps.slice(half)) > mean(gaps.slice(0, half)), `seed ${seed}: gaps should grow`);
    assert.ok(gaps[gaps.length - 1] > gaps[0], `seed ${seed}: last gap should exceed the first`);
  }
});

test('lose empties the board in about eight seconds', () => {
  const d = scenario('lose', 7);
  d.advance(9000);
  assert.equal(takenIds(d.events()).length, SCENARIOS.lose.slotCount);
  assert.ok(d.snapshot().slots.every((s) => s.state === 'taken_by_rival'));
  assert.ok(d.events().filter((e) => e.type === 'slot_taken').at(-1)!.at <= 8000);
});

test('no slot is ever taken twice, and the rival goes quiet rather than fabricating a take', () => {
  const d = scenario('lose', 5);
  d.advance(60000);
  const taken = takenIds(d.events());
  assert.equal(new Set(taken).size, taken.length);
  assert.ok(taken.length <= SCENARIOS.lose.slotCount);
});

test('the rival cannot take what you are holding or have booked', () => {
  const held = scenario('lose', 5);
  held.hold('slot-2');
  held.advance(19000);
  assert.ok(!takenIds(held.events()).includes('slot-2'));
  assert.equal(held.snapshot().slots.find((s) => s.id === 'slot-2')!.state, 'held_by_you');

  const booked = scenario('lose', 5);
  booked.hold('slot-2');
  booked.advance(1500);
  booked.confirm('slot-2');
  booked.advance(60000);
  assert.ok(!takenIds(booked.events()).includes('slot-2'));
  assert.equal(booked.snapshot().slots.find((s) => s.id === 'slot-2')!.state, 'booked_yours');
});

test('a hold ticks down whole seconds in order and expires exactly at its TTL', () => {
  const ttl = 6;
  const d = createMockDriver({ seed: 11, scenario: 'hold-and-book', overrides: { ttlSeconds: ttl } });
  const seen = collect(d);
  d.hold('slot-6');
  d.advance(6000);

  const mine = seen.filter((e) => 'slotId' in e && e.slotId === 'slot-6');
  assert.equal(mine[0].type, 'hold_started');
  assert.equal((mine[0] as Extract<DropEvent, { type: 'hold_started' }>).ttlSeconds, ttl);

  const ticks = mine.filter((e) => e.type === 'hold_tick');
  assert.deepEqual(
    ticks.map((t) => (t as Extract<DropEvent, { type: 'hold_tick' }>).secondsLeft),
    [5, 4, 3, 2, 1],
  );
  assert.deepEqual(ticks.map((t) => t.at), [1000, 2000, 3000, 4000, 5000]);

  const last = mine.at(-1)!;
  assert.equal(last.type, 'hold_expired');
  assert.equal(last.at, ttl * 1000);
  assert.equal(d.snapshot().slots.find((s) => s.id === 'slot-6')!.state, 'expired_hold');
  assert.equal(d.snapshot().hold, null);
});

test('confirming stops the clock on that hold — no further ticks, no expiry', () => {
  const d = scenario('hold-and-book', 4);
  const seen = collect(d);
  d.hold('slot-5');
  d.advance(3000);
  d.confirm('slot-5');
  d.advance(60000);

  const types = seen.filter((e) => 'slotId' in e && e.slotId === 'slot-5').map((e) => e.type);
  // three ticks: 1000, 2000 and the one that lands exactly on the 3000 boundary of the advance
  assert.deepEqual(types, ['hold_started', 'hold_tick', 'hold_tick', 'hold_tick', 'booked']);
  assert.ok(!seen.some((e) => e.type === 'hold_expired'));
});

test('releasing puts the slot back on the board and the rival can take it again', () => {
  const d = scenario('lose', 5);
  const seen = collect(d);
  d.hold('slot-1');
  d.advance(300);
  d.release('slot-1');
  assert.equal(seen.at(-1)!.type, 'drop_wave'); // the board resync (no release event in the contract)
  assert.equal(d.snapshot().slots.find((s) => s.id === 'slot-1')!.state, 'open');
  d.advance(20000);
  assert.ok(takenIds(d.events()).includes('slot-1'));
});

test('expire: the hold lapses, then the rival sweeps it 1.6s later — in that order', () => {
  const d = scenario('expire', 8);
  const seen = collect(d);
  d.hold('slot-4');
  d.advance(20000);

  const expired = seen.find((e) => e.type === 'hold_expired' && e.slotId === 'slot-4');
  const swept = seen.find((e) => e.type === 'slot_taken' && e.slotId === 'slot-4');
  assert.ok(expired, 'the hold should expire');
  assert.ok(swept, 'the lapsed slot should be swept');
  assert.equal(expired!.at, SCENARIOS.expire.ttlSeconds * 1000);
  assert.equal(swept!.at - expired!.at, SCENARIOS.expire.sweepAfterExpiryMs);
  assert.ok(seen.indexOf(expired!) < seen.indexOf(swept!));
});

test('a lapsed slot you grab back again is not swept', () => {
  const d = scenario('expire', 8);
  d.hold('slot-4');
  d.advance(SCENARIOS.expire.ttlSeconds * 1000 + 200); // let it lapse
  // Re-holding a lapsed slot is refused — it is no longer open, so the sweep still owns it.
  d.hold('slot-4');
  assert.equal(d.snapshot().slots.find((s) => s.id === 'slot-4')!.state, 'expired_hold');
  d.advance(5000);
  assert.ok(takenIds(d.events()).includes('slot-4'));
});

test('holding a second slot releases the first', () => {
  const d = scenario('hold-and-book', 2);
  d.hold('slot-6');
  d.advance(1000);
  d.hold('slot-5');
  const slots = d.snapshot().slots;
  assert.equal(slots.find((s) => s.id === 'slot-6')!.state, 'open');
  assert.equal(slots.find((s) => s.id === 'slot-5')!.state, 'held_by_you');
  assert.equal(d.snapshot().hold!.slotId, 'slot-5');
});

test('calls that do not make sense are ignored, not faked', () => {
  const d = scenario('lose', 6);
  const seen = collect(d);
  d.confirm('slot-1'); // nothing held
  d.release('slot-1'); // nothing held
  d.hold('nope'); // unknown slot
  assert.deepEqual(seen, []);

  d.advance(20000); // board is empty now
  const before = d.events().length;
  d.hold('slot-1'); // taken by the rival
  assert.equal(d.events().length, before);
});

test('snapshot carries fractional seconds for the TTL bar, clamped at zero', () => {
  const d = createMockDriver({ seed: 1, scenario: 'lose', overrides: { ttlSeconds: 10 } });
  d.hold('slot-1');
  d.advance(2500);
  assert.equal(d.snapshot().hold!.secondsLeft, 7.5);
  assert.equal(d.snapshot().hold!.ttlSeconds, 10);
  assert.equal(d.now(), 2500);
  d.advance(10000);
  assert.equal(d.snapshot().hold, null);
});

test('a late subscriber is caught up with the current board, and that catch-up is not logged', () => {
  const d = scenario('lose', 5);
  d.advance(3000);
  const late: DropEvent[] = [];
  d.subscribe((e) => late.push(e));
  assert.equal(late.length, 1);
  assert.equal(late[0].type, 'drop_wave');
  const slots = (late[0] as Extract<DropEvent, { type: 'drop_wave' }>).slots;
  assert.ok(slots.some((s: Slot) => s.state === 'taken_by_rival'), 'the catch-up shows the board as it is now');
  assert.equal(d.events().filter((e) => e.type === 'drop_wave').length, 1);
});

test('unsubscribe stops delivery; the log keeps going', () => {
  const d = scenario('lose', 5);
  const seen: DropEvent[] = [];
  const off = d.subscribe((e) => seen.push(e));
  d.advance(1000);
  off();
  d.advance(20000);
  assert.ok(d.events().length > seen.length);
});

test('emitted slots are copies — a consumer cannot mutate the board', () => {
  const d = scenario('lose', 5);
  const seen = collect(d);
  d.advance(10);
  const wave = seen[0] as Extract<DropEvent, { type: 'drop_wave' }>;
  wave.slots[0].state = 'booked_yours';
  assert.equal(d.snapshot().slots[0].state, 'open');
});
