'use client';

/**
 * `/clinic/book` — the product (SPEC-V1 §2, §5).
 *
 * One page, one board, one clock. A visitor can book an appointment here entirely by hand — click a
 * time, fill the form, confirm — and the page counts what that costs while they do it. An agent can
 * do everything except the last step: it lists the wave and takes a hold through the tools mounted
 * below, the dock arrives saying who held it, and the appointment is made by a keypress the browser
 * marks as trusted. Both costs end up side by side, both measured.
 *
 * ── WHAT IS REUSED VERBATIM (SPEC-V1 §4) ────────────────────────────────────────────────────────
 * The mock driver, the `useDropSession` fold, the manual-flow reducer, the interaction counter, the
 * confirm gate, the audio cues, the TTL arithmetic and the board announcer are all imported
 * unchanged from `lib/drop/` and `components/drop/useDropSession.ts`. Everything visual is new; the
 * bench's `DropBench` / `SlotBoard` / `ConfirmSurface` / `drop-bench.css` are not referenced.
 *
 * ── WAVE STAGING ────────────────────────────────────────────────────────────────────────────────
 * The mock driver simulates one wave per instance, so continuous releases are a driver per wave,
 * swapped on the period in `wave-clock.ts` and seeded from the wave index. The swap is DEFERRED
 * while anything is in play — a live hold, a half-filled form, a booking still on screen — because
 * a new wave clears the board and yanking a burning 45-second hold out from under a visitor to
 * satisfy a timer would be the page contradicting its own promise.
 *
 * ── THE TWO COUNTERS ────────────────────────────────────────────────────────────────────────────
 * The page counter is scoped to the booking region and runs from arrival: that is the by-hand cost.
 * The dock counter is created when the dock mounts, which is the instant a hold appears: that is the
 * with-an-agent cost. Neither can be written to; both only move when a trusted event arrives.
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
import { formatClock } from '../../lib/drop/time.ts';
import type { DropDriver } from '../../lib/drop/types.ts';
import { firstComeDriver, useDropSession } from '../drop/useDropSession.ts';
import { ClinicTools } from '../drop/ClinicTools.tsx';
import { Band, ClinicBanner, Masthead, CLINIC_NAME } from './ClinicFrame.tsx';
import { BookingSteps } from './BookingSteps.tsx';
import { ConfirmDock } from './ConfirmDock.tsx';
import { ReceiptCompare, type LaneReceipt } from './ReceiptCompare.tsx';
import { SlotSheet } from './SlotSheet.tsx';
import { agentArrivalAnnouncement, holdHeadline, holdOrigin, type HoldOrigin } from './hold-origin.ts';
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
 * Six appointments, three of which the rival clears over the first forty seconds — aggressive
 * early and tapering, the shape of a real drop. Three are left standing for the rest of the wave so
 * a visitor who arrives late still has something to book; the rival is never given a smaller budget
 * than its own preset, only a slower clock, because a rival tuned to let you win is not evidence.
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

export function ClinicBooking() {
  // ── the wave ───────────────────────────────────────────────────────────────────────────────────
  const mountedAt = useRef<number>(Date.now());
  const [wave, setWave] = useState(0);
  const driver = useMemo(
    () => createMockDriver({ seed: waveSeed(wave), scenario: 'hold-and-book', overrides: WAVE_OVERRIDES }),
    [wave],
  );
  const session = useDropSession(driver, { running: true, clock: driver });

  /**
   * Elapsed page time. Read during render rather than held in state because the session already
   * re-renders this component every animation frame — a second rAF loop would buy nothing. It is
   * deliberately NOT `session.now`, which the seam resets to zero on every driver swap.
   */
  const elapsed = Date.now() - mountedAt.current;

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
  const [origin, setOrigin] = useState<HoldOrigin>('you');
  const heldSlotId = session.held?.slotId ?? null;
  const heldStartedAt = session.held?.startedAt ?? null;

  useEffect(() => {
    if (heldStartedAt === null || heldSlotId === null) return;
    setOrigin(holdOrigin(heldStartedAt, lastLocalRequest.current));
    // A hold that arrived while you were reading further down the page is invisible unless the page
    // shows you where it landed. Scrolling is not an interaction the counter sees, so this costs the
    // reader nothing on the receipt.
    const row = document.querySelector(`[data-clinic-slot="${heldSlotId}"]`);
    if (row === null) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    row.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  }, [heldStartedAt, heldSlotId]);

  // ── receipts ───────────────────────────────────────────────────────────────────────────────────
  const [handReceipt, setHandReceipt] = useState<LaneReceipt | null>(null);
  const [agentReceipt, setAgentReceipt] = useState<LaneReceipt | null>(null);
  const [lastBookedAt, setLastBookedAt] = useState<number | null>(null);

  /** Which booking the by-hand receipt is frozen for, so "book another" cannot refreeze the old one. */
  const frozenFor = useRef<string | null>(null);
  const bookedSlotId = flow.bookedSlotId;
  useEffect(() => {
    if (bookedSlotId === null || frozenFor.current === bookedSlotId) return;
    frozenFor.current = bookedSlotId;
    const snapshot = pageCounter.current?.snapshot() ?? NO_COUNT;
    setHandReceipt({
      slotLabel: findSlot(flow.slots, bookedSlotId)?.timeLabel ?? bookedSlotId,
      count: snapshot.total,
      breakdown: snapshot.breakdown,
      slotsLost: flow.slotsLost,
    });
  }, [bookedSlotId, flow.slots, flow.slotsLost]);

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
    lastLocalRequest.current = null;
    setLastBookedAt(Date.now() - mountedAt.current);
  }, [flow.selectedSlotId, manualDriver, session.now]);

  const confirmHold = useCallback(() => {
    const slotId = session.held?.slotId;
    if (slotId === undefined) return;
    // Frozen before the dock unmounts, so the number cannot drift while the receipt is on screen.
    const snapshot = dockCounter.current?.snapshot() ?? NO_COUNT;
    session.confirm(slotId);
    setAgentReceipt({
      slotLabel: findSlot(session.slots, slotId)?.timeLabel ?? slotId,
      count: snapshot.total,
      breakdown: snapshot.breakdown,
      slotsLost: 0,
    });
    setLastBookedAt(Date.now() - mountedAt.current);
  }, [session]);

  // Booking another appointment starts a new measurement, but it does not erase the last one: the
  // receipt is a record of something that happened, not a live readout.
  const restart = useCallback(() => {
    pageCounter.current?.reset();
    setReviewAttempt(0);
    dispatch({ type: 'restart' });
  }, []);

  // ── the next release ───────────────────────────────────────────────────────────────────────────
  const busy =
    session.held !== null ||
    flow.step !== 'board' ||
    (lastBookedAt !== null && elapsed - lastBookedAt < BOOKING_GRACE_MS);

  const wantedWave = waveIndexAt(elapsed);
  useEffect(() => {
    if (!busy && wantedWave !== wave) setWave(wantedWave);
  }, [busy, wantedWave, wave]);

  /**
   * The agent seam, for the eval harness and for anyone reading the page with dev tools open. It
   * mirrors the tools this page publishes and NOTHING ELSE: list, hold, status, release. There is
   * deliberately no `book` here for the same reason there is no booking tool — the only thing that
   * turns a hold into an appointment is a keypress the browser marked as trusted.
   */
  useEffect(() => {
    const w = window as unknown as { __CEDARFIELD_AGENT__?: unknown };
    w.__CEDARFIELD_AGENT__ = {
      listDrops: () => driver.snapshot().slots,
      holdSlot: (slotId: string) => driver.hold(slotId),
      holdStatus: () => driver.snapshot().hold,
      releaseHold: (slotId: string) => driver.release(slotId),
    };
    return () => {
      delete w.__CEDARFIELD_AGENT__;
    };
  }, [driver]);

  const heldSlot = session.held === null ? undefined : findSlot(session.slots, session.held.slotId);
  const nextRelease = busy ? null : msUntilNextWave(elapsed);
  const arrival = origin === 'agent' && heldSlot ? agentArrivalAnnouncement(origin, heldSlot.timeLabel) : null;

  return (
    <div className="clinic" data-clinic-route="book" data-clinic-wave={wave}>
      <ClinicBanner />
      <main className="cl-shell">
        <h1 className="cl-sr">Book an appointment at {CLINIC_NAME}</h1>
        <Masthead
          aside={
            <>
              <p className="cl-counter" data-clinic-counter={tally.total}>
                <b>{tally.total}</b>
                <span>interactions on this page, counted</span>
              </p>
              <Link className="cl-quiet" href="/clinic" data-clinic-nav="landing">
                How this works
              </Link>
            </>
          }
        />

        {/* ══ The measured region. Everything a person does to book is inside it. ══ */}
        <div ref={regionRef} data-clinic-measured="booking">
          <Band label="This wave" open>
            <p className="cl-lead" data-clinic-wave-age>
              {describeWaveAge(msIntoWave(elapsed))} · {session.slots.filter((s) => s.state === 'open').length} of{' '}
              {session.slots.length} still open
            </p>
            <p className="cl-prose">
              {nextRelease === null
                ? 'The next release is held back while this booking is in play — nothing on the board will be cleared out from under you.'
                : `Next release in ${formatClock(nextRelease / 1000)}. A release replaces the board; anything you have booked is already yours.`}
            </p>
          </Band>

          {arrival !== null && heldSlot ? (
            <p className="cl-agent" role="status" data-clinic-agent-strip>
              {holdHeadline(origin, session.secondsLeft)}
              <span>
                {heldSlot.timeLabel} with {heldSlot.clinician}. Your agent cannot press the key.
              </span>
            </p>
          ) : null}

          {/* On the board step the band carries no label of its own: each ROW's gutter is the
              label, and it lands in the same column as every other band's — so the word that
              answers "whose is this?" is always in the same place on both routes. */}
          <Band label={flow.step === 'board' ? undefined : 'Booking'} wide>
            {flow.lost !== null ? (
              <div className="cl-lost" role="alert" data-clinic-lost={flow.lost.slotId}>
                <b>{flow.lost.timeLabel}</b> was taken by someone else while you were{' '}
                {flow.lost.atStep === 'booking' ? 'confirming' : 'filling this in'}. Everything you
                typed is still here — choose another time.{' '}
                <button
                  type="button"
                  className="cl-link"
                  style={{ background: 'none', border: 0, font: 'inherit', cursor: 'pointer', padding: 0 }}
                  data-clinic-action="dismiss-lost"
                  onClick={() => dispatch({ type: 'dismiss_lost' })}
                >
                  Hide this
                </button>
              </div>
            ) : null}

            {flow.step === 'board' ? (
              <>
                <h2 className="cl-sr">Appointments in this release</h2>
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

          <Band label="What it cost" wide>
            <ReceiptCompare hand={handReceipt} agent={agentReceipt} />
            <p className="cl-note">
              Both numbers were counted by this page while you used it, under the rules in
              lib/drop/COUNTING.md. Synthetic events are excluded, held keys count once, and a flick
              of the scroll wheel is one interaction rather than twelve.
            </p>
          </Band>

          {/* The dock lives inside the measured region on purpose: pressing Enter to book is a real
              interaction in the booking area and belongs in the by-hand number too. */}
          {session.held !== null && session.secondsLeft > 0 && heldSlot ? (
            <ConfirmDock
              secondsLeft={session.secondsLeft}
              ttlSeconds={session.held.ttlSeconds}
              slotLabel={heldSlot.timeLabel}
              slotDetail={`${heldSlot.clinician} · ${heldSlot.kind}`}
              origin={origin}
              onConfirm={confirmHold}
              onRelease={() => session.release(session.held!.slotId)}
              measuredRef={attachDock}
            />
          ) : null}
        </div>

        <ClinicTools driver={driver} session={session} />

        <Band label="Honestly">
          <p className="cl-prose">
            Demo inventory, generated on your machine. The rival is a seeded simulation and is
            labelled as one everywhere it appears. Nothing here books a real appointment, takes a
            payment, or leaves this browser. There is no tool on this page that books — the verb was
            never registered.
          </p>
        </Band>
      </main>

      {session.held !== null ? <div className="cl-dock-spacer" aria-hidden="true" /> : null}
    </div>
  );
}
