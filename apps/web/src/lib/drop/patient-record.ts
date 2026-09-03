/**
 * The patient on file — the record and its validation, pure (no React) so it is unit-tested and
 * shared by the card, the page and the by-hand form. Storage stays in the component.
 */
export interface PatientOnFileRecord {
  fullName: string;
  dateOfBirth: string; // ISO yyyy-mm-dd
  phone: string;
}

/** The labelled sample used under `?test=1` so seeded proofs stay deterministic. */
export const SAMPLE_PATIENT: PatientOnFileRecord = { fullName: 'Ada Okonkwo', dateOfBirth: '1988-04-12', phone: '416 555 0100' };

/** One sentence, or null when the record is usable. Same bar as the by-hand form. */
export function validate(p: PatientOnFileRecord): string | null {
  if (p.fullName.trim().length < 2) return 'Enter the patient’s full name, as it appears on their record.';
  const iso = p.dateOfBirth.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Enter the date of birth as year, month and day.';
  // A real calendar date: `new Date('2026-02-31')` is Invalid, and '2026-02-30' silently rolls
  // over — round-tripping through ISO catches both (2026-09-02 review, P3).
  const dob = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== iso) return 'That date does not exist. Check the month and day.';
  if (dob > new Date()) return 'That date of birth is in the future. Check the year.';
  if (p.phone.replace(/\D/g, '').length < 7) return 'Enter a phone number the clinic can call.';
  return null;
}
