// Run: node --experimental-strip-types --test src/lib/drop/gesture-logic.test.ts
//
// Everything a webcam would tell us, told by a loop instead. The four behaviours that decide
// whether this module ever books the wrong thing are: dwell accumulation, flicker tolerance,
// cancel-on-lost-palm, and fire-once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DWELL_CONFIG,
  DWELL_DEFAULT_MS,
  DWELL_MAX_MS,
  DWELL_MIN_MS,
  GESTURE_DWELL_KEY,
  GESTURE_ENABLED_KEY,
  MAX_FRAME_MS,
  TARGET_GESTURE,
  classifyCameraError,
  clampDwellMs,
  dwellProgress,
  failureCopy,
  gestureUiState,
  initialDwellState,
  isHolding,
  loadDwellMs,
  loadGestureEnabled,
  saveDwellMs,
  saveGestureEnabled,
  shouldAutoStart,
  stepDwell,
  type DwellConfig,
  type DwellState,
  type GestureFailure,
  type GestureFrame,
  type GestureUiInputs,
  type PrefStore,
} from './gesture-logic.ts';

const config: DwellConfig = { ...DEFAULT_DWELL_CONFIG };

const palm = (at: number, over: Partial<GestureFrame> = {}): GestureFrame => ({
  at,
  gesture: TARGET_GESTURE,
  score: 0.9,
  armed: true,
  ...over,
});

const empty = (at: number, over: Partial<GestureFrame> = {}): GestureFrame => ({
  at,
  gesture: null,
  score: 0,
  armed: true,
  ...over,
});

/** Feeds frames at a fixed cadence and reports how many times it fired. */
function run(
  frames: readonly GestureFrame[],
  cfg: DwellConfig = config,
  from: DwellState = initialDwellState(),
): { state: DwellState; fires: number[] } {
  let state = from;
  const fires: number[] = [];
  for (const frame of frames) {
    const step = stepDwell(state, frame, cfg);
    state = step.state;
    if (step.fire) fires.push(frame.at);
  }
  return { state, fires };
}

/** `count` frames every `everyMs`, starting at `startAt + everyMs`. */
function cadence(count: number, everyMs: number, make: (at: number) => GestureFrame, startAt = 0): GestureFrame[] {
  return Array.from({ length: count }, (_, i) => make(startAt + (i + 1) * everyMs));
}

// --- dwell accumulation ----------------------------------------------------

test('a palm held for the full dwell fires exactly once, on the frame that crosses it', () => {
  // 33ms cadence ≈ 30fps. 1000ms / 33 ≈ 31 frames, so 40 is comfortably past the line.
  const { fires, state } = run(cadence(40, 33, palm));
  assert.equal(fires.length, 1);
  assert.ok(fires[0] >= DWELL_DEFAULT_MS, `fired at ${fires[0]}, before the dwell elapsed`);
  // The frame that first sees the palm credits nothing (there is no previous frame to measure
  // from), so the earliest honest fire is dwell + one frame, and the observed one is dwell + two.
  assert.ok(fires[0] <= DWELL_DEFAULT_MS + 2 * 33, `fired at ${fires[0]}, late by more than two frames`);
  assert.equal(state.heldMs, DWELL_DEFAULT_MS, 'held time is clamped at the dwell');
  assert.equal(dwellProgress(state, config), 1);
});

test('progress is the fraction of the dwell actually held', () => {
  const { state } = run(cadence(11, 50, palm)); // first frame credits nothing → 500ms held
  assert.equal(state.heldMs, 500);
  assert.equal(dwellProgress(state, config), 0.5);
});

test('the first sighting credits no time — a single frame can never book', () => {
  const { state, fires } = run([palm(0)]);
  assert.equal(state.heldMs, 0);
  assert.equal(fires.length, 0);
  assert.ok(isHolding(state));
});

test('one enormous frame delta (backgrounded tab, stalled decode) credits at most MAX_FRAME_MS', () => {
  const { state, fires } = run([palm(0), palm(60_000)]);
  assert.equal(fires.length, 0, 'a five-figure delta must not complete a dwell on its own');
  assert.equal(state.heldMs, 0, 'and the gap itself broke the hold, so it restarted');

  // Same clamp, this time without the grace also expiring: 150ms grace-safe gap, 900ms wall clock.
  const gentle: DwellConfig = { ...config, graceMs: 60_000 };
  const held = run([palm(0), palm(900)], gentle);
  assert.equal(held.state.heldMs, MAX_FRAME_MS);
});

