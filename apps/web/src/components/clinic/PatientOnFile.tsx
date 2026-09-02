'use client';

/**
 * Who the appointment is for (2026-09-02, Arav: "think about what's normally required when booking
 * an appointment"). A real clinic never books a time for nobody. The by-hand form always asked;
 * the assistant paths — hold-then-press and the delegated booking — did not. Now the page keeps
 * one patient on file per browser: full name, date of birth, phone. Entered once, editable, and
 * every path books FOR that person. Under `?test=1` a sample patient is prefilled so the seeded
 * proofs stay deterministic (and honest: it is labelled as a sample).
 *
 * Nothing leaves the browser: the record lives in localStorage and is never sent anywhere. The
 * appointment reference on the card is what a clinic would file it under.
 */
import { useEffect, useState } from 'react';

export interface PatientOnFileRecord {
  fullName: string;
  dateOfBirth: string; // ISO yyyy-mm-dd
  phone: string;
}

const KEY = 'cedarfield.patient';
export const SAMPLE_PATIENT: PatientOnFileRecord = { fullName: 'Ada Okonkwo', dateOfBirth: '1988-04-12', phone: '416 555 0100' };

export function readPatient(): PatientOnFileRecord | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PatientOnFileRecord>;
    if (typeof p.fullName !== 'string' || typeof p.dateOfBirth !== 'string' || typeof p.phone !== 'string') return null;
    return validate(p as PatientOnFileRecord) === null ? (p as PatientOnFileRecord) : null;
  } catch {
    return null;
  }
}

const CHANGED = 'cedarfield:patient';

export function writePatient(p: PatientOnFileRecord | null): void {
  try {
    if (p === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: the card asks again next visit */
  }
  // The by-hand form saves here too; the card re-reads on this event so both stay one record.
  window.dispatchEvent(new Event(CHANGED));
}

/** One sentence, or null when the record is usable. Same bar as the by-hand form. */
export function validate(p: PatientOnFileRecord): string | null {
  if (p.fullName.trim().length < 2) return 'Enter the patient’s full name, as it appears on their record.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth.trim())) return 'Enter the date of birth as year, month and day.';
  const dob = new Date(`${p.dateOfBirth.trim()}T12:00:00Z`);
  if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== p.dateOfBirth.trim()) return 'That date does not exist. Check the month and day.';
  if (dob > new Date()) return 'That date of birth is in the future. Check the year.';
  if (p.phone.replace(/\D/g, '').length < 7) return 'Enter a phone number the clinic can call.';
  return null;
}

function formatDob(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface PatientOnFileProps {
  /** Prefill with the labelled sample when nothing is on file (the seeded board / `?test=1`). */
  sample?: boolean;
  onChange: (patient: PatientOnFileRecord | null) => void;
}

export function PatientOnFile({ sample = false, onChange }: PatientOnFileProps) {
  const [patient, setPatient] = useState<PatientOnFileRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatientOnFileRecord>({ fullName: '', dateOfBirth: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readPatient();
    const initial = stored ?? (sample ? SAMPLE_PATIENT : null);
    if (stored === null && sample) writePatient(SAMPLE_PATIENT);
    setPatient(initial);
    setDraft(initial ?? { fullName: '', dateOfBirth: '', phone: '' });
    setEditing(initial === null);
    setHydrated(true);
    onChange(initial);
    const refresh = () => {
      const p = readPatient();
      setPatient(p);
      if (p !== null) setEditing(false);
      onChange(p);
    };
    window.addEventListener(CHANGED, refresh);
    return () => window.removeEventListener(CHANGED, refresh);
    // onChange is a page callback; the page passes a stable one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample]);

  const remove = () => {
    setPatient(null);
    setDraft({ fullName: '', dateOfBirth: '', phone: '' });
    setEditing(true);
    setError(null);
    writePatient(null);
    onChange(null);
  };

  const save = () => {
    const next = { fullName: draft.fullName.trim(), dateOfBirth: draft.dateOfBirth.trim(), phone: draft.phone.trim() };
    const problem = validate(next);
    setError(problem);
    if (problem !== null) return;
    writePatient(next);
    setPatient(next);
    setEditing(false);
    onChange(next);
  };

  const isSample = patient !== null && patient.fullName === SAMPLE_PATIENT.fullName && patient.dateOfBirth === SAMPLE_PATIENT.dateOfBirth;

  if (!hydrated) return <section className="cl-patient" data-clinic-patient="pending" aria-label="Who this booking is for" />;

  return (
    <section className="cl-patient" data-clinic-patient={patient === null ? 'none' : 'on-file'} aria-labelledby="cl-patient-head">
      {patient !== null && !editing ? (
        <div className="cl-patient__row">
          <p className="cl-patient__line">
            <span id="cl-patient-head" className="cl-patient__label">Booking as</span>{' '}
            <b data-clinic-patient-name>{patient.fullName}</b> · {formatDob(patient.dateOfBirth)} · {patient.phone}
            {isSample ? <span className="cl-patient__sample"> · sample patient</span> : null}
          </p>
          <span className="cl-patient__actions-inline">
            <button
              type="button"
              className="cl-link"
              data-clinic-patient-change
              aria-label="Change who this booking is for"
              onClick={() => {
                setDraft(patient);
                setEditing(true);
              }}
            >
              Change
            </button>
            <button type="button" className="cl-link" data-clinic-patient-clear aria-label="Not you? Remove this patient from this browser" onClick={remove}>
              Not you? Remove
            </button>
          </span>
        </div>
      ) : (
        <form
          className="cl-patient__form"
          data-clinic-patient-form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <h2 id="cl-patient-head" className="cl-patient__head">Who is this appointment for?</h2>
          <p className="cl-prose cl-patient__intro">
            Entered once, kept in this browser only. Every booking on this page — by hand or by your assistant —
            is made for this person.
          </p>
          {error !== null ? (
            <p className="cl-lost" role="alert" data-clinic-patient-error>
              {error}
            </p>
          ) : null}
          <div className="cl-fields">
            <div className="cl-field">
              <label htmlFor="cl-patient-name">Patient’s full name</label>
              <input
                id="cl-patient-name"
                name="patientFullName"
                autoComplete="name"
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              />
            </div>
            <div className="cl-field">
              <label htmlFor="cl-patient-dob">Date of birth</label>
              <input
                id="cl-patient-dob"
                name="patientDateOfBirth"
                type="date"
                autoComplete="bday"
                value={draft.dateOfBirth}
                onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="cl-field">
              <label htmlFor="cl-patient-phone">Phone number</label>
              <input
                id="cl-patient-phone"
                name="patientPhone"
                type="tel"
                autoComplete="tel"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="cl-patient__actions">
            <button type="submit" className="cl-cta cl-cta--sm" data-clinic-patient-save>
              Save
            </button>
            {patient !== null ? (
              <button type="button" className="cl-quiet" data-clinic-patient-cancel onClick={() => setEditing(false)}>
                Keep as is
              </button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
