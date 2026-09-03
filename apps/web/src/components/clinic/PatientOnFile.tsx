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
import { SAMPLE_PATIENT, normalisePatient, validate, validateFields, type PatientField, type PatientOnFileRecord } from '../../lib/drop/patient-record.ts';
import { setSignSink } from '../../lib/drop/sign-sink.ts';
import { ScanKeyboard } from './ScanKeyboard.tsx';

/** The sweep speed; under `?test=1` a case may freeze it (`window.__cedarfieldScanMs`) to drive it deterministically. */
function scanStepMs(): number {
  if (typeof window === 'undefined') return 900;
  const hook = (window as unknown as { __cedarfieldScanMs?: unknown }).__cedarfieldScanMs;
  const test = new URLSearchParams(window.location.search).has('test');
  return test && typeof hook === 'number' && hook > 0 ? hook : 900;
}

export { SAMPLE_PATIENT, validate, type PatientOnFileRecord };

const KEY = 'cedarfield.patient';
const FIELD_IDS: Record<PatientField, string> = { fullName: 'cl-patient-name', dateOfBirth: 'cl-patient-dob', phone: 'cl-patient-phone' };

/** The declarative WebMCP attributes: the browser publishes this form as a tool an assistant can fill. */
const DECLARATIVE_PATIENT_FORM = {
  toolname: 'clinic_patient_details',
  tooldescription:
    'Who the appointment is for at Cedarfield Clinic: full name, date of birth (day/month/year) and phone. Fill it from what you know about your human; they press Save themselves — a submit you make is refused.',
};
const PARAM_DESCRIPTION: Record<PatientField, string> = {
  fullName: "The patient's full name, as it appears on their record.",
  dateOfBirth: 'Date of birth, day/month/year — for example 12/04/1988.',
  phone: 'A phone number the clinic can call.',
};

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

