'use client';

/**
 * useDropSession — THE ADAPTER SEAM (T8).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  THIS IS WHERE ARAV'S REAL CONTRACT PLUGS IN.
 *
 *  Everything below folds a stream of `DropEvent`s (lib/drop/types.ts) into the board state the
 *  components render. It is typed against the `DropDriver` interface and imports no concrete
 *  driver — the playground hands it `createMockDriver(...)` tonight; post-lock, someone writes a
 *  second `DropDriver` that maps the real tool/DO messages into `DropEvent`s and passes that here
 *  instead. Not one component below this hook changes. If wiring the mock through this seam was
 *  clean, wiring the real thing is the same work.
 *
 *  The one simulation-only concession is `clock`. A simulated driver has to be *driven* (its clock
 *  only moves when someone advances it), so this hook pumps it from rAF and counts the same
 *  milliseconds into `now`. A real driver has no `clock`: events arrive from the network carrying
 *  epoch `at`, and `now` becomes `Date.now()`. Either way `now` and `event.at` are the same clock,
 *  which is the only thing the fractional TTL arithmetic below depends on. Pass `clock: null` and
 *  this hook is already the production adapter.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useState } from 'react';
import type { DropDriver, DropEvent, Slot, SlotState } from '../../lib/drop/types.ts';

/** The hold this session believes it has, rebuilt from events alone — never read off the driver. */
export interface HeldSlot {
  slotId: string;
  ttlSeconds: number;
  /** `at` of the `hold_started` event, in the session clock's units. */
  startedAt: number;
}

interface Fold {
  slots: Slot[];
  held: HeldSlot | null;
  log: DropEvent[];
}

export interface DropSession {
  /** The session clock, in the same units as every `event.at`. */
  now: number;
  slots: Slot[];
  held: HeldSlot | null;
  /** Fractional seconds left on the hold, derived from `hold_started` + `now`. 0 when nothing held. */
  secondsLeft: number;
  /** Every event this session has seen, oldest first. The trace strip draws exactly this. */
  log: DropEvent[];
  hold: (slotId: string) => void;
  confirm: (slotId: string) => void;
  release: (slotId: string) => void;
}

/** What a *simulated* driver needs to be handed to move at all. A real one has no such thing. */
export interface SimulatedClock {
  advance(ms: number): void;
}

export interface DropSessionOptions {
  /** While false the clock stands still: no rival takes, no TTL burn. The pause button. */
  running: boolean;
  /** The simulated driver's clock, or null/undefined against a real backend (then `now` is epoch). */
  clock?: SimulatedClock | null;
}

function emptyFold(): Fold {
  return { slots: [], held: null, log: [] };
}

function withState(slots: readonly Slot[], slotId: string, state: SlotState): Slot[] {
  return slots.map((slot) => (slot.id === slotId ? { ...slot, state } : slot));
}

/**
 * Pure: one event, folded in. The whole board is a function of the event stream — there is no
 * second source of truth to drift from, which is what makes the swap to a real driver a swap and
 * not a rewrite.
 */
function fold(state: Fold, event: DropEvent): Fold {
  const log = [...state.log, event];

  switch (event.type) {
    case 'drop_wave': {
      // A wave is a full resync (the mock also uses it to hand back a released slot). Keep the hold
      // only if the board that just arrived still agrees we have it.
      const slots = event.slots.map((slot) => ({ ...slot }));
      const stillHeld =
        state.held !== null &&
        slots.some((slot) => slot.id === state.held?.slotId && slot.state === 'held_by_you');
      return { slots, held: stillHeld ? state.held : null, log };
    }

    case 'slot_taken':
      return { ...state, slots: withState(state.slots, event.slotId, 'taken_by_rival'), log };

    case 'hold_started':
      return {
        slots: withState(state.slots, event.slotId, 'held_by_you'),
        held: { slotId: event.slotId, ttlSeconds: event.ttlSeconds, startedAt: event.at },
        log,
      };

    // The heartbeat. The countdown on screen is computed from `hold_started` + `now` so it stays
    // smooth at frame rate; the tick is kept in the log because it is the contract's own pulse and
    // the trace strip draws it.
    case 'hold_tick':
      return { ...state, log };

    case 'hold_expired':
      return { slots: withState(state.slots, event.slotId, 'expired_hold'), held: null, log };

    case 'booked':
      return { slots: withState(state.slots, event.slotId, 'booked_yours'), held: null, log };

    default:
      return state;
  }
}

