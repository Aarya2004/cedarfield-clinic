import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseDate, normalisePatient, validate, validateFields, SAMPLE_PATIENT } from './patient-record.ts';

test('the sample patient is valid; the by-hand bar applies to every field, per field', () => {
  assert.equal(validate(SAMPLE_PATIENT), null);
  assert.deepEqual(validateFields(SAMPLE_PATIENT), {});
  assert.match(validateFields({ ...SAMPLE_PATIENT, fullName: 'A' }).fullName ?? '', /full name/);
  assert.match(validateFields({ ...SAMPLE_PATIENT, dateOfBirth: 'yesterday' }).dateOfBirth ?? '', /day, month and year/);
  assert.match(validateFields({ ...SAMPLE_PATIENT, phone: '12' }).phone ?? '', /phone/);
  const all = validateFields({ fullName: '', dateOfBirth: '', phone: '' });
  assert.deepEqual(Object.keys(all).sort(), ['dateOfBirth', 'fullName', 'phone']);
});

test('dates the way people type them normalise to ISO; impossible and future dates are refused', () => {
  assert.equal(normaliseDate('1988-04-12'), '1988-04-12');
  assert.equal(normaliseDate('1988/4/2'), '1988-04-02');
  assert.equal(normaliseDate('12/04/1988'), '1988-04-12', 'day first');
  assert.equal(normaliseDate('12.04.1988'), '1988-04-12');
  assert.equal(normaliseDate('12 April 1988'), '1988-04-12');
  assert.equal(normaliseDate('April 12 1988'), null);
  assert.match(validate({ ...SAMPLE_PATIENT, dateOfBirth: '2026-02-31' }) ?? '', /does not exist/);
  assert.match(validate({ ...SAMPLE_PATIENT, dateOfBirth: '31/13/1988' }) ?? '', /does not exist/);
  assert.match(validate({ ...SAMPLE_PATIENT, dateOfBirth: '2999-01-01' }) ?? '', /future/);
  assert.equal(validate({ ...SAMPLE_PATIENT, dateOfBirth: '29/02/2000' }), null, 'a real leap day is fine');
});

test('normalisePatient stores ISO and trimmed fields, or null', () => {
  assert.deepEqual(normalisePatient({ fullName: '  Ada Okonkwo ', dateOfBirth: '12/04/1988', phone: ' 416 555 0100 ' }), SAMPLE_PATIENT);
  assert.equal(normalisePatient({ ...SAMPLE_PATIENT, phone: '' }), null);
});
