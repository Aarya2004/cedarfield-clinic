// Two sounds, off by default (ticket T1 addendum).
//
// Unsolicited audio is an accessibility complaint in its own right, so nothing here makes a noise
// until a human flips the toggle — which doubles as the user gesture browsers require before an
// AudioContext may start. The split is deliberate: *what to play and when* is data + pure functions
// (tested in node), and *making air move* is one small injectable backend (never tested, never
// imported at module load). Nothing on this path is awaited by the confirm handler.

export type CueName = 'armed' | 'ttl_mark';

/** One sine note. `startMs` is relative to the start of the cue. */
export interface ToneStep {
  freq: number;
  startMs: number;
  durationMs: number;
  /** Peak gain, 0..1. These stay small on purpose — a cue, not an alarm. */
  gain: number;
}

export type CuePlan = readonly ToneStep[];

/**
 * `armed` is a rising fifth (G4 → D5): something arrived and is being held for you.
 * `ttl_mark` is a falling major second (E♭4 → D♭4), quieter and slower: time is going, not gone.
 * Both are sines with a soft envelope — no square/saw, nothing that reads as an error buzzer.
 */
export const CUE_PLANS: Record<CueName, CuePlan> = {
  armed: [
    { freq: 392.0, startMs: 0, durationMs: 110, gain: 0.05 },
    { freq: 587.33, startMs: 80, durationMs: 150, gain: 0.045 },
  ],
  ttl_mark: [
    { freq: 311.13, startMs: 0, durationMs: 130, gain: 0.045 },
    { freq: 277.18, startMs: 110, durationMs: 200, gain: 0.04 },
  ],
};

/** Attack/release of the per-note envelope, in ms. Short attack, long-ish tail, never a click. */
export const CUE_ATTACK_MS = 12;
export const CUE_RELEASE_MS = 60;

export function planDurationMs(plan: CuePlan): number {
  return plan.reduce((max, s) => Math.max(max, s.startMs + s.durationMs + CUE_RELEASE_MS), 0);
}

// ---------------------------------------------------------------------------
// When to play — the schedulable half
// ---------------------------------------------------------------------------

/** The single TTL mark that gets a sound. The 30s mark is announced but not sounded: two beeps in
 *  a 45-second hold is a cue; four is a smoke alarm. */
export const CUE_MARK_SECONDS = 10;

export interface CueState {
  armed: boolean;
  secondsLeft: number;
}

/** Mirrors `announcementFor`: a transition, not a level. Returns `null` on ordinary ticks. */
export function cueFor(next: CueState, prev: CueState | null): CueName | null {
  if (next.armed && (prev === null || !prev.armed)) return 'armed';
  if (!next.armed || prev === null || !prev.armed) return null;
  if (prev.secondsLeft > CUE_MARK_SECONDS && next.secondsLeft <= CUE_MARK_SECONDS && next.secondsLeft > 0) {
    return 'ttl_mark';
  }
  return null;
}

// ---------------------------------------------------------------------------
// The toggle, persisted
// ---------------------------------------------------------------------------

export const AUDIO_PREF_KEY = 'drop.audioCues';

/** Any `Storage`-shaped thing. `null` (SSR, or a browser that refuses storage) means "default off". */
export interface PrefStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadAudioPref(store: PrefStore | null | undefined): boolean {
  if (!store) return false;
  try {
    return store.getItem(AUDIO_PREF_KEY) === 'on';
  } catch {
    return false; // a locked-down storage must not decide we make noise
  }
}

export function saveAudioPref(store: PrefStore | null | undefined, on: boolean): void {
  if (!store) return;
  try {
    store.setItem(AUDIO_PREF_KEY, on ? 'on' : 'off');
  } catch {
    // a preference we cannot persist is still a preference for this session
  }
}

// ---------------------------------------------------------------------------
// Making air move — the injectable half
// ---------------------------------------------------------------------------

export interface AudioBackend {
  /** Current context time, in seconds. */
  now(): number;
  /** Schedule one enveloped sine at an absolute context time. */
  scheduleTone(step: ToneStep, atSeconds: number): void;
  /** Browsers start contexts suspended; the toggle's click is the gesture that resumes them. */
  resume(): void;
}

/** Minimal structural types so this file compiles in node's lib-less type world too. */
interface MinimalAudioContext {
  currentTime: number;
  destination: unknown;
  state: string;
  resume(): Promise<void>;
  createOscillator(): {
    type: string;
    frequency: { setValueAtTime(v: number, t: number): void };
    connect(node: unknown): void;
    start(t: number): void;
    stop(t: number): void;
  };
  createGain(): {
    gain: {
      setValueAtTime(v: number, t: number): void;
      linearRampToValueAtTime(v: number, t: number): void;
    };
    connect(node: unknown): void;
  };
}

/**
 * Wraps a live AudioContext. Not created until the first cue actually plays, so importing this
 * module never touches the audio hardware and never trips an autoplay warning.
 */
export function webAudioBackend(ctx: MinimalAudioContext): AudioBackend {
  return {
    now: () => ctx.currentTime,
    resume: () => {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    },
    scheduleTone: (step, at) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(step.freq, at);
      const attack = at + CUE_ATTACK_MS / 1000;
      const hold = at + step.durationMs / 1000;
      const end = hold + CUE_RELEASE_MS / 1000;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(step.gain, attack);
      gain.gain.linearRampToValueAtTime(step.gain, hold);
      gain.gain.linearRampToValueAtTime(0, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(end + 0.02);
    },
  };
}

export interface CuePlayer {
  /** Fire-and-forget. Never throws, never awaits — the confirm path must not wait on a sound. */
  play(cue: CueName): void;
  /** Called on toggle-on: resumes the context inside the user gesture. Never throws. */
  unlock(): void;
}

/**
 * `makeBackend` is called at most once, lazily, on the first `play`/`unlock`. Returning `null`
 * (no AudioContext in this browser, or the constructor threw) permanently disables the player
 * instead of retrying on every tick.
 */
export function createCuePlayer(makeBackend: () => AudioBackend | null): CuePlayer {
  let backend: AudioBackend | null = null;
  let tried = false;

  const get = (): AudioBackend | null => {
    if (!tried) {
      tried = true;
      try {
        backend = makeBackend();
      } catch {
        backend = null;
      }
    }
    return backend;
  };

  return {
    unlock() {
      try {
        get()?.resume();
      } catch {
        /* a cue that cannot play is not an error worth surfacing */
      }
    },
    play(cue) {
      try {
        const b = get();
        if (!b) return;
        b.resume();
        const at = b.now() + 0.01; // a hair of lead time so the first note is not clipped
        for (const step of CUE_PLANS[cue]) b.scheduleTone(step, at + step.startMs / 1000);
      } catch {
        /* same */
      }
    },
  };
}

/** The browser wiring, kept in one place so the component stays free of `window` pokes. */
export function defaultBackendFactory(): AudioBackend | null {
  const w = globalThis as unknown as { AudioContext?: new () => MinimalAudioContext; webkitAudioContext?: new () => MinimalAudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  return webAudioBackend(new Ctor());
}
