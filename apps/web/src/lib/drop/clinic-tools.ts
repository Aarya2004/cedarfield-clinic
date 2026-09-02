/**
 * ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║  Names, input schemas and result shapes below are a proposal (SPEC-V1 §3), not a contract.    ║
 * ║  Nothing outside this file and ClinicTools.tsx depends on them; change them freely until the  ║
 * ║  lock, then move whatever survives into a `contract:` commit.                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * The WebMCP tools of the Cedarfield Clinic booking page (SPEC-V1 §3, V2, V4, V5). Registered top-level,
 * imperatively, feature-detected, under ONE AbortController — the idiom of lib/webmcp/register.ts.
 *
 * ── THE THESIS, IN WHAT IS ABSENT ───────────────────────────────────────────────────────────────
 * There is no booking tool. No `clinic_book`, no `clinic_confirm`, no `confirm: true` argument on
 * anything here. The agent can see the drop, take a slot out of the race, watch the clock and give
 * the slot back — every expensive interaction — and then it stops, because the last act belongs to
 * the human. `DropDriver.confirm()` (types.ts) exists and is wired to the page's own keypress
 * handler; this module never calls it and never exposes it. `clinic-tools.test.ts` asserts that no
 * registered name contains "book" or "confirm", so the day someone adds one, the suite says no.
 *
 * ── THE SEAM ────────────────────────────────────────────────────────────────────────────────────
 * These tools read and write through exactly the same two objects the UI uses: the `DropDriver`
 * (lib/drop/types.ts) for verbs, and the `DropSession` fold (components/drop/useDropSession.ts) for
 * state. They hold no state of their own — there is no second source of truth for an agent and a
 * human to disagree about. Because a session is a React value that changes every frame, the
 * registration takes a *getter* (`ClinicToolsSource`), never a snapshot.
 *
 * ── HONESTY ─────────────────────────────────────────────────────────────────────────────────────
 * Every number returned is read off the live session at the moment of the call. A hold is only
 * reported as held once the session fold agrees it is held (we poll, briefly, rather than assume
 * the driver did what we asked). Nothing throws across the agent boundary: failures come back as
 * `{ ok: false, error, ... }` with enough state for the agent to recover on its own.
 */
import type { DropDriver, Slot, SlotState } from './types.ts';
// Type-only: erased before this file is loaded by `node --experimental-strip-types`, so the test
// never pulls React in. Relative + `.ts` for the same reason (see tickets/MAP.md Notes).
import type { DropSession } from '../../components/drop/useDropSession.ts';
import { getModelContext, type ModelContext, type ModelContextTool } from '../webmcp/types.ts';
// Chrome's secure-tools guidance, already agreed for the terminal tools: one tool result ≤ 1.5K chars.
import { OUTPUT_BUDGET_CHARS } from '../webmcp/schemas.ts';

// ── names ───────────────────────────────────────────────────────────────────────────────────────

/** The whole vocabulary, in registration order. Twelve — exactly the self-imposed cap; nothing more fits. */
export const CLINIC_TOOL_NAMES = [
  'clinic_list_drops',
  'clinic_find_slots',
  'clinic_clinicians',
  'clinic_hold_slot',
  'clinic_hold_status',
  'clinic_release_hold',
  'clinic_prepare_cancel',
  'clinic_prepare_move',
  'clinic_join_waitlist',
  'clinic_leave_waitlist',
  'clinic_my_appointment',
  'clinic_explain_confirm',
] as const;

/**
 * SPEC-V5: the waitlist cascade — registered only when the page is on the shared board (the seam
 * is present). The seeded board has no other people to wait behind, so it has no queue.
 */
export const WAITLIST_TOOL_NAMES = ['clinic_join_waitlist', 'clinic_leave_waitlist'] as const satisfies readonly ClinicToolName[];

/**
 * SPEC-V4 (2026-09-01): a tool born from the human act. The base nine are registered on load —
 * INCLUDING the arming tools, on purpose: a person with no booking must still hear "you have
 * nothing booked" from their agent, and a voice user whose client is slow to notice `toolchange`
 * must never lose a capability. What the press creates is therefore purely additive: the moment a
 * person books, `clinic_my_appointment` is registered live (toolchange fires, the list grows), and
 * it is unregistered when the last booking is gone. A client that misses the change loses nothing;
 * a client that sees it watches the human's act change the agent's surface.
 */
export const BASE_TOOL_NAMES = [
  'clinic_list_drops',
  'clinic_find_slots',
  'clinic_clinicians',
  'clinic_hold_slot',
  'clinic_hold_status',
  'clinic_release_hold',
  'clinic_prepare_cancel',
  'clinic_prepare_move',
  'clinic_explain_confirm',
] as const satisfies readonly ClinicToolName[];
export const BOOKED_TOOL_NAMES = ['clinic_my_appointment'] as const satisfies readonly ClinicToolName[];

/** Pure: does this view carry a booking of the visitor's — the condition that births the booked set. */
export function hasOwnBooking(view: ClinicToolsView): boolean {
  return view.session.slots.some((s) => s.state === 'booked_yours');
}

export type ClinicToolName = (typeof CLINIC_TOOL_NAMES)[number];

/**
 * The sentence a successful hold hands the agent to relay (SPEC-V1 §3). It is a result field and
 * not just prose in a description, because the agent that needs it most is the one that already
 * decided it had finished reading descriptions.
 */
export const HOLD_CHOREOGRAPHY =
  'The slot is held. Tell your human: one keypress on the page books it — you cannot.';

export const CANCEL_CHOREOGRAPHY =
  'The dock is armed to CANCEL. Tell your human: one keypress on the page cancels it — you cannot.';

export const MOVE_CHOREOGRAPHY =
  'The dock is armed to MOVE. Tell your human: one keypress on the page moves the booking — you cannot.';

/** The answer `clinic_explain_confirm` gives, and the reason the other tools stop where they do. */
export const NO_BOOKING_TOOL_REASON =
  'This page deliberately publishes no booking or confirmation tool. Booking is gated on a ' +
  "browser-trusted event — a real key press or click from the person at the keyboard — which no " +
  'tool call can produce; a synthetic press is rejected by the page. So the division of labour is: ' +
  'you do the fast, expensive parts (watch the drop, hold a slot, keep the clock), your human does ' +
  'the one part that must stay theirs (press the key). Hold the slot, then say so out loud.';

// ── the seam ────────────────────────────────────────────────────────────────────────────────────

