// Run: node --experimental-strip-types --test src/lib/webmcp/redact.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REDACTED, redactForAgent, redactLine, stripAnsi } from './redact.ts';

const one = (s: string) => redactForAgent([s]);

test('AWS access key', () => {
  const r = one('export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE');
  assert.ok(!r.lines[0].includes('AKIAIOSFODNN7EXAMPLE'));
  assert.ok(r.redactions.some((x) => x.kind === 'aws_access_key'));
});

test('sk- tokens (OpenAI / Anthropic shape)', () => {
  const r = one('OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz0123456789');
  assert.ok(!r.lines[0].includes('sk-proj-abcdefghijklmnopqrstuvwxyz'));
  const r2 = one('curl -H "x-api-key: sk-ant-api03-abcdefghijklmnop"');
  assert.ok(!r2.lines[0].includes('sk-ant-api03'));
});

test('GitHub tokens', () => {
  const r = one('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456');
  assert.equal(r.lines[0], REDACTED);
  const r2 = one('github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz');
  assert.equal(r2.lines[0], REDACTED);
});

test('Slack tokens', () => {
  const r = one('SLACK_TOKEN=xoxb-1234567890-abcdefghij');
  assert.ok(!r.lines[0].includes('xoxb-1234567890'));
});

test('JWT', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const r = one(`Bearer ${jwt}`);
  assert.ok(!r.lines[0].includes(jwt));
});

test('key=value secrets keep the key, drop the value', () => {
  const r = one('password=hunter2 token: abc123 API_KEY="xyz" retry_count=3');
  assert.ok(r.lines[0].includes(`password=${REDACTED}`), r.lines[0]);
  assert.ok(r.lines[0].includes(`token: ${REDACTED}`), r.lines[0]);
  assert.ok(r.lines[0].includes(`API_KEY="${REDACTED}"`), r.lines[0]);
  assert.ok(r.lines[0].includes('retry_count=3'), r.lines[0]);
  // any identifier containing a secret keyword is treated as a secret (security over precision)
  assert.ok(one('not_secret=keep').lines[0].includes(REDACTED));
});

test('Authorization header', () => {
  const r = one('> Authorization: Bearer abc.def.ghi');
  assert.ok(!r.lines[0].includes('abc.def.ghi'));
  assert.ok(/Authorization: Bearer \[redacted\]/.test(r.lines[0]), r.lines[0]);
});

test('32+ hex runs (incl. 40-char git SHAs, by design)', () => {
  const r = one('commit 3f2a9c1d4e5b6a7f8091a2b3c4d5e6f7a8b9c0d1');
  assert.ok(!r.lines[0].includes('3f2a9c1d4e5b6a7f'));
  const ok = one('short hex deadbeef stays');
  assert.equal(ok.redactions.length, 0);
});

test('PEM private key block collapses to one [redacted]', () => {
  const r = redactForAgent([
    'cat id_rsa',
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn',
    'NhAAAAAwEAAQAAAYEAy9xk3bq6',
    '-----END OPENSSH PRIVATE KEY-----',
    '$ ',
  ]);
  assert.deepEqual(r.lines, ['cat id_rsa', '-----BEGIN OPENSSH PRIVATE KEY-----', REDACTED, '-----END OPENSSH PRIVATE KEY-----', '$ ']);
  assert.ok(r.redactions.some((x) => x.kind === 'private_key_block' && x.line === 1));
});

test('ANSI + OSC stripped before matching', () => {
  const s = '[32mAKIA[0mIOSFODNN7EXAMPLE ]133;Adone';
  assert.equal(stripAnsi(s), 'AKIAIOSFODNN7EXAMPLE done');
  const r = one(s);
  assert.ok(!r.lines[0].includes('AKIAIOSFODNN7'));
});

test('clean lines pass through untouched', () => {
  const lines = ['$ ls', 'README.md  package.json  src', '$ pytest -q', '12 passed in 0.31s'];
  const r = redactForAgent(lines);
  assert.deepEqual(r.lines, lines);
  assert.equal(r.redactions.length, 0);
});

test('redactLine reports every kind hit on a line', () => {
  const { kinds } = redactLine('AKIAIOSFODNN7EXAMPLE xoxp-12345678-abcdefgh');
  assert.deepEqual(kinds.sort(), ['aws_access_key', 'slack_token']);
});

// Fable review F1 (2026-08-28): the 18 lines that leaked. Every one must redact the secret.
const leaks: [string, string][] = [
  ['AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', 'wJalrXUtnFEMI'],
  ['export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG', 'wJalrXUtnFEMI'],
  ['PGPASSWORD=hunter2 psql -h db', 'hunter2'],
  ['MYSQL_PWD=hunter2', 'hunter2'],
  ['{"password": "hunter2"}', 'hunter2'],
  ['  "api_key": "abc123",', 'abc123'],
  ['DATABASE_URL=postgres://admin:s3cretpw@db.example:5432/app', 's3cretpw'],
  ['psql --password hunter2 -U admin', 'hunter2'],
  ['STRIPE_SECRET_KEY=sk_live_abcdefghijklmnop', 'sk_live_abcdefghijklmnop'],
  ['GOOGLE_API_KEY=AIzaSyA-abcdefghijklmnopqrstuvwxyz0123', 'AIzaSyA-abcdefghijklmnopqrstuvwxyz0123'],
  ['VERCEL_TOKEN=Abcdefghijklmnopqrstuvwx', 'Abcdefghijklmnopqrstuvwx'],
  ['CLOUDFLARE_API_TOKEN=Abcdefghijklmnopqrstuvwxyz0123456789', 'Abcdefghijklmnopqrstuvwxyz0123456789'],
  ['npm_token=npm_abcdefghijklmnopqrstuvwxyz012345', 'npm_abcdefghijklmnopqrstuvwxyz012345'],
  ['curl -u admin:hunter2 https://x.example', 'hunter2'],
  ['TOKEN="abc def"', 'abc def'],
  ['  "PASSWORD": "hunter2",', 'hunter2'],
  ["export OPENAI_API_KEY='sk-proj-abcdefghijklmnop'", 'sk-proj-abcdefghijklmnop'],
  ['rk_test_abcdefghijklmnop', 'rk_test_abcdefghijklmnop'],
];
for (const [line, secret] of leaks) {
  test(`F1 leak fixed: ${line.slice(0, 40)}`, () => {
    const r = one(line);
    assert.ok(!r.lines[0].includes(secret), `still leaks: ${r.lines[0]}`);
    assert.ok(r.redactions.length > 0);
  });
}

test('F1: keys are kept, values dropped; user in URL creds kept; public key untouched', () => {
  assert.ok(one('AWS_SECRET_ACCESS_KEY=abc').lines[0].startsWith('AWS_SECRET_ACCESS_KEY='));
  assert.equal(one('{"password": "hunter2"}').lines[0], `{"password": "${REDACTED}"}`);
  assert.equal(one('DATABASE_URL=postgres://admin:pw@db/app').lines[0], `DATABASE_URL=postgres://admin:${REDACTED}@db/app`);
  assert.equal(one('curl -u admin:pw https://x').lines[0], `curl -u admin:${REDACTED} https://x`);
  assert.equal(one('ssh-rsa AAAAB3NzaC1yc2E user@host').redactions.length, 0);
  assert.equal(one('tokenizer.encode(text)').redactions.length, 0);
});
