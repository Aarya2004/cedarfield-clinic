// Run: node --experimental-strip-types --test src/lib/drop/manual-flow.test.ts
//
// The driver here is a five-line inline stub of the `DropDriver` interface from types.ts. The real
// mock driver is another ticket's file; this suite deliberately does not import it, so the flow's
// behaviour under a losing race is pinned by the *contract*, not by one implementation of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DropDriver, DropEvent, Slot } from './types.ts';
import {
  ACCESSIBILITY_MAX,
  describeSlotsLost,
  emptyDetails,
  hasErrors,
  initialManualFlowState,
  isBookable,
  manualFlowReducer,
  REASONS,
  stepPosition,
  todayIso,
  validateDetails,
  type ManualFlowAction,
  type ManualFlowState,
  type PatientDetails,
} from './manual-flow.ts';

const TODAY = '2026-08-30';

const slot = (id: string, timeLabel: string, state: Slot['state'] = 'open'): Slot => ({
  id,
  timeLabel,
  clinician: 'Dr Okonkwo',
  kind: 'New patient',
  state,
});

const BOARD: Slot[] = [slot('s1', '9:20 AM'), slot('s2', '9:40 AM'), slot('s3', '10:05 AM')];

const goodDetails = (): PatientDetails => ({
  fullName: 'Sarah Whitfield',
  dateOfBirth: '1988-03-14',
  reason: REASONS[1],
  phone: '020 7946 0815',
  accessibilityNeeds: '',
});

/** Fold a list of actions over the reducer — the flow as a person walks it. */
function walk(state: ManualFlowState, ...actions: ManualFlowAction[]): ManualFlowState {
  return actions.reduce(manualFlowReducer, state);
}

const fillDetails = (details: PatientDetails): ManualFlowAction[] =>
  (Object.keys(details) as Array<keyof PatientDetails>).map((field) => ({
    type: 'set_field' as const,
    field,
    value: details[field],
  }));

/** Everything up to and including the review step, for a given slot. */
function atReview(slotId = 's2'): ManualFlowState {
  return walk(
    initialManualFlowState(BOARD),
    { type: 'open_slot', slotId },
    { type: 'start_details' },
    ...fillDetails(goodDetails()),
    { type: 'to_review', today: TODAY },
  );
}

// ---------------------------------------------------------------- the happy walk

test('the walk is board → detail → details → review, one step per confirmed action', () => {
  const start = initialManualFlowState(BOARD);
  assert.equal(start.step, 'board');

  const detail = manualFlowReducer(start, { type: 'open_slot', slotId: 's2' });
  assert.equal(detail.step, 'detail');
  assert.equal(detail.selectedSlotId, 's2');

  const details = manualFlowReducer(detail, { type: 'start_details' });
  assert.equal(details.step, 'details');

  assert.equal(atReview().step, 'review');
});

test('back always works and never discards what was typed', () => {
  const review = atReview();
  const details = manualFlowReducer(review, { type: 'back' });
  assert.equal(details.step, 'details');
  assert.deepEqual(details.details, goodDetails());

  const detail = manualFlowReducer(details, { type: 'back' });
  assert.equal(detail.step, 'detail');

  const board = manualFlowReducer(detail, { type: 'back' });
  assert.equal(board.step, 'board');
  assert.equal(board.selectedSlotId, null);
  assert.deepEqual(board.details, goodDetails(), 'walking back to the board must not wipe the form');
});

test('a slot that is already gone cannot be opened', () => {
  const board = initialManualFlowState([slot('s1', '9:20 AM', 'taken_by_rival')]);
  assert.equal(manualFlowReducer(board, { type: 'open_slot', slotId: 's1' }).step, 'board');
  assert.equal(isBookable(slot('s1', '9:20 AM', 'taken_by_rival')), false);
  assert.equal(isBookable(slot('s1', '9:20 AM', 'open')), true);
  assert.equal(isBookable(undefined), false);
});

test('stepPosition numbers the four steps a person walks, and stops after them', () => {
  assert.equal(stepPosition('board'), 1);
  assert.equal(stepPosition('details'), 3);
  assert.equal(stepPosition('review'), 4);
  assert.equal(stepPosition('booked'), null);
});

// ---------------------------------------------------------------- validation, fairly

test('an empty form reports every required field, and nothing about the optional one', () => {
  const errors = validateDetails(emptyDetails(), TODAY);
  assert.ok(errors.fullName && errors.dateOfBirth && errors.reason && errors.phone);
  assert.equal(errors.accessibilityNeeds, undefined, 'accessibility needs is optional and stays optional');
  assert.equal(hasErrors(errors), true);
});

test('a properly filled form has no errors', () => {
  assert.deepEqual(validateDetails(goodDetails(), TODAY), {});
  assert.equal(hasErrors({}), false);
});

test('a date of birth in the future is caught, today is not', () => {
  assert.match(validateDetails({ ...goodDetails(), dateOfBirth: '2099-01-09' }, TODAY).dateOfBirth ?? '', /future/);
  assert.equal(validateDetails({ ...goodDetails(), dateOfBirth: TODAY }, TODAY).dateOfBirth, undefined);
});

