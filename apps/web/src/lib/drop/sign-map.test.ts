import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SIGN_MAP, SIGN_SHAPES, cleanPhrase, loadSignMap, phraseFor, saveSignMap, setSignPhrase, shapeFromName } from './sign-map.ts';

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), size: () => m.size };
}

test('five shapes, five default words; the open palm is not among them', () => {
  assert.equal(SIGN_SHAPES.length, 5);
  assert.ok(!SIGN_SHAPES.some((s) => (s.category as string) === 'Open_Palm'));
  assert.deepEqual(Object.values(DEFAULT_SIGN_MAP), ['yes', 'no', 'stop', 'the first one', 'another one']);
});

test('a person assigns whole requests to shapes; they round-trip through storage and clean up', () => {
  const store = memStore();
  const mine = { ...DEFAULT_SIGN_MAP, Thumb_Up: '  hold me the   earliest appointment ', Victory: 'cancel my appointment' };
  saveSignMap(store, mine);
  const back = loadSignMap(store);
  assert.equal(back.Thumb_Up, 'hold me the earliest appointment');
  assert.equal(back.Victory, 'cancel my appointment');
  assert.equal(back.Closed_Fist, 'stop', 'untouched shapes keep their defaults');
  assert.equal(phraseFor('Thumb_Up', back), 'hold me the earliest appointment');
  assert.equal(phraseFor('Open_Palm', back), null, 'the palm is never a word');
  assert.equal(phraseFor('Victory', { ...back, Victory: '' }), null, 'an emptied phrase disables the shape');
});

test('an agent labels the switch board by the shape name a person would say', () => {
  const store = memStore();
  assert.equal(shapeFromName('Thumbs up'), 'Thumb_Up');
  assert.equal(shapeFromName('two fingers'), 'Victory');
  assert.equal(shapeFromName('a fist'), 'Closed_Fist');
  assert.equal(shapeFromName('one-finger'), 'Pointing_Up');
  assert.equal(shapeFromName('Pointing_Up'), 'Pointing_Up');
  assert.equal(shapeFromName('open palm'), null, 'the palm is consent, never a phrase');
  assert.equal(shapeFromName('wave'), null);
  const next = setSignPhrase(store, 'thumbs up', '  hold me the earliest appointment ');
  assert.equal(next?.Thumb_Up, 'hold me the earliest appointment');
  assert.equal(loadSignMap(store).Thumb_Up, 'hold me the earliest appointment', 'written through');
  assert.equal(setSignPhrase(store, 'wave', 'x'), null);
});

test('defaults are not stored; broken or oversized records fall back per shape', () => {
  const store = memStore();
  saveSignMap(store, { ...DEFAULT_SIGN_MAP });
  assert.equal(store.size(), 0, 'all defaults ⇒ nothing written');
  store.setItem('cedarfield.signs', '{"Thumb_Up": 42, "Victory": "' + 'x'.repeat(500) + '"}');
  const back = loadSignMap(store);
  assert.equal(back.Thumb_Up, 'yes');
  assert.equal(back.Victory.length, 120);
  store.setItem('cedarfield.signs', 'not json');
  assert.deepEqual(loadSignMap(store), DEFAULT_SIGN_MAP);
  assert.equal(cleanPhrase('  a  b '), 'a b');
});
