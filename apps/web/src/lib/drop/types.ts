// UI-side domain types for the Drop spike — the single shared contract between spike components.
// The future adapter maps Arav's tool/DO contract INTO these shapes; nothing here imports WebMCP.

export type SlotState =
  | 'open'
  | 'held_by_you'
  | 'held_by_other'
  | 'taken_by_rival'
  | 'booked_yours'
  | 'expired_hold';

export interface Slot {
  id: string;
  timeLabel: string; // "9:20 AM"
  clinician: string;
  kind: string; // "New patient" | "Follow-up" | …
  state: SlotState;
}

export type DropEvent =
  | { type: 'drop_wave'; slots: Slot[]; at: number }
  | { type: 'slot_taken'; slotId: string; by: 'rival'; at: number }
  | { type: 'hold_started'; slotId: string; ttlSeconds: number; at: number }
  | { type: 'hold_tick'; slotId: string; secondsLeft: number; at: number }
  | { type: 'hold_expired'; slotId: string; at: number }
  | { type: 'booked'; slotId: string; at: number }
  | { type: 'cancelled'; slotId: string; at: number };

// The adapter seam: the mock driver implements this; a real backend maps into the same shapes.
//
// RATIFIED 2026-08-31 (Engineer #4) — the contract gap Aarya flagged at the lock (T8 finding #1,
// `useDropSession.ts` ⚑) is closed by `book`. Two human verbs, one agent verb, and the split is the
// whole product:
//
//   hold(slotId)     — the AGENT's verb. Reversible, auto-expiring, books nothing. This is the only
//                      one of the four that is ever registered as a WebMCP tool.
//   book(slotId)     — the HUMAN's verb, first-come path. ONE call: takes the slot and books it, or
//                      answers `slot_taken`. Never a tool. A take-then-book round trip is a race the
//                      user loses, which is why this is a single call and not two.
//   confirm(slotId)  — the HUMAN's verb, agent-held path. Books a slot you are already holding.
//                      Never a tool.
//   release(slotId)  — gives a hold back early. Registered (releasing is safe).
//
// Both human verbs are reachable ONLY from a trusted input event on the page (`confirm-logic.ts`).
// No WebMCP tool, and nothing an agent can call, reaches `book` or `confirm` — see SECURITY §10.
export interface DropDriver {
  subscribe(cb: (e: DropEvent) => void): () => void;
  hold(slotId: string): void;
  /** The human's one act on an open slot: take it and book it, atomically. Never a tool. */
  book(slotId: string): void;
  confirm(slotId: string): void;
  release(slotId: string): void;
  /**
   * SPEC-V2 (2026-08-31): cancel and move are HUMAN verbs like book/confirm — worse to automate
   * than booking, because they destroy something the person fought for. Tools may *arm* the dock
   * for them (clinic_prepare_cancel / clinic_prepare_move); only a trusted press calls these.
   */
  /** MUST be idempotent/state-guarded: a same-frame double call may not cancel twice. */
  cancel(slotId: string): void;
  /** Atomic: `to` becomes yours, `from` returns to open. One call — a cancel-then-rebook round trip is a race. */
  /** Same idempotency requirement as `cancel` — the mock's state guards are the reference. */
  move(fromSlotId: string, toSlotId: string): void;
}
