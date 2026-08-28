// Run: node --experimental-strip-types --test src/lib/terminal/terminal-libs.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PromptDetector } from './osc.ts';
import { LineBuffer } from './linebuffer.ts';

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

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

test('regression (Fable pass 2 F5): history recall and paste make the line dirty until a reset', () => {
  const ESC = String.fromCharCode(27);
  const b = new LineBuffer();
  for (const key of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']) {
    b.feedKey({ key });
    assert.equal(b.empty, false, key);
    b.feedKey({ key: 'Enter' });
    assert.equal(b.empty, true);
  }
  for (const key of ['r', 'p', 'n', 'y']) {
    b.feedKey({ key, ctrlKey: true });
    assert.equal(b.empty, false, `ctrl-${key}`);
    b.feedKey({ key: 'u', ctrlKey: true });
    assert.equal(b.empty, true);
  }
  b.feedKey({ key: '.', altKey: true });
  assert.equal(b.empty, false);
  b.reset();
  assert.equal(b.empty, true);
  // paste (⌘V arrives only via onData), bracketed paste, IME commit → dirty; single keys and arrow sequences → not
  assert.equal(b.feedData('x', true), false); // a keystroke's own data
  assert.equal(b.feedData(ESC + '[A'), false);
  assert.equal(b.empty, true);
  assert.equal(b.feedData('rm -rf ~/'), true);
  assert.equal(b.empty, false);
  b.feedKey({ key: 'c', ctrlKey: true });
  assert.equal(b.empty, true);
  assert.equal(b.feedData(ESC + '[200~ls' + ESC + '[201~'), true);
  assert.equal(b.empty, false);
  b.reset();
  // backspace never clears dirtiness (we cannot know what was recalled)
  b.feedKey({ key: 'ArrowUp' });
  b.feedKey({ key: 'Backspace' });
  assert.equal(b.empty, false);
});

test('regression (Codex review): 1-char paste is dirty, keyed 1-char data is not; Enter awaits the prompt with integration; markUnknown', () => {
  const b = new LineBuffer();
  assert.equal(b.feedData('x', true), false);
  assert.equal(b.empty, true);
  assert.equal(b.feedData('x'), true); // middle-click / IME commit of one character
  assert.equal(b.empty, false);
  b.reset();
  b.feedKey({ key: 'l' });
  b.feedKey({ key: 'Enter' }, { awaitPrompt: true });
  assert.equal(b.empty, false, 'submitted line must stay unknown until the prompt marker');
  b.reset(); // 133;A arrived
  assert.equal(b.empty, true);
  b.feedKey({ key: 'Enter' }, { awaitPrompt: false }); // no integration: Enter is the only signal we have
  assert.equal(b.empty, true);
  b.markUnknown();
  assert.equal(b.empty, false);
  b.feedKey({ key: 'Enter' });
  assert.equal(b.empty, true);
});
