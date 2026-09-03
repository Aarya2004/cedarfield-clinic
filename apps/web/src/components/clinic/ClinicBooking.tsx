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
 * a new wave clears the board and yanking a burning three-minute hold out from under a visitor to
 * satisfy a timer would be the page contradicting its own promise.
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
import { loadAudioPref } from '../../lib/drop/audio-cues.ts';
import type { DropDriver, Slot } from '../../lib/drop/types.ts';
import { firstComeDriver, useDropSession } from '../drop/useDropSession.ts';
import { ClinicTools } from '../drop/ClinicTools.tsx';
import { DELEGATION_MS, type Delegation, type ToolCallRecord } from '../../lib/drop/clinic-tools.ts';
import { GestureConfirm } from '../drop/GestureConfirm.tsx';
import { Band, ClinicPhoneLink, Masthead, CLINIC_NAME } from './ClinicFrame.tsx';
import { AppointmentCard } from './AppointmentCard.tsx';
import { AssistantGuide } from './AssistantGuide.tsx';
import { PatientOnFile, validate as validatePatient, writePatient, type PatientOnFileRecord } from './PatientOnFile.tsx';
import { VoiceAgent, type VoiceExecutor } from './VoiceAgent.tsx';
import { ListenPanel } from './ListenPanel.tsx';
import { createRequestQueue } from '../../lib/drop/request-queue.ts';
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
/** "Talk to Cedarfield": the page's own voice client. Same flag rule; the route says if no key is set. */
const VOICE_ENABLED = process.env.NEXT_PUBLIC_DROP_VOICE === '1';