test('a low-confidence palm is not a palm', () => {
  const { state, fires } = run(cadence(40, 33, (at) => palm(at, { score: 0.4 })));
  assert.equal(fires.length, 0);
  assert.equal(state.heldMs, 0);
  assert.equal(isHolding(state), false);
});

test('some other canned gesture never counts, however confident', () => {
  const { fires } = run(cadence(40, 33, (at) => palm(at, { gesture: 'Closed_Fist', score: 0.99 })));
  assert.equal(fires.length, 0);
});

test('a palm over a surface with nothing to confirm banks nothing', () => {
  const idle = run(cadence(40, 33, (at) => palm(at, { armed: false })));
  assert.equal(idle.fires.length, 0);
  assert.equal(idle.state.heldMs, 0);

  // …and arming later starts the clock from zero, not from the idle dwell.
  const after = run(cadence(40, 33, palm, 1320), config, idle.state);
  assert.equal(after.fires.length, 1);
  assert.ok(after.fires[0] >= 1320 + DWELL_DEFAULT_MS);
});

// --- flicker tolerance -----------------------------------------------------

test('a dropout shorter than the grace window keeps the accumulated hold', () => {
  // 600ms of palm, two dropped frames (~100ms), then palm again to the line.
  const frames = [...cadence(7, 100, palm), empty(700), palm(800), ...cadence(10, 100, palm, 800)];
  const { fires } = run(frames);
  assert.equal(fires.length, 1);
  assert.ok(fires[0] <= 1300, `a 100ms flicker should not cost more than the gap itself (fired ${fires[0]})`);
});

test('the frozen hold neither grows nor shrinks while the palm flickers', () => {
  const cfg: DwellConfig = { ...config, graceMs: 300 };
  const start = run(cadence(6, 100, palm), cfg); // 500ms held
  assert.equal(start.state.heldMs, 500);
  const flickered = run([empty(600), empty(700), empty(800)], cfg, start.state);
  assert.equal(flickered.state.heldMs, 500, 'no credit and no loss inside the grace window');
  assert.ok(isHolding(flickered.state), 'still counted as present');
});

test('the grace clock runs from the last sighting, not from the last frame', () => {
  const cfg: DwellConfig = { ...config, graceMs: 250 };
  const start = run(cadence(6, 100, palm), cfg); // last seen at 600
  // Frames at 700 and 800 are inside the window; 900 is 300ms past the sighting, so it is a loss.
  const drifted = run([empty(700), empty(800), empty(900)], cfg, start.state);
  assert.equal(drifted.state.heldMs, 0);
  assert.equal(isHolding(drifted.state), false);
});

test('re-acquiring after the grace has expired restarts the dwell at zero', () => {
  const cfg: DwellConfig = { ...config, graceMs: 250 };
  const start = run(cadence(9, 100, palm), cfg); // 800ms held, 200ms short of firing
  assert.equal(start.state.heldMs, 800);
  const back = run([palm(1400)], cfg, start.state); // 500ms since the last sighting
  assert.equal(back.state.heldMs, 0, 'a fresh palm is a fresh hold');
  assert.equal(back.fires.length, 0);
});

// --- cancel on lost palm ---------------------------------------------------

test('dropping the palm mid-dwell cancels it: the whole hold has to be done again', () => {
  const cfg: DwellConfig = { ...config, graceMs: 250 };
  const frames = [
    ...cadence(9, 100, palm), // 800ms — nearly there
    ...cadence(5, 100, empty, 900), // hand down for half a second
    ...cadence(9, 100, palm, 1400), // back up, but only 800ms this time
  ];
  const { fires, state } = run(frames, cfg);
  assert.equal(fires.length, 0, 'the two partial holds must not add up to a booking');
  assert.equal(state.heldMs, 800);
});