/** What the tools are allowed to see. Everything is live — never a captured snapshot. */
export interface ClinicToolsView {
  /**
   * SPEC-V2: which prepared act (if any) the page's dock is currently armed for. Without this,
   * `clinic_hold_status` would read the move-freeze hold and tell the agent the keypress BOOKS —
   * when the armed press actually moves. The tools must never describe a press they cannot see.
   */
  armedAct?: 'cancel' | 'move' | null;
  /**
   * SPEC-V3: on the live board every refresh is a `drop_wave` resync, so "the last drop_wave in the
   * log" is always seconds ago — a false number. The page passes the server's real wave start
   * instead (session-clock units). Absent ⇒ the log is the truth (seeded board).
   */
  waveLandedAt?: number | null;
  /** SPEC-V3: true when other visitors share this board — so the agent can say so out loud. */
  sharedBoard?: boolean;
  /** SPEC-V5: the queue exists (shared board). Decides which tools exist and what refusals suggest. */
  waitlistAvailable?: boolean;
  /** The verbs. `hold` / `release` are called here; `confirm` is the human path and never is. */
  driver: DropDriver;
  /** The fold the UI renders: slots, held, secondsLeft, now, log. */
  session: DropSession;
  /**
   * Epoch/clock ms of the NEXT drop wave, in the same units as `session.now`, when the page knows
   * one. Omitted or null means we do not know, and `next_wave` comes back null rather than invented.
   */
  nextWaveAt?: number | null;
}

/** Registration takes a getter, because the session is a new object on every render. */
export type ClinicToolsSource = () => ClinicToolsView;

export interface ClinicToolsOptions {
  /**
   * How long `clinic_hold_slot` / `clinic_release_hold` wait for the session fold to agree with the
   * driver before answering honestly that they could not confirm it. Small: the driver is local.
   */
  settleTimeoutMs?: number | (() => number);
  /** Poll interval while settling. */
  settlePollMs?: number;
  /** Feature detection seam, for tests. Defaults to `document/navigator.modelContext`. */
  modelContext?: () => ModelContext | null;
  /**
   * SPEC-V2 arming seams. `clinic_prepare_cancel` / `clinic_prepare_move` ARM the dock for a
   * human act; the page injects these so the tools never touch `driver.cancel` / `driver.move`
   * (the unit fakes throw if one tries). Absent — the bench, an unwired page — the tools answer
   * `dock_not_wired` honestly instead of pretending.
   */
  onPrepareCancel?: (slotId: string) => boolean;
  onPrepareMove?: (fromSlotId: string, toSlotId: string) => boolean;
  /** How often the registration watches for the human's booking (tests set it tiny). */
  watchMs?: number;
  /**
   * SPEC-V5 queue seams. Reversible agent verbs (a place in line, not an appointment): the page
   * injects them on the shared board; absent ⇒ the two waitlist tools are not registered at all.
   */
  onJoinWaitlist?: (slotId: string) => boolean;
  onLeaveWaitlist?: (slotId: string) => boolean;
  /**
   * SPEC-V8 (2026-09-02): the page's own record of what the agent did. Called after every tool
   * answer with one honest line derived from that answer — a person reading the page (or a screen
   * reader) learns "held 8:40 AM with Dr. Fanning" without trusting the chat window's narration.
   */
  onCall?: (record: ToolCallRecord) => void;
}

/** One agent call as the page saw it. `summary` is derived from the tool's JSON answer, never invented. */
export interface ToolCallRecord {
  /** Wall-clock ms when the call arrived. */
  at: number;
  name: ClinicToolName;
  ok: boolean;
  summary: string;
  /** Measured on the page: call arrived → answer left. */
  ms: number;
}

const DEFAULT_SETTLE_TIMEOUT_MS = 1_200;
const DEFAULT_SETTLE_POLL_MS = 25;

// ── result envelope ─────────────────────────────────────────────────────────────────────────────

/**
 * MCP-style text content carrying JSON (WEBMCP-RESEARCH §"Return value": the explainer's shape;
 * plain objects are also accepted). One `text` part, one JSON object, no prose outside it — an
 * agent should never have to parse English to find a number.
 */
export interface ToolTextResult {
  content: [{ type: 'text'; text: string }];
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v !== null && typeof v === 'object' ? (v as Rec) : {});
const str = (v: unknown, fallback = '?'): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : fallback);
const len = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Pure: the one line the activity log shows for a tool's answer. Reads only what the answer says.
 * A refusal quotes the tool's own `detail`; an unreadable answer says so rather than guessing.
 */
