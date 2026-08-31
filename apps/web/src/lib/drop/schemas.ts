/**
 * THE DROP — WebMCP tool contract (DROP-PLAN §3). `contract:` commits only.
 *
 * Seven tools. There is deliberately NO `confirm_booking` tool: booking is a human act on the
 * page (key / switch / held gesture), never expressible through the API. A unit test asserts the
 * absence — the absence IS the product (docs/research/2026-08-30-timed-drop-verdict.md).
 *
 * Chrome budget recommendations respected (developer.chrome.com/docs/ai/webmcp/secure-tools):
 * name ≤ 30 chars · description ≤ 500 · param descriptions ≤ 150 · outputs aimed under 1.5 K
 * (watch_slots caps at WATCH_SLOTS_MAX slots + `more`).
 */

export const DROP_TOOL_NAMES = [
  'list_drops',
  'watch_slots',
  'hold_slot',
  'release_hold',
  'hold_status',
  'join_waitlist',
  'explain_confirm',
] as const;
export type DropToolName = (typeof DROP_TOOL_NAMES)[number];

/** Names that must NEVER appear on this page's tool surface, tested in schemas.test.ts. */
export const FORBIDDEN_TOOL_NAMES = ['confirm_booking', 'book_slot', 'confirm', 'book'] as const;

export const SERVICES = ['clinic', 'dmv', 'permit'] as const;
export type Service = (typeof SERVICES)[number];

/** watch_slots caps at 10 slots + `more`: 12 measured 1 583 chars worst-case, 10 measures ≤ 1 340. */
export const WATCH_SLOTS_MAX = 10;

const serviceParam = {
  type: 'string',
  enum: [...SERVICES],
  description: 'Service to filter by (clinic, dmv or permit).',
} as const;

export const listDropsSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export const watchSlotsSchema = {
  type: 'object',
  properties: { service: serviceParam },
  additionalProperties: false,
} as const;

export const holdSlotSchema = {
  type: 'object',
  properties: {
    slot_id: { type: 'string', description: 'The slot to hold, from watch_slots.' },
  },
  required: ['slot_id'],
  additionalProperties: false,
} as const;

export const releaseHoldSchema = {
  type: 'object',
  properties: {
    hold_id: { type: 'string', description: 'The hold (or waitlist entry) to release.' },
  },
  required: ['hold_id'],
  additionalProperties: false,
} as const;

export const holdStatusSchema = listDropsSchema;
export const explainConfirmSchema = listDropsSchema;

export const joinWaitlistSchema = {
  type: 'object',
  properties: { service: serviceParam },
  required: ['service'],
  additionalProperties: false,
} as const;

/** Descriptions. Every sentence is true of the shipped behaviour; the honesty rails live here. */
export const DROP_TOOL_DESCRIPTIONS: Record<DropToolName, string> = {
  list_drops:
    'Upcoming slot drops (waves): when the next wave lands, for which service, and how many ' +
    'slots it releases. Slots vanish quickly once a wave lands — watch_slots shows the live board.',
  watch_slots:
    'The live slot board: open, held and booked slots with start times. Slots held by this ' +
    'visitor are marked held_by_you. Re-call after a wave lands; state changes within seconds.',
  hold_slot:
    'Place a 90-second exclusive hold on an open slot for this visitor. Holding books NOTHING ' +
    'and auto-releases when the timer lapses. Only the person can complete a booking, by a ' +
    'single press or gesture on the page — there is no tool for that, by design. Use ' +
    'hold_status to watch the countdown.',
  release_hold: 'Release a hold (or leave a waitlist position) early so others get the slot sooner.',
  hold_status:
    'This visitor’s current hold (with seconds remaining and what the person must do), ' +
    'waitlist position, pending offer, or completed booking. Poll this while a hold is live.',
  join_waitlist:
    'Join the FIFO waitlist for a service. When a hold lapses or is released, the head of the ' +
    'waitlist automatically receives its own fresh 90-second offer — nobody has to race.',
  explain_confirm:
    'Why this page has no booking tool: the consequential act belongs to the person. The agent ' +
    'may watch, compare, hold and queue; booking happens only when the person presses a key or ' +
    'switch, or holds a gesture. Own agent, own account, no resale — the human performs the ' +
    'consequential act.',
};

/** Wire shapes shared by the page client and (mirrored, not imported) by the DropRoom worker. */
export interface SlotWire {
  id: string;
  service: Service;
  start_iso: string;
  duration_min: number;
  state: 'open' | 'held_by_you' | 'held' | 'booked';
}

export interface HoldWire {
  id: string;
  slot_id: string;
  expires_in_s: number;
}

export interface HoldStatusWire {
  hold?: HoldWire & { confirm: 'waiting for the person' };
  offer?: HoldWire & { from_waitlist: true };
  waitlist?: { service: Service; position: number };
  booking?: { slot_id: string; booked_at: string };
}

export type HoldRefusal = 'taken' | 'already_holding' | 'not_open' | 'unknown_slot';

/** Length guards (schemas.test.ts walks every tool against these). */
export const NAME_MAX = 30;
export const DESCRIPTION_MAX = 500;
export const PARAM_DESCRIPTION_MAX = 150;
