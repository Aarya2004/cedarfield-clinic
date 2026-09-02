'use client';

/**
 * `/clinic/book` — booking at Cedarfield Clinic (SPEC-V3 §3).
 *
 * One page, one board, one clock. A visitor books entirely by hand — choose a time, give their
 * details, confirm — or their assistant reserves a time for them through the tools mounted below and
 * the confirm step arrives with it. Either way the appointment is made by a keypress the browser
 * marks as trusted, so nothing books an appointment on the visitor's behalf.
 *
 * ── WHAT IS REUSED VERBATIM (SPEC-V1 §4) ────────────────────────────────────────────────────────
 * The mock driver, the `useDropSession` fold, the manual-flow reducer, the interaction counter, the
 * confirm gate, the audio cues, the TTL arithmetic and the board announcer are all imported
 * unchanged from `lib/drop/` and `components/drop/useDropSession.ts`. Everything visual is new; the
 * bench's `DropBench` / `SlotBoard` / `ConfirmSurface` / `drop-bench.css` are not referenced.
 *
 * ── RELEASE STAGING ─────────────────────────────────────────────────────────────────────────────
 * The mock driver simulates one release per instance, so continuous releases are a driver per wave,
 * swapped on the period in `wave-clock.ts` and seeded from the wave index. The swap is DEFERRED
 * while anything is in play — a live hold, a half-filled form, a booking still on screen — because
 * a release replaces the board, and clearing a burning 45-second hold out from under a visitor to
 * satisfy a timer would be the page breaking its own promise.
 *
 * ── THE INSTRUMENTS ARE INVISIBLE (SPEC-V3 §1) ──────────────────────────────────────────────────
 * Two interaction counters still run — one scoped to the booking region from arrival, one born with
 * the confirm dock — and their totals are written to `data-clinic-counter`, `data-clinic-count-hand`
 * and `data-clinic-count-agent` on the measured region. Nothing about them is drawn: a patient
 * booking an appointment is not an experiment and the page must not read like one. Neither counter
 * can be written to; both only move when a trusted event arrives.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import {
  createCounter,
  emptyBreakdown,
  type CounterSnapshot,
  type InteractionCounter,
} from '../../lib/drop/interaction-counter.ts';
import {
  findSlot,
  initialManualFlowState,
  manualFlowReducer,
  type ManualFlowAction,
} from '../../lib/drop/manual-flow.ts';
import { createMockDriver } from '../../lib/drop/mock-driver.ts';
import { createSupabaseDriver, refusalSentence, type LiveDriver } from '../../lib/drop/supabase-driver.ts';
import { formatClock } from '../../lib/drop/time.ts';
import type { DropDriver, Slot } from '../../lib/drop/types.ts';
import { firstComeDriver, useDropSession } from '../drop/useDropSession.ts';
import { ClinicTools } from '../drop/ClinicTools.tsx';
import { GestureConfirm } from '../drop/GestureConfirm.tsx';
import { Band, Masthead, CLINIC_NAME } from './ClinicFrame.tsx';
import { AppointmentCard } from './AppointmentCard.tsx';
import { BookingSteps } from './BookingSteps.tsx';
import { ConfirmDock } from './ConfirmDock.tsx';
import { SlotSheet } from './SlotSheet.tsx';
import { agentArrivalAnnouncement, assistantTag, holdHeadline, holdOrigin, type HoldOrigin } from './hold-origin.ts';
import {
  HOLD_TTL_SECONDS,
  describeWaveAge,
  msIntoWave,
  msUntilNextWave,
  waveIndexAt,
  waveSeed,
} from './wave-clock.ts';
import './clinic-tokens.css';
import './clinic.css';

/**
 * Six appointments, three of which go over the first forty seconds — fast early and tapering, the
 * shape of a real release. Three are left standing for the rest of the release so a visitor who
 * arrives late still has something to book.
 */
const WAVE_OVERRIDES = {
  slotCount: 6,
  ttlSeconds: HOLD_TTL_SECONDS,
  rivalTakes: 3,
  firstTakeMs: 6_000,
  gapMs: 14_000,
  taper: 1.15,
  waveDelayMs: 0,
} as const;

/** How long a completed booking keeps the board from being cleared by the next release. */
const BOOKING_GRACE_MS = 25_000;

const NO_COUNT: CounterSnapshot = { total: 0, breakdown: emptyBreakdown() };

