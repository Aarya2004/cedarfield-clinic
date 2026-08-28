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
  const r = one('password=hunter2 token: abc123 API_KEY="xyz" not_secret=keep');
  assert.ok(r.lines[0].includes(`password=${REDACTED}`), r.lines[0]);
  assert.ok(r.lines[0].includes(`token: ${REDACTED}`), r.lines[0]);
  assert.ok(r.lines[0].includes(`API_KEY="${REDACTED}"`), r.lines[0]);
  assert.ok(r.lines[0].includes('not_secret=keep'), r.lines[0]);
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
