/**
 * MockDropDriver — a seeded stand-in for the real drop backend (T7).
 *
 * WHY THIS FILE EXISTS: the whole Drop UI needs a world to react to before the state machine that
 * will really run it exists. This is that world — a deterministic simulation with one clock, a
 * scripted rival, and an event stream. It is a throwaway, and it is meant to be thrown away.
 *
 * ── THE ADAPTER SEAM (the part that is NOT throwaway) ────────────────────────────────────────────
 * `DropDriver` in `./types.ts` — `subscribe` / `hold` / `confirm` / `release`, plus the `DropEvent`
 * union — IS OUR PROPOSAL for the seam between the UI and the real backend. This file is the
 * reference implementation of it. When the real contract lands, nothing in the components changes:
 * someone writes a second implementation of `DropDriver` that maps the real tool/DO messages into
 * `DropEvent`s, and the playground swaps which driver it constructs. Everything below this header
 * is simulation detail; everything in `types.ts` is the interface we are asking the real contract
 * to map into.
 *
 * Two shapes the real adapter will have to answer for, flagged honestly rather than papered over:
 * - There is no `hold_released` event in the contract, so `release()` re-emits `drop_wave` with the
 *   current board as a resync. If the real backend has a release event, add the variant and this
 *   driver follows.
 * - `at` on every event is THIS DRIVER'S CLOCK (ms since construction), not wall time, because the
 *   clock is advanced by hand in tests. A real adapter will put epoch ms there; nothing in the UI
 *   should do arithmetic across the two.
 *
 * ── DETERMINISM ─────────────────────────────────────────────────────────────────────────────────
 * Same seed + same scenario + same calls in the same driver-time order ⇒ byte-identical event log.
 * The clock only moves through `advance(ms)` (tests) or `start()` (rAF, browser), and `advance`
 * steps the clock TO each scheduled boundary before running it — so one `advance(20_000)` produces
 * exactly the log that two hundred `advance(100)` calls produce, timestamps included.
 *
 * ── THE RIVAL ───────────────────────────────────────────────────────────────────────────────────
 * Seeded, aggressive early, tapering: the first take lands fast, and each following gap grows by
 * the scenario's taper with a seeded ±15% jitter — the shape of a real drop, where the fastest
 * bookers clear the good slots first and the tail is stragglers. The rival takes the first slot
 * still `open` in its seeded preference order, so it can never take a slot twice, and it can never
 * take one you are holding or have booked. It is a simulation and the UI must say so: `RIVAL_LABEL`.
 */
import type { DropDriver, DropEvent, Slot } from './types.ts';

export const RIVAL_LABEL = 'Simulated rival';

export type ScenarioName = 'lose' | 'hold-and-book' | 'expire';

export interface ScenarioConfig {
  /** Slots in the wave. */
  slotCount: number;
  /** Seconds a hold survives before it expires. */
  ttlSeconds: number;
  /** How many slots the rival will try to take before it goes quiet. */
  rivalTakes: number;
  /** When the rival's first take lands, in ms after the wave. */
  firstTakeMs: number;
  /** The gap after the first take, in ms — every later gap is this × taper^n. */
  gapMs: number;
  /** Growth per gap. > 1 means aggressive early, tapering. */
  taper: number;
  /** Delay from `advance` starting to the wave landing, in ms. */
  waveDelayMs: number;
  /** If set, the rival takes an expired hold this many ms after it lapses — the "you hesitated" beat. */
  sweepAfterExpiryMs?: number;
}

/**
 * The three stories the playground and the video need.
 * - `lose`: you watch the board empty. Every slot gone in ~8s, nobody held anything.
 * - `hold-and-book`: the rival takes half, leaves you room to hold and confirm.
 * - `expire`: short TTL, a slow rival, and a sweep 1.6s after your hold lapses.
 */
