// node --test packages/bridge/test/redact.test.mjs — src/redact.js mirrors apps/web/src/lib/webmcp/redact.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REDACTED, RULE_KINDS, redactField, redactLine, stripAnsi } from '../src/redact.js';

test('the ledger case: an exported AWS secret keeps the key name, drops the value', () => {
  const r = redactLine('export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
  assert.equal(r.text, `export AWS_SECRET_ACCESS_KEY=${REDACTED}`);
  assert.ok(r.kinds.includes('kv_secret'));
});

test('plain commands are untouched and report no kinds', () => {
  for (const cmd of ['ls', 'ls -la ~/dev', 'git status', 'echo hi_from_pty; false', 'cd /tmp', 'PATH=/usr/local/bin:/usr/bin:/bin', 'rokan do "what blocks a 100 MiB file on GitHub"']) {
    const r = redactLine(cmd);
    assert.equal(r.text, cmd, cmd);
    assert.deepEqual(r.kinds, []);
  }
});

test('sandbox sid `<24hex>.<digits>.<16hex>` is a credential and is redacted (both files carry this rule)', () => {
  const sid = 'a1b2c3d4e5f60718293a4b5c.1756512000.0f1e2d3c4b5a6978';
  const r = redactLine(`curl https://rokan-sandbox.example/ws/${sid}`);
  assert.ok(!r.text.includes(sid), r.text);
  assert.ok(r.text.includes(REDACTED));
  assert.ok(r.kinds.includes('sandbox_sid'));
  // a bare 24-hex id (no signature) is not a sid and stays visible — it is the sandbox NAME, not a bearer
  assert.equal(redactLine('sandbox a1b2c3d4e5f60718293a4b5c').text, 'sandbox a1b2c3d4e5f60718293a4b5c');
});

test('the shared leak table (Fable F1 lines) redacts every secret — same rules as the web side', () => {
  const leaks = [
    ['AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', 'wJalrXUtnFEMI'],
    ['PGPASSWORD=hunter2 psql -h db', 'hunter2'],
    ['DATABASE_URL=postgres://admin:s3cretpw@db.example:5432/app', 's3cretpw'],
    ['psql --password hunter2 -U admin', 'hunter2'],
    ['STRIPE_SECRET_KEY=sk_live_abcdefghijklmnop', 'sk_live_abcdefghijklmnop'],
    ['GOOGLE_API_KEY=AIzaSyA-abcdefghijklmnopqrstuvwxyz0123', 'AIzaSyA-abcdefghijklmnopqrstuvwxyz0123'],
    ['curl -u admin:hunter2 https://x.example', 'hunter2'],
    ["export OPENAI_API_KEY='sk-proj-abcdefghijklmnop'", 'sk-proj-abcdefghijklmnop'],
    ['curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" x', 'SflKxwRJ'],
    ['git push https://ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456@github.com/x/y', 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456'],
    ['echo 3f2a9c1d4e5b6a7f8091a2b3c4d5e6f7a8b9c0d1', '3f2a9c1d4e5b6a7f'],
  ];
  for (const [line, secret] of leaks) {
    const r = redactLine(line);
    assert.ok(!r.text.includes(secret), `still leaks: ${r.text}`);
    assert.ok(r.kinds.length > 0, line);
  }
});

test('redactField strips terminal escapes first and leaves non-strings alone', () => {
  assert.equal(stripAnsi('\x1b[32mAKIA\x1b[0mIOSFODNN7EXAMPLE \x1b]133;A\x07done'), 'AKIAIOSFODNN7EXAMPLE done');
  assert.equal(redactField('\x1b[32mAKIA\x1b[0mIOSFODNN7EXAMPLE'), REDACTED);
  assert.equal(redactField(null), null);
  assert.equal(redactField(undefined), undefined);
  assert.equal(redactField(7), 7);
});

test('sync guard: the rule table in redact.ts lists the same kinds in the same order', () => {
  const ts = readFileSync(fileURLToPath(new URL('../../../apps/web/src/lib/webmcp/redact.ts', import.meta.url)), 'utf8');
  const tsKinds = [...ts.matchAll(/^\s*(?:\{ )?kind: '([a-z_]+)',/gm)].map((m) => m[1]);
  assert.deepEqual(tsKinds, RULE_KINDS, 'redact.ts and redact.js rule tables drifted — update both');
});
