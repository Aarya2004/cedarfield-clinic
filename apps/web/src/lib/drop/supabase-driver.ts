/**
 * The live board — every visitor shares ONE inventory (SPEC-V3, 2026-09-01).
 *
 * This is the "real backend plugs in here" seam made real: the same `DropDriver` contract the mock
 * implements, backed by Postgres. When one visitor books 9:00, every other open tab watches it go.
 * The division of labour the product is about does not move an inch:
 *
 *   · the PAGE still gates book/cancel/move on a trusted human press (or the opt-in gesture) —
 *     none of this file is reachable except through that gate or the agent's own hold/release;
 *   · the DATABASE now enforces what a page never could for two strangers at once: one hold per
 *     visitor, hold-before-book, only-your-booking cancels, and an atomic move — as RLS +
 *     SECURITY DEFINER functions, not as promises (supabase/migrations: cedarfield_board).
 *
 * Identity is an anonymous Supabase session per browser: your holds and bookings are yours across
 * reloads, and no other visitor — and no script holding only the publishable key — can touch them.
 * The publishable key below is public by design; every write is authorised by RLS, not by secrecy.
 *
 * Events carry epoch `at` and the session runs with `clock: null`, exactly as the DropSession
 * contract's "real driver" case specifies. The world advances server-side (lazily, on every read);
 * this client just re-reads it — on realtime pings, on a poll fallback, and on its own verbs.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DropDriver, DropEvent, Slot, SlotState } from './types.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://hxqpaquhkmnrnjfutuyu.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_5vuucxEB_4VUDmspqoqAJA_YtN22qUK';

const HOLD_TTL_SECONDS = 45;
const POLL_MS = 2500;
const LOCAL_SWEEP_MS = 500;

interface BoardRow {
  id: string;
  time_label: string;
  clinician: string;
  kind: string;
  state: 'open' | 'held' | 'booked' | 'rival';
  yours_held: boolean;
  yours_booked: boolean;
  hold_expires_at: string | null;
}

interface Board {
  wave: number;
  wave_started_at: string;
  next_wave_at: string;
  server_now: string;
  slots: BoardRow[];
}

/** Pure: one server row → the page's slot vocabulary. Another patient is never "the rival". */
export function rowToSlot(row: BoardRow): Slot {
  const state: SlotState =
    row.state === 'open'
      ? 'open'
      : row.state === 'rival'
        ? 'taken_by_rival'
        : row.state === 'held'
          ? row.yours_held
            ? 'held_by_you'
            : 'held_by_other'
          : row.yours_booked
            ? 'booked_yours'
            : 'taken_by_other';
  return { id: row.id, timeLabel: row.time_label, clinician: row.clinician, kind: row.kind, state };
}

export interface LiveMeta {
  waveStartedAt: number | null;
  nextWaveAt: number | null;
  /** Signed in and first board loaded. The page renders a quiet connecting line until true. */
  ready: boolean;
  /** The last verb refusal, for anyone debugging with the console open. Never rendered as UI. */
  lastError: string | null;
}

export interface LiveDriver extends DropDriver {
  meta(): LiveMeta;
  /** Same shape the page reads off the mock: the current world, synchronously. */
  snapshot(): { slots: Slot[]; hold: { slotId: string } | null };
  dispose(): void;
}

