// Run: node --experimental-strip-types --test src/lib/ws/protocol.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedBridgeUrl, parsePairingHash } from './protocol.ts';

const tok = 'a'.repeat(32);

test('pairing link: loopback ws and quick-tunnel wss are allowed', () => {
  assert.deepEqual(parsePairingHash(`#ws=${encodeURIComponent('ws://127.0.0.1:7331')}&t=${tok}`), { ws: 'ws://127.0.0.1:7331', token: tok });
  assert.deepEqual(parsePairingHash(`#ws=ws%3A%2F%2Flocalhost%3A7331&t=${tok}`), { ws: 'ws://localhost:7331', token: tok });
  assert.equal(parsePairingHash(`#ws=wss%3A%2F%2Fparks-stops-pond-mining.trycloudflare.com&t=${tok}`)?.ws, 'wss://parks-stops-pond-mining.trycloudflare.com');
});

test('pairing link: hostile or malformed targets are refused', () => {
  const bad = [
    'wss://evil.example',
    'ws://evil.example:7331',
    'wss://evil.trycloudflare.com.attacker.net',
    'wss://attacker.net/?x=trycloudflare.com',
    'wss://a.trycloudflare.com/path',
    'wss://user:pw@a.trycloudflare.com',
    'http://127.0.0.1:7331',
    'wss://127.0.0.1:7331', // loopback must be plain ws
    'not a url',
  ];
  for (const ws of bad) assert.equal(parsePairingHash(`#ws=${encodeURIComponent(ws)}&t=${tok}`), null, ws);
});

test('pairing link: token shape and missing params', () => {
  assert.equal(parsePairingHash(`#ws=ws%3A%2F%2F127.0.0.1%3A7331&t=short`), null);
  assert.equal(parsePairingHash(`#ws=ws%3A%2F%2F127.0.0.1%3A7331&t=${'G'.repeat(32)}`), null);
  assert.equal(parsePairingHash(`#ws=ws%3A%2F%2F127.0.0.1%3A7331`), null);
  assert.equal(parsePairingHash(`#t=${tok}`), null);
  assert.equal(parsePairingHash(''), null);
});

test('extra hosts (named tunnel / sandbox) are exact-match wss only', () => {
  assert.equal(isAllowedBridgeUrl('wss://bridge.rokan.dev', ['bridge.rokan.dev']), true);
  assert.equal(isAllowedBridgeUrl('wss://bridge.rokan.dev.evil', ['bridge.rokan.dev']), false);
  assert.equal(isAllowedBridgeUrl('ws://bridge.rokan.dev', ['bridge.rokan.dev']), false);
  assert.equal(parsePairingHash(`#ws=wss%3A%2F%2Fbridge.rokan.dev&t=${tok}`, ['bridge.rokan.dev'])?.ws, 'wss://bridge.rokan.dev');
});
