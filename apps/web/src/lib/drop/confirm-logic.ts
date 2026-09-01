// The rules behind the one human act (ticket T1). Pure functions, no DOM, no React — the component
// is a renderer for what this file decides, so the decisions can be unit-tested and read in one page.
//
// The load-bearing rule is `trusted`. A WebMCP tool, a content script, or anything else holding a
// reference to the element can dispatch a KeyboardEvent or call .click(); the UA marks those
// `isTrusted === false`. We confirm on `isTrusted === true` and nothing else, and we *count* the
// rest, because "the agent structurally cannot press it" is a claim a demo has to be able to show.

import { urgencyOf, type Urgency } from './urgency.ts';

/** Keys that count as a press. Space is here for switch access, which maps its one input to Space. */
export const CONFIRM_KEYS = ['Enter', ' ', 'Spacebar'] as const;

export interface ConfirmAttempt {
  /** `event.isTrusted` from the *native* event (React synthetics proxy it as `nativeEvent`). */
  isTrusted: boolean | undefined;
  source: 'key' | 'pointer';
  /** `KeyboardEvent.key` — required when `source` is `'key'`. */
  key?: string;
  /** `KeyboardEvent.repeat` — a held-down key must not fire twice. */
  repeat?: boolean;
  /** No hold is active: the surface is armed only when a slot is held for this human. */
  disabled: boolean;
  secondsLeft: number;
  alreadyConfirmed: boolean;
  /**
   * ms since the surface was armed, for destructive acts only. Omit for the book dock. Below
   * ARM_DEAD_ZONE_MS the press is ignored as agent-timed.
   */
  msSinceArmed?: number;
}

export type ConfirmDecision =
  /** Fire `onConfirm`. */
  | { kind: 'confirm' }
  /** A synthetic press. Never fires; always increments `data-untrusted-attempts`. */
  | { kind: 'blocked'; reason: 'untrusted' }
  /** Not a press at all, or a press with nothing to press for. */
  | { kind: 'ignore'; reason: 'other-key' | 'repeat' | 'disabled' | 'expired' | 'already-confirmed' | 'too-soon' };

/**
 * P1-1 (security review 2026-09-01): a destructive dock (cancel/move) is armed at a moment the
 * AGENT chooses. A trusted press that lands within this window of the arming was almost certainly
 * aimed at something else — a prompt-injected agent could time the arm under the person's finger.
 * Presses inside the window are ignored (not counted as synthetic: they are real, just early).
 * The book dock has no dead-zone: its press is the person answering a hold they asked for.
 */
export const ARM_DEAD_ZONE_MS = 500;

export function isConfirmKey(key: string | undefined): boolean {
  return key !== undefined && (CONFIRM_KEYS as readonly string[]).includes(key);
}

/**
 * The whole gate, in evaluation order:
 *
 * 1. Is this press-shaped at all? (an `a` keydown is not an attempt on anything)
 * 2. Is it trusted? — checked *before* disabled/expired so the counter tells the truth about every
 *    synthetic press, including ones aimed at a surface that had nothing to book.
 * 3. Is there something to confirm?
 */
