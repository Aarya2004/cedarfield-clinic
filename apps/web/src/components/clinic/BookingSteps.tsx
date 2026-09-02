'use client';

/**
 * Booking by hand — the same walk any clinic asks for, in this page's skin.
 *
 * The reducer, the validation and the slot-loss rules are `lib/drop/manual-flow.ts` verbatim: real
 * fields and not one more, validation only when you ask to move on, Back that never discards what
 * you typed, and — the rule with teeth — a time booked out from under you returns you to the board
 * with every character still in the form.
 *
 * Presentation only below: the bench's `ManualBookingFlow` and its module CSS are not referenced.
 * One correction carried over from it, because it was found by driving a browser and not by any
 * unit test: the error summary takes focus once per ATTEMPT to move on, never once per change in
 * the error count — the latter snatches the caret away the instant someone starts fixing a field.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ACCESSIBILITY_MAX,
  PATIENT_FIELDS,
  REASONS,
  STEP_ORDER,
  STEP_TITLE,
  findSlot,
  stepPosition,
  type ManualFlowAction,
  type ManualFlowState,
  type PatientField,
} from '../../lib/drop/manual-flow.ts';

interface FieldMeta {
  label: string;
  hint?: string;
  control: 'text' | 'date' | 'tel' | 'select' | 'textarea';
  autoComplete?: string;
  optional?: boolean;
}

/** What a clinic booking line actually asks, and why it asks it. Five fields. */
const FIELD_META: Record<PatientField, FieldMeta> = {
  fullName: {
    label: 'Patient’s full name',
    hint: 'As it appears on their record at Cedarfield.',
    control: 'text',
    autoComplete: 'name',
  },
  dateOfBirth: {
    label: 'Date of birth',
    hint: 'Used to match the booking to the right record.',
    control: 'date',
    autoComplete: 'bday',
  },
  reason: {
    label: 'Reason for the appointment',
    hint: 'The clinician sees this before you arrive.',
    control: 'select',
  },
  phone: {
    label: 'Phone number',
    hint: 'The clinic calls this number if it needs to move the appointment.',
    control: 'tel',
    autoComplete: 'tel',
  },
  accessibilityNeeds: {
    label: 'Access needs',
    hint: `Anything to arrange — step-free access, an interpreter, a longer appointment. Up to ${ACCESSIBILITY_MAX} characters.`,
    control: 'textarea',
    optional: true,
  },
};

export interface BookingStepsProps {
  state: ManualFlowState;
  dispatch: (action: ManualFlowAction) => void;
  /** Bumped by the parent on each attempt to move on; focuses the summary once per attempt. */
  reviewAttempt: number;
  onAttemptReview: () => void;
  onBook: () => void;
  onRestart: () => void;
}

/**
 * SPEC-V6 — the DECLARATIVE half of WebMCP, on the real form (Chrome 152+ with the flag; ChatGPT
 * ignores declarative forms, harmlessly). The details form carries `toolname` / `tooldescription`
 * and every control a `toolparamdescription`, so the browser itself publishes it as a tool an agent
 * can FILL. It deliberately carries no `toolautosubmit`: the agent fills, the person reviews and
 * submits — the model the W3C APA group asked for on 2026-08-05 ("review by the user"). If a client
 * ever submits on the agent's behalf anyway (`SubmitEvent.agentInvoked`), the submit is refused and
 * counted, exactly like a synthetic keypress on the dock.
 */
const DECLARATIVE_FORM = {
  toolname: 'clinic_booking_form',
  tooldescription:
    'Fill in the patient details for the appointment the person has chosen: full name, date of ' +
    'birth (YYYY-MM-DD), reason, phone, access needs. Filling is all you can do — the person ' +
    'reviews what you wrote and submits it themselves; there is no automatic submit.',
} as const;
const PARAM_DESCRIPTION: Record<PatientField, string> = {
  fullName: 'The patient\'s full name as it appears on their record.',
  dateOfBirth: 'Date of birth, YYYY-MM-DD.',
  reason: 'One of: ' + REASONS.join(' · ') + '.',
  phone: 'A phone number the clinic can call to move the appointment.',
  accessibilityNeeds: 'Optional. Anything to arrange — step-free access, an interpreter, a longer appointment.',
};

