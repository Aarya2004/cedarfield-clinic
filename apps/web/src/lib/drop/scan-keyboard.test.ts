import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCAN_ROWS, back, highlightLabel, initialScan, select, switchAction, tick, type ScanState } from './scan-keyboard.ts';

test('two switches type a name: sweep rows, select, sweep keys, select', () => {
  let s = initialScan();
  // "a": row 0 is highlighted at start; select the row, then key 0.
  s = select(s);
  assert.equal(s.key, 0);
  s = select(s);
  assert.equal(s.text, 'a');
  assert.equal(s.key, null, 'back to the row sweep after a key');
  assert.equal(s.row, 0);
  // "d": select row 0, tick to key 3, select.
  s = select(s);
  for (let i = 0; i < 3; i++) s = tick(s);
  s = select(s);
  assert.equal(s.text, 'ad');
  // space lives in row 3 at index 5
  for (let i = 0; i < 3; i++) s = tick(s);
  s = select(s);
  for (let i = 0; i < 5; i++) s = tick(s);
  s = select(s);
  assert.equal(s.text, 'ad ');
});

test('digits and the date characters are reachable; done ends it; the sweep wraps', () => {
  let s = initialScan();
  for (let i = 0; i < 4; i++) s = tick(s); // row 4: 0–6
  s = select(s);
  for (let i = 0; i < 2; i++) s = tick(s);
  s = select(s);
  assert.equal(s.text, '2');
  for (let i = 0; i < 5; i++) s = tick(s); // row 5: 7 8 9 / - + done
  s = select(s);
  for (let i = 0; i < 3; i++) s = tick(s);
  s = select(s);
  assert.equal(s.text, '2/');
  // wrap: ticking past the last row returns to row 0
  let w = initialScan();
  for (let i = 0; i < SCAN_ROWS.length; i++) w = tick(w);
  assert.equal(w.row, 0);
  // done
  for (let i = 0; i < 5; i++) s = tick(s);
  s = select(s);
  for (let i = 0; i < 6; i++) s = tick(s);
  s = select(s);
  assert.equal(s.done, true);
  assert.equal(highlightLabel(s), 'Done.');
  assert.equal(select(s).text, '2/', 'nothing changes after done');
});

test('back leaves the key sweep; back while sweeping rows deletes; delete key deletes', () => {
  let s: ScanState = { ...initialScan('abc'), row: 2, key: 4 };
  s = back(s);
  assert.equal(s.key, null);
  assert.equal(s.text, 'abc');
  s = back(s);
  assert.equal(s.text, 'ab');
  // the delete key: row 3 index 6
  s = { ...s, row: 3, key: 6 };
  s = select(s);
  assert.equal(s.text, 'a');
});

test('the two switches come from the camera shapes, a hardware switch or the keyboard', () => {
  assert.equal(switchAction('Thumb_Up'), 'select');
  assert.equal(switchAction(' '), 'select');
  assert.equal(switchAction('Enter'), 'select');
  assert.equal(switchAction('Closed_Fist'), 'back');
  assert.equal(switchAction('Escape'), 'back');
  assert.equal(switchAction('Open_Palm'), null, 'the palm is consent, never a switch');
  assert.equal(switchAction('Victory'), null);
  assert.match(highlightLabel(initialScan()), /^Row: a, b, c/);
});