export const SCENARIOS: Record<ScenarioName, ScenarioConfig> = {
  lose: { slotCount: 6, ttlSeconds: 20, rivalTakes: 6, firstTakeMs: 700, gapMs: 900, taper: 1.18, waveDelayMs: 0 },
  'hold-and-book': { slotCount: 6, ttlSeconds: 20, rivalTakes: 3, firstTakeMs: 1500, gapMs: 2600, taper: 1.35, waveDelayMs: 0 },
  expire: { slotCount: 6, ttlSeconds: 12, rivalTakes: 2, firstTakeMs: 2200, gapMs: 3400, taper: 1.4, waveDelayMs: 0, sweepAfterExpiryMs: 1600 },
};

export interface MockDriverOptions {
  /** Anything hashable. The same seed always builds the same board and the same rival schedule. */
  seed?: number | string;
  scenario?: ScenarioName;
  /** Override any field of the scenario preset (slot count, TTL, rival cadence). */
  overrides?: Partial<ScenarioConfig>;
  /** Supply the board yourself; otherwise it is generated from the seed. */
  slots?: Slot[];
}

/** What the parent hands down to the components each frame. The only place fractional time exists. */
export interface DropSnapshot {
  /** Driver clock, ms since construction. */
  now: number;
  slots: Slot[];
  hold: { slotId: string; ttlSeconds: number; secondsLeft: number } | null;
}

// ── seeded randomness ───────────────────────────────────────────────────────────────────────────

function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') return Math.trunc(seed) >>> 0;
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: small, fast, and stable across engines — the determinism guarantee rests on it. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLINICIANS = ['Dr. Alvarez', 'Dr. Boone', 'Dr. Chatterjee', 'Dr. Duarte', 'Dr. Eriksson', 'Dr. Fanning'];
const KINDS = ['New patient', 'Follow-up', 'Consult'];

function buildSlots(count: number, rand: () => number): Slot[] {
  const startHour = 8 + Math.floor(rand() * 3); // 8, 9 or 10 — seeded, so the board varies per seed
  const startMinutes = startHour * 60 + Math.floor(rand() * 3) * 20;
  return Array.from({ length: count }, (_, i) => {
    const minutes = startMinutes + i * 20;
    const h24 = Math.floor(minutes / 60);
    const m = minutes % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return {
      id: `slot-${i + 1}`,
      timeLabel: `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`,
      clinician: CLINICIANS[Math.floor(rand() * CLINICIANS.length)],
      kind: KINDS[Math.floor(rand() * KINDS.length)],
      state: 'open',
    } satisfies Slot;
  });
}

/** Fisher–Yates on the seeded stream: the rival's preference order. */
function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── the driver ──────────────────────────────────────────────────────────────────────────────────

type TaskKind = 'wave' | 'rival_take' | 'hold_tick' | 'hold_expire' | 'sweep';

interface Task {
  at: number;
  seq: number;
  kind: TaskKind;
  /** Ticks and expiry belong to one hold; a released or confirmed hold makes them no-ops. */
  holdId?: number;
  slotId?: string;
  secondsLeft?: number;
}

export class MockDropDriver implements DropDriver {
  readonly config: ScenarioConfig;
  readonly scenarioName: ScenarioName;
  readonly seed: number | string;

  private time = 0;
  private seq = 0;
  private queue: Task[] = [];
  private slots: Slot[];
  private listeners = new Set<(e: DropEvent) => void>();
  private log: DropEvent[] = [];
  private waveEmitted = false;
  private rivalOrder: string[];
  private hold_: { id: number; slotId: string; startedAt: number; ttlSeconds: number } | null = null;
  private holdSeq = 0;
  private rafHandle: number | null = null;
  private rafLast = 0;

