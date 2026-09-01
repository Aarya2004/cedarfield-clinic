import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Slot } from '../../lib/drop/types.ts';
import { ROSTER, nextAvailable } from './clinicians.ts';
import { createMockDriver } from '../../lib/drop/mock-driver.ts';
import { waveSeed } from './wave-clock.ts';

const slot = (id: string, timeLabel: string, clinician: string, state: Slot['state'] = 'open'): Slot => ({
  id,
  timeLabel,
  clinician,
  kind: 'Follow-up',
  state,
});

test('the roster names exactly the clinicians the board can put on a release', () => {
  // If the driver's list ever changes, the home page must change with it — a name on the home page
  // that never appears on the board is the one lie a visitor can catch in a single click.
  const onTheBoard = new Set<string>();
  for (let wave = 0; wave < 40; wave++) {
    for (const s of createMockDriver({ seed: waveSeed(wave), scenario: 'hold-and-book' }).snapshot().slots) {
      onTheBoard.add(s.clinician);
    }
  }
  const listed = new Set(ROSTER.map((c) => c.name));
  for (const name of onTheBoard) assert.ok(listed.has(name), `${name} takes appointments but is not on the roster`);
  for (const name of listed) assert.ok(onTheBoard.has(name), `${name} is on the roster but never takes an appointment`);
});

test('every clinician carries a specialty', () => {
  for (const c of ROSTER) assert.ok(c.specialty.length > 0);
  assert.equal(new Set(ROSTER.map((c) => c.specialty)).size, ROSTER.length);
});

test('next available is the earliest time still open for that name', () => {
  const slots = [
    slot('slot-1', '8:00 AM', 'Dr. Duarte', 'taken_by_rival'),
    slot('slot-2', '8:20 AM', 'Dr. Boone'),
    slot('slot-3', '8:40 AM', 'Dr. Duarte'),
    slot('slot-4', '9:00 AM', 'Dr. Duarte'),
  ];
  assert.equal(nextAvailable(slots, 'Dr. Duarte'), '8:40 AM');
  assert.equal(nextAvailable(slots, 'Dr. Boone'), '8:20 AM');
});

test('a clinician with nothing left returns null, so the page can print the absence', () => {
  const slots = [
    slot('slot-1', '8:00 AM', 'Dr. Duarte', 'taken_by_rival'),
    slot('slot-2', '8:20 AM', 'Dr. Duarte', 'booked_yours'),
    slot('slot-3', '8:40 AM', 'Dr. Duarte', 'held_by_you'),
    slot('slot-4', '9:00 AM', 'Dr. Duarte', 'expired_hold'),
  ];
  assert.equal(nextAvailable(slots, 'Dr. Duarte'), null);
  assert.equal(nextAvailable(slots, 'Dr. Eriksson'), null);
  assert.equal(nextAvailable([], 'Dr. Duarte'), null);
});
