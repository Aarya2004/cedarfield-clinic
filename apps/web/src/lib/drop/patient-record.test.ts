import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, SAMPLE_PATIENT } from './patient-record.ts';

test('the sample patient is valid; the by-hand bar applies to every field', () => {
  assert.equal(validate(SAMPLE_PATIENT), null);
  assert.match(validate({ ...SAMPLE_PATIENT, fullName: 'A' }) ?? '', /full name/);
  assert.match(validate({ ...SAMPLE_PATIENT, dateOfBirth: '12/04/1988' }) ?? '', /year, month and day/);
  assert.match(validate({ ...SAMPLE_PATIENT, phone: '12' }) ?? '', /phone/);
});

test('impossible and future dates are refused (2026-09-02 review, P3)', () => {
  assert.match(validate({ ...SAMPLE_PATIENT, dateOfBirth: '2026-02-31' }) ?? '', /does not exist/);
  assert.match(validate({ ...SAMPLE_PATIENT, dateOfBirth: '1988-13-01' }) ?? '', /does not exist/);
  assert.match(validate({ ...SAMPLE_PATIENT, dateOfBirth: '2999-01-01' }) ?? '', /future/);
  assert.equal(validate({ ...SAMPLE_PATIENT, dateOfBirth: '2000-02-29' }), null, 'a real leap day is fine');
});
