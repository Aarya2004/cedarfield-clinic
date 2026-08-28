// node --experimental-strip-types --test infra/sandbox/test/sid.test.mjs — signed session ids, no platform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueSid, verifySid, SID_RE } from '../src/sid.ts';

const SECRET = 'test-secret-do-not-use';
const ID = 'a'.repeat(24);

test('issue → verify round-trips and yields the sandbox id', async () => {
  const sid = await issueSid(SECRET, ID);
  assert.match(sid, SID_RE);
  assert.equal(await verifySid(SECRET, sid), ID);
});

test('regression (Fable pass 2 F4): unsigned / tampered / foreign-key sids are refused', async () => {
  const sid = await issueSid(SECRET, ID);
  const [id, sig] = sid.split('.');
  assert.equal(await verifySid(SECRET, id), null); // bare 24-hex (the old format)
  assert.equal(await verifySid(SECRET, `${'b'.repeat(24)}.${sig}`), null); // signature of another id
  assert.equal(await verifySid(SECRET, `${id}.${sig.slice(0, 15)}0`), null); // one nibble flipped
  assert.equal(await verifySid('other-secret', sid), null);
  assert.equal(await verifySid(SECRET, `${id}.${sig}x`), null);
  assert.equal(await verifySid(SECRET, ''), null);
});

test('issueSid rejects a malformed id', async () => {
  await assert.rejects(() => issueSid(SECRET, 'nope'));
});