/**
 * T6's camera dwell, same flag as the bench. ON in the submitted build (opt-in at runtime); the SAME held
 * gesture that books also cancels and moves — one human act for every consequential verb, always
 * beside a keyboard alternative (WCAG 2.5.4). GestureConfirm degrades to 'unavailable' when the
 * script-provisioned weights are absent, so the flag alone can never break a page.
 */
const GESTURE_ENABLED = process.env.NEXT_PUBLIC_DROP_GESTURE === '1';

/** "9:00 AM" must never break across a line inside the dock's headline ("Move 8:40 AM → 9:00 | AM"). */
function noWrap(timeLabel: string): string {
  return timeLabel.replace(/ /g, '\u00A0');
}

/**
 * SPEC-V3: the shared live board. ON by default; two kill switches, both honest:
 *   · build-time: NEXT_PUBLIC_LIVE_BOARD=0 → every visitor gets the seeded in-page board;
 *   · per-URL:   ?test=1 → same, so the eval harness always drives a deterministic world.
 */
const LIVE_BUILD = process.env.NEXT_PUBLIC_LIVE_BOARD !== '0';
function isTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('test');
}
function wantsLiveBoard(): boolean {
  return LIVE_BUILD && typeof window !== 'undefined' && !isTestMode();
}

/** What the page runs on for the frame(s) before the live driver exists. Does nothing, honestly. */
const INERT_DRIVER: DropDriver & { snapshot(): { slots: Slot[]; hold: null } } = {
  subscribe: () => () => {},
  hold: () => {},
  book: () => {},
  confirm: () => {},
  release: () => {},
  cancel: () => {},
  move: () => {},
  snapshot: () => ({ slots: [], hold: null }),
};

/** How long a prepared cancel stays armed before the page quietly stands down. */
const PENDING_ACT_TTL_SECONDS = 45;

/** SPEC-V2 §3: what clinic_prepare_cancel / clinic_prepare_move arm. One at a time, human-fired. */
type PendingAct =
  | { kind: 'cancel'; slotId: string; timeLabel: string; detail: string; armedAt: number; by: HoldOrigin }
  | { kind: 'move'; fromId: string; toId: string; timeLabel: string; detail: string; armedAt: number; by: HoldOrigin };

