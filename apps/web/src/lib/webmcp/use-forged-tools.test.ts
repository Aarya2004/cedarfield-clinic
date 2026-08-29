// Run: node --experimental-strip-types --test src/lib/webmcp/use-forged-tools.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForgeEngine } from './forge.ts';

// The hook is a thin `useSyncExternalStore` over `forge.list()`; we test the projection + reactivity
// contract it relies on (subscribe fires on birth/pin/unforge; list() carries the view fields).
test('forge.list() gives the view fields the hook exposes, and subscribe fires on changes', async () => {
  const engine = new ForgeEngine({ modelContext: () => null });
  let ticks = 0;
  engine.subscribe(() => ticks++);
  const spec = { name: 'hn_top', description: 'top n', commands: ['echo {{n}}'], params: [{ name: 'n', description: 'd', example: '5' }], kind: 'read' as const };
  const card = engine.openCard(spec, { origin: 'human' });
  if ('error' in card) throw new Error(card.error);
  const t = await engine.approve(card.card_id);
  if ('error' in t) throw new Error(t.error);
  const view = engine.list().tools[0];
  assert.deepEqual(Object.keys(view).sort(), ['calls_last', 'forged_at', 'hash', 'kind', 'last_exit', 'median_ms', 'name', 'params', 'pinned', 'provenance', 'runs', 'tool', 'visible'].sort());
  assert.equal(view.tool, 'forged_hn_top');
  assert.equal(view.kind, 'read');
  const before = ticks;
  engine.pin('hn_top', true);
  engine.unforge('hn_top');
  assert.ok(ticks > before, 'subscribe fires on pin + unforge');
});