test('losing the palm clears the frame clock as well, so the next sighting credits nothing', () => {
  const { state } = run([palm(0), empty(500)]);
  assert.equal(state.lastSeenAt, null);
  assert.equal(state.lastFrameAt, 500);
  const next = run([palm(600)], config, state);
  assert.equal(next.state.heldMs, 0);
});

// --- fire once -------------------------------------------------------------

test('holding the palm up after it fires does not fire again', () => {
  const { fires } = run(cadence(200, 33, palm)); // ~6.6 seconds of unwavering palm
  assert.equal(fires.length, 1);
});

test('the latch releases only when the palm actually leaves', () => {
  const cfg: DwellConfig = { ...config, graceMs: 250 };
  const first = run(cadence(40, 33, palm), cfg);
  assert.equal(first.fires.length, 1);
  assert.equal(first.state.fired, true);

  // A flicker is not a release.
  const flicker = run([empty(1340), palm(1400), ...cadence(40, 33, palm, 1400)], cfg, first.state);
  assert.equal(flicker.fires.length, 0, 'a dropped frame must not re-arm a completed dwell');

  // Putting the hand down does release it.
  const down = run(cadence(10, 100, empty, 2960), cfg, flicker.state);
  assert.equal(down.state.fired, false);
  const second = run(cadence(40, 33, palm, 3960), cfg, down.state);
  assert.equal(second.fires.length, 1, 'a new hold books again');
});

// --- the DOM state hook ----------------------------------------------------

const ui = (over: Partial<GestureUiInputs> = {}): GestureUiInputs => ({
  enabled: true,
  loading: false,
  failure: null,
  running: true,
  fired: false,
  holding: false,
  ...over,
});

test('data-gesture-state reports the six states in priority order', () => {
  assert.equal(gestureUiState(ui({ enabled: false })), 'disabled');
  assert.equal(gestureUiState(ui({ loading: true })), 'loading');
  assert.equal(gestureUiState(ui({ running: false })), 'ready');
  assert.equal(gestureUiState(ui()), 'ready');
  assert.equal(gestureUiState(ui({ holding: true })), 'held');
  assert.equal(gestureUiState(ui({ holding: true, fired: true })), 'fired');
  assert.equal(gestureUiState(ui({ failure: 'denied' })), 'unavailable');
  // A failure outranks everything, including the switch being on and a dwell in flight.
  assert.equal(gestureUiState(ui({ failure: 'no-camera', enabled: true, holding: true })), 'unavailable');
});

// --- failure honesty -------------------------------------------------------