test('phone accepts the punctuation people actually type, rejects a stub', () => {
  for (const phone of ['020 7946 0815', '+44 20 7946 0815', '(555) 019-8830']) {
    assert.equal(validateDetails({ ...goodDetails(), phone }, TODAY).phone, undefined, phone);
  }
  assert.ok(validateDetails({ ...goodDetails(), phone: '555' }, TODAY).phone);
  assert.ok(validateDetails({ ...goodDetails(), phone: '   ' }, TODAY).phone);
});

test('the reason must be one the clinic offers', () => {
  assert.ok(validateDetails({ ...goodDetails(), reason: 'whatever' }, TODAY).reason);
});

test('the accessibility note is free text up to a stated limit', () => {
  const long = 'a'.repeat(ACCESSIBILITY_MAX + 1);
  assert.ok(validateDetails({ ...goodDetails(), accessibilityNeeds: long }, TODAY).accessibilityNeeds);
  assert.equal(
    validateDetails({ ...goodDetails(), accessibilityNeeds: 'Wheelchair user, please book a ground-floor room.' }, TODAY)
      .accessibilityNeeds,
    undefined,
  );
});

test('an invalid form holds you on the details step and names what to fix', () => {
  const stuck = walk(
    initialManualFlowState(BOARD),
    { type: 'open_slot', slotId: 's2' },
    { type: 'start_details' },
    { type: 'set_field', field: 'fullName', value: 'S' },
    { type: 'to_review', today: TODAY },
  );
  assert.equal(stuck.step, 'details');
  assert.ok(stuck.errors.fullName);
});

test('editing a field clears that field’s error and leaves the others standing', () => {
  const stuck = walk(
    initialManualFlowState(BOARD),
    { type: 'open_slot', slotId: 's2' },
    { type: 'start_details' },
    { type: 'to_review', today: TODAY },
  );
  assert.ok(stuck.errors.phone);
  const typing = manualFlowReducer(stuck, { type: 'set_field', field: 'phone', value: '0' });
  assert.equal(typing.errors.phone, undefined);
  assert.ok(typing.errors.fullName, 'the other errors stay until they are fixed too');
});

test('validation runs on request, never mid-keystroke', () => {
  const typing = walk(
    initialManualFlowState(BOARD),
    { type: 'open_slot', slotId: 's2' },
    { type: 'start_details' },
    { type: 'set_field', field: 'fullName', value: 'S' },
  );
  assert.deepEqual(typing.errors, {}, 'a half-typed name is not an error yet');
});

test('todayIso formats the local calendar day', () => {
  assert.equal(todayIso(new Date(2026, 7, 30)), '2026-08-30');
  assert.equal(todayIso(new Date(2026, 0, 9)), '2026-01-09');
});

// ---------------------------------------------------------------- losing the race

test('a slot taken mid-form returns you to the board, names the loss, and keeps every character', () => {
  const review = atReview('s2');
  const lost = manualFlowReducer(review, {
    type: 'driver_event',
    event: { type: 'slot_taken', slotId: 's2', by: 'rival', at: 0 },
  });

  assert.equal(lost.step, 'board');
  assert.equal(lost.selectedSlotId, null);
  assert.deepEqual(lost.lost, { slotId: 's2', timeLabel: '9:40 AM', atStep: 'review' });
  assert.equal(lost.slotsLost, 1);
  assert.deepEqual(lost.details, goodDetails(), 'retyping would be a dark pattern and a fake interaction');
  assert.equal(lost.slots.find((s) => s.id === 's2')?.state, 'taken_by_rival');
});

test('a slot taken that you are not working on costs you nothing', () => {
  const review = atReview('s2');
  const other = manualFlowReducer(review, {
    type: 'driver_event',
    event: { type: 'slot_taken', slotId: 's3', by: 'rival', at: 0 },
  });
  assert.equal(other.step, 'review');
  assert.equal(other.lost, null);
  assert.equal(other.slotsLost, 0);
});

test('losses accumulate across attempts, and the count is what the receipt reports', () => {
  let state = atReview('s2');
  state = manualFlowReducer(state, { type: 'driver_event', event: { type: 'slot_taken', slotId: 's2', by: 'rival', at: 0 } });
  state = walk(state, { type: 'open_slot', slotId: 's3' }, { type: 'start_details' }, { type: 'to_review', today: TODAY });
  assert.equal(state.step, 'review', 'the details you already typed carry into the next attempt');
  state = manualFlowReducer(state, { type: 'driver_event', event: { type: 'slot_taken', slotId: 's3', by: 'rival', at: 0 } });

  assert.equal(state.slotsLost, 2);
  assert.equal(describeSlotsLost(state.slotsLost), '2 slots were taken while you were filling this in.');
  assert.equal(describeSlotsLost(1), 'One slot was taken while you were filling this in.');
  assert.equal(describeSlotsLost(0), 'No slot was taken while you worked.');
});

