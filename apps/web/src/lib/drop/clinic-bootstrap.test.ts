import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { BOOTSTRAP_GLOBAL, bootstrapScript, loadToolDescriptors } from './clinic-bootstrap.ts';
import { BASE_TOOL_NAMES, LISTEN_TOOL_NAMES } from './clinic-tools.ts';

test('the descriptors are the twelve load-time tools, copied from the real definitions', () => {
  const d = loadToolDescriptors();
  assert.deepEqual(
    d.map((x) => x.name),
    [...BASE_TOOL_NAMES, ...LISTEN_TOOL_NAMES],
  );
  assert.equal(d.length, 12);
  for (const x of d) {
    assert.ok(x.description.length > 20, x.name);
    assert.equal(x.inputSchema.type, 'object');
    assert.equal(typeof x.annotations.readOnlyHint, 'boolean');
  }
  assert.ok(d.every((x) => x.name !== 'clinic_book_slot'), 'the booking tool is never in the first snapshot');
});

test('the inline script registers every tool before the app exists, and calls wait for the app', async () => {
  const registered: { name: string; execute: (input: unknown) => Promise<unknown> }[] = [];
  const window: Record<string, unknown> = {};
  const sandbox = {
    window,
    document: { modelContext: { registerTool: (t: { name: string; execute: (input: unknown) => Promise<unknown> }) => registered.push(t) } },
    navigator: {},
    JSON,
    Promise,
  };
  vm.runInNewContext(bootstrapScript(loadToolDescriptors()), sandbox);
  assert.equal(registered.length, 12);
  const handle = window[BOOTSTRAP_GLOBAL] as { names: string[]; execute: ((n: string, i: unknown) => Promise<unknown>) | null; resolve: () => void };
  assert.equal(handle.names.length, 12);
  // A call before the app is ready is held, not refused.
  let settled = false;
  const call = registered[0]!.execute({}).then((r) => {
    settled = true;
    return r;
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(settled, false, 'waits for the app');
  handle.execute = async (name, input) => ({ name, input });
  handle.resolve();
  assert.deepEqual(await call, { name: registered[0]!.name, input: {} });
});

test('a browser without modelContext is left alone', () => {
  const window: Record<string, unknown> = {};
  vm.runInNewContext(bootstrapScript(loadToolDescriptors()), { window, document: {}, navigator: {}, JSON, Promise });
  assert.equal(window[BOOTSTRAP_GLOBAL], undefined);
});

test('the script never closes a script tag', () => {
  assert.ok(!bootstrapScript(loadToolDescriptors()).includes('</script'));
});