export function ClinicBooking() {
  // ── the wave ───────────────────────────────────────────────────────────────────────────────────
  /**
   * The seeded board's clock origin. Real visitors: the epoch, so this page and the landing
   * countdown agree to the second and a fresh driver is advanced to where the wave already is
   * (wave-clock.ts's contract). Under ?test=1: page load, so every eval sees a wave land on
   * arrival with the rival exactly where the cases expect it.
   */
  const [clockOrigin] = useState<number>(() => (isTestMode() ? Date.now() : 0));
  // Hydration rule: the server's HTML and the client's first render must be identical, and any
  // text derived from the wall clock ("Released 12 s ago", the wave index) never is. So the first
  // render is the neutral one — elapsed 0, wave 0 — and the real clock takes over after mount.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [wave, setWave] = useState(0);
  // Decided once, on the client, before the first driver exists. SSR renders the seeded board and
  // the live driver takes over on hydration — the page is identical either way until data arrives.
  // Decided in an effect, never in the initial render: the server has no `window`, and a first
  // client render that disagrees with the server's HTML is a hydration error on every visit.
  const [wantLive, setWantLive] = useState<boolean>(false);
  useEffect(() => setWantLive(wantsLiveBoard()), []);
  // Fail toward a working product: if the live board has not produced a world within the grace
  // (network trouble, an outage, a corporate proxy eating websockets), the visitor silently gets
  // the seeded board — the same complete product, minus other people. Never a hung page.
  const [liveFailed, setLiveFailed] = useState(false);
  const live = wantLive && !liveFailed;
  // The live driver is born in an effect, not in render: React may mount, unmount and remount a
  // component (StrictMode does exactly that), and a driver disposed by the first unmount must not
  // survive as a corpse in a ref. Until it exists the page runs on an inert driver — no slots, the
  // "connecting" line — which is also what the server-rendered HTML shows.
  const [liveDriver, setLiveDriver] = useState<LiveDriver | null>(null);
  useEffect(() => {
    if (!live) return;
    const d = createSupabaseDriver();
    setLiveDriver(d);
    const giveUp = () => {
      // One line in the console for whoever debugs it; the page itself just keeps working.
      console.warn('[cedarfield] live board unavailable, using the seeded board:', d.meta().lastError);
      setLiveFailed(true);
    };
    // A definitive answer (sign-in refused, board switched off) falls back at once; only a slow
    // network gets the full grace.
    const probe = setInterval(() => {
      const m = d.meta();
      if (m.ready) return;
      if (m.offline || (m.lastError !== null && m.lastError.startsWith('sign_in:'))) giveUp();
    }, 250);
    const grace = setTimeout(() => {
      if (!d.meta().ready) giveUp();
    }, 6000);
    return () => {
      clearTimeout(grace);
      clearInterval(probe);
      d.dispose();
      setLiveDriver(null);
    };
  }, [live]);
  const mockDriver = useMemo(() => {
    if (live) return null;
    const d = createMockDriver({ seed: waveSeed(wave), scenario: 'hold-and-book', overrides: WAVE_OVERRIDES });
    // Arriving mid-wave: advance to where the wave already is, so the board matches the countdown.
    if (clockOrigin === 0) d.advance(msIntoWave(Date.now()));
    return d;
  }, [live, wave, clockOrigin]);
  const driver: DropDriver & { snapshot(): { slots: Slot[]; hold: { slotId: string } | null } } = live
    ? (liveDriver ?? INERT_DRIVER)
    : mockDriver!;
  // A real driver has no clock: events carry epoch `at` and `now` is Date.now() (useDropSession's
  // own contract). The simulated driver still doubles as the clock it always was.
  const session = useDropSession(driver, { running: true, clock: live ? null : (driver as ReturnType<typeof createMockDriver>) });

  /**
   * Elapsed page time. Read during render rather than held in state because the session already
   * re-renders this component every animation frame — a second rAF loop would buy nothing. It is
   * deliberately NOT `session.now`, which the seam resets to zero on every driver swap.
   */
  const elapsed = hydrated ? Date.now() - clockOrigin : 0;

  // ── the manual walk ────────────────────────────────────────────────────────────────────────────
  const [flow, dispatch] = useReducer(manualFlowReducer, [], initialManualFlowState);
  const [reviewAttempt, setReviewAttempt] = useState(0);
  useEffect(() => driver.subscribe((event) => dispatch({ type: 'driver_event', event })), [driver]);

  // ── the instruments ────────────────────────────────────────────────────────────────────────────
  const regionRef = useRef<HTMLDivElement | null>(null);
  const pageCounter = useRef<InteractionCounter | null>(null);
  const dockCounter = useRef<InteractionCounter | null>(null);
  const [tally, setTally] = useState<CounterSnapshot>(NO_COUNT);

  useEffect(() => {
    const root = regionRef.current;
    if (root === null) return;
    // Production settings: only events the browser marks isTrusted are counted, so nothing on this
    // page — including a tool holding a reference to it — can move the number.
    const counter = createCounter(root, { onChange: setTally });
    pageCounter.current = counter;
    return () => {
      counter.stop();
      pageCounter.current = null;
    };
  }, []);

  /** The dock's own counter is born with the dock, which is born with the hold. */
  const attachDock = useCallback((element: HTMLDivElement | null) => {
    dockCounter.current?.stop();
    dockCounter.current = element === null ? null : createCounter(element);
  }, []);

  // ── who is holding ─────────────────────────────────────────────────────────────────────────────
  const lastLocalRequest = useRef<number | null>(null);
  const heldSlotId = session.held?.slotId ?? null;
  const heldStartedAt = session.held?.startedAt ?? null;
  // Derived in render, on purpose: the dock decides whether to take focus in ITS mount effect,
  // which runs before this component's effects — an origin set in an effect would arrive one
  // render late and a cascade grant would steal focus under the previous origin (security review).
  const origin: HoldOrigin = session.held?.granted
    ? 'waitlist'
    : heldStartedAt === null
      ? 'you'
      : holdOrigin(heldStartedAt, lastLocalRequest.current);

  useEffect(() => {
    if (heldStartedAt === null || heldSlotId === null) return;
    // A hold that arrived while you were reading further down the page is invisible unless the page
    // shows you where it landed. Scrolling is not an interaction the counter sees, so this costs the
    // reader nothing on the receipt.
    const row = document.querySelector(`[data-clinic-slot="${heldSlotId}"]`);
    if (row === null) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    row.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  }, [heldStartedAt, heldSlotId]);

  // ── what each route cost, frozen at the booking and never drawn ────────────────────────────────
  // Both totals are real measurements from the counters above. They reach the outside world only as
  // data-* attributes on the measured region (SPEC-V3 §1) — nothing on screen reads them.
  const [handCount, setHandCount] = useState<number | null>(null);
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [lastBookedAt, setLastBookedAt] = useState<number | null>(null);

  /** Which booking the by-hand total is frozen for, so "book another" cannot refreeze the old one. */
  const frozenFor = useRef<string | null>(null);
  const bookedSlotId = flow.bookedSlotId;
  useEffect(() => {
    // Seeded ids repeat every wave (slot-1…6), so the key carries the wave as well.
    if (bookedSlotId === null) return;
    const key = `${wave}:${bookedSlotId}`;
    if (frozenFor.current === key) return;
    frozenFor.current = key;
    setHandCount((pageCounter.current?.snapshot() ?? NO_COUNT).total);
  }, [bookedSlotId, wave]);

  // ── SPEC-V2: the prepared act ─────────────────────────────────────────────────────────────────
  // clinic_prepare_cancel / clinic_prepare_move arm ONE pending act; a trusted press performs it.
  // A cancel arm carries its own clock; a move arm lives exactly as long as the hold it placed on
  // the target slot — hold gone, arm gone. Either way the agent armed it and only a person fires it.
  const [pendingAct, setPendingActState] = useState<PendingAct | null>(null);
  // P2-1: a gesture dwell (rAF) and a trusted keypress in the same frame both close over a stale
  // non-null pendingAct. The ref is the synchronous truth: whoever nulls it first performs the act,
  // the other call returns — so a real backend never sees a double cancel/move.
  const pendingActRef = useRef<PendingAct | null>(null);
  const setPendingAct = useCallback((next: PendingAct | null) => {
    pendingActRef.current = next;
    setPendingActState(next);
  }, []);

  // `by`: who armed it. The tools arm as 'agent' (the dock says "via your assistant"); the
  // appointment card's own Cancel/Move buttons arm as 'you' and the dock says nothing about it.
  const prepareCancel = useCallback(
    (slotId: string, by: HoldOrigin = 'agent'): boolean => {
      const slot = driver.snapshot().slots.find((s) => s.id === slotId);
      if (!slot || slot.state !== 'booked_yours') return false;
      const current = pendingActRef.current;
      // Re-arming the same cancel keeps the original clock: an agent cannot keep a destructive
      // dock alive indefinitely by re-calling every forty seconds.
      if (current?.kind === 'cancel' && current.slotId === slotId) return true;
      setPendingAct({ kind: 'cancel', slotId, timeLabel: noWrap(slot.timeLabel), detail: `${slot.clinician} · ${slot.kind}`, armedAt: Date.now(), by });
      return true;
    },
    [driver, setPendingAct],
  );

  const prepareMove = useCallback(
    (fromId: string, toId: string, by: HoldOrigin = 'agent'): boolean => {
      const slots = driver.snapshot().slots;
      const from = slots.find((s) => s.id === fromId);
      const to = slots.find((s) => s.id === toId);
      if (!from || from.state !== 'booked_yours') return false;
      if (!to || (to.state !== 'open' && to.state !== 'held_by_you') || fromId === toId) return false;
      // P1-2 defense in depth (the tool refuses first): never swap the dock out from under a live
      // hold on a different slot — that hold may have the person's finger over its book key.
      const held = driver.snapshot().hold;
      if (held !== null && held.slotId !== toId) return false;
      // Freeze the target while the person decides — hold is the agent's verb, so this is allowed.
      driver.hold(toId);
      setPendingAct({
        kind: 'move',
        fromId,
        toId,
        timeLabel: `${noWrap(from.timeLabel)} → ${noWrap(to.timeLabel)}`,
        detail: `${to.clinician} · ${to.kind}`,
        armedAt: Date.now(),
        by,
      });
      return true;
    },
    [driver, setPendingAct],
  );

  // A cancel arm expires on its own clock; the page re-renders every frame, so render-time math.
  const pendingSecondsLeft =
    pendingAct === null
      ? 0
      : pendingAct.kind === 'move'
        ? session.secondsLeft
        : Math.max(0, PENDING_ACT_TTL_SECONDS - (Date.now() - pendingAct.armedAt) / 1000);

  useEffect(() => {
    if (pendingAct === null) return;
    // A move arm dies with its target hold (expired, released, or absorbed by the move itself);
    // a cancel arm dies when its own clock runs out; both die when the slot stops being cancellable.
    if (pendingAct.kind === 'move' && session.held?.slotId !== pendingAct.toId) setPendingAct(null);
    else if (pendingAct.kind === 'cancel' && pendingSecondsLeft <= 0) setPendingAct(null);
    // A hold arriving AFTER a cancel was armed is a newer intent (the agent moved on to booking
    // something); the cancel arm stands down rather than hiding a burning hold behind its dock.
    else if (pendingAct.kind === 'cancel' && session.held !== null) setPendingAct(null);
    else {
      const anchor = pendingAct.kind === 'cancel' ? pendingAct.slotId : pendingAct.fromId;
      if (session.slots.find((s) => s.id === anchor)?.state !== 'booked_yours') setPendingAct(null);
    }
  }, [pendingAct, pendingSecondsLeft, session.held, session.slots, setPendingAct]);

  // A new wave is a new driver and a new board: nothing prepared against the old one survives.
  useEffect(() => setPendingAct(null), [driver, setPendingAct]);

  /** The trusted press. The ONLY call sites of driver.cancel / driver.move in the product. */
  const confirmPendingAct = useCallback(() => {
    const act = pendingActRef.current;
    if (act === null) return;
    pendingActRef.current = null; // claim it synchronously; a same-frame second caller sees null
    if (act.kind === 'cancel') {
      driver.cancel(act.slotId);
      // A manually-booked slot leaves the flow sitting on its "booked" card; cancelling that slot
      // must take the card with it, or the page would show a booking the board no longer has.
      if (flow.bookedSlotId === act.slotId) dispatch({ type: 'restart' });
    } else {
      driver.move(act.fromId, act.toId);
      // The move produced a booking; hold the board for the same grace a booking gets.
      setLastBookedAt(Date.now() - clockOrigin);
    }
    setPendingAct(null);
  }, [driver, flow.bookedSlotId, setPendingAct, clockOrigin]);

  const dismissPendingAct = useCallback(() => {
    if (pendingAct?.kind === 'move' && session.held?.slotId === pendingAct.toId) {
      session.release(pendingAct.toId); // give the frozen target back
    }
    setPendingAct(null);
  }, [pendingAct, session, setPendingAct]);

  // ── acts ───────────────────────────────────────────────────────────────────────────────────────

  /**
   * A first-come booking site holds nothing for you: the appointment is yours at submit or it is
   * already gone. `DropDriver` has no verb for that, so the take-and-book stopgap from the seam is
   * used here too — and this is the same gap T8 flagged for the real contract (it needs ONE call).
   */
  const manualDriver: DropDriver = useMemo(() => firstComeDriver(driver), [driver]);

  const bookByHand = useCallback(() => {
    if (flow.selectedSlotId === null) return;
    // Claim the hold that `firstComeDriver` is about to take, so the dock (if the take-and-book ever
    // stops being one synchronous tick) does not tell you your own click was your agent. The mock
    // answers inside this call, so the claim is released immediately after; against an async backend
    // the claim would stand and `LOCAL_REQUEST_WINDOW_MS` would close it.
    lastLocalRequest.current = session.now;
    dispatch({ type: 'submit_booking' });
    manualDriver.confirm(flow.selectedSlotId);
    // The seeded driver answers inside this call, so the claim can close at once. The live driver
    // answers over the network: the claim must STAND so the hold that lands a moment later reads
    // as yours, not your agent's (LOCAL_REQUEST_WINDOW_MS closes it).
    if (!live) lastLocalRequest.current = null;
    setLastBookedAt(Date.now() - clockOrigin);
  }, [flow.selectedSlotId, manualDriver, session.now, live, clockOrigin]);

  /** The press happened; the booking has not yet. The measurement waits for the `booked` event. */
  const pendingAgentCount = useRef<{ slotId: string; count: number } | null>(null);
  const confirmHold = useCallback(() => {
    const slotId = session.held?.slotId;
    if (slotId === undefined) return;
    // Frozen before the dock unmounts, so the number cannot drift after the booking it belongs to —
    // but only WRITTEN when the driver confirms the booking, so a refused press (hold expired at
    // the boundary, on the live board) never records a measurement for an appointment nobody has.
    pendingAgentCount.current = { slotId, count: (dockCounter.current?.snapshot() ?? NO_COUNT).total };
    session.confirm(slotId);
  }, [session]);
  useEffect(
    () =>
      driver.subscribe((event) => {
        const pending = pendingAgentCount.current;
        if (event.type === 'booked' && pending && event.slotId === pending.slotId) {
          pendingAgentCount.current = null;
          setAgentCount(pending.count);
          setLastBookedAt(Date.now() - clockOrigin);
        }
      }),
    [driver, clockOrigin],
  );

  // Booking another appointment starts a new measurement, but it does not erase the last one: the
  // frozen total is a record of something that happened, not a live readout.
  const restart = useCallback(() => {
    pageCounter.current?.reset();
    setReviewAttempt(0);
    dispatch({ type: 'restart' });
  }, []);

  // ── the next release ───────────────────────────────────────────────────────────────────────────
  const busy =
    session.held !== null ||
    pendingAct !== null ||
    flow.step !== 'board' ||
    (lastBookedAt !== null && elapsed - lastBookedAt < BOOKING_GRACE_MS);

  const wantedWave = waveIndexAt(elapsed);
  useEffect(() => {
    // Live board: the server rolls the waves for everyone at once; there is nothing to stage here.
    if (live) return;
    if (!busy && wantedWave !== wave) setWave(wantedWave);
  }, [busy, wantedWave, wave, live]);

  /**
   * The agent seam, for the eval harness and for anyone reading the page with dev tools open. It
   * mirrors the AGENT-VERB subset of what this page publishes and NOTHING ELSE: list, hold,
   * status, release. There is deliberately no `book`, `cancel` or `move` here for the same reason
   * there are no such tools — the only thing that performs a consequential act is a keypress the
   * browser marked as trusted (the prepare_* tools go through the real tool surface, not this seam).
   */
  const heldSlot = session.held === null ? undefined : findSlot(session.slots, session.held.slotId);
  // Live: the release schedule is the server's and it waits for nobody — anything booked is yours
  // across waves, which is what the copy says. Seeded: the swap defers while this visitor is busy.
  const liveMeta = live ? liveDriver?.meta() : undefined;
  const nextRelease = live
    ? liveMeta?.nextWaveAt != null
      ? Math.max(0, liveMeta.nextWaveAt - Date.now())
      : null
    : busy
      ? null
      : msUntilNextWave(elapsed);
  const via = assistantTag(origin);
  const arrival = (origin === 'agent' || origin === 'waitlist') && heldSlot ? agentArrivalAnnouncement(origin, heldSlot.timeLabel) : null;
  const openCount = session.slots.filter((s) => s.state === 'open').length;

  // The card's reference is seeded on the instant the booking landed, so that instant has to be
  // wall-clock and has to stay put. `lastBookedAt` is elapsed since `clockOrigin` by the same wall
  // clock, so this addition is exactly the `Date.now()` of the booking — and it does not drift per frame.
  const bookedSlot = session.slots.find((s) => s.state === 'booked_yours');
  const bookedAtWall = lastBookedAt === null ? null : clockOrigin + lastBookedAt;

  return (
    <div className="clinic" data-clinic-route="book" data-clinic-wave={wave} data-clinic-board={live ? 'live' : liveFailed ? 'fallback' : 'seeded'}>
      <main className="cl-shell">
        <h1 className="cl-sr">Book an appointment at {CLINIC_NAME}</h1>
        <Masthead
          aside={
            <Link className="cl-quiet" href="/clinic" data-clinic-nav="landing">
              Clinic home
            </Link>
          }
        />

        {/* ══ The measured region. Everything a person does to book is inside it — and the counts
            leave the page only as attributes, never as pixels (SPEC-V3 §1). ══ */}
        <div
          ref={regionRef}
          data-clinic-measured="booking"
          data-clinic-counter={tally.total}
          data-clinic-count-hand={handCount ?? ''}
          data-clinic-count-agent={agentCount ?? ''}
          data-clinic-receipt={`${handCount ?? '-'}:${agentCount ?? '-'}`}
        >
          <Band label="Availability" open>
            <p className="cl-lead" data-clinic-wave-age>
              {live
                ? liveMeta?.ready
                  ? `${describeWaveAge(Math.max(0, Date.now() - (liveMeta.waveStartedAt ?? Date.now())))} · ${openCount} ${openCount === 1 ? 'appointment' : 'appointments'} still available`
                  : 'Checking today’s availability…'
                : `${describeWaveAge(msIntoWave(elapsed))} · ${openCount} of ${session.slots.length} appointments still available`}
            </p>
            <p className="cl-prose">
              {nextRelease === null
                ? live
                  ? 'Availability here updates as cancellations come in. Anything you have already booked stays yours.'
                  : 'The next release is held back until you have finished — nothing on this board will change while you are booking.'
                : `Cancelled appointments are released to this page as they come in. Next release in ${formatClock(nextRelease / 1000)}; anything you have already booked stays yours.`}
            </p>
          </Band>

          {liveMeta && liveMeta.errorSeq > 0 && liveMeta.lastError ? (
            <p className="cl-lost" role="status" data-clinic-refusal={liveMeta.errorSeq} key={liveMeta.errorSeq}>
              {refusalSentence(liveMeta.lastError)}
            </p>
          ) : null}

          {arrival !== null && heldSlot ? (
            <p className="cl-agent" data-clinic-agent-strip data-clinic-hold-origin={origin}>
              {/* The seconds tick every frame; a live region that re-reads them would speak forty-five
                  times. Screen readers get the arrival sentence once, below; the dock's own regions
                  carry the 30 s / 10 s marks. */}
              <span aria-hidden="true">{holdHeadline(origin, session.secondsLeft)}</span>
              <span aria-hidden="true">
                {heldSlot.timeLabel} with {heldSlot.clinician}
                {via === null ? null : <span className="cl-agent__via"> · {via}</span>}
              </span>
              <span className="cl-sr" role="status">
                {arrival}
              </span>
            </p>
          ) : null}

          {/* On the board step the band carries no label of its own: each ROW's gutter is the
              label, and it lands in the same column as every other band's — so the word that
              answers "whose is this?" is always in the same place on both routes. */}
          <Band label={flow.step === 'board' ? undefined : 'Booking'} wide>
            {flow.lost !== null ? (
              <div className="cl-lost" role="alert" data-clinic-lost={flow.lost.slotId}>
                <b>{flow.lost.timeLabel}</b> is no longer available — it was booked while you were{' '}
                {flow.lost.atStep === 'booking' ? 'confirming' : 'filling this in'}. Everything you
                entered is still here — choose another time.{' '}
                <button
                  type="button"
                  className="cl-link"
                  data-clinic-action="dismiss-lost"
                  onClick={() => dispatch({ type: 'dismiss_lost' })}
                >
                  Hide this
                </button>
              </div>
            ) : null}

            {flow.step === 'board' ? (
              <>
                <h2 className="cl-sr">Appointments available now</h2>
                <SlotSheet
                  slots={session.slots}
                  onOpen={(slotId) => dispatch({ type: 'open_slot', slotId })}
                  heldSlotId={heldSlotId}
                  holdOrigin={origin}
                  holdSecondsLeft={session.secondsLeft}
                  holdTtlSeconds={session.held?.ttlSeconds ?? HOLD_TTL_SECONDS}
                  now={session.now}
                />
              </>
            ) : (
              <BookingSteps
                state={flow}
                dispatch={dispatch as (action: ManualFlowAction) => void}
                reviewAttempt={reviewAttempt}
                onAttemptReview={() => setReviewAttempt((n) => n + 1)}
                onBook={bookByHand}
                onRestart={restart}
              />
            )}
          </Band>

          {/* Your appointment (SPEC-V3 §3). Rendered off the BOARD's state, not the manual flow's,
              so a booking the assistant set up gets the same reference, the same calendar file and
              the same cancel/move controls as one walked through by hand. The card arms; the dock
              below is still the only thing that performs.
              The gutter names the state and the card names the object: a band labelled "Your
              appointment" above a card whose own eyebrow says the same is the page stuttering. */}
          {bookedSlot !== undefined && bookedAtWall !== null ? (
            <Band label="Booked" wide>
              <AppointmentCard
                slotId={bookedSlot.id}
                bookedAt={bookedAtWall}
                timeLabel={bookedSlot.timeLabel}
                clinician={bookedSlot.clinician}
                kind={bookedSlot.kind}
                moveOptions={session.slots
                  .filter((s) => s.state === 'open')
                  .map((s) => ({ slotId: s.id, timeLabel: s.timeLabel, clinician: s.clinician }))}
                onCancel={() => prepareCancel(bookedSlot.id, 'you')}
                onMove={(toId) => prepareMove(bookedSlot.id, toId, 'you')}
                armed={pendingAct !== null}
              />
            </Band>
          ) : null}

          {/* The dock lives inside the measured region on purpose: pressing Enter to book is a real
              interaction in the booking area and belongs in the by-hand number too. */}
          {pendingAct !== null && pendingSecondsLeft > 0 ? (
            <ConfirmDock
              // Keyed apart from the hold dock: switching book→cancel/move must be a fresh dock —
              // fresh announcement, fresh untrusted counter, fresh agent-lane measurement.
              key={`act-${pendingAct.kind}-${pendingAct.kind === 'move' ? pendingAct.toId : pendingAct.slotId}`}
              act={pendingAct.kind}
              secondsLeft={pendingSecondsLeft}
              ttlSeconds={pendingAct.kind === 'move' ? (session.held?.ttlSeconds ?? HOLD_TTL_SECONDS) : PENDING_ACT_TTL_SECONDS}
              slotLabel={pendingAct.timeLabel}
              slotDetail={pendingAct.detail}
              origin={pendingAct.by}
              onConfirm={confirmPendingAct}
              onRelease={dismissPendingAct}
              measuredRef={attachDock}
              gestureSlot={
                GESTURE_ENABLED ? (
                  <GestureConfirm verb={pendingAct.kind} onConfirm={confirmPendingAct} armed={pendingSecondsLeft > 0} />
                ) : undefined
              }
            />
          ) : session.held !== null && session.secondsLeft > 0 && heldSlot ? (
            <ConfirmDock
              // Keyed by slot: a cascade grant that replaces a live hold (the sweep gives your other
              // hold back and hands you the queued slot) must be a fresh dock — fresh dead zone,
              // fresh announcement — never a relabelled one under a finger already in flight.
              key={`hold-dock-${session.held.slotId}-${session.held.startedAt}`}
              secondsLeft={session.secondsLeft}
              ttlSeconds={session.held.ttlSeconds}
              slotLabel={heldSlot.timeLabel}
              slotDetail={`${heldSlot.clinician} · ${heldSlot.kind}`}
              origin={origin}
              onConfirm={confirmHold}
              onRelease={() => session.release(session.held!.slotId)}
              measuredRef={attachDock}
              gestureSlot={
                GESTURE_ENABLED ? (
                  <GestureConfirm onConfirm={confirmHold} armed={session.held !== null && session.secondsLeft > 0} />
                ) : undefined
              }
            />
          ) : null}
        </div>

        {/* nextWaveAt travels in session.now (driver-clock) units — the tool computes seconds
            from it. `nextRelease` is wall-ms from now, and the driver clock ticks 1:1 with wall
            time while running, so now + nextRelease is the wave's driver-clock timestamp. Null
            while a booking holds the board (the release really is postponed — never invented).
            Unwired until 2026-08-31: the page showed the human a live countdown while
            clinic_list_drops told the agent null — the agent was blinder than the person for no
            reason (self-review against SPEC-V1 §3). */}
        <ClinicTools
          driver={driver}
          session={session}
          nextWaveAt={live ? (liveMeta?.nextWaveAt ?? null) : nextRelease === null ? null : session.now + nextRelease}
          onPrepareCancel={prepareCancel}
          onPrepareMove={prepareMove}
          // SPEC-V5: the queue exists only on the shared board; the seeded board has no other people.
          onJoinWaitlist={live && liveDriver ? (id) => (liveDriver.joinWaitlist(id), true) : undefined}
          onLeaveWaitlist={live && liveDriver ? (id) => (liveDriver.leaveWaitlist(id), true) : undefined}
          armedAct={pendingAct?.kind ?? null}
          waveLandedAt={live ? (liveMeta?.waveStartedAt ?? null) : null}
          sharedBoard={live}
          // Two network round trips (RPC + re-read) on a judge's hotel wifi is not 1.2 s.
          settleTimeoutMs={live ? 8000 : undefined}
        />
      </main>

      {session.held !== null || pendingAct !== null ? <div className="cl-dock-spacer" aria-hidden="true" /> : null}
    </div>
  );
}