test('getUserMedia rejections map onto the reason a human would give', () => {
  const cases: [string, GestureFailure][] = [
    ['NotAllowedError', 'denied'],
    ['PermissionDeniedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'no-camera'],
    ['OverconstrainedError', 'no-camera'],
    ['NotReadableError', 'in-use'],
    ['AbortError', 'in-use'],
    ['TypeError', 'unsupported'],
    ['WhateverError', 'error'],
  ];
  for (const [name, expected] of cases) {
    assert.equal(classifyCameraError(Object.assign(new Error('x'), { name })), expected, name);
  }
  assert.equal(classifyCameraError(undefined), 'error');
  assert.equal(classifyCameraError('a string'), 'error');
});

test('every failure line says the keyboard still works', () => {
  const all: GestureFailure[] = ['denied', 'no-camera', 'in-use', 'unsupported', 'load-failed', 'error'];
  for (const failure of all) {
    assert.match(failureCopy(failure), /keyboard still books this/, failure);
  }
});

// --- preferences -----------------------------------------------------------

function memoryStore(seed: Record<string, string> = {}): PrefStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

const hostileStore: PrefStore = {
  getItem() {
    throw new Error('storage is disabled');
  },
  setItem() {
    throw new Error('storage is disabled');
  },
};

test('the camera switch defaults to off and round-trips', () => {
  const store = memoryStore();
  assert.equal(loadGestureEnabled(store), false);
  saveGestureEnabled(store, true);
  assert.equal(store.map.get(GESTURE_ENABLED_KEY), 'on');
  assert.equal(loadGestureEnabled(store), true);
  saveGestureEnabled(store, false);
  assert.equal(loadGestureEnabled(store), false);
});

test('no storage, or a storage that throws, means off — never on', () => {
  assert.equal(loadGestureEnabled(null), false);
  assert.equal(loadGestureEnabled(undefined), false);
  assert.equal(loadGestureEnabled(hostileStore), false);
  assert.doesNotThrow(() => saveGestureEnabled(hostileStore, true));
  assert.doesNotThrow(() => saveGestureEnabled(null, true));
});

test('the dwell slider persists, and junk or out-of-range values fall back to something usable', () => {
  const store = memoryStore();
  assert.equal(loadDwellMs(store), DWELL_DEFAULT_MS);
  saveDwellMs(store, 1800);
  assert.equal(store.map.get(GESTURE_DWELL_KEY), '1800');
  assert.equal(loadDwellMs(store), 1800);

  assert.equal(loadDwellMs(memoryStore({ [GESTURE_DWELL_KEY]: 'soon' })), DWELL_DEFAULT_MS);
  assert.equal(loadDwellMs(memoryStore({ [GESTURE_DWELL_KEY]: '5' })), DWELL_MIN_MS);
  assert.equal(loadDwellMs(memoryStore({ [GESTURE_DWELL_KEY]: '99999' })), DWELL_MAX_MS);
  assert.equal(loadDwellMs(hostileStore), DWELL_DEFAULT_MS);
  assert.equal(loadDwellMs(null), DWELL_DEFAULT_MS);

  assert.equal(clampDwellMs(Number.NaN), DWELL_DEFAULT_MS);
  assert.equal(clampDwellMs(Number.POSITIVE_INFINITY), DWELL_DEFAULT_MS);
  assert.equal(clampDwellMs(1234.6), 1235);
});

test('a remembered "on" reopens the camera only where the grant already stands', () => {
  assert.equal(shouldAutoStart(true, 'granted'), true);
  assert.equal(shouldAutoStart(true, 'prompt'), false, 'never prompt on page load');
  assert.equal(shouldAutoStart(true, 'denied'), false);
  assert.equal(shouldAutoStart(true, 'unknown'), false, 'a browser without the Permissions API waits for a click');
  assert.equal(shouldAutoStart(false, 'granted'), false, 'off means off');
});

// SPEC-V10 §1.8 / §4: two gesture modules can be on one page (a dock and the grant band), so a
// bare "Enable camera" is ambiguous to Voice Control ("Click Enable camera" → which?). The
// accessible name keeps the visible text first (WCAG 2.5.3) and says what the palm would do.
import { cameraControlName, seeingCopy } from './gesture-logic.ts';

test('camera controls are named by what the palm would do, visible text first', () => {
  assert.equal(cameraControlName('Enable camera', 'book'), 'Enable camera to book it');
  assert.equal(cameraControlName('Camera off', 'cancel'), 'Camera off to cancel it');
  assert.equal(cameraControlName('Try again', 'move'), 'Try again to move it');
  assert.equal(cameraControlName('Enable camera', 'grant'), 'Enable camera to let your assistant book');
});

test('the two modules that can share a page never share a camera-control name', () => {
  assert.notEqual(cameraControlName('Enable camera', 'book'), cameraControlName('Enable camera', 'grant'));
  assert.notEqual(cameraControlName('Camera off', 'cancel'), cameraControlName('Camera off', 'grant'));
});

test('the seeing line speaks for the camera it is on (2026-09-03: a palm at the sign camera did nothing, silently)', () => {
  assert.match(seeingCopy('Open_Palm 0.68', 'sign', false), /not a request.*thumbs up/);
  assert.match(seeingCopy('Thumb_Up 0.80', 'sign', false), /thumbs up \(80%\) — hold it steady/);
  assert.match(seeingCopy('Open_Palm 0.68', 'book', true), /open palm \(68%\) — hold it/);
  assert.match(seeingCopy('Open_Palm 0.68', 'book', false), /nothing to confirm yet/);
  assert.match(seeingCopy('Open_Palm 0.68', 'grant', false), /paused while a time is held/);
  assert.match(seeingCopy('Thumb_Up 0.80', 'book', true), /not an open palm/);
  assert.match(seeingCopy('no_hand'), /no hand yet/);
});
