/**
 * Who asked for this hold (SPEC-V3 §2).
 *
 * A hold arrives at the page as a `hold_started` event and the event does not say who asked for it.
 * It is the same event whether the visitor clicked a row or their assistant called
 * `clinic_hold_slot`, because the driver seam deliberately has one verb. The page still owes the
 * visitor the distinction: a time held on their behalf carries a small "via your assistant" tag, the
 * way any product with an assistant integration would say so.
 *
 * So the page records the instant a local control asked for a hold, and this module decides: a hold
 * that starts without a recent local request was asked for somewhere else.
 *
 * Pure, no DOM, relative imports: unit-testable under `node --test` (tickets/MAP.md).
 */
import { formatClock } from '../../lib/drop/time.ts';

export type HoldOrigin = 'you' | 'agent';

/**
 * How recently a local click must have asked for the hold to own it. Generous on purpose: the
 * driver answers synchronously today, but a real backend will round-trip, and misattributing the
 * human's own click to "your agent" is the one mistake this affordance must never make. Erring long
 * only costs the reverse — an agent hold landing inside the window right after you clicked reads as
 * yours, which is a sentence that is still true.
 */
export const LOCAL_REQUEST_WINDOW_MS = 2500;

/**
 * `lastLocalRequestAt` is null when no control on this page has ever asked for a hold. Both clocks
 * must be the same clock — the session clock that stamps `event.at` (see useDropSession's header).
 */
export function holdOrigin(
  holdStartedAt: number,
  lastLocalRequestAt: number | null,
  windowMs: number = LOCAL_REQUEST_WINDOW_MS,
): HoldOrigin {
  if (lastLocalRequestAt === null) return 'agent';
  if (!Number.isFinite(holdStartedAt) || !Number.isFinite(lastLocalRequestAt)) return 'agent';
  const age = holdStartedAt - lastLocalRequestAt;
  if (age < 0) return 'agent'; // the request came after the hold: it cannot have caused it
  return age <= windowMs ? 'you' : 'agent';
}

/**
 * The line the strip above the board carries while a time is reserved: the promise, then the clock.
 * Origin-free on purpose — the hold reads the same to the visitor however it was asked for, and the
 * tag below is what names the assistant.
 */
export function holdHeadline(secondsLeft: number): string {
  return `This time is held for you — ${formatClock(secondsLeft)}`;
}

/**
 * The tag a hold placed by the visitor's assistant carries — on the board row and in the dock. Small
 * and factual: the visitor should know how the time got reserved without being lectured about it.
 */
export const ASSISTANT_TAG = 'via your assistant';

/** The tag for this hold, or null when the visitor reserved the time themselves. */
export function assistantTag(origin: HoldOrigin): string | null {
  return origin === 'agent' ? ASSISTANT_TAG : null;
}