export function createSupabaseDriver(): LiveDriver {
  const client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  const subscribers = new Set<(e: DropEvent) => void>();
  let slots: Slot[] = [];
  let myHold: { slotId: string; expiresAt: number } | null = null;
  let meta: LiveMeta = { waveStartedAt: null, nextWaveAt: null, ready: false, lastError: null };
  let disposed = false;
  let refreshing = false;

  const emit = (e: DropEvent) => {
    for (const cb of subscribers) cb(e);
  };

  const ensureAuth = async (): Promise<boolean> => {
    const { data } = await client.auth.getSession();
    if (data.session) return true;
    const { error } = await client.auth.signInAnonymously();
    if (error) {
      meta = { ...meta, lastError: `sign_in: ${error.message}` };
      return false;
    }
    return true;
  };

  const rpc = async (fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: string | null }> => {
    if (!(await ensureAuth())) return { data: null, error: meta.lastError };
    const { data, error } = await client.rpc(fn, args);
    if (error) meta = { ...meta, lastError: `${fn}: ${error.message}` };
    return { data, error: error?.message ?? null };
  };

  /**
   * Re-read the world and tell the fold about it. The fold treats `drop_wave` as a full resync and
   * keeps the hold only if the arriving board still says `held_by_you` — so ordering hold events
   * BEFORE the resync is what keeps the TTL arithmetic alive across refreshes.
   */
  const refresh = async (): Promise<void> => {
    if (disposed || refreshing) return;
    refreshing = true;
    try {
      const { data, error } = await rpc('clinic_board');
      if (error || !data) return;
      const board = data as Board;
      const now = Date.now();
      const next = board.slots.map(rowToSlot);
      const mine = board.slots.find((r) => r.yours_held && r.state === 'held');

      if (mine && mine.hold_expires_at) {
        const expiresAt = Date.parse(mine.hold_expires_at);
        if (myHold?.slotId !== mine.id) {
          emit({ type: 'hold_started', slotId: mine.id, ttlSeconds: HOLD_TTL_SECONDS, at: expiresAt - HOLD_TTL_SECONDS * 1000 });
        }
        myHold = { slotId: mine.id, expiresAt };
      } else if (myHold !== null) {
        // Gone server-side: expired, released elsewhere, or absorbed by a booking. The specific
        // outcome is in the slots themselves; the fold's resync sorts the rest out.
        const was = myHold;
        myHold = null;
        const nowState = next.find((s) => s.id === was.slotId)?.state;
        if (nowState !== 'booked_yours' && was.expiresAt <= now) {
          emit({ type: 'hold_expired', slotId: was.slotId, at: was.expiresAt });
        }
      }

      // booked/cancelled transitions for MY slots, so receipts and the flow reducer stay truthful
      for (const s of next) {
        const before = slots.find((p) => p.id === s.id)?.state;
        if (before !== s.state && s.state === 'booked_yours') emit({ type: 'booked', slotId: s.id, at: now });
        if (before === 'booked_yours' && s.state === 'open') emit({ type: 'cancelled', slotId: s.id, at: now });
      }

      slots = next;
      meta = {
        waveStartedAt: Date.parse(board.wave_started_at),
        nextWaveAt: Date.parse(board.next_wave_at),
        ready: true,
        lastError: meta.lastError,
      };
      emit({ type: 'drop_wave', slots: next.map((s) => ({ ...s })), at: now });
    } finally {
      refreshing = false;
    }
  };

  // realtime: any change to the board, from anyone, anywhere → re-read. Polling is the fallback
  // for the judge whose network eats websockets; the local sweep catches a hold dying mid-tick.
  const channel = client
    .channel('clinic_slots_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_slots' }, () => void refresh())
    .subscribe();
  const poll = setInterval(() => void refresh(), POLL_MS);
  const sweep = setInterval(() => {
    if (myHold !== null && myHold.expiresAt <= Date.now()) void refresh();
    // wave boundary: the next release lands for everyone at the same instant
    if (meta.nextWaveAt !== null && Date.now() >= meta.nextWaveAt) void refresh();
  }, LOCAL_SWEEP_MS);
  void refresh();

  /** A verb is: call the database, then believe only what it says back. */
  const verb = (fn: string, args: Record<string, unknown>, onOk?: () => void) => {
    void rpc(fn, args).then(({ error }) => {
      if (!error) onOk?.();
      void refresh();
    });
  };

  return {
    subscribe(cb) {
      subscribers.add(cb);
      // late subscriber: replay the current world, same as the mock's subscribe contract
      if (meta.ready) cb({ type: 'drop_wave', slots: slots.map((s) => ({ ...s })), at: Date.now() });
      return () => subscribers.delete(cb);
    },
    hold(slotId) {
      verb('clinic_hold', { slot_id: slotId });
    },
    release(slotId) {
      verb('clinic_release', { slot_id: slotId });
    },
    /** The human's press on a held slot. Server refuses unless the hold is yours and alive. */
    confirm(slotId) {
      verb('clinic_book', { slot_id: slotId });
    },
    /**
     * The manual first-come path: a real booking site holds nothing for you. Hold-before-book is a
     * server invariant, so the one press performs both steps in order — the trusted-event gate is
     * upstream of this call either way.
     */
    book(slotId) {
      void rpc('clinic_hold', { slot_id: slotId }).then(({ error }) => {
        if (error) return void refresh();
        verb('clinic_book', { slot_id: slotId });
      });
    },
    cancel(slotId) {
      verb('clinic_cancel', { slot_id: slotId });
    },
    move(fromSlotId, toSlotId) {
      verb('clinic_move', { from_slot: fromSlotId, to_slot: toSlotId });
    },
    meta: () => meta,
    snapshot: () => ({ slots: slots.map((s) => ({ ...s })), hold: myHold ? { slotId: myHold.slotId } : null }),
    dispose() {
      disposed = true;
      clearInterval(poll);
      clearInterval(sweep);
      void client.removeChannel(channel);
    },
  };
}