export function summariseToolAnswer(name: ClinicToolName, result: ToolTextResult): { ok: boolean; summary: string } {
  let r: Rec;
  try {
    r = rec(JSON.parse(result.content[0].text));
  } catch {
    return { ok: false, summary: 'answer was not JSON' };
  }
  if (r.ok === false) {
    const why = str(r.detail, str(r.error, 'refused'));
    return { ok: false, summary: `refused — ${why.length > 110 ? `${why.slice(0, 107)}…` : why}` };
  }
  const hold = rec(r.your_hold);
  const slot = rec(r.slot);
  switch (name) {
    case 'clinic_list_drops':
      return { ok: true, summary: `${str(r.open_count, '0')} open of ${len(r.slots)}${r.your_hold ? ` · holding ${str(hold.time)}` : ''}` };
    case 'clinic_find_slots':
      return { ok: true, summary: len(r.matches) ? plural(len(r.matches), 'match') : `no match (${str(r.eliminated_by, 'nothing open')})` };
    case 'clinic_clinicians':
      return { ok: true, summary: plural(len(r.clinicians), 'clinician') };
    case 'clinic_hold_slot':
      return { ok: true, summary: `held ${str(hold.time)} with ${str(hold.clinician)} · ${str(hold.ttl_seconds)} s, your press books it` };
    case 'clinic_hold_status':
      return { ok: true, summary: r.held ? `holding ${str(hold.time)} · ${str(hold.seconds_left)} s left` : 'nothing held' };
    case 'clinic_release_hold':
      return { ok: true, summary: `released ${str(r.released)}` };
    case 'clinic_prepare_cancel':
      return { ok: true, summary: `dock armed to cancel ${str(slot.time)} — only your press cancels` };
    case 'clinic_prepare_move':
      return { ok: true, summary: `dock armed to move ${str(rec(r.from_slot).time)} → ${str(rec(r.to_slot).time)} — only your press moves` };
    case 'clinic_explain_confirm':
      return { ok: true, summary: 'explained: no tool books; you do' };
    case 'clinic_join_waitlist':
      return { ok: true, summary: `in line for ${str(slot.time)}${r.position ? ` · #${str(r.position)}` : ''}` };
    case 'clinic_leave_waitlist':
      return { ok: true, summary: `left the line for ${str(r.slot_id)}` };
    case 'clinic_my_appointment':
      return { ok: true, summary: plural(len(r.appointments), 'appointment') };
    default:
      return { ok: true, summary: 'ok' };
  }
}

export function asToolResult(data: unknown): ToolTextResult {
  let text = JSON.stringify(data);
  if (text.length > OUTPUT_BUDGET_CHARS) {
    // Should not happen at demo sizes; if it ever does, say so instead of silently returning a
    // truncated blob that would not parse as JSON.
    text = JSON.stringify({ ok: false, error: 'result_too_large', budget_chars: OUTPUT_BUDGET_CHARS });
  }
  return { content: [{ type: 'text', text }] };
}

/** Mirrors `coerceInput` in lib/webmcp/forge-spec.ts: Chrome 152 hands `execute` a JSON string. */
function coerceInput(input: unknown): Record<string, unknown> {
  if (typeof input === 'string') {
    try {
      const parsed: unknown = JSON.parse(input);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

// ── shapes an agent sees ────────────────────────────────────────────────────────────────────────

export interface AgentSlot {
  id: string;
  time: string;
  clinician: string;
  kind: string;
  state: SlotState;
  /** Shared board only: how many wait on this slot, and your human's place in that line (1 = next). */
  waiting?: number;
  your_position?: number;
}

export interface ListDropsResult {
  ok: true;
  clinic: string;
  fictional_clinic: true;
  /** Present and true on the live board: other slots on it belong to real visitors. */
  shared_board?: true;
  slots: AgentSlot[];
  open_count: number;
  /** Seconds until the next wave, when the page knows; null when it does not. Never invented. */
  next_wave_seconds: number | null;
  /** Seconds since the wave on the board landed, or null before the first wave. */
  wave_landed_seconds_ago: number | null;
  your_hold: HoldSummary | null;
  /** The visitor's booked slots, newest first — so "cancel my appointment" can be answered without any born tool. */
  your_bookings: AgentSlot[];
  booking: 'human_only';
}

export interface HoldSummary {
  slot_id: string;
  time: string;
  clinician: string;
  ttl_seconds: number;
  seconds_left: number;
  state: SlotState;
}

export interface HoldStatusResult {
  ok: true;
  held: boolean;
  your_hold: HoldSummary | null;
  /** The prepared act the dock is armed for right now, when the page reports one. */
  armed_act?: 'cancel' | 'move';
  booking: 'human_only';
  next_step: string;
}

export interface ErrorResult {
  ok: false;
  error: string;
  detail?: string;
  slot_state?: SlotState;
  open_slot_ids?: string[];
}

const CLINIC_NAME = 'Cedarfield Clinic';

/** One decimal is all an agent can act on, and it keeps the result honest about jitter. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toAgentSlot(slot: Slot): AgentSlot {
  return {
    id: slot.id,
    time: slot.timeLabel,
    clinician: slot.clinician,
    kind: slot.kind,
    state: slot.state,
    ...(slot.waiting ? { waiting: slot.waiting } : {}),
    ...(slot.yourPosition ? { your_position: slot.yourPosition } : {}),
  };
}

function openIds(slots: readonly Slot[]): string[] {
  return slots.filter((s) => s.state === 'open').map((s) => s.id);
}

/** The hold, described from the session fold alone. Null when this session holds nothing. */
export function holdSummary(view: ClinicToolsView): HoldSummary | null {
  const { session } = view;
  if (!session.held) return null;
  const slot = session.slots.find((s) => s.id === session.held?.slotId);
  return {
    slot_id: session.held.slotId,
    time: slot?.timeLabel ?? 'unknown',
    clinician: slot?.clinician ?? 'unknown',
    ttl_seconds: session.held.ttlSeconds,
    seconds_left: round1(session.secondsLeft),
    state: slot?.state ?? 'held_by_you',
  };
}

/** Pure: the whole `clinic_list_drops` answer as a function of the live view. */
export function listDrops(view: ClinicToolsView): ListDropsResult {
  const { session } = view;
  const lastWave = [...session.log].reverse().find((e) => e.type === 'drop_wave');
  const landedAt = view.waveLandedAt ?? lastWave?.at ?? null;
  const nextWaveAt = view.nextWaveAt ?? null;
  return {
    ok: true,
    clinic: CLINIC_NAME,
    fictional_clinic: true,
    slots: session.slots.map(toAgentSlot),
    open_count: openIds(session.slots).length,
    next_wave_seconds: nextWaveAt === null ? null : Math.max(0, round1((nextWaveAt - session.now) / 1000)),
    wave_landed_seconds_ago: landedAt === null ? null : Math.max(0, round1((session.now - landedAt) / 1000)),
    ...(view.sharedBoard ? { shared_board: true as const } : {}),
    your_hold: holdSummary(view),
    your_bookings: [...session.slots].reverse().filter((s) => s.state === 'booked_yours').map(toAgentSlot),
    booking: 'human_only',
  };
}

/** Pure: the whole `clinic_hold_status` answer. */
export function holdStatus(view: ClinicToolsView): HoldStatusResult {
  const hold = holdSummary(view);
  const armed = view.armedAct ?? null;
  return {
    ok: true,
    held: hold !== null,
    your_hold: hold,
    ...(armed ? { armed_act: armed } : {}),
    booking: 'human_only',
    // The sentence must describe the press the dock will actually perform. A move's freeze IS a
    // hold, but the armed key moves; an armed cancel holds nothing, but the key cancels.
    next_step:
      armed === 'move'
        ? MOVE_CHOREOGRAPHY
        : armed === 'cancel'
          ? CANCEL_CHOREOGRAPHY
          : hold
            ? HOLD_CHOREOGRAPHY
            : 'Nothing is held for your human right now. Call clinic_list_drops, then clinic_hold_slot.',
  };
}

// ── settling ────────────────────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wait, briefly, for the session fold to agree with what we just asked the driver to do. The driver
 * emits synchronously but the fold lands through React state, so a tool that answered immediately
 * would report the state from before its own call. Returns false on timeout; the caller then says
 * so honestly instead of claiming a hold nobody has.
 */
async function settle(
  source: ClinicToolsSource,
  predicate: (v: ClinicToolsView) => boolean,
  timeoutMs: number,
  pollMs: number,
  signal?: AbortSignal,
): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  for (;;) {
    if (predicate(source())) return true;
    // The agent (or the platform) cancelled the call: stop waiting and answer with what is true now.
    if (signal?.aborted) return predicate(source());
    if (Date.now() >= deadline) return predicate(source());
    await sleep(Math.max(1, pollMs));
  }
}

// ── descriptions (the choreography lives here as well as in the results) ────────────────────────

export const LIST_DROPS_DESCRIPTION =
  "List the appointment slots in this clinic's current drop: id, time, clinician, kind, and state " +
  '(open, held_by_you, held_by_other, taken_by_rival, taken_by_other, booked_yours, expired_hold). Read-only — it ' +
  'changes nothing. Start here, then clinic_hold_slot to take one slot out of the race for your ' +
  'human. There is deliberately NO booking tool on this page: only your human can book, with one ' +
  'key press on the page. Fictional clinic, simulated rival — nothing real is booked.';

export const HOLD_SLOT_DESCRIPTION =
  'Hold one open slot for your human for a short time (the result carries ttl_seconds and ' +
  'seconds_left). A hold is NOT a booking: it expires on its own, and no tool here can turn it ' +
  'into a booking. On success, relay the result\'s next_step sentence to your human — they press ' +
  'one key on the page and the slot is theirs. If the slot is already gone the result says so, ' +
  'with the ids that are still open: pick another and call again.';

export const HOLD_STATUS_DESCRIPTION =
  'How long your human has left on the slot you are holding: slot, ttl_seconds, seconds_left, ' +
  'state. Read-only, no input. Call it while your human is deciding, so you can tell them how ' +
  'much time is on the clock. Booking still happens only by their own key press.';

export const RELEASE_HOLD_DESCRIPTION =
  'Give back the slot you are holding so someone else can take it. Takes no input — it releases ' +
  'the one hold this session has. Use it when your human says no, or picks a different slot. It ' +
  'cannot book anything; nothing on this page can.';

export const EXPLAIN_CONFIRM_DESCRIPTION =
  'Explain why this page has no booking or confirmation tool, and what your human has to do ' +
  'instead. Read-only, no input, no side effects. Call it if you are hunting for the tool that ' +
  'completes the booking: there is none, and this tells you exactly what to say to your human.';

// ── the definitions ─────────────────────────────────────────────────────────────────────────────

export interface ClinicToolDef {
  name: ClinicToolName;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint?: boolean };
  /** `signal` is the platform's cancellation (spec: execute(input, {signal})); every settle honours it. */
  execute: (input?: unknown, ctx?: { signal?: AbortSignal }) => Promise<ToolTextResult>;
}

const NO_INPUT_SCHEMA = { type: 'object', properties: {}, additionalProperties: false } as const;

export const holdSlotSchema = {
  type: 'object',
  properties: {
    slot_id: {
      type: 'string',
      maxLength: 64,
      description: 'The id of an open slot, exactly as clinic_list_drops returned it (e.g. "slot-3").',
    },
  },
  required: ['slot_id'],
  additionalProperties: false,
} as const;

/**
 * Build the five. `source` is called on every invocation, so the tools always read the live board.
 * Pure function of its arguments: nothing is registered until `registerClinicTools`.
 */
/** "9", "9:00", "9:00 AM", "4 pm" → minutes since midnight; null when unparseable. */
export function parseClockText(raw: unknown): number | null {
  // Chrome and agents alike may pass `after: 9` as a number; it means the same as "9".
  if (typeof raw === 'number' && Number.isFinite(raw)) raw = String(raw);
  if (typeof raw !== 'string') return null;
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  // A bare small hour on a clinic board means daytime: "4" is 4 PM, not 4 AM.
  if (!m[3] && h >= 1 && h <= 6) h += 12;
  return h * 60 + min;
}

function slotMinutes(time: string): number | null {
  return parseClockText(time);
}

export const findSlotsSchema = {
  type: 'object',
  properties: {
    clinician: { type: 'string', description: 'Clinician name or part of one, e.g. "Boone" or "Dr. Boone".' },
    kind: { type: 'string', description: 'Appointment kind or part of one: "New patient", "Follow-up", "Consult".' },
    after: { type: 'string', description: 'Earliest acceptable start, e.g. "9:00 AM" or "9".' },
    before: { type: 'string', description: 'Latest acceptable start, e.g. "11:30 AM".' },
  },
  additionalProperties: false,
} as const;

export const waitlistSchema = {
  type: 'object',
  properties: {
    slot_id: { type: 'string', maxLength: 64, description: 'A slot that is held or booked by someone else, from clinic_list_drops.' },
  },
  required: ['slot_id'],
  additionalProperties: false,
} as const;

export const prepareMoveSchema = {
  type: 'object',
  properties: {
    new_slot_id: { type: 'string', maxLength: 64, description: 'The open slot to move the booking to, from clinic_find_slots or clinic_list_drops.' },
  },
  required: ['new_slot_id'],
  additionalProperties: false,
} as const;

export const FIND_SLOTS_DESCRIPTION =
  'Search the live board by clinician, kind, and/or time window (after/before). Answers with the ' +
  'matching open slots, and when nothing matches, names which constraint eliminated everything so ' +
  'you can relax the right one. Includes seconds until the next release. Read-only.';

export const CLINICIANS_DESCRIPTION =
  'Who is on today\'s board: each clinician with their open slot times and appointment kinds. ' +
  'Use it to answer "what doctors are there?" before searching or holding. Read-only.';

export const PREPARE_CANCEL_DESCRIPTION =
  'Arm the page for the person to CANCEL their booked appointment. Cancels nothing itself: the ' +
  'dock shows "press to cancel" and only a key, switch or held gesture from the person performs ' +
  'it. Refused when nothing is booked.';

export const JOIN_WAITLIST_DESCRIPTION =
  'Put your human in line for a slot that is NOT open (held or booked by someone else). If it ' +
  'comes back — a hold lapses, a cancellation — the clinic hands it to the first in line as a ' +
  'fresh three-minute hold, in order: nobody races. Reversible (clinic_leave_waitlist). Answers ' +
  'with the position. Booking still takes one press from your human.';

export const LEAVE_WAITLIST_DESCRIPTION =
  'Take your human out of the line for a slot they no longer want. Reversible, immediate. ' +
  'Use it when they change their mind or when they have booked something else.';

export const WAITLIST_CHOREOGRAPHY =
  'Your human is in line. If the slot comes back it becomes their hold automatically — tell them the ' +
  'dock will arm by itself and one keypress books it. You cannot press it.';

export const MY_APPOINTMENT_DESCRIPTION =
  "Your human's booked appointment(s) on this board — time, clinician, kind, slot id — newest " +
  'first. This tool exists only because your human booked: it appeared when they pressed, and ' +
  'it disappears if nothing is booked. Read-only. To change a booking, arm a cancel or a move; ' +
  'the press is theirs.';

export const PREPARE_MOVE_DESCRIPTION =
  'Arm the page for the person to MOVE their booking to another slot. Holds the target slot so it ' +
  'cannot be taken while they decide, then the dock shows "press to move". Moves nothing itself — ' +
  'one press from the person performs the swap atomically. Refused without a booking or an open target.';

export function clinicToolDefs(source: ClinicToolsSource, options: ClinicToolsOptions = {}): ClinicToolDef[] {
  // A getter, because the page learns its budget (live board = two network round trips) after
  // the tools are registered, and registration is once per mount — re-registering the same nine
  // names collides in the model context.
  const settleBudget = () =>
    typeof options.settleTimeoutMs === 'function' ? options.settleTimeoutMs() : (options.settleTimeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS);
  const pollMs = options.settlePollMs ?? DEFAULT_SETTLE_POLL_MS;

  return [
    {
      name: 'clinic_list_drops',
      title: 'List the slots in this drop',
      description: LIST_DROPS_DESCRIPTION,
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        return asToolResult(listDrops(source()));
      },
    },
    {
      name: 'clinic_find_slots',
      title: 'Search slots by clinician, kind, or time',
      description: FIND_SLOTS_DESCRIPTION,
      inputSchema: findSlotsSchema,
      annotations: { readOnlyHint: true },
      async execute(raw) {
        const input = coerceInput(raw);
        const view = source();
        const wantClin = typeof input.clinician === 'string' ? input.clinician.trim().toLowerCase() : '';
        const wantKind = typeof input.kind === 'string' ? input.kind.trim().toLowerCase() : '';
        const after = parseClockText(input.after);
        const before = parseClockText(input.before);
        if (typeof input.after === 'string' && input.after.trim() !== '' && after === null) {
          return asToolResult({
            ok: false,
            error: 'bad_time',
            detail: `Could not read "${String(input.after).slice(0, 40)}" as a time. Say it like "9:00 AM".`,
          } satisfies ErrorResult);
        }
        if (typeof input.before === 'string' && input.before.trim() !== '' && before === null) {
          return asToolResult({
            ok: false,
            error: 'bad_time',
            detail: `Could not read "${String(input.before).slice(0, 40)}" as a time. Say it like "11:30 AM".`,
          } satisfies ErrorResult);
        }
        const open = view.session.slots.filter((s) => s.state === 'open');
        // Apply each filter separately so a miss can name the constraint that eliminated everything.
        const byClin = wantClin ? open.filter((s) => s.clinician.toLowerCase().includes(wantClin)) : open;
        const byKind = wantKind ? byClin.filter((s) => s.kind.toLowerCase().includes(wantKind)) : byClin;
        const matches = byKind.filter((s) => {
          const t = slotMinutes(s.timeLabel);
          if (t === null) return after === null && before === null;
          if (after !== null && t < after) return false;
          if (before !== null && t > before) return false;
          return true;
        });
        const nextWaveAt = view.nextWaveAt ?? null;
        const nextWave = nextWaveAt === null ? null : Math.max(0, round1((nextWaveAt - view.session.now) / 1000));
        if (matches.length === 0) {
          const eliminated_by = open.length === 0
            ? 'no_open_slots'
            : wantClin && byClin.length === 0
              ? 'clinician'
              : wantKind && byKind.length === 0
                ? 'kind'
                : after !== null || before !== null
                  ? 'time_window'
                  : 'no_open_slots';
          return asToolResult({
            ok: true,
            matches: [],
            eliminated_by,
            detail: eliminated_by === 'no_open_slots'
              ? 'Nothing is open right now. The next wave may bring more.'
              : `Open slots exist, but none match your ${eliminated_by.replace('_', ' ')}. Relax that one.`,
            open_slot_ids: openIds(view.session.slots),
            next_wave_seconds: nextWave,
            booking: 'human_only' as const,
          });
        }
        return asToolResult({
          ok: true,
          matches: matches.map(toAgentSlot),
          next_wave_seconds: nextWave,
          your_hold: holdSummary(view),
          booking: 'human_only' as const,
        });
      },
    },
    {
      name: 'clinic_clinicians',
      title: "Who is on today's board",
      description: CLINICIANS_DESCRIPTION,
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        const view = source();
        const byName = new Map<string, { open_times: string[]; kinds: Set<string> }>();
        for (const s of view.session.slots) {
          const row = byName.get(s.clinician) ?? { open_times: [], kinds: new Set<string>() };
          row.kinds.add(s.kind);
          if (s.state === 'open') row.open_times.push(s.timeLabel);
          byName.set(s.clinician, row);
        }
        return asToolResult({
          ok: true,
          clinic: CLINIC_NAME,
          fictional_clinic: true,
          clinicians: [...byName.entries()].map(([name, row]) => ({
            name,
            open_times: row.open_times,
            kinds: [...row.kinds],
          })),
          booking: 'human_only' as const,
        });
      },
    },
    {
      name: 'clinic_hold_slot',
      title: 'Hold a slot for your human (never books it)',
      description: HOLD_SLOT_DESCRIPTION,
      inputSchema: holdSlotSchema,
      annotations: { readOnlyHint: false },
      async execute(raw, ctx) {
        const input = coerceInput(raw);
        const slotId = typeof input.slot_id === 'string' ? input.slot_id.trim() : '';
        const before = source();
        if (!slotId) {
          return asToolResult({
            ok: false,
            error: 'slot_id_required',
            detail: 'Pass the id of an open slot from clinic_list_drops.',
            open_slot_ids: openIds(before.session.slots),
          } satisfies ErrorResult);
        }
        const slot = before.session.slots.find((s) => s.id === slotId);
        if (!slot) {
          return asToolResult({
            ok: false,
            error: 'unknown_slot',
            detail: `This drop has no slot "${slotId}".`,
            open_slot_ids: openIds(before.session.slots),
          } satisfies ErrorResult);
        }
        if (slot.state !== 'open') {
          // The honest failure the demo is built around: the rival got there first.
          return asToolResult({
            ok: false,
            error: slot.state === 'held_by_you' ? 'already_held_by_you' : 'slot_not_open',
            ...(before.waitlistAvailable && (slot.state === 'held_by_other' || slot.state === 'taken_by_other')
              ? { hint: 'clinic_join_waitlist: put your human in line for it — if it comes back, it is theirs first.' }
              : {}),
            detail:
              slot.state === 'taken_by_rival'
                ? 'Someone else took this slot. Pick another id from open_slot_ids.'
                : slot.state === 'taken_by_other'
                  ? 'Another visitor booked this slot. Pick another id from open_slot_ids.'
                  : slot.state === 'held_by_other'
                    ? 'Another visitor is holding this slot right now. Pick another id from open_slot_ids.'
                    : `Slot "${slotId}" is ${slot.state}.`,
            slot_state: slot.state,
            open_slot_ids: openIds(before.session.slots),
          } satisfies ErrorResult);
        }

        const previous = before.session.held?.slotId ?? null;
        // The one verb. `driver.confirm` is one property away and is never touched here.
        before.driver.hold(slotId);
        const settled = await settle(source, (v) => v.session.held?.slotId === slotId, settleBudget(), pollMs, ctx?.signal);
        const after = source();
        if (!settled) {
          const now = after.session.slots.find((s) => s.id === slotId);
          return asToolResult({
            ok: false,
            error: 'hold_not_confirmed',
            detail: 'The page did not report the hold. Call clinic_list_drops and try again.',
            slot_state: now?.state ?? slot.state,
            open_slot_ids: openIds(after.session.slots),
          } satisfies ErrorResult);
        }
        const hold = holdSummary(after)!;
        return asToolResult({
          ok: true,
          held: true,
          your_hold: hold,
          ...(previous && previous !== slotId ? { released_previous_hold: previous } : {}),
          booking: 'human_only' as const,
          // Verbatim, so the agent can read it out without paraphrasing the one line that matters.
          next_step: HOLD_CHOREOGRAPHY,
        });
      },
    },
    {
      name: 'clinic_hold_status',
      title: 'Time left on your hold',
      description: HOLD_STATUS_DESCRIPTION,
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        return asToolResult(holdStatus(source()));
      },
    },
    {
      name: 'clinic_release_hold',
      title: 'Release the slot you are holding',
      description: RELEASE_HOLD_DESCRIPTION,
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: false },
      async execute(_raw, ctx) {
        const before = source();
        const held = before.session.held;
        if (!held) {
          return asToolResult({
            ok: false,
            error: 'nothing_held',
            detail: 'This session is not holding a slot; there is nothing to release.',
            open_slot_ids: openIds(before.session.slots),
          } satisfies ErrorResult);
        }
        before.driver.release(held.slotId);
        const settled = await settle(source, (v) => v.session.held === null, settleBudget(), pollMs, ctx?.signal);
        const after = source();
        if (!settled) {
          return asToolResult({
            ok: false,
            error: 'release_not_confirmed',
            detail: 'The page still reports the hold. Call clinic_hold_status to check.',
            slot_state: after.session.slots.find((s) => s.id === held.slotId)?.state,
            open_slot_ids: openIds(after.session.slots),
          } satisfies ErrorResult);
        }
        return asToolResult({
          ok: true,
          released: held.slotId,
          held: false,
          open_slot_ids: openIds(after.session.slots),
          booking: 'human_only' as const,
        });
      },
    },
    {
      name: 'clinic_prepare_cancel',
      title: 'Arm the page to cancel (never cancels)',
      description: PREPARE_CANCEL_DESCRIPTION,
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: false },
      async execute() {
        const view = source();
        // The NEWEST booking: on the live board earlier ones stay visible for a few waves.
        const booked = [...view.session.slots].reverse().find((s) => s.state === 'booked_yours');
        if (!booked) {
          return asToolResult({
            ok: false,
            error: 'nothing_booked',
            detail: 'Your human has no booked appointment on this board, so there is nothing to cancel.',
            open_slot_ids: openIds(view.session.slots),
          } satisfies ErrorResult);
        }
        if (view.session.held !== null) {
          return asToolResult({
            ok: false,
            error: 'hold_in_progress',
            detail: 'You are holding a slot right now — the page shows your human the booking dock, not a cancel dock. Release the hold (clinic_release_hold) or let them decide it first.',
          } satisfies ErrorResult);
        }
        // Never `driver.cancel` — that verb is the human's. The page's dock is armed instead.
        if (!options.onPrepareCancel || !options.onPrepareCancel(booked.id)) {
          // Say WHY when we can: the page refuses when the board moved between our read and the arm.
          const nowSlot = source().session.slots.find((s) => s.id === booked.id);
          if (!nowSlot || nowSlot.state !== 'booked_yours') {
            return asToolResult({
              ok: false,
              error: 'nothing_booked',
              detail: 'The booking is no longer on the board (the release may have rolled). Call clinic_list_drops.',
            } satisfies ErrorResult);
          }
          return asToolResult({
            ok: false,
            error: 'dock_not_wired',
            detail: 'This page cannot arm the cancel dock right now. Ask your human to cancel on the page.',
          } satisfies ErrorResult);
        }
        return asToolResult({
          ok: true,
          armed: 'cancel' as const,
          slot: toAgentSlot(booked),
          cancelling: 'human_only' as const,
          next_step: CANCEL_CHOREOGRAPHY,
        });
      },
    },
    {
      name: 'clinic_prepare_move',
      title: 'Arm the page to move a booking (never moves)',
      description: PREPARE_MOVE_DESCRIPTION,
      inputSchema: prepareMoveSchema,
      annotations: { readOnlyHint: false },
      async execute(raw, ctx) {
        const input = coerceInput(raw);
        const toId = typeof input.new_slot_id === 'string' ? input.new_slot_id.trim() : '';
        const view = source();
        // The NEWEST booking: on the live board earlier ones stay visible for a few waves.
        const booked = [...view.session.slots].reverse().find((s) => s.state === 'booked_yours');
        if (!booked) {
          return asToolResult({
            ok: false,
            error: 'nothing_booked',
            detail: 'Your human has no booked appointment to move. clinic_hold_slot holds a new one instead.',
            open_slot_ids: openIds(view.session.slots),
          } satisfies ErrorResult);
        }
        if (!toId) {
          return asToolResult({
            ok: false,
            error: 'new_slot_id_required',
            detail: 'Pass the id of an open slot from clinic_find_slots or clinic_list_drops.',
            open_slot_ids: openIds(view.session.slots),
          } satisfies ErrorResult);
        }
        const target = view.session.slots.find((s) => s.id === toId);
        if (!target) {
          return asToolResult({
            ok: false,
            error: 'unknown_slot',
            detail: `This drop has no slot "${toId}".`,
            open_slot_ids: openIds(view.session.slots),
          } satisfies ErrorResult);
        }
        if (target.id === booked.id) {
          return asToolResult({
            ok: false,
            error: 'same_slot',
            detail: 'That is the slot your human already has.',
            open_slot_ids: openIds(view.session.slots),
          } satisfies ErrorResult);
        }
        if (target.state !== 'open' && target.state !== 'held_by_you') {
          return asToolResult({
            ok: false,
            error: 'slot_unavailable',
            detail: `Slot "${toId}" is ${target.state}, not open.`,
            slot_state: target.state,
            open_slot_ids: openIds(view.session.slots),
          } satisfies ErrorResult);
        }
        // P1-2: a live hold on a DIFFERENT slot means the person may be mid-press on the book dock.
        // Arming a move would silently release that hold and swap the dock's meaning under their
        // finger. Refused — unless the hold IS the target, which is the legitimate two-step flow.
        if (view.session.held !== null && view.session.held.slotId !== target.id) {
          return asToolResult({
            ok: false,
            error: 'hold_in_progress',
            detail: 'You are holding a different slot — the page shows your human the booking dock. Release the hold (clinic_release_hold) or let them decide it first.',
          } satisfies ErrorResult);
        }
        // Never `driver.move` — the swap itself is the human's. The dock is armed with the target,
        // and the page freezes it with a hold (the agent's verb) so nobody takes it mid-decision.
        if (!options.onPrepareMove || !options.onPrepareMove(booked.id, target.id)) {
          // Say WHY when we can: the usual reason is a race — the target got taken mid-call.
          const nowView = source();
          const nowTarget = nowView.session.slots.find((s) => s.id === target.id);
          if (nowTarget && nowTarget.state !== 'open' && nowTarget.state !== 'held_by_you') {
            return asToolResult({
              ok: false,
              error: 'slot_unavailable',
              detail: `Slot "${target.id}" was taken while arming. Pick another from clinic_find_slots.`,
              slot_state: nowTarget.state,
              open_slot_ids: openIds(nowView.session.slots),
            } satisfies ErrorResult);
          }
          return asToolResult({
            ok: false,
            error: 'dock_not_wired',
            detail: 'This page cannot arm the move dock right now. Ask your human to rebook on the page.',
          } satisfies ErrorResult);
        }
        // The freeze lands through React state; answer with the target as it IS, not as it was.
        await settle(source, (v) => v.session.held?.slotId === target.id, settleBudget(), pollMs, ctx?.signal);
        const after = source();
        const targetNow = after.session.slots.find((s) => s.id === target.id) ?? target;
        return asToolResult({
          ok: true,
          armed: 'move' as const,
          from_slot: toAgentSlot(booked),
          to_slot: toAgentSlot(targetNow),
          target_frozen: after.session.held?.slotId === target.id,
          moving: 'human_only' as const,
          next_step: MOVE_CHOREOGRAPHY,
        });
      },
    },
    {
      name: 'clinic_join_waitlist',
      title: 'Put your human in line for a taken slot',
      description: JOIN_WAITLIST_DESCRIPTION,
      inputSchema: waitlistSchema,
      annotations: { readOnlyHint: false },
      async execute(raw, ctx) {
        const input = coerceInput(raw);
        const slotId = typeof input.slot_id === 'string' ? input.slot_id.trim() : '';
        const view = source();
        if (!slotId) {
          return asToolResult({ ok: false, error: 'slot_id_required', detail: 'Pass the id of a slot that is held or booked by someone else.', open_slot_ids: openIds(view.session.slots) } satisfies ErrorResult);
        }
        const slot = view.session.slots.find((s) => s.id === slotId);
        if (!slot) {
          return asToolResult({ ok: false, error: 'unknown_slot', detail: `This drop has no slot "${slotId}".`, open_slot_ids: openIds(view.session.slots) } satisfies ErrorResult);
        }
        if (slot.state === 'open') {
          return asToolResult({ ok: false, error: 'slot_open', detail: 'That slot is open right now — clinic_hold_slot it instead of waiting for it.', slot_state: slot.state, open_slot_ids: openIds(view.session.slots) } satisfies ErrorResult);
        }
        if (slot.state === 'held_by_you' || slot.state === 'booked_yours') {
          return asToolResult({ ok: false, error: 'already_yours', detail: "That slot is already your human's.", slot_state: slot.state } satisfies ErrorResult);
        }
        if (slot.state === 'taken_by_rival') {
          // The simulated rival never gives a slot back this wave: a line behind it is a dead wait.
          return asToolResult({ ok: false, error: 'slot_unavailable', detail: 'That slot was taken for the rest of this release; it will not come back. Pick another id from open_slot_ids, or wait for the next release.', slot_state: slot.state, open_slot_ids: openIds(view.session.slots) } satisfies ErrorResult);
        }
        if (!options.onJoinWaitlist || !options.onJoinWaitlist(slotId)) {
          return asToolResult({ ok: false, error: 'waitlist_unavailable', detail: 'This board has no waitlist.' } satisfies ErrorResult);
        }
        const settled = await settle(source, (v) => (v.session.slots.find((s) => s.id === slotId)?.yourPosition ?? 0) > 0, settleBudget(), pollMs, ctx?.signal);
        const now = source().session.slots.find((s) => s.id === slotId);
        if (!settled) {
          // The seam is fire-and-forget; the board is the truth. A refused join (cap, a past wave, a
          // race) must never be reported as a place in line.
          return asToolResult({ ok: false, error: 'waitlist_not_confirmed', detail: 'The board did not report a place in line. It may be full for your human (three lines at most), or the slot changed. Call clinic_list_drops and try again.', slot_state: now?.state ?? slot.state, open_slot_ids: openIds(source().session.slots) } satisfies ErrorResult);
        }
        return asToolResult({
          ok: true,
          waiting: true,
          slot: now ? toAgentSlot(now) : toAgentSlot(slot),
          position: now?.yourPosition ?? null,
          ahead_of_you: now?.yourPosition ? now.yourPosition - 1 : null,
          booking: 'human_only' as const,
          next_step: WAITLIST_CHOREOGRAPHY,
        });
      },
    },
    {
      name: 'clinic_leave_waitlist',
      title: 'Take your human out of a line',
      description: LEAVE_WAITLIST_DESCRIPTION,
      inputSchema: waitlistSchema,
      annotations: { readOnlyHint: false },
      async execute(raw, ctx) {
        const input = coerceInput(raw);
        const slotId = typeof input.slot_id === 'string' ? input.slot_id.trim() : '';
        const view = source();
        const slot = view.session.slots.find((s) => s.id === slotId);
        if (!slotId || !slot) {
          return asToolResult({ ok: false, error: 'unknown_slot', detail: `This drop has no slot "${slotId}".` } satisfies ErrorResult);
        }
        if (!slot.yourPosition) {
          return asToolResult({ ok: false, error: 'not_waiting', detail: 'Your human is not in line for that slot.', slot_state: slot.state } satisfies ErrorResult);
        }
        if (!options.onLeaveWaitlist || !options.onLeaveWaitlist(slotId)) {
          return asToolResult({ ok: false, error: 'waitlist_unavailable', detail: 'This board has no waitlist.' } satisfies ErrorResult);
        }
        const left = await settle(source, (v) => !(v.session.slots.find((s) => s.id === slotId)?.yourPosition), settleBudget(), pollMs, ctx?.signal);
        if (!left) {
          return asToolResult({ ok: false, error: 'waitlist_not_confirmed', detail: 'The board still shows your human in that line. Call clinic_list_drops and try again.' } satisfies ErrorResult);
        }
        return asToolResult({ ok: true, waiting: false, slot_id: slotId, booking: 'human_only' as const });
      },
    },
    {
      name: 'clinic_my_appointment',
      title: "Your human's booked appointment(s)",
      description: MY_APPOINTMENT_DESCRIPTION,
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        const view = source();
        const mine = [...view.session.slots].reverse().filter((s) => s.state === 'booked_yours').map(toAgentSlot);
        if (mine.length === 0) {
          return asToolResult({
            ok: false,
            error: 'nothing_booked',
            detail: 'Your human has no booked appointment on this board right now.',
            open_slot_ids: openIds(view.session.slots),
          } satisfies ErrorResult);
        }
        return asToolResult({
          ok: true,
          appointments: mine,
          newest_first: true,
          you_can: 'Arm a cancel (clinic_prepare_cancel) or a move (clinic_prepare_move). Your human performs either with one press; you cannot.',
          changing: 'human_only' as const,
        });
      },
    },
    {
      name: 'clinic_explain_confirm',
      title: 'Why there is no booking tool',
      description: EXPLAIN_CONFIRM_DESCRIPTION,
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        const view = source();
        return asToolResult({
          ok: true,
          booking: 'human_only' as const,
          reason: NO_BOOKING_TOOL_REASON,
          tools_that_exist: [
            ...BASE_TOOL_NAMES,
            ...(view.waitlistAvailable ? WAITLIST_TOOL_NAMES : []),
            ...(hasOwnBooking(view) ? BOOKED_TOOL_NAMES : []),
          ],
          ...(hasOwnBooking(view) ? {} : { tools_that_appear_after_your_human_books: [...BOOKED_TOOL_NAMES] }),
          tool_that_books: null,
          human_only_acts: ['book', 'cancel', 'move'],
          what_to_tell_your_human: HOLD_CHOREOGRAPHY,
          your_hold: holdSummary(view),
        });
      },
    },
  ];
}

