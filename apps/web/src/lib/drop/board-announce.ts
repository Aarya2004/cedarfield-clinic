/**
 * What the drop board says out loud.
 *
 * A drop wave flips several slots inside a second. A live region that mirrors every flip is
 * unusable — the screen reader is still reading "9:20 slot taken" when 9:40 and 10:00 have already
 * gone. So the board owns exactly one polite live region and this module owns what lands in it:
 * pure string builders plus a throttled queue that releases at most one line per interval and keeps
 * the newest lines when a burst outruns it.
 *
 * No DOM, no React, no timers of its own — the caller supplies `now`. That keeps it unit-testable
 * under `node --experimental-strip-types --test` and makes the throttle deterministic.
 *
 * Relative `.ts` imports only (see tickets/MAP.md): a file that imports `@/…` cannot be unit-tested.
 */
import type { Slot, SlotState } from './types.ts';

/** One line per ~900 ms: fast enough to keep up with a wave, slow enough to finish a sentence. */
export const DEFAULT_ANNOUNCE_INTERVAL_MS = 900;

/** Three lines is roughly what a listener can hold before the board has moved on anyway. */
export const DEFAULT_ANNOUNCE_QUEUE = 3;

export interface AnnouncerOptions {
  /** Minimum gap between released lines. Default {@link DEFAULT_ANNOUNCE_INTERVAL_MS}. */
  intervalMs?: number;
  /** How many unread lines to hold. Overflow drops the *stalest* line. Default 3. */
  maxQueue?: number;
}

/**
 * The sentence for a slot's current state, or `null` when the state is not worth saying.
 *
 * `open` is the board's resting state: a wave of eleven open slots should announce the wave once
 * (the board header does that), not eleven times. A slot that returns to `open` after being held is
 * news, though — that case is handled by {@link transitionAnnouncement}, which knows the prior state.
 */
export function slotAnnouncement(slot: Pick<Slot, 'timeLabel' | 'state'>): string | null {
  const t = slot.timeLabel.trim();
  if (!t) return null;
  switch (slot.state) {
    case 'open':
      return null;
    case 'held_by_you':
      return `${t} held — yours`;
    case 'held_by_other':
      return `${t} held by someone else`;
    case 'taken_by_rival':
      return `${t} slot taken`;
    case 'booked_yours':
      return `${t} booked — yours`;
    case 'expired_hold':
      return `${t} hold expired`;
  }
}

/**
 * The sentence for a state *change*. `prev === undefined` means the slot just appeared in a wave.
 * Returns `null` when nothing changed, or when the change is not worth interrupting for.
 */
export function transitionAnnouncement(
  prev: SlotState | undefined,
  slot: Pick<Slot, 'timeLabel' | 'state'>,
): string | null {
  if (prev === slot.state) return null;
  if (slot.state === 'open') {
    // A slot arriving open is part of the wave, not an event. A slot *returning* to open is.
    return prev === undefined ? null : `${slot.timeLabel.trim()} open again`;
  }
  return slotAnnouncement(slot);
}

/**
 * Every line the board owes its listener after `prev` became `next`, in board order.
 * Slots that vanish from the board are silent: they are already gone from the grid.
 */
export function diffAnnouncements(prev: readonly Slot[], next: readonly Slot[]): string[] {
  const before = new Map<string, SlotState>();
  for (const s of prev) before.set(s.id, s.state);
  const out: string[] = [];
  for (const s of next) {
    const line = transitionAnnouncement(before.get(s.id), s);
    if (line) out.push(line);
  }
  return out;
}

/** "11 slots just opened" — the one line a fresh wave is allowed. */
export function waveAnnouncement(slots: readonly Slot[]): string | null {
  const n = slots.length;
  if (n === 0) return null;
  return n === 1 ? '1 slot just opened' : `${n} slots just opened`;
}

/**
 * A throttled queue for one polite live region.
 *
 * Contract: `push` never blocks and never speaks; `read(now)` is the only thing that releases a
 * line, and it releases at most one per `intervalMs`. The caller polls `read` (an interval, an
 * animation frame, whatever) and paints the returned string into the live region. Painting the same
 * string twice is a no-op for assistive tech, which is why `read` keeps returning the current line
 * until the next one is due.
 */
export class BoardAnnouncer {
  readonly intervalMs: number;
  readonly maxQueue: number;

  private queue: string[] = [];
  private currentLine = '';
  private lastReleaseAt = Number.NEGATIVE_INFINITY;
  private droppedCount = 0;

  constructor(options: AnnouncerOptions = {}) {
    this.intervalMs = Math.max(0, options.intervalMs ?? DEFAULT_ANNOUNCE_INTERVAL_MS);
    this.maxQueue = Math.max(1, options.maxQueue ?? DEFAULT_ANNOUNCE_QUEUE);
  }

  /** Lines waiting to be said. */
  get pending(): number {
    return this.queue.length;
  }

  /** Lines the queue overflowed past — counted, never spoken, useful in tests and debugging. */
  get dropped(): number {
    return this.droppedCount;
  }

  /** The line the live region should be showing right now. */
  get current(): string {
    return this.currentLine;
  }

  /**
   * Enqueue a line. Empty lines and an immediate repeat of what is already queued or on screen are
   * ignored — "9:20 slot taken" twice in a row tells the listener nothing new.
   */
  push(text: string | null | undefined): void {
    const line = (text ?? '').trim();
    if (!line) return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.currentLine;
    if (line === last) return;
    this.queue.push(line);
    while (this.queue.length > this.maxQueue) {
      this.queue.shift();
      this.droppedCount += 1;
    }
  }

  /** Enqueue several lines in order. */
  pushAll(lines: readonly (string | null | undefined)[]): void {
    for (const l of lines) this.push(l);
  }

  /**
   * Release the next line if the interval has elapsed, and return what the live region should show.
   * Idempotent within an interval, so it is safe to call on every render or every frame.
   */
  read(now: number): string {
    if (this.queue.length && now - this.lastReleaseAt >= this.intervalMs) {
      this.currentLine = this.queue.shift() as string;
      this.lastReleaseAt = now;
    }
    return this.currentLine;
  }

  /** Say everything still queued as one line — for "the wave is over, catch up" moments. */
  flush(now: number): string {
    if (this.queue.length) {
      this.currentLine = this.queue.join('. ');
      this.queue = [];
      this.lastReleaseAt = now;
    }
    return this.currentLine;
  }

  /** Back to silence. The next `read` may release immediately. */
  reset(): void {
    this.queue = [];
    this.currentLine = '';
    this.lastReleaseAt = Number.NEGATIVE_INFINITY;
    this.droppedCount = 0;
  }
}
