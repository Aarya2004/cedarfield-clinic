// node --experimental-strip-types --test infra/sandbox/test/origin.test.mjs — pure origin policy, no platform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corsHeaders, originAllowed } from '../src/origin.ts';

const APP = 'https://rokan-terminal.vercel.app';

test('app origin and localhost dev are allowed', () => {
  assert.equal(originAllowed(APP, APP), true);
  assert.equal(originAllowed(APP, 'http://localhost:3000'), true);
  assert.equal(originAllowed(APP, 'http://127.0.0.1'), true);
});

test('regression (Opus pass 2 P1): any other origin is refused, including null/opaque and lookalikes', () => {
  for (const o of ['https://evil.example', 'https://rokan-terminal.vercel.app.evil.example', 'http://rokan-terminal.vercel.app', 'https://localhost:3000', 'null', '']) {
    assert.equal(originAllowed(APP, o), false, o);
  }
});

test('corsHeaders: headers only for an allowed origin; none when the request has no Origin', () => {
  assert.deepEqual(corsHeaders(APP, null), {});
  assert.deepEqual(corsHeaders(APP, 'https://evil.example'), {});
  assert.equal(corsHeaders(APP, APP)['access-control-allow-origin'], APP);
});
