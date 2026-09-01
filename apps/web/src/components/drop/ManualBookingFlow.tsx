'use client';

/**
 * Act one: booking the appointment by hand, fairly, while the counter watches.
 *
 * The honesty of this whole demo rests on this component being a GOOD manual booking site, not a
 * strawman built to lose. So: real labels tied to real inputs, hints that say why a field is asked
 * for, `autocomplete` attributes that let a browser fill four fields for one interaction, an error
 * summary you can jump from, a Back link at every step that never discards what you typed, a
 * visible focus ring, 44px targets, and no countdown pressure on the form. It still costs dozens of
 * interactions, because structure costs interactions. That is the finding, not the trick.
 *
 * The number comes from `lib/drop/interaction-counter.ts` under `lib/drop/COUNTING.md`, scoped to
 * the measured region below — which excludes this component's own header, so reading the tally
 * never costs you anything. Nothing here can set the count; if the counter is not running it is 0.
 *
 * Slots go while you are mid-form. That arrives through the `DropDriver` seam (`lib/drop/types.ts`)
 * as a `DropEvent`: the rival takes slots on its own schedule, not in response to your progress.
 * This file never imports a driver implementation — it is typed against the interface, so the mock
 * tonight and the real adapter later are the same component to it.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  createCounter,
  emptyBreakdown,
  type CounterSnapshot,
  type InteractionBreakdown,
  type InteractionCounter,
} from '../../lib/drop/interaction-counter.ts';
import {
  ACCESSIBILITY_MAX,
  describeSlotsLost,
  findSlot,
  initialManualFlowState,
  isBookable,
  manualFlowReducer,
  PATIENT_FIELDS,
  REASONS,
  stepPosition,
  STEP_ORDER,
  STEP_TITLE,
  type PatientField,
} from '../../lib/drop/manual-flow.ts';
import type { DropDriver, Slot, SlotState } from '../../lib/drop/types.ts';
import { CounterBadge } from './CounterBadge.tsx';
import styles from './ManualBookingFlow.module.css';

export interface ManualReceipt {
  slotId: string;
  count: number;
  breakdown: InteractionBreakdown;
  slotsLost: number;
}

export interface ManualBookingFlowProps {
  /** The seam. Any implementation of the interface; this file knows no concrete driver. */
  driver: DropDriver;
  /** The board before the first wave arrives. Waves from the driver replace it. */
  slots?: Slot[];
  clinicName?: string;
  /** Called once, with the frozen receipt, the moment the booking is confirmed. */
  onFinish?: (receipt: ManualReceipt) => void;
  className?: string;
}

const STATUS_WORD: Record<SlotState, string> = {
  open: 'Available',
  held_by_you: 'Held for you',
  held_by_other: 'Being booked',
  taken_by_rival: 'Taken',
  taken_by_other: 'Taken',
  booked_yours: 'Booked',
  expired_hold: 'Gone',
};

interface FieldMeta {
  label: string;
  hint?: string;
  control: 'text' | 'date' | 'tel' | 'select' | 'textarea';
  autoComplete?: string;
  optional?: boolean;
}

/** What a clinic booking line asks, and why. Five fields — we did not pad the form. */
const FIELD_META: Record<PatientField, FieldMeta> = {
  fullName: {
    label: 'Patient’s full name',
    hint: 'As it appears on their record at the clinic.',
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
    hint: 'The clinic calls this number if they need to move the appointment.',
    control: 'tel',
    autoComplete: 'tel',
  },
  accessibilityNeeds: {
    label: 'Access needs',
    hint: `Anything the clinic should arrange — step-free access, an interpreter, a longer appointment. Up to ${ACCESSIBILITY_MAX} characters.`,
    control: 'textarea',
    optional: true,
  },
};

