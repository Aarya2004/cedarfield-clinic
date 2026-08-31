/**
 * The contract's guard rails as executable spec. The most important assertion in the product is a
 * NEGATIVE one: no tool that books. If someone adds `confirm_booking` in a late-night commit, this
 * is the test that fails (DROP-PLAN §3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DROP_TOOL_NAMES,
  DROP_TOOL_DESCRIPTIONS,
  FORBIDDEN_TOOL_NAMES,
  NAME_MAX,
  DESCRIPTION_MAX,
  PARAM_DESCRIPTION_MAX,
  WATCH_SLOTS_MAX,
  listDropsSchema,
  watchSlotsSchema,
  holdSlotSchema,
  releaseHoldSchema,
  joinWaitlistSchema,
} from './schemas.ts';

test('booking is not a tool: no forbidden name on the surface, ever', () => {
  for (const forbidden of FORBIDDEN_TOOL_NAMES) {
    assert.ok(
      !(DROP_TOOL_NAMES as readonly string[]).includes(forbidden),
      `the tool surface must never contain ${forbidden} — the absence is the product`,
    );
  }
  // and no description promises the agent can book
  for (const [name, d] of Object.entries(DROP_TOOL_DESCRIPTIONS)) {
    assert.ok(!/agent (can|may) book/i.test(d), `${name} must not claim the agent can book`);
  }
});

test('exactly seven tools, hold_slot present, all names within Chrome budget', () => {
  assert.equal(DROP_TOOL_NAMES.length, 7);
  assert.ok(DROP_TOOL_NAMES.includes('hold_slot'));
  for (const n of DROP_TOOL_NAMES) {
    assert.ok(n.length <= NAME_MAX, n);
    assert.match(n, /^[a-z][a-z_]*$/);
  }
});

test('descriptions exist for every tool and stay within the recommendation', () => {
  for (const n of DROP_TOOL_NAMES) {
    const d = DROP_TOOL_DESCRIPTIONS[n];
    assert.ok(d && d.length > 40, `${n} needs a real description`);
    assert.ok(d.length <= DESCRIPTION_MAX, `${n} description ${d.length} > ${DESCRIPTION_MAX}`);
  }
  assert.match(DROP_TOOL_DESCRIPTIONS.hold_slot, /books NOTHING/i);
  assert.match(DROP_TOOL_DESCRIPTIONS.explain_confirm, /human performs the consequential act/);
});

test('param descriptions within budget; schemas closed', () => {
  for (const schema of [listDropsSchema, watchSlotsSchema, holdSlotSchema, releaseHoldSchema, joinWaitlistSchema]) {
    assert.equal(schema.additionalProperties, false);
    for (const p of Object.values(schema.properties ?? {})) {
      const d = (p as { description?: string }).description;
      if (d) assert.ok(d.length <= PARAM_DESCRIPTION_MAX, d);
    }
  }
});

test('watch_slots output cap keeps a worst-case response under ~1.5 K', () => {
  const worst = {
    slots: Array.from({ length: WATCH_SLOTS_MAX }, (_, i) => ({
      id: `slot_permit_2026-09-02_${i}`,
      service: 'permit',
      start_iso: '2026-09-02T15:30:00-07:00',
      duration_min: 30,
      state: 'held_by_you',
    })),
    more: 3,
    as_of: '2026-09-02T15:29:58-07:00',
  };
  assert.ok(JSON.stringify(worst).length <= 1500, String(JSON.stringify(worst).length));
});
