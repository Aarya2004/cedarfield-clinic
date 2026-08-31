// Run: node --experimental-strip-types --test src/lib/drop/audio-cues.test.ts
// Only the schedulable half is tested: the Web Audio calls sit behind `AudioBackend`, which is
// faked here, so this file runs in plain node with no DOM and no audio hardware.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_PREF_KEY,
  CUE_ATTACK_MS,
  CUE_MARK_SECONDS,
  CUE_PLANS,
  CUE_RELEASE_MS,
  createCuePlayer,
  cueFor,
  loadAudioPref,
  planDurationMs,
  saveAudioPref,
  type AudioBackend,
  type PrefStore,
  type ToneStep,
} from './audio-cues.ts';

// --- the plans -------------------------------------------------------------

test('both cues are short, quiet sine pairs — a cue, never an alarm', () => {
  for (const [name, plan] of Object.entries(CUE_PLANS)) {
    assert.equal(plan.length, 2, name);
    for (const step of plan) {
      assert.ok(step.gain > 0 && step.gain <= 0.06, `${name} gain ${step.gain} stays modest`);
      assert.ok(step.freq >= 200 && step.freq <= 1000, `${name} freq ${step.freq} sits in a soft register`);
      assert.ok(step.durationMs > 0 && step.durationMs <= 250, `${name} note is brief`);
    }
    assert.ok(planDurationMs(plan) < 500, `${name} is over well before the next tick`);
  }
});

test('armed rises, the ttl mark falls — direction carries the meaning', () => {
  assert.ok(CUE_PLANS.armed[1].freq > CUE_PLANS.armed[0].freq);
  assert.ok(CUE_PLANS.ttl_mark[1].freq < CUE_PLANS.ttl_mark[0].freq);
  assert.ok(CUE_PLANS.ttl_mark[0].gain <= CUE_PLANS.armed[0].gain);
});

test('planDurationMs spans the last note plus its release tail', () => {
  const plan: ToneStep[] = [
    { freq: 400, startMs: 0, durationMs: 100, gain: 0.05 },
    { freq: 500, startMs: 80, durationMs: 150, gain: 0.05 },
  ];
  assert.equal(planDurationMs(plan), 80 + 150 + CUE_RELEASE_MS);
  assert.equal(planDurationMs([]), 0);
});

// --- when to play ----------------------------------------------------------

const cs = (armed: boolean, secondsLeft: number) => ({ armed, secondsLeft });

test('arming plays the armed cue, from cold start or from disarmed', () => {
  assert.equal(cueFor(cs(true, 45), null), 'armed');
  assert.equal(cueFor(cs(true, 45), cs(false, 0)), 'armed');
});

test('ordinary ticks are silent', () => {
  for (const [prev, next] of [
    [45, 44],
    [31, 30],
    [30, 29],
    [12, 11],
    [9, 8],
  ] as const) {
    assert.equal(cueFor(cs(true, next), cs(true, prev)), null, `${prev}->${next}`);
  }
});

test('crossing 10 seconds plays the mark exactly once', () => {
  assert.equal(cueFor(cs(true, CUE_MARK_SECONDS), cs(true, 11)), 'ttl_mark');
  assert.equal(cueFor(cs(true, 9), cs(true, CUE_MARK_SECONDS)), null);
  assert.equal(cueFor(cs(true, 4), cs(true, 20)), 'ttl_mark'); // a skipped tick still sounds it
});

test('the 30s mark is announced but never sounded — two beeps a hold, not four', () => {
  assert.equal(cueFor(cs(true, 30), cs(true, 31)), null);
  assert.equal(CUE_MARK_SECONDS, 10);
});

test('expiry is silent: the sound would arrive after the thing it warns about', () => {
  assert.equal(cueFor(cs(true, 0), cs(true, 1)), null);
  assert.equal(cueFor(cs(false, 0), cs(true, 1)), null);
  assert.equal(cueFor(cs(false, 0), cs(false, 0)), null);
});

test('counting back up does not re-sound the mark', () => {
  assert.equal(cueFor(cs(true, 20), cs(true, 5)), null);
});

// --- the toggle ------------------------------------------------------------

