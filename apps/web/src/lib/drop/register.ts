/**
 * THE DROP — WebMCP tool registration (DROP-PLAN §3, §4b). Follows the shipped pattern from
 * `../webmcp/register.ts` (register once, AbortController per tool, document.modelContext first).
 *
 * Tools are thin: validate → RoomClient call → wire shape from schemas.ts. The RoomClient is
 * injected so every tool is unit-tested against a fake; the real client (WS + fetch to the
 * DropRoom worker) implements the same interface. NOTHING here can book: the interface itself
 * has no confirm method — the confirm token flow lives in confirm.ts and is reachable only from
 * trusted input handlers on the page (the absence mirrors the API's absence, by design).
 */

import {
  DROP_TOOL_DESCRIPTIONS,
  WATCH_SLOTS_MAX,
  listDropsSchema,
  watchSlotsSchema,
  holdSlotSchema,
  releaseHoldSchema,
  holdStatusSchema,
  joinWaitlistSchema,
  explainConfirmSchema,
  SERVICES,
  type Service,
  type SlotWire,
  type HoldWire,
  type HoldStatusWire,
  type HoldRefusal,
} from './schemas.ts';
import { getModelContext, type ModelContext } from '../webmcp/types.ts';

/** What the page needs from the room. Note: no confirm — that is the point. */
export interface RoomClient {
  listDrops(): Promise<{ now: string; waves: WaveWire[]; next_wave_in_s: number }>;
  watchSlots(service?: Service): Promise<{ slots: SlotWire[]; as_of: string; stale?: boolean }>;
  holdSlot(slotId: string): Promise<{ ok: boolean; hold?: HoldWire; reason?: HoldRefusal; server_ms?: number }>;
  releaseHold(holdId: string): Promise<{ ok: boolean }>;
  holdStatus(): Promise<HoldStatusWire>;
  joinWaitlist(service: Service): Promise<{ ok: boolean; position?: number }>;
}

export interface WaveWire {
  id: string;
  at: string;
  service: Service;
  slots_total: number;
  slots_expected_open: number;
}

export interface DropRegistration {
  registered: string[];
  abort(): void;
}

const isService = (v: unknown): v is Service => typeof v === 'string' && (SERVICES as readonly string[]).includes(v);

/**
 * Register the seven tools. Idempotent per page load; `abort()` unregisters all (AbortSignal —
 * the current API; `unregisterTool` was removed from the spec 2026-03-27).
 */
export function registerDropTools(client: RoomClient, mc: ModelContext | null = getModelContext()): DropRegistration {
  if (!mc) return { registered: [], abort: () => {} };
  const controller = new AbortController();
  const registered: string[] = [];
  const reg = (
    name: string,
    description: string,
    inputSchema: object,
    readOnly: boolean,
    execute: (input: Record<string, unknown>) => Promise<unknown>,
  ): void => {
    void mc
      .registerTool(
        {
          name,
          title: name.replace(/_/g, ' '),
          description,
          inputSchema: inputSchema as Record<string, unknown>,
          annotations: { readOnlyHint: readOnly },
          async execute(input: Record<string, unknown>) {
            const value = await execute(input ?? {});
            return { content: [{ type: 'text', text: JSON.stringify(value) }] };
          },
        },
        { signal: controller.signal },
      )
      .catch(() => {
        // A rejected registration (permissions policy, duplicate) must not break the page.
      });
    registered.push(name);
  };

  reg('list_drops', DROP_TOOL_DESCRIPTIONS.list_drops, listDropsSchema, true, () => client.listDrops());

  reg('watch_slots', DROP_TOOL_DESCRIPTIONS.watch_slots, watchSlotsSchema, true, async (input) => {
    const service = isService(input.service) ? input.service : undefined;
    const { slots, as_of, stale } = await client.watchSlots(service);
    const capped = slots.slice(0, WATCH_SLOTS_MAX);
    const more = slots.length - capped.length;
    return { slots: capped, ...(more > 0 ? { more } : {}), as_of, ...(stale ? { stale } : {}) };
  });

  reg('hold_slot', DROP_TOOL_DESCRIPTIONS.hold_slot, holdSlotSchema, false, async (input) => {
    if (typeof input.slot_id !== 'string' || input.slot_id.length === 0 || input.slot_id.length > 64) {
      return { ok: false, reason: 'unknown_slot' satisfies HoldRefusal };
    }
    return client.holdSlot(input.slot_id);
  });

  reg('release_hold', DROP_TOOL_DESCRIPTIONS.release_hold, releaseHoldSchema, false, async (input) => {
    if (typeof input.hold_id !== 'string' || input.hold_id.length === 0 || input.hold_id.length > 64) {
      return { ok: false };
    }
    return client.releaseHold(input.hold_id);
  });

  reg('hold_status', DROP_TOOL_DESCRIPTIONS.hold_status, holdStatusSchema, true, () => client.holdStatus());

  reg('join_waitlist', DROP_TOOL_DESCRIPTIONS.join_waitlist, joinWaitlistSchema, false, async (input) => {
    if (!isService(input.service)) return { ok: false };
    return client.joinWaitlist(input.service);
  });

  reg('explain_confirm', DROP_TOOL_DESCRIPTIONS.explain_confirm, explainConfirmSchema, true, async () => ({
    confirm_is: 'a human act on this page',
    how: 'one key press, one switch press, or one held gesture — the person chooses the channel',
    why: 'the consequential act belongs to the person; the API cannot express it',
    agent_can: ['watch drops', 'compare slots', 'hold for 90 s', 'queue on the waitlist', 'narrate the countdown'],
    agent_cannot: ['book', 'confirm', 'bypass the person'],
    honesty: 'own agent · own account · no resale · the human performs the consequential act',
  }));

  return {
    registered,
    abort: () => controller.abort(),
  };
}
