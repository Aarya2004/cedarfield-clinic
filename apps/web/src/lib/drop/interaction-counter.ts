/**
 * The instrument. Every interaction number this project shows is produced here, by this code,
 * from real input — read `COUNTING.md` (same folder) for the measurement spec this file implements
 * clause by clause. That document is the argument; this file is only the machine.
 *
 * Framework-free and DOM-lite on purpose: `createCounter` takes anything with add/removeEventListener,
 * so an HTMLElement works in the browser and a five-line fake works under `node --test` with no jsdom.
 *
 * There is deliberately no code path in this module that assigns a bucket a literal value. The only
 * way any number here goes up is an event arriving from a listener.
 */

/** COUNTING.md §3: wheel events closer together than this belong to one gesture. */
export const SCROLL_GESTURE_GAP_MS = 350;

export type InteractionKind = 'clicks' | 'keys' | 'scrolls' | 'tabs';

export interface InteractionBreakdown {
  clicks: number;
  keys: number;
  scrolls: number;
  tabs: number;
}

export interface CounterSnapshot {
  /** Always the plain sum of the four buckets — never weighted (COUNTING.md §"The definition"). */
  total: number;
  breakdown: InteractionBreakdown;
}

/**
 * The slice of `Event` we read. Structural, so a browser `Event` satisfies it and a test can build
 * one with an object literal. `key`/`repeat` are optional because only KeyboardEvent has them.
 */
export interface CountableEvent {
  readonly type: string;
  readonly isTrusted?: boolean;
  readonly key?: string;
  readonly repeat?: boolean;
}

/** The scope handle. `HTMLElement` satisfies this; so does a fake in a test. */
export interface CounterRoot {
  addEventListener(
    type: string,
    listener: (event: CountableEvent) => void,
    options?: { capture?: boolean; passive?: boolean },
  ): void;
  removeEventListener(type: string, listener: (event: CountableEvent) => void, options?: { capture?: boolean }): void;
}

/**
 * Bare modifier presses. Holding Shift to type a capital is part of typing that letter, not a
 * second act, so `Shift+A` is one interaction (COUNTING.md §2).
 */
export const MODIFIER_KEYS: ReadonlySet<string> = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'AltGraph',
  'Fn',
  'FnLock',
  'Hyper',
  'Super',
  'Symbol',
  'SymbolLock',
]);

/** The DOM event types we listen for. Everything else is a consequence of one of these. */
export const COUNTED_EVENT_TYPES = ['pointerdown', 'keydown', 'wheel'] as const;

export interface ClassifyOptions {
  /**
   * Production default `true`: only `isTrusted` events count, so no script — ours, an agent's, or a
   * console's — can move the number. Tests pass `false` because a test process has no browser and
   * therefore no trusted events; the filter itself is asserted separately.
   */
  trustedOnly?: boolean;
}

/**
 * Pure: which bucket does this event belong to, or none? Every `wheel` returns `'scrolls'` here;
 * gesture coalescing is the counter's job (see `startsNewScrollGesture`), so that this function
 * stays a function of its argument alone.
 */
export function classify(event: CountableEvent, options: ClassifyOptions = {}): InteractionKind | null {
  if (options.trustedOnly !== false && event.isTrusted !== true) return null;

  switch (event.type) {
    case 'pointerdown':
      return 'clicks';
    case 'wheel':
      return 'scrolls';
    case 'keydown': {
      if (event.repeat === true) return null; // held key = one sustained act
      const key = event.key ?? '';
      if (MODIFIER_KEYS.has(key)) return null;
      return key === 'Tab' ? 'tabs' : 'keys';
    }
    default:
      return null;
  }
}

/** Pure: does a wheel event at `at` open a new gesture, given the previous wheel at `lastAt`? */
export function startsNewScrollGesture(lastAt: number | null, at: number, gapMs = SCROLL_GESTURE_GAP_MS): boolean {
  return lastAt === null || at - lastAt >= gapMs;
}

export function emptyBreakdown(): InteractionBreakdown {
  return { clicks: 0, keys: 0, scrolls: 0, tabs: 0 };
}

export function totalOf(breakdown: InteractionBreakdown): number {
  return breakdown.clicks + breakdown.keys + breakdown.scrolls + breakdown.tabs;
}

/** "1 interaction" / "n interactions" — the receipt reads as English, not as a stat block. */
export function describeCount(count: number): string {
  return `${count} ${count === 1 ? 'interaction' : 'interactions'}`;
}

export interface CounterOptions extends ClassifyOptions {
  /** Gesture window for scroll coalescing. Overridable so a test need not sleep. */
  scrollGapMs?: number;
  /** Clock, injectable for the same reason. */
  now?: () => number;
  /** Fired after any bucket changes — the live tally subscribes to this. */
  onChange?: (snapshot: CounterSnapshot) => void;
}

export interface InteractionCounter {
  /** Running total. */
  readonly count: number;
  /** Copy of the four buckets — mutating it cannot corrupt the counter. */
  readonly breakdown: InteractionBreakdown;
  snapshot(): CounterSnapshot;
  /** Zero the buckets and forget any in-flight scroll gesture. Listeners stay attached. */
  reset(): void;
  /** Detach every listener. Idempotent; the final numbers stay readable afterwards. */
  stop(): void;
}

const defaultNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

/**
 * Attach the instrument to one region.
 *
 * Listeners are registered in the **capture** phase deliberately: a descendant that calls
 * `stopPropagation()` must not be able to hide its own cost from the count.
 */
export function createCounter(root: CounterRoot, options: CounterOptions = {}): InteractionCounter {
  const { trustedOnly, onChange } = options;
  const gapMs = options.scrollGapMs ?? SCROLL_GESTURE_GAP_MS;
  const now = options.now ?? defaultNow;

  const buckets = emptyBreakdown();
  let lastWheelAt: number | null = null;
  let stopped = false;

  const snapshot = (): CounterSnapshot => ({ total: totalOf(buckets), breakdown: { ...buckets } });

  const handle = (event: CountableEvent): void => {
    if (stopped) return;
    const kind = classify(event, { trustedOnly });
    if (kind === null) return;

    if (kind === 'scrolls') {
      const at = now();
      const isNewGesture = startsNewScrollGesture(lastWheelAt, at, gapMs);
      lastWheelAt = at;
      if (!isNewGesture) return; // same flick of the wheel
    }

    buckets[kind] += 1;
    onChange?.(snapshot());
  };

  for (const type of COUNTED_EVENT_TYPES) {
    root.addEventListener(type, handle, { capture: true, passive: true });
  }

  return {
    get count() {
      return totalOf(buckets);
    },
    get breakdown() {
      return { ...buckets };
    },
    snapshot,
    reset() {
      buckets.clicks = 0;
      buckets.keys = 0;
      buckets.scrolls = 0;
      buckets.tabs = 0;
      lastWheelAt = null;
      onChange?.(snapshot());
    },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const type of COUNTED_EVENT_TYPES) {
        root.removeEventListener(type, handle, { capture: true });
      }
    },
  };
}
