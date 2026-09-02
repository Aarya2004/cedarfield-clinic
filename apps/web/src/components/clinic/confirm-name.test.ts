import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIRM_KEY, confirmControlName } from './confirm-name.ts';

// SPEC-V10 §1.3: the confirm control's accessible name carries the act AND the time, so a Voice
// Control user says one unambiguous phrase — "Click Confirm booking nine twenty" — and hears the
// compact summary back. The visible text stays the act alone; the name starts with it (WCAG 2.5.3).

test('booking: the name is the visible key plus the held time', () => {
  assert.equal(confirmControlName('book', '9:20 AM'), 'Confirm booking 9:20 AM');
});

test('cancel and move name their own act', () => {
  assert.equal(confirmControlName('cancel', '9:00 AM'), 'Confirm cancellation 9:00 AM');
  assert.equal(confirmControlName('move', '9:20 AM'), 'Confirm move to 9:20 AM');
});

test('a move label written as "from → to" is spoken as "to <target>" — an arrow is not a word', () => {
  // The dock receives the pair with non-breaking spaces (noWrap); the name keeps only the target.
  assert.equal(confirmControlName('move', '9:00 AM → 9:20 AM'), 'Confirm move to 9:20 AM');
});

test('label in name: every accessible name starts with the visible text of the key', () => {
  for (const act of ['book', 'cancel', 'move'] as const) {
    const name = confirmControlName(act, '10:00 AM');
    assert.ok(name.startsWith(CONFIRM_KEY[act]), `${act}: "${name}" should start with "${CONFIRM_KEY[act]}"`);
  }
});

test('a missing or padded time never leaves a dangling or doubled space', () => {
  assert.equal(confirmControlName('book', ''), 'Confirm booking');
  assert.equal(confirmControlName('book', '  8:40 AM '), 'Confirm booking 8:40 AM');
});
