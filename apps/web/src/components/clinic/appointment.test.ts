import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APPOINTMENT_MINUTES,
  REFERENCE_PATTERN,
  appointmentDateFor,
  appointmentReference,
  buildIcs,
  foldLine,
  formatAppointmentDate,
  icsFilename,
} from './appointment.ts';

test('a reference is stable, shaped, and free of look-alike characters', () => {
  const ref = appointmentReference('slot-3|1756713600000');
  assert.match(ref, REFERENCE_PATTERN);
  assert.equal(ref, appointmentReference('slot-3|1756713600000'));
  assert.notEqual(ref, appointmentReference('slot-4|1756713600000'));
  assert.notEqual(ref, appointmentReference('slot-3|1756713600001'));
  // I, L, O and U are the characters a person mis-hears down a phone line.
  assert.equal(/[ILOU]/.test(ref), false);
});

test('every reference the alphabet can produce still matches the published pattern', () => {
  for (let i = 0; i < 500; i++) {
    assert.match(appointmentReference(`slot-${i}|${1756713600000 + i * 137}`), REFERENCE_PATTERN);
  }
});

test('the filename carries the reference so it can be found again', () => {
  assert.equal(icsFilename('CF-4X2K'), 'cedarfield-CF-4X2K.ics');
});

test('a board time becomes today, or tomorrow once it has passed', () => {
  const now = new Date(2026, 8, 1, 9, 30); // 1 Sep 2026, 09:30 local
  const later = appointmentDateFor('10:20 AM', now);
  assert.ok(later);
  assert.equal(later.getDate(), 1);
  assert.equal(later.getHours(), 10);
  assert.equal(later.getMinutes(), 20);

  const passed = appointmentDateFor('8:40 AM', now);
  assert.ok(passed);
  assert.equal(passed.getDate(), 2);
  assert.equal(passed.getHours(), 8);
});

test('midnight and noon are the two the twelve-hour clock gets wrong', () => {
  const now = new Date(2026, 8, 1, 0, 1);
  assert.equal(appointmentDateFor('12:00 PM', now)?.getHours(), 12);
  assert.equal(appointmentDateFor('12:30 AM', now)?.getHours(), 0);
});

test('a label that travelled through the dock keeps its non-breaking space', () => {
  const now = new Date(2026, 8, 1, 7, 0);
  const at = appointmentDateFor(`8:40\u00A0AM`, now);
  assert.equal(at?.getHours(), 8);
  assert.equal(at?.getMinutes(), 40);
});

test('an unreadable time draws no calendar button rather than a wrong one', () => {
  const now = new Date(2026, 8, 1, 9, 30);
  assert.equal(appointmentDateFor('sometime', now), null);
  assert.equal(appointmentDateFor('25:00 AM', now), null);
  assert.equal(appointmentDateFor('8:70 AM', now), null);
  assert.equal(appointmentDateFor('08:40', now), null);
});

test('the date line says today or tomorrow, and spells the rest out', () => {
  const now = new Date(2026, 8, 1, 9, 30); // Tuesday
  assert.equal(formatAppointmentDate(new Date(2026, 8, 1, 10, 20), now), 'Today · Tuesday 1 September');
  assert.equal(formatAppointmentDate(new Date(2026, 8, 2, 8, 40), now), 'Tomorrow · Wednesday 2 September');
  assert.equal(formatAppointmentDate(new Date(2026, 8, 9, 8, 40), now), 'Wednesday 9 September');
});

test('the calendar file is CRLF throughout and closes its own blocks', () => {
  const ics = buildIcs({
    reference: 'CF-4X2K',
    startsAt: new Date(2026, 8, 3, 8, 40),
    clinician: 'Dr. Duarte',
    kind: 'Follow-up',
    stamp: new Date(Date.UTC(2026, 8, 1, 10, 15, 30)),
  });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(/(^|[^\r])\n/.test(ics), false, 'a bare LF makes the file unreadable to some clients');
  assert.ok(ics.includes('UID:CF-4X2K@cedarfield.example\r\n'));
});

test('DTSTART is local floating time and DTSTAMP is a real instant', () => {
  const ics = buildIcs({
    reference: 'CF-4X2K',
    startsAt: new Date(2026, 8, 3, 8, 40),
    clinician: 'Dr. Duarte',
    kind: 'Follow-up',
    stamp: new Date(Date.UTC(2026, 8, 1, 10, 15, 30)),
  });
  assert.ok(ics.includes('DTSTART:20260903T084000\r\n'), '8:40 means 8:40 in the room the clinic is in');
  assert.ok(ics.includes('DTEND:20260903T085500\r\n'));
  assert.ok(ics.includes('DTSTAMP:20260901T101530Z\r\n'));
  assert.equal(APPOINTMENT_MINUTES, 15);
});

test('commas and semicolons in content are escaped, not left to split the line', () => {
  const ics = buildIcs({
    reference: 'CF-4X2K',
    startsAt: new Date(2026, 8, 3, 8, 40),
    clinician: 'Dr. Boone; locum',
    kind: 'Follow-up, second',
    stamp: new Date(Date.UTC(2026, 8, 1, 10, 15, 30)),
  });
  assert.ok(ics.includes('SUMMARY:Follow-up\\, second with Dr. Boone\\; locum'));
  assert.ok(ics.includes('LOCATION:Cedarfield Clinic\\, 14 Marlow Row\\, Cedarfield CF4 2QN'));
});

test('content lines fold at 75 octets, and a multi-byte character is never cut in half', () => {
  assert.equal(foldLine('SHORT:line'), 'SHORT:line');

  const long = `SUMMARY:${'a'.repeat(120)}`;
  const folded = foldLine(long).split('\r\n');
  assert.equal(folded.length, 2);
  assert.equal(folded[0].length, 75);
  assert.ok(folded[1].startsWith(' '));
  assert.equal(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join(''), long);

  const wide = `SUMMARY:${'é'.repeat(60)}`;
  for (const line of foldLine(wide).split('\r\n')) {
    assert.ok(new TextEncoder().encode(line).length <= 75);
  }
  assert.equal(
    foldLine(wide)
      .split('\r\n')
      .map((l, i) => (i === 0 ? l : l.slice(1)))
      .join(''),
    wide,
  );
});

test('a long description is folded inside the file it is written into', () => {
  const ics = buildIcs({
    reference: 'CF-4X2K',
    startsAt: new Date(2026, 8, 3, 8, 40),
    clinician: 'Dr. Chatterjee',
    kind: 'Diabetes and long-term conditions review',
    stamp: new Date(Date.UTC(2026, 8, 1, 10, 15, 30)),
  });
  for (const line of ics.split('\r\n')) {
    assert.ok(new TextEncoder().encode(line).length <= 75, `line too long: ${line}`);
  }
});