// ── registration ────────────────────────────────────────────────────────────────────────────────

export type ClinicRegistrationState =
  | { kind: 'unsupported' }
  | {
      kind: 'registered';
      names: ClinicToolName[];
      /** What the BROWSER says it has for this origin, when it can be asked — proof, not our claim. */
      browserCount?: number;
    }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

/**
 * Register the base nine with `document.modelContext` (or the `navigator` alias); the tenth is
 * born and unregistered by the human's act (SPEC-V4). The returned function drops everything. Feature-detected:
 * with no modelContext this is a no-op that reports `unsupported` — the page must work identically
 * in a browser that has never heard of WebMCP.
 */
export async function registerClinicTools(
  source: ClinicToolsSource,
  onState: (state: ClinicRegistrationState) => void,
  options: ClinicToolsOptions = {},
): Promise<() => void> {
  const mc = (options.modelContext ?? getModelContext)();
  if (!mc) {
    onState({ kind: 'unsupported' });
    return () => {};
  }
  const defs = clinicToolDefs(source, options);
  const toTool = (def: ClinicToolDef): ModelContextTool<unknown> => ({
    name: def.name,
    title: def.title,
    description: def.description,
    inputSchema: def.inputSchema,
    annotations: def.annotations,
    execute: async (input, execOptions) => {
      const at = Date.now();
      try {
        const res = await def.execute(input, execOptions ? { signal: execOptions.signal } : undefined);
        options.onCall?.({ at, name: def.name, ms: Date.now() - at, ...summariseToolAnswer(def.name, res) });
        return res;
      } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        options.onCall?.({ at, name: def.name, ms: Date.now() - at, ok: false, summary: `failed — ${why.slice(0, 110)}` });
        throw err;
      }
    },
  });
  const registerSet = async (names: readonly ClinicToolName[], signal: AbortSignal) => {
    for (const def of defs) {
      if (names.includes(def.name)) await mc.registerTool(toTool(def), { signal });
    }
  };

  const base = new AbortController();
  let booked: AbortController | null = null;
  let disposed = false;
  const loadSet: ClinicToolName[] = [...BASE_TOOL_NAMES, ...(options.onJoinWaitlist ? WAITLIST_TOOL_NAMES : [])];
  const liveNames = (): ClinicToolName[] => (booked ? [...loadSet, ...BOOKED_TOOL_NAMES] : [...loadSet]);
  // Ask the platform for its own count after each change. Not every client exposes getTools; when
  // it does, the page can show "the browser confirms N" instead of only its own belief.
  const report = async () => {
    let browserCount: number | undefined;
    try {
      const mine = await mc.getTools?.();
      if (Array.isArray(mine)) browserCount = mine.filter((t) => (CLINIC_TOOL_NAMES as readonly string[]).includes(t.name)).length;
    } catch {
      browserCount = undefined;
    }
    if (!disposed) onState({ kind: 'registered', names: liveNames(), ...(browserCount !== undefined ? { browserCount } : {}) });
  };

  try {
    await registerSet(loadSet, base.signal);
    await report();
  } catch (e) {
    // Half a surface is worse than none: a throw mid-loop must not leave the earlier tools live
    // under a label that says registration failed.
    base.abort();
    onState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    return () => {};
  }

  // The human's act, watched: a booking appears → the booked set is born (Chrome fires
  // toolchange); the last booking goes → it is unregistered. Polled, because the seam has no
  // event stream and 400 ms is well inside the beat of a person reading a dock.
  let busy = false;
  let again = false;
  const reconcile = async () => {
    if (disposed) return;
    if (busy) {
      again = true; // a tick landed mid-registration: run once more when this one settles
      return;
    }
    busy = true;
    try {
      const want = hasOwnBooking(source());
      if (want && booked === null) {
        const ac = new AbortController();
        booked = ac;
        try {
          await registerSet(BOOKED_TOOL_NAMES, ac.signal);
        } catch {
          ac.abort();
          booked = null;
          return;
        }
        await report();
      } else if (!want && booked !== null) {
        // The state settles no matter what the platform does with the abort: a throwing unregister
        // must never leave the page claiming a tool that has no booking behind it.
        const dying = booked;
        booked = null;
        try {
          dying.abort();
        } catch {
          /* the model context refused to unregister; the count is still the truth we can keep */
        }
        await report();
      }
    } finally {
      busy = false;
      if (again && !disposed) {
        again = false;
        void reconcile();
      }
    }
  };
  await reconcile(); // a reload with a booking already on the board gets its tools at once
  const watch = setInterval(() => void reconcile(), options.watchMs ?? 250);
  // Under Node (tests) a live interval would keep the process alive after the last test; the
  // browser's setInterval returns a number and has no unref — hence the guard.
  (watch as unknown as { unref?: () => void }).unref?.();

  return () => {
    disposed = true;
    clearInterval(watch);
    booked?.abort();
    base.abort();
  };
}