test('a new wave that no longer lists your slot is the same loss', () => {
  const review = atReview('s2');
  const lost = manualFlowReducer(review, {
    type: 'driver_event',
    event: { type: 'drop_wave', slots: [slot('s7', '11:15 AM')], at: 0 },
  });
  assert.equal(lost.step, 'board');
  assert.equal(lost.slotsLost, 1);
  assert.equal(lost.lost?.slotId, 's2');
});

test('the loss banner can be dismissed without touching anything else', () => {
  const lost = manualFlowReducer(atReview('s2'), {
    type: 'driver_event',
    event: { type: 'slot_taken', slotId: 's2', by: 'rival', at: 0 },
  });
  const dismissed = manualFlowReducer(lost, { type: 'dismiss_lost' });
  assert.equal(dismissed.lost, null);
  assert.equal(dismissed.slotsLost, 1, 'dismissing the notice does not un-lose the slot');
});

test('hold events are ignored — a manual booking site holds nothing for you', () => {
  const review = atReview('s2');
  for (const event of [
    { type: 'hold_started', slotId: 's2', ttlSeconds: 90, at: 0 },
    { type: 'hold_tick', slotId: 's2', secondsLeft: 30, at: 0 },
  ] satisfies DropEvent[]) {
    assert.deepEqual(manualFlowReducer(review, { type: 'driver_event', event }), review);
  }
});

// ---------------------------------------------------------------- booking, through the seam

test('booking is not optimistic: you submit, and the driver decides', () => {
  const submitted = manualFlowReducer(atReview('s2'), { type: 'submit_booking' });
  assert.equal(submitted.step, 'booking', 'pressed, waiting — not yet booked');
  assert.equal(submitted.bookedSlotId, null);

  const booked = manualFlowReducer(submitted, { type: 'driver_event', event: { type: 'booked', slotId: 's2', at: 0 } });
  assert.equal(booked.step, 'booked');
  assert.equal(booked.bookedSlotId, 's2');
  assert.equal(booked.slots.find((s) => s.id === 's2')?.state, 'booked_yours');
});

test('you can lose the race after pressing Book — that is the honest beat, not sabotage', () => {
  const submitted = manualFlowReducer(atReview('s2'), { type: 'submit_booking' });
  const lost = manualFlowReducer(submitted, {
    type: 'driver_event',
    event: { type: 'slot_taken', slotId: 's2', by: 'rival', at: 0 },
  });
  assert.equal(lost.step, 'board');
  assert.equal(lost.lost?.atStep, 'booking');
  assert.equal(lost.bookedSlotId, null);
});

test('the flow drives off any DropDriver — a five-line stub is enough', () => {
  // The whole seam, inline: subscribe/hold/confirm/release. No mock-driver import anywhere.
  const listeners = new Set<(e: DropEvent) => void>();
  const confirmed: string[] = [];
  const driver: DropDriver = {
    subscribe: (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    hold: () => {},
    confirm: (slotId) => confirmed.push(slotId),
    book: (slotId) => confirmed.push(slotId),
    release: () => {},
  };

  let state = initialManualFlowState();
  const unsubscribe = driver.subscribe((event) => {
    state = manualFlowReducer(state, { type: 'driver_event', event });
  });

  const emit = (event: DropEvent) => listeners.forEach((cb) => cb(event));

  emit({ type: 'drop_wave', slots: BOARD, at: 0 });
  assert.equal(state.slots.length, 3, 'the board arrives from the driver, not from a fixture');

  state = walk(state, { type: 'open_slot', slotId: 's1' }, { type: 'start_details' }, ...fillDetails(goodDetails()), {
    type: 'to_review',
    today: TODAY,
  });
  state = manualFlowReducer(state, { type: 'submit_booking' });
  driver.confirm('s1');
  emit({ type: 'booked', slotId: 's1', at: 0 });

  assert.deepEqual(confirmed, ['s1']);
  assert.equal(state.step, 'booked');

  unsubscribe();
  emit({ type: 'slot_taken', slotId: 's1', by: 'rival', at: 0 });
  assert.equal(state.step, 'booked', 'unsubscribing detaches the flow from the driver');
});

test('restart clears the person, keeps the board', () => {
  const booked = manualFlowReducer(manualFlowReducer(atReview('s2'), { type: 'submit_booking' }), {
    type: 'driver_event',
    event: { type: 'booked', slotId: 's2', at: 0 },
  });
  const fresh = manualFlowReducer(booked, { type: 'restart' });
  assert.equal(fresh.step, 'board');
  assert.deepEqual(fresh.details, emptyDetails());
  assert.equal(fresh.slotsLost, 0);
  assert.equal(fresh.slots.length, 3);
});

test('the reducer never mutates the state it is handed', () => {
  const before = atReview('s2');
  const snapshot = JSON.stringify(before);
  manualFlowReducer(before, { type: 'driver_event', event: { type: 'slot_taken', slotId: 's2', by: 'rival', at: 0 } });
  manualFlowReducer(before, { type: 'back' });
  manualFlowReducer(before, { type: 'submit_booking' });
  assert.equal(JSON.stringify(before), snapshot);
});