export function BookingSteps({ state, dispatch, reviewAttempt, onAttemptReview, onBook, onRestart }: BookingStepsProps) {
  // Did an agent (the browser's declarative tool) write into this form? Decided by the events the
  // browser marks untrusted; a person typing is trusted. Shown as a review banner, never hidden.
  const [agentFilled, setAgentFilled] = useState(false);
  const [agentSubmitBlocked, setAgentSubmitBlocked] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const didMount = useRef(false);
  /** Set by "Change <field>" on the review step so Back lands on the field it named. */
  const focusField = useRef<PatientField | null>(null);

  const errorFields = PATIENT_FIELDS.filter((field) => state.errors[field] !== undefined);

  // Programmatic focus costs the reader nothing and is not counted (COUNTING.md), so moving it to
  // each new step is free accessibility rather than a thumb on the scale.
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const field = focusField.current;
    focusField.current = null;
    const target = field === null ? null : document.getElementById(`cl-field-${field}`);
    if (target !== null) target.focus();
    else headingRef.current?.focus();
  }, [state.step]);

  useEffect(() => {
    if (reviewAttempt === 0) return;
    summaryRef.current?.focus();
  }, [reviewAttempt]);

  const selected = findSlot(state.slots, state.selectedSlotId);
  const position = stepPosition(state.step);

  return (
    <div className="cl-panel" data-clinic-flow={state.step} data-clinic-slots-lost={state.slotsLost}>
      {/* Only while the walk has numbered steps. On the terminal steps the heading already says
          where you are, and printing it twice is the page stuttering. */}
      {position === null ? null : (
        <p className="cl-step" data-clinic-step-position={position}>
          Step {position} of {STEP_ORDER.length}
        </p>
      )}
      <h2 className="cl-lead cl-panel__lead" ref={headingRef} tabIndex={-1}>
        {STEP_TITLE[state.step]}
      </h2>

      {selected !== undefined && state.step !== 'booked' ? (
        <div className="cl-chosen cl-panel__block">
          <span className="cl-chosen__label">Appointment</span>
          <span className="cl-chosen__time">{selected.timeLabel}</span>
          <span className="cl-chosen__who">
            {selected.clinician} · {selected.kind}
          </span>
        </div>
      ) : null}

      {state.step === 'detail' && selected !== undefined ? (
        <div data-clinic-step="detail">
          <p className="cl-prose cl-panel__block">
            Cedarfield needs a few details before it can put this time in the book. It takes about a
            minute, and nothing holds the appointment for you while you fill it in — that is how
            first-come booking works, here and everywhere.
          </p>
          <div className="cl-actions">
            <button
              type="button"
              className="cl-cta"
              data-clinic-action="start-details"
              onClick={() => dispatch({ type: 'start_details' })}
            >
              Continue
            </button>
            <button
              type="button"
              className="cl-quiet"
              data-clinic-action="back"
              onClick={() => dispatch({ type: 'back' })}
            >
              Choose a different time
            </button>
          </div>
        </div>
      ) : null}

      {state.step === 'details' ? (
        <form
          data-clinic-step="details"
          data-clinic-agent-filled={agentFilled ? 'true' : 'false'}
          data-clinic-agent-submits-blocked={agentSubmitBlocked}
          noValidate
          {...(DECLARATIVE_FORM as unknown as Record<string, string>)}
          onInput={(event) => {
            if (!event.nativeEvent.isTrusted) setAgentFilled(true);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            // A submit the browser attributes to an agent never advances: filling is the agent's;
            // submitting is the person's. Counted in the open, like a synthetic keypress.
            if ((event.nativeEvent as SubmitEvent & { agentInvoked?: boolean }).agentInvoked === true || !event.nativeEvent.isTrusted) {
              setAgentSubmitBlocked((n) => n + 1);
              return;
            }
            onAttemptReview();
            dispatch({ type: 'to_review' });
          }}
        >
          {agentFilled ? (
            <p className="cl-agent" role="status" data-clinic-agent-filled-banner>
              Filled in by your assistant. Check it over — nothing is sent until you press Review, then Book.
            </p>
          ) : null}
          {agentSubmitBlocked > 0 ? (
            <p className="cl-lost" role="status" data-clinic-agent-submit-blocked={agentSubmitBlocked}>
              This form is only sent when you press Review yourself.
            </p>
          ) : null}
          {errorFields.length > 0 ? (
            <div
              ref={summaryRef}
              className="cl-summary"
              tabIndex={-1}
              role="alert"
              data-clinic-errors={errorFields.length}
            >
              <h3>{errorFields.length === 1 ? 'There is a problem' : 'There are problems'}</h3>
              <ul>
                {errorFields.map((field) => (
                  <li key={field}>
                    <a href={`#cl-field-${field}`}>{state.errors[field]}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="cl-fields">
            {PATIENT_FIELDS.map((field) => {
              const meta = FIELD_META[field];
              const error = state.errors[field];
              const id = `cl-field-${field}`;
              const describedBy = [meta.hint ? `${id}-hint` : null, error ? `${id}-error` : null]
                .filter(Boolean)
                .join(' ');
              const shared = {
                id,
                name: field,
                value: state.details[field],
                ...({ toolparamdescription: PARAM_DESCRIPTION[field] } as Record<string, string>),
                'aria-invalid': error !== undefined,
                'aria-describedby': describedBy === '' ? undefined : describedBy,
                'data-clinic-field': field,
                onChange: (event: { target: { value: string } }) =>
                  dispatch({ type: 'set_field', field, value: event.target.value }),
              };

              return (
                <div key={field} className="cl-field" data-invalid={error !== undefined ? 'true' : 'false'}>
                  <label htmlFor={id}>
                    {meta.label}
                    {meta.optional ? <span className="cl-field__optional"> (optional)</span> : null}
                  </label>
                  {meta.hint ? (
                    <p className="cl-field__hint" id={`${id}-hint`}>
                      {meta.hint}
                    </p>
                  ) : null}
                  {meta.control === 'select' ? (
                    <select {...shared}>
                      <option value="">Choose one</option>
                      {REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  ) : meta.control === 'textarea' ? (
                    // No hard maxLength: silently swallowing typed characters is the one dark
                    // pattern a length limit tempts you into. The limit is validated and named.
                    <textarea {...shared} rows={3} />
                  ) : (
                    <input
                      {...shared}
                      type={meta.control}
                      autoComplete={meta.autoComplete}
                      inputMode={meta.control === 'tel' ? 'tel' : undefined}
                    />
                  )}

                  {/* Under the control, where the eye lands after trying to fill it in. */}
                  {error ? (
                    <p className="cl-field__error" id={`${id}-error`}>
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="cl-actions">
            <button type="submit" className="cl-cta" data-clinic-action="to-review">
              Review your answers
            </button>
            <button
              type="button"
              className="cl-quiet"
              data-clinic-action="back"
              onClick={() => dispatch({ type: 'back' })}
            >
              Back
            </button>
          </div>
        </form>
      ) : null}

      {state.step === 'review' && selected !== undefined ? (
        <div data-clinic-step="review">
          <dl className="cl-answers">
            {PATIENT_FIELDS.map((field) => (
              <div key={field} className="cl-answer" data-clinic-answer={field}>
                <dt>{FIELD_META[field].label}</dt>
                <dd className={state.details[field] === '' ? 'cl-answer__blank' : undefined}>
                  {state.details[field] === '' ? 'Not given' : state.details[field]}
                </dd>
                <button
                  type="button"
                  data-clinic-action="change"
                  onClick={() => {
                    focusField.current = field;
                    dispatch({ type: 'back' });
                  }}
                >
                  Change<span className="cl-sr"> {FIELD_META[field].label}</span>
                </button>
              </div>
            ))}
          </dl>
          <div className="cl-actions">
            <button type="button" className="cl-cta" data-clinic-action="book" onClick={onBook}>
              Book this appointment
            </button>
            <button
              type="button"
              className="cl-quiet"
              data-clinic-action="back"
              onClick={() => dispatch({ type: 'back' })}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {state.step === 'booking' ? (
        <p className="cl-prose cl-panel__block" role="status" data-clinic-step="booking">
          Sending your booking…
        </p>
      ) : null}

      {state.step === 'booked' ? (
        <div data-clinic-step="booked">
          {/* The reference, the date, add-to-calendar and the cancel/move controls are the
              `AppointmentCard` band `ClinicBooking` renders under this panel — a booking made by
              the assistant never walks through these steps and must get the same card. */}
          <p className="cl-prose cl-panel__block">
            {state.details.fullName.trim() === '' ? 'The patient' : state.details.fullName} is booked
            in. Cedarfield asks that you arrive ten minutes early, and calls the number you gave if
            anything has to move.
          </p>
          <div className="cl-actions">
            <button type="button" className="cl-quiet" data-clinic-action="restart" onClick={onRestart}>
              Book another appointment
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
