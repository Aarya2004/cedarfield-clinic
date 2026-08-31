// Time math for the Drop spike (T2). Pure functions, no clock, no timers: every caller passes the
// numbers in, so the countdown components stay deterministic and unit-testable while the mock
// driver (T7) owns the only clock in the system.
//
// One rule runs through all of it: a countdown never shows a negative, and never shows "0:00" while
// there is still time on it. Displayed seconds are CEILED — 0.2s left reads "0:01" — so the moment
// the readout says 0:00 is the moment the hold is actually gone.
import { urgencyOf, URGENCY_TOKEN, type Urgency } from './urgency.ts';

/** Seconds, floored at zero. Non-finite input (NaN, ±Infinity from a bad divide) reads as zero. */
export function clampSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return seconds > 0 ? seconds : 0;
}

/** The integer a readout shows for `seconds`: clamped, then ceiled. 20.0 → 20, 19.4 → 20, 0.2 → 1. */
export function displaySeconds(seconds: number): number {
  return Math.ceil(clampSeconds(seconds));
}

/**
 * "0:42" · "1:05" · "10:00" · "1:00:00". Minutes are padded only past the hour mark, so short
 * holds read as a stopwatch and long waits read as a clock.
 */
export function formatClock(seconds: number): string {
  const total = displaySeconds(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Seconds from `now` (epoch ms) until `dropAt`. Past drops clamp to 0, never negative. */
export function secondsUntil(dropAt: Date | number, now: number): number {
  const target = dropAt instanceof Date ? dropAt.getTime() : dropAt;
  if (!Number.isFinite(target) || !Number.isFinite(now)) return 0;
  return clampSeconds((target - now) / 1000);
}

/** How much of the bar is still burning: 1 → full, 0 → spent. Clamped both ends. */
export function fractionLeft(totalSeconds: number, secondsLeft: number): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  const left = clampSeconds(secondsLeft);
  return left >= totalSeconds ? 1 : left / totalSeconds;
}

/** Urgency for a TTL readout, on the shared thresholds — negative time is critical, not calm. */
export function urgencyAt(secondsLeft: number): Urgency {
  return urgencyOf(clampSeconds(secondsLeft));
}

/** The CSS colour for that urgency, as a `var(--drop-*, fallback)` token the playground can reskin. */
export function urgencyColorAt(secondsLeft: number): string {
  return URGENCY_TOKEN[urgencyAt(secondsLeft)];
}

/** Seconds at which a screen reader hears about a hold. Same numbers as the colour thresholds. */
export const HOLD_MILESTONES = [30, 10, 5] as const;
/** Seconds at which a screen reader hears about the next wave. Fewer: a wait is not an emergency. */
export const DROP_MILESTONES = [30, 10] as const;

/**
 * The `aria-live` line for a burning hold, or '' between milestones.
 *
 * Milestone-only by design: the text changes at most four times per hold, so an assistive tech
 * reads "10 seconds left" instead of narrating every tick. Because the sentence is derived from
 * the displayed integer, a re-render inside the same second produces identical text and is not
 * re-announced — which is why this can stay a pure function with no memory.
 */
export function holdAnnouncement(secondsLeft: number, label = 'Hold'): string {
  const s = displaySeconds(secondsLeft);
  if (s === 0) return `${label} expired.`;
  return (HOLD_MILESTONES as readonly number[]).includes(s) ? `${s} seconds left on your ${label.toLowerCase()}.` : '';
}

/** The `aria-live` line for the wave countdown, or '' between milestones. */
export function dropAnnouncement(secondsLeft: number): string {
  const s = displaySeconds(secondsLeft);
  if (s === 0) return 'Slots are dropping now.';
  return (DROP_MILESTONES as readonly number[]).includes(s) ? `Next drop in ${s} seconds.` : '';
}