/** The labelled sample, field for field — never a real person's record. */
export function isSamplePatient(p: PatientOnFileRecord): boolean {
  return p.fullName === SAMPLE_PATIENT.fullName && p.dateOfBirth === SAMPLE_PATIENT.dateOfBirth && p.phone === SAMPLE_PATIENT.phone;
}

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
  const [errors, setErrors] = useState<Partial<Record<PatientField, string>>>({});
  const [saved, setSaved] = useState(false);
  const [agentFilled, setAgentFilled] = useState(false);
  const [blockedSubmits, setBlockedSubmits] = useState(0);
  /** Which field the scanning keyboard is typing into, if any (two switches: camera shapes, a switch, or keys). */
  const [scanning, setScanning] = useState<PatientField | null>(null);
  const FIELD_LABEL: Record<PatientField, string> = { fullName: 'the patient’s full name', dateOfBirth: 'the date of birth', phone: 'the phone number' };
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let stored = readPatient();
    // The sample lives in memory only: written to the browser it would outlive the test flag and
    // book a real visitor's appointment for "Ada Okonkwo" without asking (Arav, 2026-09-03 01:16).
    // Browsers that already hold the sample from an older build are cleaned here, once.
    if (stored !== null && !sample && isSamplePatient(stored)) {
      writePatient(null);
      stored = null;
    }
    const initial = stored ?? (sample ? SAMPLE_PATIENT : null);
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
    setErrors({});
    setSaved(false);
    writePatient(null);
    onChange(null);
  };

  const save = () => {
    const problems = validateFields(draft);
    setErrors(problems);
    const next = normalisePatient(draft);
    if (next === null) {
      // Focus the first field with a problem so a keyboard or switch user lands on it.
      const first = (['fullName', 'dateOfBirth', 'phone'] as PatientField[]).find((f) => problems[f]);
      if (first) document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    writePatient(next);
    setPatient(next);
    setEditing(false);
    setSaved(true);
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
            {saved ? (
              <span className="cl-patient__saved" role="status" data-clinic-patient-saved>
                {' '}· Saved. Every booking on this page is now for this person.
              </span>
            ) : null}
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
          data-clinic-patient-agent-filled={agentFilled ? 'true' : 'false'}
          data-clinic-patient-submits-blocked={blockedSubmits}
          noValidate
          // WebMCP's declarative half: the browser publishes this form as a tool, so an assistant can
          // fill it for a person who cannot type — from what it knows about them. The person's press
          // on Save is the consent; a submit the browser attributes to an agent, or a scripted one,
          // is refused and counted, exactly like the booking form.
          {...(DECLARATIVE_PATIENT_FORM as unknown as Record<string, string>)}
          onInput={(e) => {
            if (!e.nativeEvent.isTrusted) setAgentFilled(true);
          }}
          onSubmit={(e) => {
            e.preventDefault();
            if ((e.nativeEvent as SubmitEvent & { agentInvoked?: boolean }).agentInvoked === true || !e.nativeEvent.isTrusted) {
              setBlockedSubmits((n) => n + 1);
              return;
            }
            save();
          }}
        >
          {agentFilled ? (
            <p className="cl-agent" role="status" data-clinic-patient-agent-banner>
              Filled in by your assistant. Check it over, then press Save yourself — nothing is kept until you do.
            </p>
          ) : null}
          {blockedSubmits > 0 ? (
            <p className="cl-lost" role="status" data-clinic-patient-submit-blocked={blockedSubmits}>
              A save that did not come from you was refused ({blockedSubmits}). Press Save yourself.
            </p>
          ) : null}
          <h2 id="cl-patient-head" className="cl-patient__head">Who is this appointment for?</h2>
          <p className="cl-prose cl-patient__intro">
            Entered once, kept in this browser only. Every booking on this page — by hand or by your assistant —
            is made for this person.
          </p>
          {Object.keys(errors).length > 0 ? (
            <div className="cl-lost" role="alert" data-clinic-patient-error>
              <b>Not saved yet.</b> {Object.keys(errors).length === 1 ? 'One field needs attention:' : `${Object.keys(errors).length} fields need attention:`}
              <ul>
                {(['fullName', 'dateOfBirth', 'phone'] as PatientField[]).filter((f) => errors[f]).map((f) => (
                  <li key={f}>
                    <a href={`#${FIELD_IDS[f]}`}>{errors[f]}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="cl-fields">
            <div className="cl-field" data-invalid={errors.fullName ? 'true' : 'false'}>
              <label htmlFor={FIELD_IDS.fullName}>Patient’s full name</label>
              <input
                id={FIELD_IDS.fullName}
                name="patientFullName"
                autoComplete="name"
                {...({ toolparamdescription: PARAM_DESCRIPTION['fullName'] } as Record<string, string>)}
                required
                aria-required="true"
                aria-invalid={errors.fullName ? 'true' : 'false'}
                aria-describedby={errors.fullName ? `${FIELD_IDS.fullName}-error` : undefined}
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              />
              {errors.fullName ? (
                <p className="cl-field__error" id={`${FIELD_IDS.fullName}-error`}>
                  {errors.fullName}
                </p>
              ) : null}
            </div>
            <div className="cl-field" data-invalid={errors.dateOfBirth ? 'true' : 'false'}>
              <label htmlFor={FIELD_IDS.dateOfBirth}>Date of birth</label>
              <p className="cl-field__hint" id={`${FIELD_IDS.dateOfBirth}-hint`}>
                Day, month, year — for example 12/04/1988.
              </p>
              <input
                id={FIELD_IDS.dateOfBirth}
                name="patientDateOfBirth"
                type="text"
                inputMode="numeric"
                autoComplete="bday"
                {...({ toolparamdescription: PARAM_DESCRIPTION['dateOfBirth'] } as Record<string, string>)}
                placeholder="DD/MM/YYYY"
                required
                aria-required="true"
                aria-invalid={errors.dateOfBirth ? 'true' : 'false'}
                aria-describedby={`${FIELD_IDS.dateOfBirth}-hint${errors.dateOfBirth ? ` ${FIELD_IDS.dateOfBirth}-error` : ''}`}
                value={draft.dateOfBirth}
                onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
              />
              {errors.dateOfBirth ? (
                <p className="cl-field__error" id={`${FIELD_IDS.dateOfBirth}-error`}>
                  {errors.dateOfBirth}
                </p>
              ) : null}
            </div>
            <div className="cl-field" data-invalid={errors.phone ? 'true' : 'false'}>
              <label htmlFor={FIELD_IDS.phone}>Phone number</label>
              <input
                id={FIELD_IDS.phone}
                name="patientPhone"
                type="tel"
                autoComplete="tel"
                {...({ toolparamdescription: PARAM_DESCRIPTION['phone'] } as Record<string, string>)}
                required
                aria-required="true"
                aria-invalid={errors.phone ? 'true' : 'false'}
                aria-describedby={errors.phone ? `${FIELD_IDS.phone}-error` : undefined}
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
              {errors.phone ? (
                <p className="cl-field__error" id={`${FIELD_IDS.phone}-error`}>
                  {errors.phone}
                </p>
              ) : null}
            </div>
          </div>
          {scanning !== null ? (
            <ScanKeyboard
              key={scanning}
              fieldLabel={FIELD_LABEL[scanning]}
              value={draft[scanning]}
              stepMs={scanStepMs()}
              onChange={(text) => setDraft((d) => ({ ...d, [scanning]: text }))}
              onDone={() => setScanning(null)}
              registerSignSink={setSignSink}
            />
          ) : (
            <p className="cl-patient__scan-offer">
              Cannot type?{' '}
              {(['fullName', 'dateOfBirth', 'phone'] as PatientField[]).map((f) => (
                <button key={f} type="button" className="cl-link" data-clinic-scan-open={f} onClick={() => setScanning(f)}>
                  Type {FIELD_LABEL[f]} with two switches
                </button>
              ))}
            </p>
          )}
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
