import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIRM_WORDS, heardConfirm, heardWord, heardYes, pickWord, tokens } from './word-challenge.ts';

test('the word is heard as a whole token, in any sentence, any case, any punctuation', () => {
  assert.equal(heardWord('Maple.', 'maple'), true);
  assert.equal(heardWord('okay, the word is MAPLE', 'maple'), true);
  assert.equal(heardWord('maples', 'maple'), false, 'no substring matches');
  assert.equal(heardWord('yes', 'maple'), false);
  assert.equal(heardWord('', 'maple'), false);
  assert.deepEqual(tokens("Say 'river' — now!"), ['say', 'river', 'now']);
});

test('the pool never contains a word the panel already means something by', () => {
  for (const w of CONFIRM_WORDS) assert.ok(!['yes', 'no', 'stop', 'book', 'cancel', 'move', 'confirm'].includes(w), w);
  assert.ok(new Set(CONFIRM_WORDS).size === CONFIRM_WORDS.length, 'no duplicates');
  for (const w of CONFIRM_WORDS) assert.match(w, /^[a-z]{5,7}$/);
});

test('a new act gets a different word from the last one', () => {
  const first = pickWord(() => 0);
  const second = pickWord(() => 0, first);
  assert.notEqual(first, second);
  assert.ok(CONFIRM_WORDS.includes(pickWord(() => 0.999)));
});

test('a clean yes confirms; any negation in the sentence refuses; the word still works', () => {
  assert.equal(heardYes('Yes.'), true);
  assert.equal(heardYes('yeah go ahead'), true);
  assert.equal(heardYes('no, not yes'), false);
  assert.equal(heardYes('yes, wait'), false);
  assert.equal(heardYes("don't, yes"), false);
  assert.equal(heardYes('hold me the earliest appointment'), false);
  assert.equal(heardConfirm('maple', 'maple'), true);
  assert.equal(heardConfirm('yes', 'maple'), true);
  assert.equal(heardConfirm('yesterday', 'maple'), false);
});
