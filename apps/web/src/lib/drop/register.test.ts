// Run: node --experimental-strip-types --test src/lib/drop/register.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerDropTools, type RoomClient } from './register.ts';
import { FORBIDDEN_TOOL_NAMES, WATCH_SLOTS_MAX, type SlotWire } from './schemas.ts';
import type { ModelContext, ModelContextTool, RegisterToolOptions } from '../webmcp/types.ts';

type Captured = { tool: ModelContextTool; options?: RegisterToolOptions };
const fakeMc = () => {
  const tools: Captured[] = [];
  const mc = {
    registerTool: async (tool: ModelContextTool, options?: RegisterToolOptions) => {
      tools.push({ tool, options });
    },
  } as unknown as ModelContext;
  return { mc, tools };
};

const slot = (i: number): SlotWire => ({
  id: `slot_clinic_${i}`,
  service: 'clinic',
  start_iso: '2026-09-02T15:00:00-07:00',
  duration_min: 30,
  state: 'open',
});

const fakeClient = (overrides: Partial<RoomClient> = {}): { client: RoomClient; calls: string[] } => {
  const calls: string[] = [];
  const client: RoomClient = {
    listDrops: async () => (calls.push('listDrops'), { now: 'n', waves: [], next_wave_in_s: 42 }),
    watchSlots: async () => (calls.push('watchSlots'), { slots: Array.from({ length: 14 }, (_, i) => slot(i)), as_of: 'n' }),
    holdSlot: async (id) => (calls.push(`holdSlot:${id}`), { ok: true, hold: { id: 'h1', slot_id: id, expires_in_s: 90 } }),
    releaseHold: async (id) => (calls.push(`releaseHold:${id}`), { ok: true }),
    holdStatus: async () => (calls.push('holdStatus'), {}),
    joinWaitlist: async (s) => (calls.push(`joinWaitlist:${s}`), { ok: true, position: 2 }),
    ...overrides,
  };
  return { client, calls };
};

const runTool = async (tools: Captured[], name: string, input: Record<string, unknown> = {}) => {
  const t = tools.find((c) => c.tool.name === name);
  assert.ok(t, `${name} registered`);
  const out = (await t.tool.execute(input)) as { content: [{ type: string; text: string }] };
  return JSON.parse(out.content[0].text) as Record<string, unknown>;
};

test('registers exactly seven tools, none forbidden, all abortable via options.signal', () => {
  const { mc, tools } = fakeMc();
  const regd = registerDropTools(fakeClient().client, mc);
  assert.equal(regd.registered.length, 7);
  for (const c of tools) {
    assert.ok(!(FORBIDDEN_TOOL_NAMES as readonly string[]).includes(c.tool.name));
    assert.ok(c.options?.signal instanceof AbortSignal, `${c.tool.name} carries the abort signal`);
    assert.equal(c.options.signal.aborted, false);
  }
  regd.abort();
  assert.equal(tools[0].options?.signal?.aborted, true);
});

test('no modelContext (unsupported browser) → no-op, no throw', () => {
  const regd = registerDropTools(fakeClient().client, null);
  assert.deepEqual(regd.registered, []);
  regd.abort();
});

test('watch_slots caps at WATCH_SLOTS_MAX and reports `more`', async () => {
  const { mc, tools } = fakeMc();
  registerDropTools(fakeClient().client, mc);
  const out = await runTool(tools, 'watch_slots');
  assert.equal((out.slots as unknown[]).length, WATCH_SLOTS_MAX);
  assert.equal(out.more, 14 - WATCH_SLOTS_MAX);
});

test('watch_slots ignores an invalid service instead of failing', async () => {
  const { mc, tools } = fakeMc();
  const { client, calls } = fakeClient();
  registerDropTools(client, mc);
  await runTool(tools, 'watch_slots', { service: 'spa"; DROP TABLE' });
  assert.ok(calls.includes('watchSlots'));
});

test('hold_slot validates the id shape before touching the room', async () => {
  const { mc, tools } = fakeMc();
  const { client, calls } = fakeClient();
  registerDropTools(client, mc);
  const bad = await runTool(tools, 'hold_slot', { slot_id: 'x'.repeat(65) });
  assert.deepEqual(bad, { ok: false, reason: 'unknown_slot' });
  assert.equal(calls.some((c) => c.startsWith('holdSlot')), false);
  const good = await runTool(tools, 'hold_slot', { slot_id: 'slot_clinic_1' });
  assert.equal(good.ok, true);
});

test('join_waitlist refuses unknown services client-side', async () => {
  const { mc, tools } = fakeMc();
  const { client, calls } = fakeClient();
  registerDropTools(client, mc);
  const out = await runTool(tools, 'join_waitlist', { service: 'concerts' });
  assert.deepEqual(out, { ok: false });
  assert.equal(calls.some((c) => c.startsWith('joinWaitlist')), false);
});

test('explain_confirm carries the honesty line and the cannot-list', async () => {
  const { mc, tools } = fakeMc();
  registerDropTools(fakeClient().client, mc);
  const out = await runTool(tools, 'explain_confirm');
  assert.match(String(out.honesty), /human performs the consequential act/);
  assert.ok((out.agent_cannot as string[]).includes('book'));
});
