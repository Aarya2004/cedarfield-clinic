// Run: node --experimental-strip-types --test src/lib/drop/interaction-counter.test.ts
//
// THE isTrusted CAVEAT, stated once here so it is impossible to miss:
//   In a browser, `createCounter(root)` counts only events with `isTrusted === true`, so no script
//   can move the number. This test process is not a browser: it has no `Event` constructor and no
//   trusted events at all. So every bucket-logic test below builds a plain object and passes
//   `{ trustedOnly: false }`. That switch exists for this file and nothing else — production call
//   sites use `createCounter(root)` with no options.
//   The filter is therefore asserted directly and separately, in "the trust filter" tests: with the
//   production default, an untrusted event of every countable type is dropped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classify,
  createCounter,
  describeCount,
  emptyBreakdown,
  MODIFIER_KEYS,
  SCROLL_GESTURE_GAP_MS,
  startsNewScrollGesture,
  totalOf,
  type CountableEvent,
  type CounterRoot,
} from './interaction-counter.ts';

/** Minimal stand-in for an element: records listeners, replays them in registration order. */
function fakeRoot() {
  const listeners = new Map<string, Set<(event: CountableEvent) => void>>();
  const root: CounterRoot & {
    dispatch: (event: CountableEvent) => void;
    listenerCount: () => number;
  } = {
    addEventListener(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(event) {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
    },
    listenerCount() {
      let n = 0;
      for (const set of listeners.values()) n += set.size;
      return n;
    },
  };
  return root;
}

const press = (key: string, extra: Partial<CountableEvent> = {}): CountableEvent => ({ type: 'keydown', key, ...extra });
const pointer = (): CountableEvent => ({ type: 'pointerdown' });
const wheel = (): CountableEvent => ({ type: 'wheel' });

/** A counter over a fake clock, with the trust filter off — see the caveat at the top. */
function counterOnFake() {
  const root = fakeRoot();
  let clock = 0;
  const counter = createCounter(root, { trustedOnly: false, now: () => clock });
  return { root, counter, advance: (ms: number) => (clock += ms) };
}

// ---------------------------------------------------------------- classify: pure bucket logic

test('classify: a pointer press is one click, whatever the pointing device', () => {
  assert.equal(classify(pointer(), { trustedOnly: false }), 'clicks');
});

test('classify: consequence events are never counted', () => {
  for (const type of ['click', 'dblclick', 'keyup', 'keypress', 'input', 'change', 'submit', 'scroll', 'focusin', 'pointermove', 'mousemove']) {
    assert.equal(classify({ type }, { trustedOnly: false }), null, `${type} must not count`);
  }
});

test('classify: an ordinary keydown is one key', () => {
  assert.equal(classify(press('a'), { trustedOnly: false }), 'keys');
  assert.equal(classify(press('Backspace'), { trustedOnly: false }), 'keys');
  assert.equal(classify(press('Enter'), { trustedOnly: false }), 'keys');
});

test('classify: a bare modifier press is not an interaction', () => {
  for (const key of MODIFIER_KEYS) {
    assert.equal(classify(press(key), { trustedOnly: false }), null, `${key} must not count alone`);
  }
});

test('classify: Shift+A is one interaction, not two — the modifier press is not separately counted', () => {
  assert.equal(classify(press('Shift'), { trustedOnly: false }), null);
  assert.equal(classify(press('A'), { trustedOnly: false }), 'keys');
});

test('classify: auto-repeat from a held key is one sustained act', () => {
  assert.equal(classify(press('Backspace', { repeat: false }), { trustedOnly: false }), 'keys');
  assert.equal(classify(press('Backspace', { repeat: true }), { trustedOnly: false }), null);
});

test('classify: Tab lands in its own bucket so a reader can subtract focus travel', () => {
  assert.equal(classify(press('Tab'), { trustedOnly: false }), 'tabs');
  assert.equal(classify(press('Tab', { repeat: true }), { trustedOnly: false }), null);
});

test('classify: a wheel event is a scroll before coalescing', () => {
  assert.equal(classify(wheel(), { trustedOnly: false }), 'scrolls');
});

// ---------------------------------------------------------------- the trust filter, on its own

test('the trust filter: with the production default, an untrusted event of every type is dropped', () => {
  for (const event of [pointer(), press('a'), press('Tab'), wheel()]) {
    assert.equal(classify(event), null, `${event.type} must not count when untrusted`);
    assert.equal(classify({ ...event, isTrusted: false }), null, `${event.type} must not count when isTrusted is false`);
  }
});

test('the trust filter: the same events count once the browser vouches for them', () => {
  assert.equal(classify({ ...pointer(), isTrusted: true }), 'clicks');
  assert.equal(classify({ ...press('a'), isTrusted: true }), 'keys');
  assert.equal(classify({ ...press('Tab'), isTrusted: true }), 'tabs');
  assert.equal(classify({ ...wheel(), isTrusted: true }), 'scrolls');
});

test('the trust filter: a counter left on its production default ignores a script-dispatched flood', () => {
  const root = fakeRoot();
  const counter = createCounter(root); // no options — exactly how the app calls it
  for (let i = 0; i < 50; i += 1) {
    root.dispatch(pointer());
    root.dispatch(press('x'));
  }
  assert.equal(counter.count, 0);
});

// ---------------------------------------------------------------- scroll gesture coalescing

test('startsNewScrollGesture: the first wheel always opens a gesture', () => {
  assert.equal(startsNewScrollGesture(null, 0), true);
});

test('startsNewScrollGesture: events inside the window join the gesture, a gap opens a new one', () => {
  assert.equal(startsNewScrollGesture(1000, 1000 + SCROLL_GESTURE_GAP_MS - 1), false);
  assert.equal(startsNewScrollGesture(1000, 1000 + SCROLL_GESTURE_GAP_MS), true);
});

test('one flick emitting a burst of wheel events counts once', () => {
  const { root, counter, advance } = counterOnFake();
  for (let i = 0; i < 30; i += 1) {
    root.dispatch(wheel());
    advance(16); // ~one frame apart, as a real trackpad flick arrives
  }
  assert.equal(counter.breakdown.scrolls, 1);
});

test('two deliberate flicks separated by a pause count twice', () => {
  const { root, counter, advance } = counterOnFake();
  root.dispatch(wheel());
  advance(SCROLL_GESTURE_GAP_MS);
  root.dispatch(wheel());
  assert.equal(counter.breakdown.scrolls, 2);
});

test('a slow continuous scroll still counts once — the spec is generous against us', () => {
  const { root, counter, advance } = counterOnFake();
  for (let i = 0; i < 20; i += 1) {
    root.dispatch(wheel());
    advance(SCROLL_GESTURE_GAP_MS - 1);
  }
  assert.equal(counter.breakdown.scrolls, 1);
});

// ---------------------------------------------------------------- the counter as a whole

test('total is always the plain sum of the four buckets', () => {
  const { root, counter } = counterOnFake();
  root.dispatch(pointer());
  root.dispatch(pointer());
  root.dispatch(press('s'));
  root.dispatch(press('a'));
  root.dispatch(press('m'));
  root.dispatch(press('Tab'));
  root.dispatch(wheel());

  assert.deepEqual(counter.breakdown, { clicks: 2, keys: 3, scrolls: 1, tabs: 1 });
  assert.equal(counter.count, 7);
  assert.equal(counter.count, totalOf(counter.breakdown));
  assert.deepEqual(counter.snapshot(), { total: 7, breakdown: { clicks: 2, keys: 3, scrolls: 1, tabs: 1 } });
});

test('typing a name costs one interaction per character — the honest bulk of a form', () => {
  const { root, counter } = counterOnFake();
  for (const ch of 'Sarah') root.dispatch(press(ch));
  assert.equal(counter.breakdown.keys, 5);
});

test('the breakdown handed out is a copy — a caller cannot corrupt the tally', () => {
  const { root, counter } = counterOnFake();
  root.dispatch(pointer());
  const stolen = counter.breakdown;
  stolen.clicks = 999;
  assert.equal(counter.count, 1);
});

test('onChange fires with a fresh snapshot on every counted event, and never on an ignored one', () => {
  const root = fakeRoot();
  const seen: number[] = [];
  createCounter(root, { trustedOnly: false, onChange: (s) => seen.push(s.total) });
  root.dispatch(pointer());
  root.dispatch(press('Shift')); // ignored
  root.dispatch(press('b'));
  root.dispatch({ type: 'click' }); // ignored
  assert.deepEqual(seen, [1, 2]);
});

test('reset zeroes the buckets and forgets the in-flight scroll gesture', () => {
  const { root, counter, advance } = counterOnFake();
  root.dispatch(pointer());
  root.dispatch(wheel());
  advance(16);
  counter.reset();
  assert.deepEqual(counter.breakdown, emptyBreakdown());
  assert.equal(counter.count, 0);

  root.dispatch(wheel()); // immediately after reset: a new gesture, not a continuation
  assert.equal(counter.breakdown.scrolls, 1);
});

test('stop detaches every listener, is idempotent, and leaves the final number readable', () => {
  const { root, counter } = counterOnFake();
  root.dispatch(pointer());
  root.dispatch(press('a'));
  counter.stop();
  assert.equal(root.listenerCount(), 0);

  counter.stop(); // idempotent
  root.dispatch(pointer());
  assert.equal(counter.count, 2, 'the receipt keeps the number it ended on');
});

test('two counters over different roots do not see each other — the count is scoped', () => {
  const flow = fakeRoot();
  const elsewhere = fakeRoot();
  const flowCounter = createCounter(flow, { trustedOnly: false });
  createCounter(elsewhere, { trustedOnly: false });

  elsewhere.dispatch(pointer());
  elsewhere.dispatch(press('a'));
  assert.equal(flowCounter.count, 0, 'input outside the measured region is not the flow’s cost');

  flow.dispatch(pointer());
  assert.equal(flowCounter.count, 1);
});

test('describeCount reads as English at every magnitude', () => {
  assert.equal(describeCount(0), '0 interactions');
  assert.equal(describeCount(1), '1 interaction');
  assert.equal(describeCount(19), '19 interactions');
});
