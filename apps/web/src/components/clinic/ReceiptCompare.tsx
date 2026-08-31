'use client';

/**
 * The receipt — the same appointment, priced twice, in interactions.
 *
 * Both numbers are frozen at the instant their booking was confirmed and both were produced by
 * `lib/drop/interaction-counter.ts` from real input under `lib/drop/COUNTING.md`. There is no code
 * path in this file, or in the counter, that assigns either number a literal. If a lane has not been
 * run, its column says so instead of showing a number we did not measure — a blank is honest and a
 * placeholder is not.
 *
 * The two columns are scoped differently and the page says so under each one, because the
 * difference is the whole argument: by hand counts everything you did in the booking area from the
 * moment you arrived; with an agent counts everything you did from the moment the hold appeared.
 */
import { describeCount, type InteractionBreakdown } from '../../lib/drop/interaction-counter.ts';
import { describeSlotsLost } from '../../lib/drop/manual-flow.ts';

export interface LaneReceipt {
  slotLabel: string;
  count: number;
  breakdown: InteractionBreakdown;
  slotsLost: number;
}

function Breakdown({ b }: { b: InteractionBreakdown }) {
  const rows: [string, string, number][] = [
    ['press', 'presses', b.clicks],
    ['key', 'keys', b.keys],
    ['scroll', 'scrolls', b.scrolls],
    ['tab move', 'tab moves', b.tabs],
  ];
  return (
    <p className="cl-receipt__breakdown">
      {rows
        .filter(([, , n]) => n > 0)
        .map(([one, many, n]) => `${n} ${n === 1 ? one : many}`)
        .join(' · ') || 'nothing counted'}
    </p>
  );
}

export function ReceiptCompare({ hand, agent }: { hand: LaneReceipt | null; agent: LaneReceipt | null }) {
  return (
    <div className="cl-receipt" data-clinic-receipt={`${hand?.count ?? '-'}:${agent?.count ?? '-'}`}>
      <div className="cl-receipt__col" data-lane="hand">
        <p className="cl-receipt__label">By hand</p>
        {hand === null ? (
          <>
            <span className="cl-receipt__empty" aria-hidden="true">
              —
            </span>
            <p className="cl-receipt__unit">Not measured yet.</p>
            <p className="cl-receipt__note">
              Book one appointment yourself and this fills in with what it cost you.
            </p>
          </>
        ) : (
          <>
            <span className="cl-receipt__n" data-clinic-count="hand">
              {hand.count}
            </span>
            <p className="cl-receipt__unit">{describeCount(hand.count)} to book {hand.slotLabel}.</p>
            <Breakdown b={hand.breakdown} />
            <p className="cl-receipt__note">
              Counted in the booking area from the moment you arrived until the appointment was
              confirmed. {describeSlotsLost(hand.slotsLost)}
            </p>
          </>
        )}
      </div>

      <div className="cl-receipt__col" data-lane="agent">
        <p className="cl-receipt__label">With your agent</p>
        {agent === null ? (
          <>
            <span className="cl-receipt__empty" aria-hidden="true">
              —
            </span>
            <p className="cl-receipt__unit">Not measured yet.</p>
            <p className="cl-receipt__note">
              Ask your agent to hold a time. When the dock arrives, this counts what you spend from
              then on.
            </p>
          </>
        ) : (
          <>
            <span className="cl-receipt__n" data-clinic-count="agent">
              {agent.count}
            </span>
            <p className="cl-receipt__unit">{describeCount(agent.count)} to book {agent.slotLabel}.</p>
            <Breakdown b={agent.breakdown} />
            <p className="cl-receipt__note">
              Counted in the dock from the moment the hold arrived until the appointment was
              confirmed. Your agent found and held the slot; it could not press the key.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
