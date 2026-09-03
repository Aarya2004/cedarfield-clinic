import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchChoice } from './choice-match.ts';

const two = [
  { id: 'c1', label: 'Hold it' },
  { id: 'c2', label: 'Show another time' },
];
const three = [...two, { id: 'c3', label: 'Explain more simply' }];

test('the label, or a distinctive word from it, picks the choice', () => {
  assert.deepEqual(matchChoice('hold it', two), { kind: 'choice', index: 0 });
  assert.deepEqual(matchChoice('show me another time please', two), { kind: 'choice', index: 1 });
  assert.deepEqual(matchChoice('explain', three), { kind: 'choice', index: 2 });
  assert.deepEqual(matchChoice('simply', three), { kind: 'choice', index: 2 });
});

test('ordinals and digits: the first one, another one, the third, 2', () => {
  assert.deepEqual(matchChoice('the first one', three), { kind: 'choice', index: 0 });
  assert.deepEqual(matchChoice('another one', three), { kind: 'choice', index: 1 });
  assert.deepEqual(matchChoice('the third', three), { kind: 'choice', index: 2 });
  assert.deepEqual(matchChoice('the last one', three), { kind: 'choice', index: 2 });
  assert.deepEqual(matchChoice('2', three), { kind: 'choice', index: 1 });
  assert.equal(matchChoice('the third', two), null, 'no third choice');
});

test('yes is the first choice; no is the second of two and nothing of three; stop stops', () => {
  assert.deepEqual(matchChoice('yes', two), { kind: 'choice', index: 0 });
  assert.deepEqual(matchChoice('yeah go ahead', three), { kind: 'choice', index: 0 });
  assert.deepEqual(matchChoice('no', two), { kind: 'choice', index: 1 });
  assert.equal(matchChoice('no', three), null);
  assert.deepEqual(matchChoice('stop', three), { kind: 'stop' });
  assert.deepEqual(matchChoice('never mind', two), { kind: 'stop' });
  assert.equal(matchChoice('is Dr Rao available on Tuesday?', two), null, 'an unrelated sentence is not an answer');
  assert.equal(matchChoice('', two), null);
});

test('a label word that appears in two labels does not decide', () => {
  const twins = [
    { id: 'a', label: 'Morning with Dr Lin' },
    { id: 'b', label: 'Afternoon with Dr Lin' },
  ];
  assert.equal(matchChoice('with Dr Lin', twins), null);
  assert.deepEqual(matchChoice('afternoon', twins), { kind: 'choice', index: 1 });
});
