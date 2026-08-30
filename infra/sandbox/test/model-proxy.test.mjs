// node --experimental-strip-types --test infra/sandbox/test/model-proxy.test.mjs — pure proxy policy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedPath, validateModelRequest, upstreamHeaders, usdMicros, estimateUsdMicros, capError, isPassthroughStatus, callWeight, MAX_TOKENS_CAP, DUMMY_API_KEY } from '../src/model-proxy.ts';

const SID = 'a'.repeat(24) + '.1700000000.' + 'b'.repeat(16);
const plannerBody = () => ({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 4000,
  system: [{ type: 'text', text: 'rules', cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content: [{ type: 'text', text: 'page text' }] }],
  output_config: { format: { type: 'json_schema', schema: {} } },
  temperature: 0,
});

test('allowedPath: exactly one shape', () => {
  assert.equal(allowedPath(`/api/model/${SID}/v1/messages`), SID);
  assert.equal(allowedPath(`/api/model/${SID}/v1/messages/count_tokens`), null);
  assert.equal(allowedPath(`/api/model/${SID}/v1/messages/`), null);
  assert.equal(allowedPath(`/api/model/${SID}`), null);
  assert.equal(allowedPath(`/api/model/../v1/messages`), null);
  assert.equal(allowedPath(`/api/model/${SID.toUpperCase()}/v1/messages`), null);
  assert.equal(allowedPath('/api/model//v1/messages'), null);
});

test('validate: the planner-shaped body passes unchanged', () => {
  const v = validateModelRequest(plannerBody());
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.model, 'claude-haiku-4-5-20251001');
    assert.equal(v.maxTokens, 4000);
    assert.deepEqual(v.body, plannerBody());
  }
});

test('validate: models off the ladder are refused, not rewritten', () => {
  for (const model of ['claude-opus-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', '']) {
    const v = validateModelRequest({ ...plannerBody(), model });
    assert.equal(v.ok, false, model);
    if (!v.ok) assert.equal(v.status, 400);
  }
  assert.equal(validateModelRequest({ ...plannerBody(), model: 'claude-sonnet-5' }).ok, true);
});

test('validate: max_tokens is clamped, never rejected when large; rejected when absent/invalid', () => {
  const v = validateModelRequest({ ...plannerBody(), max_tokens: 20000 });
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.body.max_tokens, MAX_TOKENS_CAP);
  for (const bad of [undefined, 0, -1, 1.5, '4000']) {
    const b = { ...plannerBody() };
    if (bad === undefined) delete b.max_tokens; else b.max_tokens = bad;
    assert.equal(validateModelRequest(b).ok, false, String(bad));
  }
});

test('validate: streaming, tools and other disallowed keys → 400', () => {
  for (const extra of [{ stream: true }, { tools: [] }, { tool_choice: { type: 'auto' } }, { mcp_servers: [] }, { service_tier: 'auto' }, { betas: ['x'] }, { container: 'c' }]) {
    const v = validateModelRequest({ ...plannerBody(), ...extra });
    assert.equal(v.ok, false, JSON.stringify(extra));
    if (!v.ok) assert.equal(v.status, 400);
  }
  assert.equal(validateModelRequest({ ...plannerBody(), stream: false }).ok, false, 'stream key itself is not allowed');
});

test('validate: only text content blocks', () => {
  const img = { ...plannerBody(), messages: [{ role: 'user', content: [{ type: 'image', source: {} }] }] };
  assert.equal(validateModelRequest(img).ok, false);
  const doc = { ...plannerBody(), system: [{ type: 'document', source: {} }] };
  assert.equal(validateModelRequest(doc).ok, false);
  const str = { ...plannerBody(), messages: [{ role: 'user', content: 'plain string' }], system: 'plain' };
  assert.equal(validateModelRequest(str).ok, true);
  assert.equal(validateModelRequest({ ...plannerBody(), messages: [] }).ok, false);
  assert.equal(validateModelRequest('nope').ok, false);
  assert.equal(validateModelRequest(null).ok, false);
  assert.equal(validateModelRequest([]).ok, false);
});

test('upstreamHeaders: exactly three headers, the client key never among them', () => {
  const h = upstreamHeaders('sk-real', '2023-06-01');
  assert.deepEqual(Object.keys(h).sort(), ['anthropic-version', 'content-type', 'x-api-key']);
  assert.equal(h['x-api-key'], 'sk-real');
  assert.equal(upstreamHeaders('k', null)['anthropic-version'], '2023-06-01');
  assert.equal(upstreamHeaders('k', 'garbage')['anthropic-version'], '2023-06-01');
  assert.equal(upstreamHeaders('k', '2024-10-22')['anthropic-version'], '2024-10-22');
  assert.ok(!('anthropic-beta' in h) && !('authorization' in h));
  assert.equal(DUMMY_API_KEY, 'judge-sandbox-proxy');
});

test('usdMicros: known answers (haiku 1/5, sonnet-5 2/10 per MTok)', () => {
  assert.equal(usdMicros('claude-haiku-4-5-20251001', { input_tokens: 1_000_000 }), 1_000_000);
  assert.equal(usdMicros('claude-haiku-4-5-20251001', { output_tokens: 1000 }), 5000);
  assert.equal(usdMicros('claude-sonnet-5', { input_tokens: 10_000, output_tokens: 1000 }), 20_000 + 10_000);
  assert.equal(usdMicros('claude-haiku-4-5-20251001', { cache_read_input_tokens: 1_000_000 }), 100_000);
  assert.equal(usdMicros('claude-haiku-4-5-20251001', {}), 0);
  assert.equal(usdMicros('unknown-model', { input_tokens: 1_000_000 }), 2_000_000, 'unknown models price as sonnet');
});

test('estimate is pessimistic: ≥ the settled cost of a realistic call', () => {
  const est = estimateUsdMicros('claude-haiku-4-5-20251001', 15_000, 4000);
  const actual = usdMicros('claude-haiku-4-5-20251001', { input_tokens: 4000, output_tokens: 900, cache_read_input_tokens: 1500 });
  assert.ok(est >= actual, `${est} >= ${actual}`);
});

test('capError: Anthropic error envelope + no-retry headers', () => {
  const e = capError('session cap', 0.2);
  assert.equal(e.body.type, 'error');
  assert.equal(e.body.error.type, 'rate_limit_error');
  assert.match(e.body.error.message, /session cap/);
  assert.equal(e.body.retry_after_s, 1);
  assert.equal(e.headers['retry-after'], '1');
  assert.equal(e.headers['x-should-retry'], 'false');
});

test('passthrough statuses and call weights', () => {
  for (const s of [200, 201, 400, 404, 413, 422, 429]) assert.equal(isPassthroughStatus(s), true, String(s));
  for (const s of [401, 402, 403, 500, 502, 503, 529]) assert.equal(isPassthroughStatus(s), false, String(s));
  assert.equal(callWeight('claude-haiku-4-5-20251001'), 1);
  assert.equal(callWeight('claude-sonnet-5'), 3);
});
