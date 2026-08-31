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
 * Colour carries exactly one meaning: cedar is yours. A slot the rival took is not red — it is
 * grey and struck through and labelled `Simulated rival`, because a loss is an absence. That leaves
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
import { RIVAL_LABEL } from '../../lib/drop/mock-driver.ts';
import { fractionLeft } from '../../lib/drop/time.ts';
import type { Slot, SlotState } from '../../lib/drop/types.ts';
import { holdGutterLabel, type HoldOrigin } from './hold-origin.ts';

const STATE_WORD: Record<SlotState, string> = {
  open: 'Open',
  held_by_you: 'Held — yours',
  held_by_other: 'Held by someone else',
  taken_by_rival: 'Taken',
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
        No appointments on the board yet. The next release lands on the clock above — nothing here is
        held back for you, and nothing is reserved before it is shown.
      </p>
    );
  }

  return (
    <>
      <ul className="cl-sheet" data-clinic-sheet={slots.length}>
        {slots.map((slot) => {
          const held = slot.id === heldSlotId && slot.state === 'held_by_you';
          const stateWord = held ? holdGutterLabel(holdOrigin) : STATE_WORD[slot.state];
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
              {slot.state === 'open' ? (
                <span className="cl-row__action" aria-hidden="true">
                  Book →
                </span>
              ) : slot.state === 'taken_by_rival' ? (
                <span className="cl-row__tag">{RIVAL_LABEL}</span>
              ) : slot.state === 'expired_hold' ? (
                <span className="cl-row__tag">Hold ran out</span>
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
