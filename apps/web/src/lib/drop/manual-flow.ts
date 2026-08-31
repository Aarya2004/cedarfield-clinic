/**
 * The manual booking flow's state, as a pure reducer — board → slot → details → review → book.
 *
 * This is act one: doing it by hand, fairly. "Fairly" is a design constraint with teeth, so the
 * rules this file encodes are worth stating:
 *
 *  - The form asks for exactly the fields a clinic actually needs, and not one field more. Padding
 *    it would inflate the interaction count in our favour, which would make the count worthless.
 *  - Nothing here is a dark pattern. Back always works. Validation runs when you ask to move on,
 *    never mid-keystroke. Errors say what to fix.
 *  - **When a slot is taken out from under you, your typed details survive.** Making you retype
 *    would be both cruel and dishonest — it would manufacture interactions the real cost does not
 *    contain. You pay for choosing another slot and walking the steps again. That is the true cost.
 *  - The manual site does not hold a slot for you. That is not a handicap we invented to lose the
 *    race: it is how first-come booking works, and the rival takes slots on its own schedule
 *    whether or not you happen to be mid-form. The flow ignores every hold event for that reason.
 *
 * Slot loss arrives through the `DropDriver` seam (`types.ts`) as a `DropEvent`; the reducer folds
 * events in itself, so the losing-the-race path is unit-testable without a driver or a browser.
 */
import type { DropEvent, Slot } from './types.ts';

export type ManualStep = 'board' | 'detail' | 'details' | 'review' | 'booking' | 'booked';

/** The steps a person walks. `booking` (submitted, waiting) and `booked` are after the walk. */
export const STEP_ORDER: readonly ManualStep[] = ['board', 'detail', 'details', 'review'];

export const STEP_TITLE: Record<ManualStep, string> = {
  board: 'Choose an appointment',
  detail: 'Check the appointment',
  details: 'Patient details',
  review: 'Review and book',
  booking: 'Booking',
  booked: 'Booked',
};

/** 1-based position for "Step n of 4", or null once the walk is over. */
export function stepPosition(step: ManualStep): number | null {
  const index = STEP_ORDER.indexOf(step);
  return index === -1 ? null : index + 1;
}

export const PATIENT_FIELDS = ['fullName', 'dateOfBirth', 'reason', 'phone', 'accessibilityNeeds'] as const;
export type PatientField = (typeof PATIENT_FIELDS)[number];
export type PatientDetails = Record<PatientField, string>;

/** What a clinic booking line actually asks. Ordered the way it is asked. */
export const REASONS: readonly string[] = [
  'New symptom or problem',
  'Follow-up on an existing problem',
  'Repeat prescription review',
  'Test results',
  'Vaccination or injection',
  'Something else',
];

export type FieldErrors = Partial<Record<PatientField, string>>;

export function emptyDetails(): PatientDetails {
  return { fullName: '', dateOfBirth: '', reason: '', phone: '', accessibilityNeeds: '' };
}

export const ACCESSIBILITY_MAX = 500;