export function decideConfirm(a: ConfirmAttempt): ConfirmDecision {
  if (a.source === 'key') {
    if (!isConfirmKey(a.key)) return { kind: 'ignore', reason: 'other-key' };
    if (a.repeat === true) return { kind: 'ignore', reason: 'repeat' };
  }
  if (a.isTrusted !== true) return { kind: 'blocked', reason: 'untrusted' };
  if (a.msSinceArmed !== undefined && a.msSinceArmed < ARM_DEAD_ZONE_MS) return { kind: 'ignore', reason: 'too-soon' };
  if (a.disabled) return { kind: 'ignore', reason: 'disabled' };
  if (a.secondsLeft <= 0) return { kind: 'ignore', reason: 'expired' };
  if (a.alreadyConfirmed) return { kind: 'ignore', reason: 'already-confirmed' };
  return { kind: 'confirm' };
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

/**
 * Screen-reader marks. A per-second countdown in an assertive region is unusable — it interrupts
 * itself forever and the human never hears the verb. Two marks plus the arm sentence is the budget.
 */
export const ANNOUNCE_MARKS = [30, 10] as const;

export interface ConfirmSurfaceState {
  armed: boolean;
  secondsLeft: number;
  slotLabel: string;
}

/** True when the tick just crossed `mark` on the way down. Rising edges never announce. */
export function crossedMark(prevSeconds: number, nextSeconds: number, mark: number): boolean {
  return prevSeconds > mark && nextSeconds <= mark;
}

export function secondsPhrase(n: number): string {
  const s = Math.max(0, Math.ceil(n));
  return s === 1 ? '1 second' : `${s} seconds`;
}

/**
 * What (if anything) the assertive live region should say for this transition. `null` on every
 * tick that is not the arm, a mark, or the expiry — so the region stays silent between events.
 */
export function announcementFor(next: ConfirmSurfaceState, prev: ConfirmSurfaceState | null, verb: 'book' | 'cancel' | 'move' = 'book'): string | null {
  const justArmed = next.armed && (prev === null || !prev.armed);
  const headline = verb === 'book' ? `Slot held: ${next.slotLabel}` : `Ready to ${verb}: ${next.slotLabel}`;
  if (justArmed) {
    return `${headline}. ${secondsPhrase(next.secondsLeft)}. Press Enter to ${verb}.`;
  }
  if (!next.armed) {
    // Only the hold running out is worth interrupting for; a hold that was released or booked
    // elsewhere in the UI announces itself there.
    if (prev !== null && prev.armed && next.secondsLeft <= 0) {
      return verb === 'book' ? 'Hold expired. The slot went back to the list.' : `Time ran out. Nothing was ${verb === 'move' ? 'moved' : 'cancelled'}.`;
    }
    return null;
  }
  if (prev === null || !prev.armed) return null;
  for (const mark of ANNOUNCE_MARKS) {
    if (crossedMark(prev.secondsLeft, next.secondsLeft, mark)) {
      return `${secondsPhrase(mark)} left. Press Enter to ${verb}.`;
    }
  }
  return null;
}

/** The polite counterpart: what the blocked-attempt region says. Never assertive — it is not urgent. */
export function blockedAnnouncement(count: number, verb: 'book' | 'cancel' | 'move' = 'book'): string | null {
  if (count <= 0) return null;
  const does = verb === 'book' ? 'books' : verb === 'cancel' ? 'cancels' : 'moves';
  return count === 1
    ? `1 synthetic press blocked. Only a real keypress ${does} this slot.`
    : `${count} synthetic presses blocked. Only a real keypress ${does} this slot.`;
}

// ---------------------------------------------------------------------------
// Copy + urgency
// ---------------------------------------------------------------------------

/** Urgency is a shared contract (T2 draws the same thresholds); disarmed has no urgency of its own. */
export function surfaceUrgency(armed: boolean, secondsLeft: number): Urgency {
  return armed ? urgencyOf(secondsLeft) : 'calm';
}

export interface SurfaceCopy {
  /** The eyebrow above the cap. */
  status: string;
  /** The verb on the keycap. */
  action: string;
  /** The engraved line under the verb. */
  legend: string;
  /** The sentence under the cap. */
  footnote: string;
}

export function surfaceCopy(state: ConfirmSurfaceState): SurfaceCopy {
  if (!state.armed) {
    return {
      status: 'Nothing held',
      action: 'Waiting for a drop',
      legend: 'nothing to press yet',
      footnote: 'When a slot drops and your agent takes a hold, it lands here and this key wakes up.',
    };
  }
  if (state.secondsLeft <= 0) {
    return {
      status: 'Hold expired',
      action: 'The slot went back',
      legend: 'nothing to press',
      footnote: 'The hold ran out. The next drop puts it back on the board.',
    };
  }
  return {
    status: 'Held for you',
    action: `Book ${state.slotLabel}`,
    legend: 'press enter',
    footnote: 'Your agent held this slot. It cannot press this key — only you can.',
  };
}