  constructor(options: MockDriverOptions = {}) {
    const { seed = 1, scenario = 'lose', overrides, slots } = options;
    this.seed = seed;
    this.scenarioName = scenario;
    this.config = { ...SCENARIOS[scenario], ...overrides };

    const rand = mulberry32(hashSeed(seed));
    this.slots = (slots ?? buildSlots(this.config.slotCount, rand)).map((s) => ({ ...s }));

    this.schedule({ at: this.config.waveDelayMs, kind: 'wave' });

    // The rival's whole schedule is fixed here, at construction, from the seed — nothing about it
    // depends on what you do later, only on whether a slot is still open when its turn comes.
    const order = shuffled(
      this.slots.map((s) => s.id),
      rand,
    );
    let at = this.config.waveDelayMs + this.config.firstTakeMs;
    let gap = this.config.gapMs;
    for (let i = 0; i < Math.min(this.config.rivalTakes, order.length); i++) {
      this.schedule({ at: Math.round(at), kind: 'rival_take' });
      const jitter = 0.85 + rand() * 0.3;
      at += gap * jitter;
      gap *= this.config.taper;
    }
    this.rivalOrder = order;
  }

  // ── DropDriver ────────────────────────────────────────────────────────────────────────────────

  /**
   * Listen. Returns the unsubscribe. A subscriber that arrives after the wave landed is sent a
   * `drop_wave` carrying the CURRENT board so it can sync — that catch-up is not written to the log
   * and is not sent to anyone else.
   */
  subscribe(cb: (e: DropEvent) => void): () => void {
    this.listeners.add(cb);
    if (this.waveEmitted) cb({ type: 'drop_wave', slots: this.snapshotSlots(), at: this.time });
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Hold a slot. Ignored unless the slot is open; holding a second slot releases the first. */
  hold(slotId: string): void {
    const slot = this.find(slotId);
    if (!slot || slot.state !== 'open') return;
    if (this.hold_) this.release(this.hold_.slotId);

    const id = ++this.holdSeq;
    const ttlSeconds = this.config.ttlSeconds;
    this.hold_ = { id, slotId, startedAt: this.time, ttlSeconds };
    slot.state = 'held_by_you';
    this.emit({ type: 'hold_started', slotId, ttlSeconds, at: this.time });

    for (let k = 1; k < ttlSeconds; k++) {
      this.schedule({ at: this.time + k * 1000, kind: 'hold_tick', holdId: id, slotId, secondsLeft: ttlSeconds - k });
    }
    this.schedule({ at: this.time + ttlSeconds * 1000, kind: 'hold_expire', holdId: id, slotId });
  }

  /** Book the slot you are holding. Ignored for anything you are not currently holding. */
  confirm(slotId: string): void {
    const slot = this.find(slotId);
    if (!slot || slot.state !== 'held_by_you' || this.hold_?.slotId !== slotId) return;
    slot.state = 'booked_yours';
    this.hold_ = null; // queued ticks for that hold id become no-ops
    this.emit({ type: 'booked', slotId, at: this.time });
  }

  /** Give a held slot back. It returns to open; the board resyncs via `drop_wave` (see header). */
  release(slotId: string): void {
    const slot = this.find(slotId);
    if (!slot || slot.state !== 'held_by_you' || this.hold_?.slotId !== slotId) return;
    slot.state = 'open';
    this.hold_ = null;
    this.emit({ type: 'drop_wave', slots: this.snapshotSlots(), at: this.time });
  }

  // ── clock ─────────────────────────────────────────────────────────────────────────────────────

  /**
   * Move the clock forward. Every scheduled boundary between here and there runs AT its own
   * timestamp, in (time, insertion) order — so the size of the step never changes the log.
   */
  advance(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    const target = this.time + ms;
    for (;;) {
      const next = this.queue[0];
      if (!next || next.at > target) break;
      this.queue.shift();
      this.time = next.at;
      this.run(next);
    }
    this.time = target;
  }

  /** Drive the clock from rAF (browser only). No-op where rAF does not exist. */
  start(): void {
    if (this.rafHandle !== null || typeof requestAnimationFrame !== 'function') return;
    this.rafLast = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const frame = (t: number) => {
      this.advance(t - this.rafLast);
      this.rafLast = t;
      this.rafHandle = requestAnimationFrame(frame);
    };
    this.rafHandle = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.rafHandle === null) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  /** Driver clock, ms since construction. */
  now(): number {
    return this.time;
  }

  /** When the wave lands on the driver clock — feed it to `DropCountdown` alongside `now()`. */
  waveAt(): number {
    return this.config.waveDelayMs;
  }

  /** Everything the components need for one frame, including fractional seconds on the live hold. */
  snapshot(): DropSnapshot {
    const h = this.hold_;
    return {
      now: this.time,
      slots: this.snapshotSlots(),
      hold: h
        ? {
            slotId: h.slotId,
            ttlSeconds: h.ttlSeconds,
            secondsLeft: Math.max(0, h.ttlSeconds - (this.time - h.startedAt) / 1000),
          }
        : null,
    };
  }

  /** Every event emitted so far, oldest first. The determinism tests compare these. */
  events(): DropEvent[] {
    return this.log.slice();
  }

  // ── internals ─────────────────────────────────────────────────────────────────────────────────

  private snapshotSlots(): Slot[] {
    return this.slots.map((s) => ({ ...s }));
  }

  private find(slotId: string): Slot | undefined {
    return this.slots.find((s) => s.id === slotId);
  }

  private schedule(task: Omit<Task, 'seq'>): void {
    const full: Task = { ...task, seq: this.seq++ };
    // Tiny queue; a sorted insert keeps (at, seq) ordering exact and stable.
    const i = this.queue.findIndex((t) => t.at > full.at || (t.at === full.at && t.seq > full.seq));
    if (i === -1) this.queue.push(full);
    else this.queue.splice(i, 0, full);
  }

  private run(task: Task): void {
    switch (task.kind) {
      case 'wave': {
        this.waveEmitted = true;
        this.emit({ type: 'drop_wave', slots: this.snapshotSlots(), at: this.time });
        return;
      }
      case 'rival_take': {
        const target = this.rivalOrder.find((id) => this.find(id)?.state === 'open');
        if (!target) return; // nothing left to take — the rival goes quiet rather than fabricating
        this.takeByRival(target);
        return;
      }
      case 'hold_tick': {
        if (!this.hold_ || this.hold_.id !== task.holdId) return; // released or booked since
        this.emit({ type: 'hold_tick', slotId: task.slotId!, secondsLeft: task.secondsLeft!, at: this.time });
        return;
      }
      case 'hold_expire': {
        if (!this.hold_ || this.hold_.id !== task.holdId) return;
        const slot = this.find(task.slotId!);
        this.hold_ = null;
        if (slot) slot.state = 'expired_hold';
        this.emit({ type: 'hold_expired', slotId: task.slotId!, at: this.time });
        if (this.config.sweepAfterExpiryMs !== undefined) {
          this.schedule({ at: this.time + this.config.sweepAfterExpiryMs, kind: 'sweep', slotId: task.slotId });
        }
        return;
      }
      case 'sweep': {
        const slot = this.find(task.slotId!);
        // Only an unclaimed lapsed hold gets swept — if you re-held or re-booked it, it is yours.
        if (!slot || slot.state !== 'expired_hold') return;
        this.takeByRival(slot.id);
        return;
      }
    }
  }

  private takeByRival(slotId: string): void {
    const slot = this.find(slotId);
    if (!slot || slot.state === 'taken_by_rival' || slot.state === 'booked_yours') return;
    slot.state = 'taken_by_rival';
    this.emit({ type: 'slot_taken', slotId, by: 'rival', at: this.time });
  }

  private emit(e: DropEvent): void {
    this.log.push(e);
    for (const cb of Array.from(this.listeners)) cb(e);
  }
}

/** Build a driver. `createMockDriver({ seed: 7, scenario: 'expire' })`. */
export function createMockDriver(options: MockDriverOptions = {}): MockDropDriver {
  return new MockDropDriver(options);
}

/** The playground/video shorthand: `scenario('lose')`, `scenario('hold-and-book', 42)`. */
export function scenario(name: ScenarioName, seed: number | string = 1): MockDropDriver {
  return new MockDropDriver({ scenario: name, seed });
}