export function useDropSession(driver: DropDriver, options: DropSessionOptions): DropSession {
  const { running, clock = null } = options;

  const [state, setState] = useState<Fold>(emptyFold);
  const [now, setNow] = useState<number>(() => (clock ? 0 : Date.now()));
  const [activeDriver, setActiveDriver] = useState<DropDriver>(driver);

  // A new driver is a new race, and the old board has to be gone in THIS render, not one render
  // later. Clearing it in an effect leaves a frame in which the parent still sees the previous
  // run's result — which is exactly how a freshly reset agent lane froze its receipt at zero,
  // reading the manual lane's booking as its own. Caught by driving the page; the unit-level
  // behaviour was correct either way.
  if (activeDriver !== driver) {
    setActiveDriver(driver);
    setState(emptyFold());
    setNow(clock ? 0 : Date.now());
  }

  // One subscription per driver. `subscribe` replays the current board if the wave already landed.
  useEffect(() => driver.subscribe((event) => setState((current) => fold(current, event))), [driver]);

  // The clock. Every frame: move the simulation forward by the real elapsed time, then publish the
  // same number as `now` so the TTL arithmetic and the driver's event timestamps cannot drift.
  useEffect(() => {
    if (!running) return;
    if (typeof requestAnimationFrame !== 'function') return;

    let handle = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = t - last;
      last = t;
      if (clock) {
        clock.advance(dt);
        setNow((current) => current + dt);
      } else {
        setNow(Date.now());
      }
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, [running, clock]);

  const { held } = state;
  const secondsLeft = held === null ? 0 : Math.max(0, held.ttlSeconds - (now - held.startedAt) / 1000);

  const hold = useCallback((slotId: string) => driver.hold(slotId), [driver]);
  const confirm = useCallback((slotId: string) => driver.confirm(slotId), [driver]);
  const release = useCallback((slotId: string) => driver.release(slotId), [driver]);

  return { now, slots: state.slots, held, secondsLeft, log: state.log, hold, confirm, release };
}

/**
 * ⚑ THE ONE PLACE THE CONTRACT DID NOT FIT A REAL SCREEN — flagged for the lock.
 *
 * A first-come booking site holds nothing for you: you fill the form and the slot is yours at
 * submit, or it is already gone. `DropDriver` has no verb for that. `confirm(slotId)` books a slot
 * you are ALREADY holding, and T7 deliberately ignores it otherwise ("calls that do not make sense
 * are ignored, not faked") — so `ManualBookingFlow` wired straight to the mock can never complete a
 * booking. It sits on "Sending your booking…" forever. Found by driving this page, not by any unit
 * test on either side, because both sides are individually correct.
 *
 * The stopgap below is take-then-book in one call, which is only safe because the mock driver is
 * synchronous. The real contract should settle it properly: either add `book(slotId)` beside
 * `confirm(heldSlotId)`, or let `confirm` accept an open slot and answer with `booked` or
 * `slot_taken`. Whichever it is, it needs to be ONE call — a round trip between take and book is a
 * race the user loses.
 */
export function firstComeDriver(driver: DropDriver): DropDriver {
  return {
    subscribe: (cb) => driver.subscribe(cb),
    hold: (slotId) => driver.hold(slotId),
    release: (slotId) => driver.release(slotId),
    confirm: (slotId) => {
      driver.hold(slotId);
      driver.confirm(slotId);
    },
  };
}

/** Convenience for the panes: the first slot still open, or undefined once the wave is picked over. */
export function firstOpenSlot(slots: readonly Slot[]): Slot | undefined {
  return slots.find((slot) => slot.state === 'open');
}
