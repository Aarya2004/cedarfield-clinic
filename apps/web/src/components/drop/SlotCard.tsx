'use client';

/**
 * One slot plate.
 *
 * The card is the demo's emotional unit: a wall of these is what the judge sees, and one of them
 * changing colour is the whole lost-race beat. So the hierarchy is deliberate — a state rail down
 * the left edge you can read across a room, then the time in tabular mono at display size, then the
 * clinician, then a status word that names the state in plain language.
 *
 * State never depends on one signal. Every card carries `data-slot-state` for tests and drivers,
 * a coloured rail, a status word, and — for the ended states — a strike through the time. Colour is
 * the fourth signal, not the first, which is why this reads under colour-vision deficiency and in a
 * compressed video.
 *
 * This component owns no state machine: `slot.state` is the truth and the parent supplies it. The
 * only local state is whether the claim animation is currently playing.
 *
 * The TTL bar is T2's component and is deliberately NOT imported here — pass it as `ttlSlot` and it
 * lands in the held card's own row.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Slot, SlotState } from '@/lib/drop/types';
import './drop-tokens.css';

/** The word on the plate. Plain language, present tense, the same vocabulary as the live region. */
const STATUS_WORD: Record<SlotState, string> = {
  open: 'Open',
  held_by_you: 'Held — yours',
  held_by_other: 'Held',
  taken_by_rival: 'Taken',
  taken_by_other: 'Taken',
  booked_yours: 'Booked — yours',
  expired_hold: 'Hold expired',
};

/** Read out by assistive tech in place of the visual rail + strike + colour. */
const STATE_LABEL: Record<SlotState, string> = {
  open: 'open',
  held_by_you: 'held by you',
  held_by_other: 'held by someone else',
  taken_by_rival: 'taken',
  taken_by_other: 'taken',
  booked_yours: 'booked, yours',
  expired_hold: 'hold expired',
};

/** States whose arrival gets the one-time claim beat. */
const CLAIMED_STATES: ReadonlySet<SlotState> = new Set<SlotState>(['taken_by_rival', 'taken_by_other', 'expired_hold']);

export interface SlotCardProps {
  slot: Slot;
  /**
   * Rendered inside the card while it is `held_by_you` — this is where T2's TtlBar sits.
   * Passed in rather than imported so the card stays transplantable and independently testable.
   */
  ttlSlot?: ReactNode;
  /**
   * How the demo names its scripted opponent. Shown verbatim on a taken card so nobody watching
   * can mistake the rival for a real person racing us.
   */
  rivalLabel?: string;
  /** Offered only on an open slot. When absent the card is pure display. */
  onHold?: (slot: Slot) => void;
  /** Label for that action. Keep the verb identical wherever the flow repeats it. */
  holdLabel?: string;
}

export function SlotCard({
  slot,
  ttlSlot,
  rivalLabel = 'simulated rival',
  onHold,
  holdLabel = 'Hold',
}: SlotCardProps) {
  const claiming = useClaimBeat(slot.state);
  const canHold = slot.state === 'open' && typeof onHold === 'function';

  return (
    <li
      className={`drop-card${claiming ? ' is-claiming' : ''}`}
      data-slot-id={slot.id}
      data-slot-state={slot.state}
      data-drop-card
    >
      <span className="drop-card__kind">{slot.kind}</span>

      <span className="drop-card__time">
        {slot.timeLabel}
        {/* The bar that sweeps through the time when the slot is lost. Decoration only — the
            state is already in data-slot-state and in the status word below. */}
        <span className="drop-card__strike" aria-hidden="true" />
      </span>

      <span className="drop-card__who">{slot.clinician}</span>

      {slot.state === 'held_by_you' && ttlSlot ? (
        <div className="drop-card__ttl" data-slot-ttl>
          {ttlSlot}
        </div>
      ) : null}

      <div className="drop-card__foot">
        <span className="drop-card__status" data-slot-status>
          {STATUS_WORD[slot.state]}
        </span>

        {slot.state === 'taken_by_rival' ? (
          <span
            className="drop-card__chip"
            data-slot-rival
            title="A scripted opponent in this demo, not a real person."
          >
            {rivalLabel}
          </span>
        ) : null}

        {slot.state === 'held_by_other' ? (
          <span className="drop-card__chip" data-slot-holder>
            someone else
          </span>
        ) : null}

        {canHold ? (
          <button
            type="button"
            className="drop-card__action"
            data-slot-action="hold"
            onClick={() => onHold?.(slot)}
          >
            {holdLabel}
          </button>
        ) : null}
      </div>

      {/* One sentence covering everything the rail, the strike and the colour say visually. */}
      <span className="drop-sr">
        {`${slot.timeLabel}, ${slot.clinician}, ${slot.kind} — ${STATE_LABEL[slot.state]}`}
      </span>
    </li>
  );
}

/**
 * True for one animation's length after the slot lands in an ended state.
 *
 * Deliberately does not fire on mount: a board that renders with three already-taken slots should
 * show them settled, not replay three losses. Reduced motion skips the beat entirely — the settled
 * card is identical either way, so nothing is lost.
 */
function useClaimBeat(state: SlotState): boolean {
  const [claiming, setClaiming] = useState(false);
  const previous = useRef<SlotState | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === null || before === state) return; // first paint, or no change
    if (!CLAIMED_STATES.has(state)) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    setClaiming(true);
    const t = window.setTimeout(() => setClaiming(false), 500);
    return () => window.clearTimeout(t);
  }, [state]);

  return claiming;
}
