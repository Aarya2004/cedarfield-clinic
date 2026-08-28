// Run: node --experimental-strip-types --test src/lib/terminal/terminal-libs.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PromptDetector } from './osc.ts';
import { LineBuffer } from './linebuffer.ts';

const ESC = '';
const BEL = '';

test('PromptDetector: A/C/D/7 in one chunk', () => {
  const d = new PromptDetector();
  const ev = d.feed(`${ESC}]7;file://mac/Users/x${BEL}${ESC}]133;D;1${BEL}${ESC}]133;A${BEL}~ $ ${ESC}]133;C${BEL}`);
  assert.deepEqual(ev, [{ kind: 'cwd', cwd: '/Users/x' }, { kind: 'end', code: 1 }, { kind: 'prompt' }, { kind: 'start' }]);
});

test('PromptDetector: sequence split across chunks, including a trailing lone ESC', () => {
  const d = new PromptDetector();
  assert.deepEqual(d.feed(`out${ESC}`), []);
  assert.deepEqual(d.feed(`]133;D;0`), []);
  assert.deepEqual(d.feed(`${BEL}${ESC}]13`), [{ kind: 'end', code: 0 }]);
  assert.deepEqual(d.feed(`3;A${BEL}`), [{ kind: 'prompt' }]);
});

test('PromptDetector: ST terminator, unknown OSC ignored, raw % in cwd', () => {
  const d = new PromptDetector();
  assert.deepEqual(d.feed(`${ESC}]133;A${ESC}\\${ESC}]0;title${BEL}${ESC}]7;file://h/tmp/100%done${BEL}`), [{ kind: 'prompt' }, { kind: 'cwd', cwd: '/tmp/100%done' }]);
});

test('LineBuffer: printable counts, backspace, enter/ctrl resets, modifiers ignored', () => {
  const b = new LineBuffer();
  let n = 0;
  b.subscribe(() => n++);
  b.feedKey({ key: 'l' });
  b.feedKey({ key: 's' });
  assert.equal(b.length, 2);
  b.feedKey({ key: 'ArrowLeft' });
  b.feedKey({ key: 'Shift' });
  b.feedKey({ key: 'c', metaKey: true });
  assert.equal(b.length, 2);
  b.feedKey({ key: 'Backspace' });
  assert.equal(b.length, 1);
  b.feedKey({ key: 'Backspace' });
  b.feedKey({ key: 'Backspace' });
  assert.equal(b.length, 0);
  b.feedText('echo hi\n');
  assert.equal(b.length, 7);
  b.feedKey({ key: 'c', ctrlKey: true });
  assert.equal(b.empty, true);
  b.feedKey({ key: 'x' });
  b.feedKey({ key: 'Enter' });
  assert.equal(b.empty, true);
  b.feedKey({ key: 'x' });
  b.feedKey({ key: 'u', ctrlKey: true });
  assert.equal(b.empty, true);
  assert.ok(n >= 8);
});