export function ManualBookingFlow({ driver, slots = [], clinicName = 'Northgate Health Centre', onFinish, className = '' }: ManualBookingFlowProps) {
  const [state, dispatch] = useReducer(manualFlowReducer, slots, initialManualFlowState);

  const measuredRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef<InteractionCounter | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef(false);
  /** Set by "Change <field>" on the review step so going back lands on the field it named. */
  const focusFieldRef = useRef<PatientField | null>(null);

  const [tally, setTally] = useState<CounterSnapshot>({ total: 0, breakdown: emptyBreakdown() });
  const [receipt, setReceipt] = useState<ManualReceipt | null>(null);
  /** Bumped by each attempt to move on, so the error summary takes focus once per attempt. */
  const [reviewAttempt, setReviewAttempt] = useState(0);

  // The instrument. Scoped to the measured region and left on its production settings: only events
  // the browser marks isTrusted are counted, so nothing on this page can inflate the number.
  useEffect(() => {
    const root = measuredRef.current;
    if (root === null) return;
    const counter = createCounter(root, { onChange: setTally });
    counterRef.current = counter;
    return () => {
      counter.stop();
      counterRef.current = null;
    };
  }, []);

  // The seam. Every board change — including the loss — arrives here.
  useEffect(() => driver.subscribe((event) => dispatch({ type: 'driver_event', event })), [driver]);

  // Freeze the receipt at the instant the booking is confirmed, so the number cannot drift while
  // the confirmation is on screen.
  const bookedSlotId = state.bookedSlotId;
  useEffect(() => {
    if (bookedSlotId === null || receipt !== null) return;
    const snapshot = counterRef.current?.snapshot() ?? { total: 0, breakdown: emptyBreakdown() };
    const frozen: ManualReceipt = {
      slotId: bookedSlotId,
      count: snapshot.total,
      breakdown: snapshot.breakdown,
      slotsLost: state.slotsLost,
    };
    setReceipt(frozen);
    onFinish?.(frozen);
  }, [bookedSlotId, receipt, state.slotsLost, onFinish]);

  // Move focus to the new step's heading. Programmatic focus costs the user nothing and is not
  // counted (COUNTING.md), so this is free accessibility rather than a thumb on the scale.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const field = focusFieldRef.current;
    focusFieldRef.current = null;
    const target = field === null ? null : document.getElementById(`drop-field-${field}`);
    if (target !== null) target.focus();
    else headingRef.current?.focus();
  }, [state.step]);

  const errorFields = PATIENT_FIELDS.filter((field) => state.errors[field] !== undefined);
  const errorCount = errorFields.length;

  // Focus the summary once per attempt to move on — never when an error merely clears. Focusing on
  // every change would snatch the caret away mid-word the instant someone started fixing a field.
  useEffect(() => {
    if (reviewAttempt === 0) return;
    summaryRef.current?.focus();
  }, [reviewAttempt]);

  const restart = useCallback(() => {
    counterRef.current?.reset();
    setReceipt(null);
    setReviewAttempt(0);
    dispatch({ type: 'restart' });
  }, []);

  const book = useCallback(() => {
    if (state.selectedSlotId === null) return;
    dispatch({ type: 'submit_booking' });
    driver.confirm(state.selectedSlotId);
  }, [driver, state.selectedSlotId]);

  const selected = findSlot(state.slots, state.selectedSlotId);
  const booked = findSlot(state.slots, state.bookedSlotId);
  const position = stepPosition(state.step);

  return (
    <section
      data-drop-flow="manual"
      data-drop-step={state.step}
      data-drop-slots-lost={state.slotsLost}
      className={`${styles.flow} ${className}`}
      aria-labelledby="drop-manual-title"
    >
      <header className={styles.head}>
        <div>
          <p className={styles.clinic}>{clinicName}</p>
          <h2 id="drop-manual-title" ref={headingRef} tabIndex={-1} className={styles.title}>
            {STEP_TITLE[state.step]}
          </h2>
          {position !== null ? (
            <p className={styles.progress} data-drop-progress={position}>
              Step {position} of {STEP_ORDER.length}
            </p>
          ) : null}
        </div>
        <CounterBadge count={tally.total} mode="manual" />
      </header>

      <div ref={measuredRef} data-drop-measured="manual-flow" className={styles.measured}>
        {state.lost !== null ? (
          <div className={styles.lost} role="alert" data-drop-lost={state.lost.slotId}>
            <p>
              <span className={styles.lostTime}>{state.lost.timeLabel}</span> was booked by someone
              else while you were {state.lost.atStep === 'booking' ? 'confirming' : 'filling this in'}.
              Your details are still here — choose another time.
            </p>
            <button type="button" className={styles.secondary} data-drop-action="dismiss-lost" onClick={() => dispatch({ type: 'dismiss_lost' })}>
              Hide this
            </button>
          </div>
        ) : null}

        {state.step === 'board' ? (
          <div data-drop-step-panel="board">
            <p className={styles.lede}>
              {state.slots.length === 0
                ? 'Appointments appear here the moment the clinic releases them.'
                : 'Choose a time. The appointment is yours once you have booked it, not before.'}
            </p>
            {state.slots.length === 0 ? (
              <p className={styles.empty}>No appointments released yet</p>
            ) : (
              <ul className={styles.sheet}>
                {state.slots.map((slot) => (
                  <li key={slot.id} className={styles.row} data-drop-slot={slot.id} data-slot-state={slot.state}>
                    {isBookable(slot) ? (
                      <button
                        type="button"
                        className={styles.rowButton}
                        data-drop-action="open-slot"
                        onClick={() => dispatch({ type: 'open_slot', slotId: slot.id })}
                      >
                        <span className={styles.time}>{slot.timeLabel}</span>
                        <span className={styles.who}>
                          {slot.clinician}
                          <span className={styles.kind}>{slot.kind}</span>
                        </span>
                        <span className={styles.status}>{STATUS_WORD[slot.state]}</span>
                      </button>
                    ) : (
                      <div className={styles.rowGone}>
                        <span className={`${styles.time} ${styles.timeGone}`}>{slot.timeLabel}</span>
                        <span className={styles.who}>
                          {slot.clinician}
                          <span className={styles.kind}>{slot.kind}</span>
                        </span>
                        <span className={`${styles.status} ${styles.statusGone}`}>{STATUS_WORD[slot.state]}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {state.step === 'detail' && selected !== undefined ? (
          <div data-drop-step-panel="detail">
            <div className={styles.chosen}>
              <span className={styles.chosenTime}>{selected.timeLabel}</span>
              <span className={styles.chosenWho}>
                {selected.clinician} · {selected.kind}
              </span>
            </div>
            <p className={styles.lede}>
              The clinic needs a few details before it can hold this time for you. It takes about a
              minute.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} data-drop-action="start-details" onClick={() => dispatch({ type: 'start_details' })}>
                Continue
              </button>
              <button type="button" className={styles.secondary} data-drop-action="back" onClick={() => dispatch({ type: 'back' })}>
                Choose a different time
              </button>
            </div>
          </div>
        ) : null}

        {state.step === 'details' ? (
          <form
            data-drop-step-panel="details"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setReviewAttempt((n) => n + 1);
              dispatch({ type: 'to_review' });
            }}
          >
            {errorCount > 0 ? (
              <div ref={summaryRef} className={styles.summary} tabIndex={-1} role="alert" data-drop-error-summary={errorCount}>
                <h3 className={styles.summaryTitle}>
                  {errorCount === 1 ? 'There is a problem' : 'There are problems'}
                </h3>
                <ul className={styles.summaryList}>
                  {errorFields.map((field) => (
                    <li key={field}>
                      <a href={`#drop-field-${field}`}>{state.errors[field]}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={styles.fields}>
              {PATIENT_FIELDS.map((field) => {
                const meta = FIELD_META[field];
                const error = state.errors[field];
                const id = `drop-field-${field}`;
                const describedBy = [meta.hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
                const shared = {
                  id,
                  name: field,
                  value: state.details[field],
                  'aria-invalid': error !== undefined,
                  'aria-describedby': describedBy === '' ? undefined : describedBy,
                  'data-drop-field': field,
                  onChange: (event: { target: { value: string } }) =>
                    dispatch({ type: 'set_field', field, value: event.target.value }),
                };

                return (
                  <div key={field} className={`${styles.field} ${error ? styles.fieldError : ''}`}>
                    <label className={styles.label} htmlFor={id}>
                      {meta.label}
                      {meta.optional ? <span className={styles.optional}> (optional)</span> : null}
                    </label>
                    {meta.hint ? (
                      <p className={styles.hint} id={`${id}-hint`}>
                        {meta.hint}
                      </p>
                    ) : null}
                    {error ? (
                      <p className={styles.error} id={`${id}-error`}>
                        {error}
                      </p>
                    ) : null}

                    {meta.control === 'select' ? (
                      <select {...shared} className={styles.select}>
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
                      <textarea {...shared} className={styles.textarea} rows={3} />
                    ) : (
                      <input
                        {...shared}
                        className={styles.input}
                        type={meta.control}
                        autoComplete={meta.autoComplete}
                        inputMode={meta.control === 'tel' ? 'tel' : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.primary} data-drop-action="to-review">
                Review your answers
              </button>
              <button type="button" className={styles.secondary} data-drop-action="back" onClick={() => dispatch({ type: 'back' })}>
                Back
              </button>
            </div>
          </form>
        ) : null}

        {state.step === 'review' && selected !== undefined ? (
          <div data-drop-step-panel="review">
            <div className={styles.chosen}>
              <span className={styles.chosenTime}>{selected.timeLabel}</span>
              <span className={styles.chosenWho}>
                {selected.clinician} · {selected.kind}
              </span>
            </div>
            <dl className={styles.answers}>
              {PATIENT_FIELDS.map((field) => (
                <div key={field} className={styles.answer} data-drop-answer={field}>
                  <dt>{FIELD_META[field].label}</dt>
                  <dd className={state.details[field] === '' ? styles.answerBlank : undefined}>
                    {state.details[field] === '' ? 'Not given' : state.details[field]}
                  </dd>
                  <button
                    type="button"
                    className={styles.change}
                    data-drop-action="change"
                    data-drop-field={field}
                    onClick={() => {
                      focusFieldRef.current = field;
                      dispatch({ type: 'back' });
                    }}
                  >
                    Change<span className={styles.srOnly}> {FIELD_META[field].label}</span>
                  </button>
                </div>
              ))}
            </dl>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} data-drop-action="book" onClick={book}>
                Book this appointment
              </button>
              <button type="button" className={styles.secondary} data-drop-action="back" onClick={() => dispatch({ type: 'back' })}>
                Back
              </button>
            </div>
          </div>
        ) : null}

        {state.step === 'booking' ? (
          <p className={styles.waiting} role="status" data-drop-step-panel="booking">
            Sending your booking…
          </p>
        ) : null}

        {state.step === 'booked' && receipt !== null ? (
          <div data-drop-step-panel="booked">
            <div className={styles.confirmed}>
              <p className={styles.confirmedTitle}>
                Booked — {booked?.timeLabel ?? ''} with {booked?.clinician ?? 'the clinic'}
              </p>
              <p className={styles.confirmedBody}>
                {state.details.fullName || 'The patient'} is expected at reception ten minutes early.
              </p>
            </div>

            <CounterBadge count={receipt.count} mode="manual" variant="receipt" breakdown={receipt.breakdown} />

            <p className={styles.receiptNote} data-drop-slots-lost-note>
              {describeSlotsLost(receipt.slotsLost)}
            </p>

            <div className={styles.actions}>
              <button type="button" className={styles.secondary} data-drop-action="restart" onClick={restart}>
                Book another appointment
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
