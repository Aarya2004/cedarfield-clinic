'use client';

/**
 * The appointment list — one white card per released time, in time order.
 *
 * Each card is a row: the time, the clinician and the kind of appointment under it, and the act
 * available to you on the right. A row you can book is a card with a Book button; a row that has
 * gone is the same card with the button replaced by a line of text, so nothing on the page reflows
 * when a time is taken while you are reading.
 *
 * Colour carries one meaning: the practice blue is an action, or the appointment that is yours. A
 * time somebody else booked is grey and says `No longer available` — a loss is an absence, not a
 * warning. The one card that is yours takes a 2px blue border, a pale blue fill, the words
 * `Held for you · 0:41`, and a progress bar that drains as the hold burns. `--cl-fraction` is
 * written per frame from `fractionLeft()`; never put a CSS transition on it or the bar lags the
 * number beside it.
 *
 * Announcements come from `lib/drop/board-announce.ts` unchanged: one polite live region, throttled
 * to a line every ~900 ms, newest lines kept when a release outruns it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardAnnouncer, diffAnnouncements, waveAnnouncement } from '../../lib/drop/board-announce.ts';
import { isBookable } from '../../lib/drop/manual-flow.ts';
import { formatClock, fractionLeft } from '../../lib/drop/time.ts';
import type { Slot, SlotState } from '../../lib/drop/types.ts';
import { assistantTag, type HoldOrigin } from './hold-origin.ts';

/** How the practice names the state of a time on its own list, for the states that need saying. */
const STATE_WORD: Record<SlotState, string> = {
  open: 'Available',
  held_by_you: 'Held for you',
  held_by_other: 'Being booked by someone else',
  taken_by_rival: 'No longer available · simulated demand',
  taken_by_other: 'Booked by another patient',
  booked_yours: 'Booked — yours',
  expired_hold: 'Hold expired',
};

export interface SlotSheetProps {
  slots: readonly Slot[];
  /** Choosing a row opens the booking flow for it — the page is simply a bookable clinic. */
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
          const via = held ? assistantTag(holdOrigin) : null;
          const gone = slot.state === 'taken_by_rival' || slot.state === 'taken_by_other' || slot.state === 'expired_hold';
          const body = (
            <>
              <span className="cl-row__main">
                <span className="cl-row__time">{slot.timeLabel}</span>
                <span className="cl-row__who">
                  {slot.clinician} · {slot.kind}
                </span>
                {held ? (
                  <>
                    <span className="cl-row__hold">
                      Held for you · {formatClock(holdSecondsLeft)}
                      {via === null ? null : (
                        <span className="cl-row__via" data-clinic-hold-origin="agent">
                          {' '}· {via}
                        </span>
                      )}
                    </span>
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
                  </>
                ) : null}
              </span>

              {slot.state === 'open' ? (
                <span className="cl-row__action" aria-hidden="true">
                  Book
                </span>
              ) : held ? null : (
                <span className="cl-row__tag" data-slot-word={slot.state}>
                  {STATE_WORD[slot.state]}
                </span>
              )}
              {slot.state !== 'open' && ((slot.waiting ?? 0) > 0 || slot.yourPosition) ? (
                <span
                  className="cl-row__tag cl-row__tag--queue"
                  data-clinic-waiting={slot.waiting ?? 0}
                  data-clinic-position={slot.yourPosition ?? undefined}
                >
                  {slot.yourPosition ? `You're #${slot.yourPosition} in line` : `${slot.waiting} waiting`}
                </span>
              ) : null}
            </>
          );

          return (
            <li key={slot.id} className={`cl-row${gone ? ' cl-row--gone' : ''}`} data-slot-state={slot.state} data-clinic-slot={slot.id}>
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
                  {/* The visible body is presentation: the sentence above IS the accessible name,
                      short and unique per row, so "Click Book nine twenty" resolves (SPEC-V10). */}
                  <span aria-hidden="true">{body}</span>
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
