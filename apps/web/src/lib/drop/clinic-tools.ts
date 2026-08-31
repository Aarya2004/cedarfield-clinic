/**
 * ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║  PROVISIONAL SCHEMA — Arav red-lines before lock.                                            ║
 * ║  Names, input schemas and result shapes below are a proposal (SPEC-V1 §3), not a contract.    ║
 * ║  Nothing outside this file and ClinicTools.tsx depends on them; change them freely until the  ║
 * ║  lock, then move whatever survives into a `contract:` commit.                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * The five WebMCP tools of the Cedarfield Clinic booking page (SPEC-V1 §3). Registered top-level,
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

/** The five, in registration order. Five, against a self-imposed cap of twelve. */
export const CLINIC_TOOL_NAMES = [
  'clinic_list_drops',
  'clinic_hold_slot',
  'clinic_hold_status',
  'clinic_release_hold',
  'clinic_explain_confirm',
] as const;

export type ClinicToolName = (typeof CLINIC_TOOL_NAMES)[number];

/**
 * The sentence a successful hold hands the agent to relay (SPEC-V1 §3). It is a result field and
 * not just prose in a description, because the agent that needs it most is the one that already
 * decided it had finished reading descriptions.
 */
export const HOLD_CHOREOGRAPHY =
  'The slot is held. Tell your human: one keypress on the page books it — you cannot.';

/** The answer `clinic_explain_confirm` gives, and the reason the other four stop where they do. */
export const NO_BOOKING_TOOL_REASON =
  'This page deliberately publishes no booking or confirmation tool. Booking is gated on a ' +
  "browser-trusted event — a real key press or click from the person at the keyboard — which no " +
  'tool call can produce; a synthetic press is rejected by the page. So the division of labour is: ' +
  'you do the fast, expensive parts (watch the drop, hold a slot, keep the clock), your human does ' +
  'the one part that must stay theirs (press the key). Hold the slot, then say so out loud.';

// ── the seam ────────────────────────────────────────────────────────────────────────────────────

/** What the tools are allowed to see. Everything is live — never a captured snapshot. */
export interface ClinicToolsView {
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
  settleTimeoutMs?: number;
  /** Poll interval while settling. */
  settlePollMs?: number;
  /** Feature detection seam, for tests. Defaults to `document/navigator.modelContext`. */
  modelContext?: () => ModelContext | null;
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
}

export interface ListDropsResult {
  ok: true;
  clinic: string;
  demo: true;
  slots: AgentSlot[];
  open_count: number;
  /** Seconds until the next wave, when the page knows; null when it does not. Never invented. */
  next_wave_seconds: number | null;
  /** Seconds since the wave on the board landed, or null before the first wave. */
  wave_landed_seconds_ago: number | null;
  your_hold: HoldSummary | null;
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
  return { id: slot.id, time: slot.timeLabel, clinician: slot.clinician, kind: slot.kind, state: slot.state };
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
  const nextWaveAt = view.nextWaveAt ?? null;
  return {
    ok: true,
    clinic: CLINIC_NAME,
    demo: true,
    slots: session.slots.map(toAgentSlot),
    open_count: openIds(session.slots).length,
    next_wave_seconds: nextWaveAt === null ? null : Math.max(0, round1((nextWaveAt - session.now) / 1000)),
    wave_landed_seconds_ago: lastWave ? Math.max(0, round1((session.now - lastWave.at) / 1000)) : null,
    your_hold: holdSummary(view),
    booking: 'human_only',
  };
}

/** Pure: the whole `clinic_hold_status` answer. */
export function holdStatus(view: ClinicToolsView): HoldStatusResult {
  const hold = holdSummary(view);
  return {
    ok: true,
    held: hold !== null,
    your_hold: hold,
    booking: 'human_only',
    next_step: hold
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
async function settle(source: ClinicToolsSource, predicate: (v: ClinicToolsView) => boolean, timeoutMs: number, pollMs: number): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  for (;;) {
    if (predicate(source())) return true;
    if (Date.now() >= deadline) return predicate(source());
    await sleep(Math.max(1, pollMs));
  }
}

// ── descriptions (the choreography lives here as well as in the results) ────────────────────────

export const LIST_DROPS_DESCRIPTION =
  "List the appointment slots in this clinic's current drop: id, time, clinician, kind, and state " +
  '(open, held_by_you, held_by_other, taken_by_rival, booked_yours, expired_hold). Read-only — it ' +
  'changes nothing. Start here, then clinic_hold_slot to take one slot out of the race for your ' +
  'human. There is deliberately NO booking tool on this page: only your human can book, with one ' +
  'key press on the page. Demo inventory, simulated rival — nothing real is booked.';

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
  execute: (input?: unknown) => Promise<ToolTextResult>;
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
export function clinicToolDefs(source: ClinicToolsSource, options: ClinicToolsOptions = {}): ClinicToolDef[] {
  const timeoutMs = options.settleTimeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS;
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
      name: 'clinic_hold_slot',
      title: 'Hold a slot for your human (never books it)',
      description: HOLD_SLOT_DESCRIPTION,
      inputSchema: holdSlotSchema,
      annotations: { readOnlyHint: false },
      async execute(raw) {
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
            detail:
              slot.state === 'taken_by_rival'
                ? 'Someone else took this slot. Pick another id from open_slot_ids.'
                : `Slot "${slotId}" is ${slot.state}.`,
            slot_state: slot.state,
            open_slot_ids: openIds(before.session.slots),
          } satisfies ErrorResult);
        }

        const previous = before.session.held?.slotId ?? null;
        // The one verb. `driver.confirm` is one property away and is never touched here.
        before.driver.hold(slotId);
        const settled = await settle(source, (v) => v.session.held?.slotId === slotId, timeoutMs, pollMs);
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
      async execute() {
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
        const settled = await settle(source, (v) => v.session.held === null, timeoutMs, pollMs);
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
          tools_that_exist: [...CLINIC_TOOL_NAMES],
          tool_that_books: null,
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
  | { kind: 'registered'; names: ClinicToolName[] }
  | { kind: 'error'; message: string };

/**
 * Register the five with `document.modelContext` (or the `navigator` alias) under ONE
 * AbortController; the returned function aborts it, which unregisters all five. Feature-detected:
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
  const ac = new AbortController();
  try {
    for (const def of clinicToolDefs(source, options)) {
      const tool: ModelContextTool<unknown> = {
        name: def.name,
        title: def.title,
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
        execute: def.execute,
      };
      await mc.registerTool(tool, { signal: ac.signal });
    }
    onState({ kind: 'registered', names: [...CLINIC_TOOL_NAMES] });
  } catch (e) {
    onState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
  }
  return () => ac.abort();
}