/** Today as `yyyy-mm-dd`, in local time — the same calendar day the patient is looking at. */
export function todayIso(at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * Validation runs on request, not on every keystroke: nagging a half-typed field is both rude and
 * a way to bait extra corrective input into the count.
 */
export function validateDetails(details: PatientDetails, today: string = todayIso()): FieldErrors {
  const errors: FieldErrors = {};

  if (details.fullName.trim().length < 2) {
    errors.fullName = 'Enter the patient’s full name, as it appears on their record.';
  }

  const dob = details.dateOfBirth.trim();
  if (dob === '') {
    errors.dateOfBirth = 'Enter a date of birth.';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob))) {
    errors.dateOfBirth = 'Enter the date of birth as year, month and day.';
  } else if (dob > today) {
    errors.dateOfBirth = 'That date is in the future. Check the year.';
  }

  if (!REASONS.includes(details.reason)) {
    errors.reason = 'Choose the reason for the appointment.';
  }

  const digits = details.phone.replace(/\D/g, '');
  if (digits.length === 0) {
    errors.phone = 'Enter a phone number the clinic can reach you on.';
  } else if (digits.length < 7) {
    errors.phone = 'That number looks too short. Include the area code.';
  }

  if (details.accessibilityNeeds.length > ACCESSIBILITY_MAX) {
    errors.accessibilityNeeds = `Keep this under ${ACCESSIBILITY_MAX} characters. The clinic will ask for more when they call.`;
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** A slot you could still book. Anything else on the board is history. */
export function isBookable(slot: Slot | undefined): boolean {
  return slot !== undefined && (slot.state === 'open' || slot.state === 'held_by_you');
}

export function findSlot(slots: readonly Slot[], slotId: string | null): Slot | undefined {
  return slotId === null ? undefined : slots.find((slot) => slot.id === slotId);
}

/** What the flow shows when the slot you were working on disappeared under you. */
export interface LostSlot {
  slotId: string;
  timeLabel: string;
  /** How far in you were when it went — the sentence reads differently at the review step. */
  atStep: ManualStep;
}

export interface ManualFlowState {
  step: ManualStep;
  slots: Slot[];
  selectedSlotId: string | null;
  details: PatientDetails;
  errors: FieldErrors;
  lost: LostSlot | null;
  /** How many slots were taken while you were working on them. Part of the honest receipt. */
  slotsLost: number;
  bookedSlotId: string | null;
}

export type ManualFlowAction =
  | { type: 'open_slot'; slotId: string }
  | { type: 'back' }
  | { type: 'start_details' }
  | { type: 'set_field'; field: PatientField; value: string }
  | { type: 'to_review'; today?: string }
  | { type: 'submit_booking' }
  | { type: 'dismiss_lost' }
  | { type: 'driver_event'; event: DropEvent }
  | { type: 'restart' };

export function initialManualFlowState(slots: readonly Slot[] = []): ManualFlowState {
  return {
    step: 'board',
    slots: [...slots],
    selectedSlotId: null,
    details: emptyDetails(),
    errors: {},
    lost: null,
    slotsLost: 0,
    bookedSlotId: null,
  };
}

function withSlotState(slots: readonly Slot[], slotId: string, state: Slot['state']): Slot[] {
  return slots.map((slot) => (slot.id === slotId ? { ...slot, state } : slot));
}

/**
 * After any change to the board, decide whether the slot the user is working on is still theirs to
 * take. If not, they are returned to the board with the loss named — and with every character they
 * typed still in the form.
 */
function reconcileSelection(state: ManualFlowState): ManualFlowState {
  if (state.selectedSlotId === null || state.step === 'board' || state.step === 'booked') return state;

  const slot = findSlot(state.slots, state.selectedSlotId);
  if (isBookable(slot)) return state;

  return {
    ...state,
    step: 'board',
    selectedSlotId: null,
    errors: {},
    slotsLost: state.slotsLost + 1,
    lost: {
      slotId: state.selectedSlotId,
      timeLabel: slot?.timeLabel ?? state.selectedSlotId,
      atStep: state.step,
    },
    // details deliberately untouched — see the file header.
  };
}

function applyDriverEvent(state: ManualFlowState, event: DropEvent): ManualFlowState {
  switch (event.type) {
    case 'drop_wave':
      return reconcileSelection({ ...state, slots: [...event.slots] });

    case 'slot_taken':
      return reconcileSelection({ ...state, slots: withSlotState(state.slots, event.slotId, 'taken_by_rival') });

    case 'hold_expired':
      return reconcileSelection({ ...state, slots: withSlotState(state.slots, event.slotId, 'expired_hold') });

    case 'booked': {
      const slots = withSlotState(state.slots, event.slotId, 'booked_yours');
      if (state.step === 'booking' && event.slotId === state.selectedSlotId) {
        return { ...state, slots, step: 'booked', bookedSlotId: event.slotId, lost: null };
      }
      return reconcileSelection({ ...state, slots });
    }

    // Holds belong to the agent's story, not this one: a manual booking site holds nothing for you.
    case 'hold_started':
    case 'hold_tick':
      return state;

    default:
      return state;
  }
}

export function manualFlowReducer(state: ManualFlowState, action: ManualFlowAction): ManualFlowState {
  switch (action.type) {
    case 'open_slot': {
      if (state.step !== 'board') return state;
      if (!isBookable(findSlot(state.slots, action.slotId))) return state;
      return { ...state, step: 'detail', selectedSlotId: action.slotId, lost: null };
    }

    case 'back': {
      if (state.step === 'detail') return { ...state, step: 'board', selectedSlotId: null };
      if (state.step === 'details') return { ...state, step: 'detail', errors: {} };
      if (state.step === 'review') return { ...state, step: 'details' };
      return state; // no going back once it is submitted, and nowhere to go once it is booked
    }

    case 'start_details':
      return state.step === 'detail' ? { ...state, step: 'details' } : state;

    case 'set_field': {
      if (state.step !== 'details') return state;
      const errors = { ...state.errors };
      delete errors[action.field]; // stop shouting the moment they start fixing it
      return { ...state, details: { ...state.details, [action.field]: action.value }, errors };
    }

    case 'to_review': {
      if (state.step !== 'details') return state;
      const errors = validateDetails(state.details, action.today ?? todayIso());
      return hasErrors(errors) ? { ...state, errors } : { ...state, errors: {}, step: 'review' };
    }

    case 'submit_booking':
      return state.step === 'review' && state.selectedSlotId !== null ? { ...state, step: 'booking' } : state;

    case 'dismiss_lost':
      return state.lost === null ? state : { ...state, lost: null };

    case 'driver_event':
      return applyDriverEvent(state, action.event);

    case 'restart':
      return initialManualFlowState(state.slots);

    default:
      return state;
  }
}

/** The line under the receipt: what the race cost you on top of the interactions. */
export function describeSlotsLost(slotsLost: number): string {
  if (slotsLost === 0) return 'No slot was taken while you worked.';
  if (slotsLost === 1) return 'One slot was taken while you were filling this in.';
  return `${slotsLost} slots were taken while you were filling this in.`;
}
