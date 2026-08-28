// node --experimental-strip-types --test infra/sandbox/test/sid.test.mjs — signed, expiring session ids, no platform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueSid, verifySid, SID_RE } from '../src/sid.ts';

const SECRET = 'test-secret-do-not-use';
const ID = 'a'.repeat(24);
const NOW = 1_800_000_000_000;

test('issue → verify round-trips before expiry and yields the sandbox id', async () => {
  const sid = await issueSid(SECRET, ID, NOW + 60_000);
  assert.match(sid, SID_RE);
  assert.equal(await verifySid(SECRET, sid, NOW), ID);
});

test('regression (Fable pass 2 F4): unsigned / tampered / foreign-key sids are refused', async () => {
  const sid = await issueSid(SECRET, ID, NOW + 60_000);
  const [id, exp, sig] = sid.split('.');
  assert.equal(await verifySid(SECRET, id, NOW), null); // bare id (the oldest format)
  assert.equal(await verifySid(SECRET, `${id}.${sig}`, NOW), null); // the previous format
  assert.equal(await verifySid(SECRET, `${'b'.repeat(24)}.${exp}.${sig}`, NOW), null);
  assert.equal(await verifySid(SECRET, `${id}.${exp}.${sig.slice(0, 15)}${sig.endsWith('0') ? '1' : '0'}`, NOW), null); // one nibble flipped
  assert.equal(await verifySid('other-secret', sid, NOW), null);
  assert.equal(await verifySid(SECRET, '', NOW), null);
});

test('regression (Fable pass 3 P2): an expired sid is refused; the expiry is inside the signature', async () => {
  const sid = await issueSid(SECRET, ID, NOW + 1_000);
  assert.equal(await verifySid(SECRET, sid, NOW + 999), ID);
  assert.equal(await verifySid(SECRET, sid, NOW + 1_000), null); // exactly at expiry → gone
  const [id, exp, sig] = sid.split('.');
  assert.equal(await verifySid(SECRET, `${id}.${Number(exp) + 3600}.${sig}`, NOW + 1_000), null); // stretched expiry
});

test('issueSid rejects a malformed id or expiry', async () => {
  await assert.rejects(() => issueSid(SECRET, 'nope', NOW));
  await assert.rejects(() => issueSid(SECRET, ID, Number.NaN));
});
