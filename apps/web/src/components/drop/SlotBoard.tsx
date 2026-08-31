'use client';

/**
 * The drop board: one wave of appointment slots, and the one place the page speaks.
 *
 * A drop wave is a race. Eight to twelve slots appear at once, a scripted rival takes some of them
 * within seconds, and the human has to see which one is still theirs. The board is therefore built
 * for a reader at video distance: a rule-topped header with an honestly counted tally, then a grid
 * of plates whose left rails form a wall of state you can read before you read any text.
 *
 * Sighted readers get the rail wall. Everyone else gets the same information through one polite
 * live region, fed by the throttled queue in lib/drop/board-announce.ts — at most one line per
 * interval, newest lines kept, so a burst of six flips never turns into six seconds of speech.
 *
 * Pure props in, callbacks out. No driver, no tool contract, no timers beyond the announcer poll —
 * whatever Arav locks maps INTO the `Slot` shape and this board renders it unchanged.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BoardAnnouncer,
  DEFAULT_ANNOUNCE_INTERVAL_MS,
  diffAnnouncements,
} from '@/lib/drop/board-announce';
import type { Slot, SlotState } from '@/lib/drop/types';
import { SlotCard } from './SlotCard';
import './drop-tokens.css';

export interface SlotBoardProps {
  slots: readonly Slot[];
  /**
   * Rendered inside whichever card is `held_by_you` — T2's TtlBar goes here. Passed down rather
   * than imported so this board has no dependency on another agent's component.
   */
  ttlSlot?: ReactNode;
  /** Header eyebrow. Says what wave this is; the tally beside it says how it is going. */
  waveLabel?: string;
  /** How the demo names its scripted opponent, shown verbatim on every taken card. */
  rivalLabel?: string;
  /** Offered on open slots only. Omit for a display-only board. */
  onHold?: (slot: Slot) => void;
  /** Turn the live region off — for a board rendered inside another announcing surface. */
  announce?: boolean;
  /** Minimum gap between spoken lines. */
  announceIntervalMs?: number;
  /** Shown when the wave is empty. An empty board is an invitation, not an apology. */
  emptyMessage?: string;
  className?: string;
}

const GONE: ReadonlySet<SlotState> = new Set<SlotState>(['taken_by_rival', 'expired_hold']);
const YOURS: ReadonlySet<SlotState> = new Set<SlotState>(['held_by_you', 'booked_yours']);

export function SlotBoard({
  slots,
  ttlSlot,
  waveLabel = 'Drop wave',
  rivalLabel = 'simulated rival',
  onHold,
  announce = true,
  announceIntervalMs = DEFAULT_ANNOUNCE_INTERVAL_MS,
  emptyMessage = 'No slots in this wave yet. The next one lands here.',
  className = '',
}: SlotBoardProps) {
  const tally = useMemo(() => countSlots(slots), [slots]);
  const live = useBoardAnnouncements(slots, announce, announceIntervalMs);

  return (
    <section
      className={`drop-board ${className}`.trim()}
      data-drop-board
      aria-label={`${waveLabel} — ${slots.length} slots`}
    >
      <header className="drop-board__head">
        <h2 className="drop-board__wave">
          {waveLabel} · {slots.length} slots
        </h2>
        {/* Every number here is counted from the slots prop on this render. Nothing is scripted. */}
        <p className="drop-board__tally" data-drop-tally>
          <span data-tally="open">
            <b>{tally.open}</b> open
          </span>
          <span data-tally="yours">
            <b>{tally.yours}</b> yours
          </span>
          <span data-tally="gone">
            <b>{tally.gone}</b> gone
          </span>
        </p>
      </header>

      {slots.length === 0 ? (
        <p className="drop-board__empty" data-drop-empty>
          {emptyMessage}
        </p>
      ) : (
        <ul className="drop-board__grid" data-drop-grid>
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              ttlSlot={slot.state === 'held_by_you' ? ttlSlot : undefined}
              rivalLabel={rivalLabel}
              onHold={onHold}
            />
          ))}
        </ul>
      )}

      {/* Exactly one live region for the whole board. aria-atomic so a partial line is never read. */}
      <p className="drop-sr" role="status" aria-live="polite" aria-atomic="true" data-drop-live>
        {live}
      </p>
    </section>
  );
}

export interface SlotTally {
  open: number;
  yours: number;
  gone: number;
  heldByOther: number;
}

/** The header's scoreboard, counted rather than asserted. Exported so a caller can show it too. */
export function countSlots(slots: readonly Slot[]): SlotTally {
  const t: SlotTally = { open: 0, yours: 0, gone: 0, heldByOther: 0 };
  for (const s of slots) {
    if (s.state === 'open') t.open += 1;
    else if (YOURS.has(s.state)) t.yours += 1;
    else if (GONE.has(s.state)) t.gone += 1;
    else t.heldByOther += 1;
  }
  return t;
}

/**
 * Diffs each `slots` change into sentences, queues them, and returns the line the live region
 * should be showing. The queue is the throttle; this hook is only the clock and the plumbing.
 */
function useBoardAnnouncements(
  slots: readonly Slot[],
  enabled: boolean,
  intervalMs: number,
): string {
  const [line, setLine] = useState('');
  const previous = useRef<readonly Slot[]>([]);
  const announcer = useRef<BoardAnnouncer | null>(null);

  if (announcer.current === null || announcer.current.intervalMs !== intervalMs) {
    announcer.current = new BoardAnnouncer({ intervalMs });
  }

  // Queue on every change to the slots prop, including the very first (a board that mounts with a
  // taken slot should still say so once).
  useEffect(() => {
    if (!enabled) {
      previous.current = slots;
      return;
    }
    const a = announcer.current;
    if (!a) return;
    a.pushAll(diffAnnouncements(previous.current, slots));
    previous.current = slots;
    setLine(a.read(Date.now()));
  }, [slots, enabled]);

  // Drain the queue on a timer, one line per interval. Only runs while something is waiting.
  useEffect(() => {
    if (!enabled) return;
    const a = announcer.current;
    if (!a) return;
    const id = window.setInterval(() => {
      const next = a.read(Date.now());
      setLine((current) => (current === next ? current : next));
      if (a.pending === 0) window.clearInterval(id);
    }, Math.max(50, Math.floor(intervalMs / 3)));
    return () => window.clearInterval(id);
  }, [slots, enabled, intervalMs]);

  return enabled ? line : '';
}
