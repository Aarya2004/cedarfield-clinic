'use client';

/**
 * The appointment sheet — the board, rebuilt as a schedule rather than a grid of cards.
 *
 * Appointments are ordered in time, so the sheet is a column and time is the axis. Each row keeps
 * the site's one grid: a gutter that says WHOSE this is, the appointment time set at display size
 * with tabular figures, the clinician, and the act available to you. A row you can book is a
 * button; a row that is gone is the same box with the button taken away, so nothing reflows when
 * the rival takes one out from under you.
 *
 * Colour carries exactly one meaning: cedar is yours. A time someone else booked is not red — it is
 * grey, struck through and reads `No longer available`, because a loss is an absence. That leaves
 * your held row as the only coloured object on the page, and it is the row that swells: its time
 * doubles in size and the hairline beneath the numeral retracts as the hold burns. That rule IS the
 * TTL bar (see clinic.css) — the countdown is set in type, not drawn beside it.
 *
 * Announcements come from `lib/drop/board-announce.ts` unchanged: one polite live region, throttled
 * to a line every ~900 ms, newest lines kept when a wave outruns it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardAnnouncer, diffAnnouncements, waveAnnouncement } from '../../lib/drop/board-announce.ts';
import { isBookable } from '../../lib/drop/manual-flow.ts';
import { fractionLeft } from '../../lib/drop/time.ts';
import type { Slot, SlotState } from '../../lib/drop/types.ts';
import { assistantTag, type HoldOrigin } from './hold-origin.ts';

/** How a clinic names the state of a time on its own schedule. The gutter is the whole label. */
const STATE_WORD: Record<SlotState, string> = {
  open: 'Available',
  held_by_you: 'Held for you',
  held_by_other: 'On hold',
  taken_by_rival: 'Taken',
  taken_by_other: 'Taken',
  booked_yours: 'Booked — yours',
  expired_hold: 'Lapsed',
};

export interface SlotSheetProps {
  slots: readonly Slot[];
  /** Clicking a row opens the booking flow for it — the page is simply a bookable clinic. */
  onOpen: (slotId: string) => void;
  heldSlotId: string | null;
  holdOrigin: HoldOrigin;
  holdSecondsLeft: number;
  holdTtlSeconds: number;
  /** The session clock, for the announcer's throttle. */
  now: number;
}

export function SlotSheet({
  slots,
  onOpen,
  heldSlotId,
  holdOrigin,
  holdSecondsLeft,
  holdTtlSeconds,
  now,
}: SlotSheetProps) {
  const announcer = useMemo(() => new BoardAnnouncer(), []);
  const prevSlots = useRef<readonly Slot[]>([]);
  const [line, setLine] = useState('');

  useEffect(() => {
    const before = prevSlots.current;
    prevSlots.current = slots;
    if (before.length === 0 && slots.length > 0) announcer.push(waveAnnouncement(slots));
    else announcer.pushAll(diffAnnouncements(before, slots));
    setLine(announcer.read(now));
  }, [slots, now, announcer]);

  if (slots.length === 0) {
    return (
      <p className="cl-note" data-clinic-sheet="empty">
        No appointments available right now. Cancellations are released to this page as they come
        in — the next release is on the clock above.
      </p>
    );
  }

  return (
    <>
      <ul className="cl-sheet" data-clinic-sheet={slots.length}>
        {slots.map((slot) => {
          const held = slot.id === heldSlotId && slot.state === 'held_by_you';
          const stateWord = STATE_WORD[slot.state];
          const via = held ? assistantTag(holdOrigin) : null;
          const body = (
            <>
              <span className="cl-row__state">{stateWord}</span>
              <span className="cl-row__main">
                <span className="cl-row__time">
                  {slot.timeLabel}
                  <span className="cl-row__strike" aria-hidden="true" />
                </span>
                <span className="cl-row__who">
                  {slot.clinician} · {slot.kind}
                </span>
                {held ? (
                  <span
                    className="cl-ttl__track"
                    aria-hidden="true"
                    data-clinic-row-ttl={fractionLeft(holdTtlSeconds, holdSecondsLeft).toFixed(3)}
                  >
                    <span
                      className="cl-ttl"
                      style={{ ['--cl-fraction' as string]: fractionLeft(holdTtlSeconds, holdSecondsLeft) }}
                    />
                  </span>
                ) : null}
              </span>
              {via !== null ? (
                <span className="cl-row__tag cl-row__tag--via" data-clinic-hold-origin="agent">
                  {via}
                </span>
              ) : slot.state === 'open' ? (
                <span className="cl-row__action" aria-hidden="true">
                  Book →
                </span>
              ) : slot.state === 'taken_by_rival' ? (
                <span className="cl-row__tag">No longer available</span>
              ) : slot.state === 'taken_by_other' ? (
                <span className="cl-row__tag">Booked by another patient</span>
              ) : slot.state === 'expired_hold' ? (
                <span className="cl-row__tag">Hold expired</span>
              ) : null}
              {slot.state !== 'open' && ((slot.waiting ?? 0) > 0 || slot.yourPosition) ? (
                <span className="cl-row__tag" data-clinic-waiting={slot.waiting ?? 0} data-clinic-position={slot.yourPosition ?? undefined}>
                  {slot.yourPosition ? `You're #${slot.yourPosition} in line` : `${slot.waiting} waiting`}
                </span>
              ) : null}
            </>
          );

          return (
            <li key={slot.id} className="cl-row" data-slot-state={slot.state} data-clinic-slot={slot.id}>
              {isBookable(slot) ? (
                <button
                  type="button"
                  className="cl-row__inner"
                  data-clinic-action="open-slot"
                  onClick={() => onOpen(slot.id)}
                >
                  <span className="cl-sr">
                    Book {slot.timeLabel} with {slot.clinician}, {slot.kind}.
                  </span>
                  {body}
                </button>
              ) : (
                <div className="cl-row__inner">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="cl-sr" role="status" aria-live="polite" data-clinic-board-live>
        {line}
      </p>
    </>
  );
}
