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
  | { type: 'booked'; slotId: string; at: number };

// The adapter seam: the mock driver implements this tonight; Arav's real contract maps into it later.
export interface DropDriver {
  subscribe(cb: (e: DropEvent) => void): () => void;
  hold(slotId: string): void;
  confirm(slotId: string): void;
  release(slotId: string): void;
}
