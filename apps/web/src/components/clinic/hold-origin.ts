/**
 * Who took this hold — the "an agent is here" affordance (SPEC-V1 §5, brief item 5).
 *
 * A hold arrives at the page as a `hold_started` event and the event does not say who asked for it.
 * It is the same event whether a human clicked a row or a WebMCP tool called `clinic_hold_slot`,
 * because the driver seam deliberately has one verb. But the two cases have to READ differently on
 * screen: if your agent did it, the page owes you a sentence saying so, and the dock's whole
 * argument ("it held the slot, it cannot press the key") only lands when the page names the actor.
 *
 * So the page records the instant a local control asked for a hold, and this module decides: a hold
 * that starts without a recent local request came from somewhere else — the agent.
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
 * The line the board strip and the dock eyebrow both carry — the sentence the brief asks for,
 * verbatim: "Held by your agent — 0:41 · one keypress books it".
 */
export function holdHeadline(origin: HoldOrigin, secondsLeft: number): string {
  const clock = formatClock(secondsLeft);
  const who = origin === 'agent' ? 'Held by your agent' : 'Held for you';
  return `${who} — ${clock} · one keypress books it`;
}

/** The gutter word beside the held row. Short enough for the label column at 390px. */
export function holdGutterLabel(origin: HoldOrigin): string {
  return origin === 'agent' ? 'Held — your agent' : 'Held — yours';
}

/**
 * What the strip above the board says when an agent hold is live. Announced once (politely), not
 * per tick, so the seconds are deliberately absent from this sentence.
 */
export function agentArrivalAnnouncement(origin: HoldOrigin, timeLabel: string): string | null {
  if (origin !== 'agent') return null;
  return `Your agent holds ${timeLabel}. Press Enter to book it — your agent cannot.`;
}