function fakeStore(seed: Record<string, string> = {}): PrefStore & { data: Record<string, string> } {
  const data = { ...seed };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

test('audio is off by default: no store, empty store, or any value that is not "on"', () => {
  assert.equal(loadAudioPref(null), false);
  assert.equal(loadAudioPref(undefined), false);
  assert.equal(loadAudioPref(fakeStore()), false);
  assert.equal(loadAudioPref(fakeStore({ [AUDIO_PREF_KEY]: 'off' })), false);
  assert.equal(loadAudioPref(fakeStore({ [AUDIO_PREF_KEY]: 'true' })), false);
  assert.equal(loadAudioPref(fakeStore({ [AUDIO_PREF_KEY]: 'on' })), true);
});

test('the choice round-trips and is stored under a namespaced key', () => {
  const store = fakeStore();
  saveAudioPref(store, true);
  assert.equal(store.data[AUDIO_PREF_KEY], 'on');
  assert.equal(loadAudioPref(store), true);
  saveAudioPref(store, false);
  assert.equal(loadAudioPref(store), false);
});

test('a storage that throws leaves audio off instead of crashing the surface', () => {
  const hostile: PrefStore = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(loadAudioPref(hostile), false);
  assert.doesNotThrow(() => saveAudioPref(hostile, true));
  assert.doesNotThrow(() => saveAudioPref(null, true));
});

// --- the player ------------------------------------------------------------

function fakeBackend() {
  const scheduled: Array<{ step: ToneStep; at: number }> = [];
  let resumes = 0;
  let clock = 100;
  const backend: AudioBackend = {
    now: () => clock,
    resume: () => void resumes++,
    scheduleTone: (step, at) => void scheduled.push({ step, at }),
  };
  return {
    backend,
    scheduled,
    get resumes() {
      return resumes;
    },
    set clock(v: number) {
      clock = v;
    },
  };
}

test('playing a cue schedules its notes at the plan offsets, ahead of the clock', () => {
  const f = fakeBackend();
  const player = createCuePlayer(() => f.backend);
  player.play('armed');
  assert.equal(f.scheduled.length, 2);
  const base = f.scheduled[0].at;
  assert.ok(base > 100, 'a lead-in keeps the first note from clipping');
  assert.ok(base - 100 < 0.05, 'the lead-in is imperceptible');
  assert.ok(Math.abs(f.scheduled[1].at - base - CUE_PLANS.armed[1].startMs / 1000) < 1e-9);
  assert.deepEqual(
    f.scheduled.map((s) => s.step.freq),
    CUE_PLANS.armed.map((s) => s.freq),
  );
});

test('the backend is built once, lazily — importing the module makes no context', () => {
  let built = 0;
  const f = fakeBackend();
  const player = createCuePlayer(() => {
    built++;
    return f.backend;
  });
  assert.equal(built, 0, 'nothing is built until something plays');
  player.play('armed');
  player.play('ttl_mark');
  player.unlock();
  assert.equal(built, 1);
  assert.equal(f.scheduled.length, 4);
});

test('unlock resumes the context inside the gesture and makes no sound', () => {
  const f = fakeBackend();
  const player = createCuePlayer(() => f.backend);
  player.unlock();
  assert.equal(f.resumes, 1);
  assert.equal(f.scheduled.length, 0);
});

test('a browser with no AudioContext silently disables cues and is not retried', () => {
  let built = 0;
  const player = createCuePlayer(() => {
    built++;
    return null;
  });
  assert.doesNotThrow(() => {
    player.play('armed');
    player.play('armed');
    player.unlock();
  });
  assert.equal(built, 1);
});

test('a backend that throws never reaches the caller — the confirm path cannot be broken by a sound', () => {
  const player = createCuePlayer(() => ({
    now: () => {
      throw new Error('context died');
    },
    resume: () => {
      throw new Error('context died');
    },
    scheduleTone: () => {
      throw new Error('context died');
    },
  }));
  assert.doesNotThrow(() => player.play('armed'));
  assert.doesNotThrow(() => player.unlock());

  const thrower = createCuePlayer(() => {
    throw new Error('no audio');
  });
  assert.doesNotThrow(() => thrower.play('ttl_mark'));
});

test('the envelope constants leave room for an attack inside the shortest note', () => {
  const shortest = Math.min(...Object.values(CUE_PLANS).flatMap((p) => p.map((s) => s.durationMs)));
  assert.ok(CUE_ATTACK_MS < shortest, `${CUE_ATTACK_MS}ms attack fits inside a ${shortest}ms note`);
});