/** "2:24 PM" — when a standing permission ends, in the visitor's own clock. */
function formatWallClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

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
const PENDING_ACT_TTL_SECONDS = 180;

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

  // ── who the appointment is for ────────────────────────────────────────────────────────────────
  // One patient on file per browser (PatientOnFile). No path books without it: the by-hand form
  // always asked; the assistant paths now refuse until it exists, and say so where the eye is.
  const [patient, setPatientState] = useState<PatientOnFileRecord | null>(null);
  const patientRef = useRef<PatientOnFileRecord | null>(null);
  const onPatientChange = useCallback((p: PatientOnFileRecord | null) => {
    patientRef.current = p;
    setPatientState(p);
  }, []);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (notice === null) return;
    const t = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(t);
  }, [notice]);
  /** True when the page may book for someone. False ⇒ the card is brought into view with the reason. */
  const requirePatient = useCallback((): boolean => {
    if (patientRef.current !== null) return true;
    setNotice('Add the patient’s name, date of birth and phone first — once, at the top of the page.');
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    document.querySelector('[data-clinic-patient]')?.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    return false;
  }, []);

  /** The press happened; the booking has not yet. The measurement waits for the `booked` event. */
  const pendingAgentCount = useRef<{ slotId: string; count: number; delegated: boolean } | null>(null);
  const confirmHold = useCallback(() => {
    const slotId = session.held?.slotId;
    if (slotId === undefined) return;
    if (!requirePatient()) return;
    // Frozen before the dock unmounts, so the number cannot drift after the booking it belongs to —
    // but only WRITTEN when the driver confirms the booking, so a refused press (hold expired at
    // the boundary, on the live board) never records a measurement for an appointment nobody has.
    pendingAgentCount.current = { slotId, count: (dockCounter.current?.snapshot() ?? NO_COUNT).total, delegated: false };
    session.confirm(slotId);
  }, [session, requirePatient]);

  // ── SPEC-V9: the booking tool is born by your hand ─────────────────────────────────────────────
  // One trusted press here ("Let my agent book for me") grants a delegation: one booking, ten
  // minutes. While it stands, `clinic_book_slot` is registered and the agent may book on "yes".
  // The grant is set from a trusted event ONLY — a synthetic click is counted and ignored, the same
  // rule as the dock. The booking spends it; a revoke or the clock ends it.
  // The latest assistant call, shown at the top of the page for a few seconds — where a person
  // watching a chat client work is actually looking (Arav, 2026-09-02 05:50: the booking landed
  // below the fold and the page "looked like a non-functioning webapp"). The full record stays
  // under the times; this is the same line, brought to the eye.
  const [lastCall, setLastCall] = useState<ToolCallRecord | null>(null);
  const noteCall = useCallback((record: ToolCallRecord) => {
    setLastCall(record);
    // Said out loud too, when the person has turned sound on (the same preference as the confirm
    // bar's cues): a person who cannot watch the page still hears that the assistant acted, and
    // what it did. The page speaks its own record — never the assistant's words.
    try {
      // Never speak what the page just heard: with the recognizer on, the synthesized "heard you:
      // …" would be transcribed straight back into the queue (2026-09-02 review, P2-2).
      if (record.name !== 'clinic_wait_for_request' && loadAudioPref(window.localStorage) && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(`Your assistant${record.ok ? '' : ' was refused'}: ${record.summary.replace(/ — /g, '. ').replace(/ · /g, ', ')}`);
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      }
    } catch {
      /* no voices, or storage refused: the strip and the record still stand */
    }
    // Bring the thing that changed into view: a booking → the appointment card; anything else that
    // succeeded → the record under the times, so the person sees the row appear.
    const target =
      record.name === 'clinic_book_slot' && record.ok
        ? '[data-clinic-appointment]'
        : record.name === 'clinic_hold_slot' && record.ok
          ? '[data-slot-state="held_by_you"]'
          : null;
    if (target === null) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(target);
      if (el === null) return;
      el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
      // A visible pulse on the thing the assistant changed — "it happened HERE" — honouring
      // reduced motion (the CSS rule is behind the media query).
      el.setAttribute('data-clinic-flash', 'true');
      setTimeout(() => el.removeAttribute('data-clinic-flash'), 1800);
    }, 250);
  }, []);
  useEffect(() => {
    if (lastCall === null) return;
    const t = setTimeout(() => setLastCall((c) => (c === lastCall ? null : c)), 9000);
    return () => clearTimeout(t);
  }, [lastCall]);

  /** The page's own voice client gets the live tool list and execute path from ClinicTools. */
  const [voiceExecutor, setVoiceExecutor] = useState<VoiceExecutor | null>(null);

  // "Say it to the page": what the person says, signs or types, queued for whichever agent asks.
  // The wait tool is born while the page listens or a request is waiting — the person's press.
  const requestQueue = useMemo(() => createRequestQueue(), []);
  const [listenActive, setListenActive] = useState(false);
  // One microphone consumer at a time: the page's own voice agent and the recognizer exclude each
  // other, so the agent's speech is never transcribed back as the person's words (review P1-3).
  // `listenMic` is the recognizer or the sign camera actually running — a typed request waiting in
  // the queue does not count (Codex audit: a typed handoff must not disable Talk to Cedarfield).
  const [listenMic, setListenMic] = useState(false);
  const [voiceLive, setVoiceLive] = useState(false);

  const [delegation, setDelegationState] = useState<Delegation | null>(null);
  const delegationRef = useRef<Delegation | null>(null);
  const setDelegation = useCallback((next: Delegation | null) => {
    delegationRef.current = next;
    setDelegationState(next);
  }, []);
  const [syntheticGrants, setSyntheticGrants] = useState(0);
  const [lastBookingDelegated, setLastBookingDelegated] = useState(false);
  const grantDelegation = useCallback(
    (e: { nativeEvent: Event }) => {
      if (!e.nativeEvent.isTrusted) {
        setSyntheticGrants((n) => n + 1);
        return;
      }
      // No patient, no permission — and say so where the eye is, instead of a dead click
      // (Codex audit, 2026-09-02: "gives no feedback when the patient profile is incomplete").
      if (!requirePatient()) return;
      const now = Date.now();
      setDelegation({ grantedAt: now, until: now + DELEGATION_MS });
    },
    [setDelegation, requirePatient],
  );
  /** The open palm, held: the camera dwell is a physical-presence root, not a DOM event, so no isTrusted to read. */
  const grantByGesture = useCallback(() => {
    if (delegationRef.current !== null) return;
    if (!requirePatient()) return;
    const now = Date.now();
    setDelegation({ grantedAt: now, until: now + DELEGATION_MS });
  }, [setDelegation, requirePatient]);
  const revokeDelegation = useCallback(() => setDelegation(null), [setDelegation]);
  useEffect(() => {
    if (delegation === null) return;
    const t = setTimeout(() => {
      if (delegationRef.current === delegation) setDelegation(null);
    }, Math.max(0, delegation.until - Date.now()));
    return () => clearTimeout(t);
  }, [delegation, setDelegation]);
  /** The agent's booking verb. Only `clinic_book_slot` reaches it, and only while the grant stands. */
  const bookByAgent = useCallback(
    (slotId: string): boolean => {
      const grant = delegationRef.current;
      if (grant === null || grant.until <= Date.now()) return false;
      if (!requirePatient()) return false;
      // The grant is spent HERE, synchronously — not when the booking lands. Two calls in the same
      // tick could otherwise both pass the check and the second would take the one booking
      // (2026-09-02 review, P2-1). A refused booking leaves the grant spent; the person presses again.
      setDelegation(null);
      // Zero interactions: the person pressed once, earlier, to grant — the booking itself cost none.
      pendingAgentCount.current = { slotId, count: 0, delegated: true };
      session.confirm(slotId);
      return true;
    },
    [session, requirePatient, setDelegation],
  );

  useEffect(
    () =>
      driver.subscribe((event) => {
        const pending = pendingAgentCount.current;
        if (event.type === 'booked' && pending && event.slotId === pending.slotId) {
          pendingAgentCount.current = null;
          setAgentCount(pending.count);
          setLastBookingDelegated(pending.delegated);
          setLastBookedAt(Date.now() - clockOrigin);
          if (pending.delegated) setDelegation(null); // one booking per grant
        }
      }),
    [driver, clockOrigin, setDelegation],
  );

  // Booking another appointment starts a new measurement, but it does not erase the last one: the
  // frozen total is a record of something that happened, not a live readout.
  // The by-hand form starts from the patient on file: a person who told the page who they are
  // once is not asked to type it again. Only empty fields are filled; nothing typed is overwritten.
  useEffect(() => {
    if (flow.step !== 'details' || patient === null) return;
    const fill: Array<['fullName' | 'dateOfBirth' | 'phone', string]> = [
      ['fullName', patient.fullName],
      ['dateOfBirth', patient.dateOfBirth],
      ['phone', patient.phone],
    ];
    for (const [field, value] of fill) {
      if (flow.details[field].trim() === '' && value !== '') dispatch({ type: 'set_field', field, value });
    }
    // Runs when the step opens; the details themselves are read once, deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.step, patient]);
  // …and what the by-hand form collects becomes the patient on file, so the next booking — by hand
  // or by the assistant — does not ask again. Saved at review (the details have passed validation).
  useEffect(() => {
    if (flow.step !== 'review') return;
    const next = { fullName: flow.details.fullName.trim(), dateOfBirth: flow.details.dateOfBirth.trim(), phone: flow.details.phone.trim() };
    if (validatePatient(next) !== null) return;
    if (patientRef.current && patientRef.current.fullName === next.fullName && patientRef.current.dateOfBirth === next.dateOfBirth && patientRef.current.phone === next.phone) return;
    writePatient(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.step]);

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
        <Masthead
          bar
          aside={
            <>
              <ClinicPhoneLink />
              <Link className="cl-quiet cl-quiet--sm" href="/clinic" data-clinic-nav="landing">
                Clinic home
              </Link>
            </>
          }
        />

        {notice !== null ? (
          <div className="cl-now" role="status" data-clinic-notice data-clinic-now-ok="false">
            <span className="cl-now__who">Not booked yet:</span> <span className="cl-now__what">{notice}</span>
          </div>
        ) : lastCall !== null ? (
          <div className="cl-now" role="status" data-clinic-now={lastCall.name} data-clinic-now-ok={lastCall.ok ? 'true' : 'false'}>
            <span className="cl-now__who">Your assistant{lastCall.ok ? '' : ' was refused'}:</span>{' '}
            <span className="cl-now__what">{lastCall.summary}</span>
          </div>
        ) : null}

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
            <h1 className="cl-thesis cl-thesis--book">Book an appointment</h1>
            <p className="cl-prose cl-prose--lead" data-clinic-wave-age>
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

          {/* What to say, for a first visitor with an assistant (Arav, 2026-09-02). Dismissible. */}
          <Band flush wide>
            <PatientOnFile sample={clockOrigin !== 0} onChange={onPatientChange} />
            <AssistantGuide />
            <ListenPanel queue={requestQueue} gesture={GESTURE_ENABLED} onActive={setListenActive} onMicChange={setListenMic} disabled={voiceLive} />
            {VOICE_ENABLED ? <VoiceAgent executor={voiceExecutor} disabled={listenMic} onLiveChange={setVoiceLive} /> : null}
          </Band>

          {(liveMeta && liveMeta.errorSeq > 0 && liveMeta.lastError) || (arrival !== null && heldSlot) ? (
            <Band flush wide>
              {liveMeta && liveMeta.errorSeq > 0 && liveMeta.lastError ? (
                <p className="cl-lost" role="status" data-clinic-refusal={liveMeta.errorSeq} key={liveMeta.errorSeq}>
                  {refusalSentence(liveMeta.lastError)}
                </p>
              ) : null}

              {arrival !== null && heldSlot ? (
                <p className="cl-agent" data-clinic-agent-strip data-clinic-hold-origin={origin}>
                  {/* The seconds tick every frame; a live region that re-reads them would speak forty-five
                      times. Screen readers get the arrival sentence once, below; the confirm bar's own
                      regions carry the 30 s / 10 s marks. */}
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
            </Band>
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
                <h2 className="cl-lead">
                  Available now<span className="cl-sr"> at {CLINIC_NAME}</span>
                </h2>
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

          {/* SPEC-V9: the permission control and the assistant's own record, directly under the
              board — where a person watching a chat client work looks for proof (Arav, 2026-09-02:
              "how am I supposed to tell if these commands have happened"). The grant is the one
              trusted press that births the booking tool; a synthetic click is counted, not obeyed. */}
          <Band label="Your assistant" wide>
            <div
              className="cl-delegate"
              data-clinic-delegation={delegation !== null ? 'granted' : 'none'}
              data-clinic-synthetic-grants={syntheticGrants}
            >
              {delegation === null ? (
                <>
                  <p className="cl-prose">
                    Your assistant can search, hold and queue for you, but no tool on this page can book. One press
                    here lets it book <b>one</b> appointment in the next ten minutes, when you say yes to it.
                  </p>
                  <button
                    type="button"
                    className="cl-quiet"
                    data-clinic-delegate
                    onClick={grantDelegation}
                    // A trusted Enter or Space on the focused control grants as well (a switch user's
                    // press arrives as a key, and some drivers never synthesise the click).
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        grantDelegation(e);
                      }
                    }}
                  >
                    Let my assistant book for me
                  </button>
                  {/* The open palm grants too: the camera is a physical-presence root, the same one
                      that books, cancels and moves on the docks. Never on by itself — opt-in per visit. */}
                  {/* Armed only when no other palm act is live: the dock's palm books, this one grants —
                      one held palm must never do both (2026-09-02 review, P1-4). */}
                  {GESTURE_ENABLED ? (
                    <GestureConfirm verb="grant" onConfirm={grantByGesture} armed={session.held === null && pendingAct === null} />
                  ) : null}
                </>
              ) : (
                <>
                  <p className="cl-prose" role="status">
                    Your assistant may book <b>one</b> appointment until {formatWallClock(delegation.until)}. Tell it
                    “yes, book it”. You can still cancel or move anything it books; it cannot.
                  </p>
                  <button type="button" className="cl-quiet" data-clinic-revoke onClick={revokeDelegation}>
                    Take that back
                  </button>
                </>
              )}
            </div>
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
              delegation={delegation}
              onBook={bookByAgent}
              onCall={noteCall}
              patientOnFile={patient !== null}
              onExecutor={VOICE_ENABLED ? setVoiceExecutor : undefined}
              requests={requestQueue}
              listening={listenActive}
            />
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
                interactions={{ hand: handCount, agent: agentCount, delegated: lastBookingDelegated }}
                patientName={patient?.fullName}
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

      </main>

      {session.held !== null || pendingAct !== null ? <div className="cl-dock-spacer" aria-hidden="true" /> : null}
    </div>
  );
}
