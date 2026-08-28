// node --test packages/bridge/test/trailer.test.mjs — pure parser, no PTY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRokanTrailer } from '../src/rokan-trailer.js';

const ESC = '\x1b';

test('replayed answer with TTY colour → ms + replayed (0 model calls)', () => {
  const line = `  GitHub blocks files larger than 100 MiB.   ${ESC}[2m312ms${ESC}[0m  ${ESC}[38;5;172m⚡${ESC}[0m\r\n`;
  assert.deepEqual(parseRokanTrailer(`$ rokan do "x"\r\n${line}`), { ms: 312, replayed: true });
});

test('planned answer (no bolt) → replayed:false; calls stay unknown', () => {
  assert.deepEqual(parseRokanTrailer('  The population is 2.79 million.   6100ms\n'), { ms: 6100, replayed: false });
});

test('last matching line wins; answers containing "ms" or digits do not fool it; non-rokan output → null', () => {
  const out = '  first   10ms  ⚡\n    ignoring 3 lines\n  second answer with 5ms inside   42ms\n';
  assert.deepEqual(parseRokanTrailer(out), { ms: 42, replayed: false });
  assert.equal(parseRokanTrailer('total 0\n-rw-r--r-- 1 me  0 Aug 28 15:20 app.py\n'), null);
  assert.equal(parseRokanTrailer('  ⏸ abstained — cannot prove this\n    class   abstained_no_repair_class\n'), null);
  assert.equal(parseRokanTrailer('312ms'), null); // needs the two-space indent and an answer
});
