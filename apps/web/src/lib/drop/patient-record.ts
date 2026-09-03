/**
 * The patient on file — the record and its validation, pure (no React) so it is unit-tested and
 * shared by the card, the page and the by-hand form. Storage stays in the component.
 */
export interface PatientOnFileRecord {
  fullName: string;
  dateOfBirth: string; // ISO yyyy-mm-dd
  phone: string;
}

export type PatientField = keyof PatientOnFileRecord;

/** The labelled sample used under `?test=1` so seeded proofs stay deterministic. */
export const SAMPLE_PATIENT: PatientOnFileRecord = { fullName: 'Ada Okonkwo', dateOfBirth: '1988-04-12', phone: '416 555 0100' };

/**
 * A date the way people type it — `1988-04-12`, `1988/04/12`, `12/04/1988`, `12.04.1988`,
 * `12 April 1988` — normalised to ISO, or null. Day-first for the slash forms: this clinic is not in
 * the one country that writes month first, and the hint on the field says which order.
 */
export function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  m = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i.exec(s);
  if (m) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const i = months.indexOf(m[2]!.slice(0, 3).toLowerCase());
    if (i >= 0) return `${m[3]}-${String(i + 1).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  }
  return null;
}

/** Per-field problems, empty when the record is usable. Same bar as the by-hand form. */
export function validateFields(p: PatientOnFileRecord): Partial<Record<PatientField, string>> {
  const errors: Partial<Record<PatientField, string>> = {};
  if (p.fullName.trim().length < 2) errors.fullName = 'Enter the patient’s full name, as it appears on their record.';
  const iso = normaliseDate(p.dateOfBirth);
  if (iso === null) errors.dateOfBirth = 'Enter the date of birth as day, month and year — for example 12/04/1988.';
  else {
    // A real calendar date: `new Date('2026-02-31')` is Invalid and '2026-02-30' silently rolls
    // over — round-tripping through ISO catches both (2026-09-02 review, P3).
    const dob = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== iso) errors.dateOfBirth = 'That date does not exist. Check the month and day.';
    else if (dob > new Date()) errors.dateOfBirth = 'That date of birth is in the future. Check the year.';
  }
  if (p.phone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a phone number the clinic can call.';
  return errors;
}

/** One sentence, or null when the record is usable. */
export function validate(p: PatientOnFileRecord): string | null {
  const e = validateFields(p);
  return e.fullName ?? e.dateOfBirth ?? e.phone ?? null;
}

/** The record as stored: the date normalised to ISO, the rest trimmed. Null when invalid. */
export function normalisePatient(p: PatientOnFileRecord): PatientOnFileRecord | null {
  if (validate(p) !== null) return null;
  return { fullName: p.fullName.trim(), dateOfBirth: normaliseDate(p.dateOfBirth)!, phone: p.phone.trim() };
}

/** The field order a hands-free visitor fills, and the next one still empty after `after` (or from the top). */
export const PATIENT_FIELD_ORDER: readonly PatientField[] = ['fullName', 'dateOfBirth', 'phone'];

export function nextEmptyField(draft: PatientOnFileRecord, after?: PatientField): PatientField | null {
  const start = after ? PATIENT_FIELD_ORDER.indexOf(after) + 1 : 0;
  for (let i = start; i < PATIENT_FIELD_ORDER.length; i++) {
    const f = PATIENT_FIELD_ORDER[i]!;
    if (draft[f].trim() === '') return f;
  }
  return null;
}
