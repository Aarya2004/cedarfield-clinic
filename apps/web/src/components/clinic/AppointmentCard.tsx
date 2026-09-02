'use client';

/**
 * Your appointment — what a person has after they book (SPEC-V3 §3).
 *
 * A white card with a blue top edge — the one plate on the site that is unambiguously the
 * visitor's, and the only one that carries the practice blue. Everything it shows
 * is derived from the booking itself — the reference from the slot and the instant it was made, the
 * date from the list's own time label — so the card cannot disagree with the row it came from.
 *
 * ── HOW TO MOUNT IT (for whoever owns `ClinicBooking.tsx`) ──────────────────────────────────────
 * The card performs nothing. `onCancel` and `onMove` are the page's existing arming callbacks —
 * `prepareCancel(slotId)` and `prepareMove(fromId, toId)`, the same pair `clinic_prepare_cancel` and
 * `clinic_prepare_move` call — and both return false when the board has moved on, which the card
 * turns into a line of text rather than a silent no-op. Arming raises the confirm dock; the dock's
 * trusted press is what actually cancels or moves, exactly as it is for an agent-armed act.
 *
 *   {bookedSlot !== undefined && lastBookedAtWall !== null ? (
 *     <AppointmentCard
 *       slotId={bookedSlot.id}
 *       bookedAt={lastBookedAtWall}                    // Date.now() when the booking landed
 *       timeLabel={bookedSlot.timeLabel}
 *       clinician={bookedSlot.clinician}
 *       kind={bookedSlot.kind}
 *       moveOptions={session.slots
 *         .filter((s) => s.state === 'open')
 *         .map((s) => ({ slotId: s.id, timeLabel: s.timeLabel, clinician: s.clinician }))}
 *       onCancel={() => prepareCancel(bookedSlot.id)}
 *       onMove={(toId) => prepareMove(bookedSlot.id, toId)}
 *       armed={pendingAct !== null}
 *     />
 *   ) : null}
 *
 * `bookedAt` must be wall-clock epoch ms and must not change while the card is on screen, or the
 * reference the visitor was given would change under them. The page's `lastBookedAt` is driver-clock
 * elapsed time, not epoch — pass `Date.now()` captured at the same moment instead.
 */
import { useMemo, useRef, useState } from 'react';
import {
  appointmentDateFor,
  appointmentReference,
  buildIcs,
  formatAppointmentDate,
  icsFilename,
} from './appointment.ts';

export interface MoveOption {
  slotId: string;
  timeLabel: string;
  clinician: string;
}

export interface AppointmentCardProps {
  /** The booked slot's id. Half the reference's seed, and the anchor for cancel and move. */
  slotId: string;
  /** Wall-clock epoch ms at which the booking landed. The other half of the reference's seed. */
  bookedAt: number;
  /** "8:40 AM", exactly as the board printed it. */
  timeLabel: string;
  clinician: string;
  kind: string;
  /** Arms the cancel dock. False means the board no longer has this booking to cancel. */
  onCancel?: () => boolean;
  /** Open times this booking can move to. No options, no move control. */
  moveOptions?: readonly MoveOption[];
  /** Arms the move dock for `toSlotId`. False means that time went while the list was open. */
  onMove?: (toSlotId: string) => boolean;
  /** True while a dock is already armed: the card stands down and points at it. */
  armed?: boolean;
  /**
   * What this booking cost, measured by the page (SPEC-V1 §7.2): interactions by hand from arrival
   * to confirmation, and interactions with the agent from the confirm bar's arrival to the press.
   * `delegated`: the agent booked under a standing permission — the person's cost was zero.
   */
  interactions?: { hand: number | null; agent: number | null; delegated?: boolean };
}

export function AppointmentCard({
  slotId,
  bookedAt,
  timeLabel,
  clinician,
  kind,
  onCancel,
  moveOptions = [],
  onMove,
  armed = false,
  interactions,
}: AppointmentCardProps) {
  const reference = useMemo(() => appointmentReference(`${slotId}|${bookedAt}`), [slotId, bookedAt]);
  const bookedDate = useMemo(() => new Date(bookedAt), [bookedAt]);
  const startsAt = useMemo(() => appointmentDateFor(timeLabel, bookedDate), [timeLabel, bookedDate]);

  const [showMoves, setShowMoves] = useState(false);
  const [notice, setNotice] = useState('');
  const downloadRef = useRef<HTMLAnchorElement>(null);

  const download = () => {
    if (startsAt === null || downloadRef.current === null) return;
    const file = buildIcs({ reference, startsAt, clinician, kind, stamp: new Date() });
    const url = URL.createObjectURL(new Blob([file], { type: 'text/calendar;charset=utf-8' }));
    const anchor = downloadRef.current;
    anchor.href = url;
    anchor.download = icsFilename(reference);
    anchor.click();
    // Revoked on the next turn: Safari reads the URL after the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const cancel = () => {
    const armedNow = onCancel?.() ?? false;
    setNotice(
      armedNow
        ? 'Cancelling this appointment. Confirm it in the bar at the bottom of the screen.'
        : 'This appointment is no longer on the board, so there is nothing to cancel.',
    );
  };

  const move = (option: MoveOption) => {
    const armedNow = onMove?.(option.slotId) ?? false;
    setShowMoves(false);
    setNotice(
      armedNow
        ? `Moving to ${option.timeLabel}. Confirm it in the bar at the bottom of the screen.`
        : `${option.timeLabel} went while the list was open. Choose another time.`,
    );
  };

  return (
    <div
      className="cl-appt"
      data-clinic-appointment={reference}
      data-clinic-slot-booked={slotId}
      // The measurements are still taken (interaction-counter.ts, trusted events only) but a patient
      // is never shown them — a clinic does not price its own form (SPEC-V3 §1; Aarya 2026-09-02:
      // the demo shows the time difference by going through both flows on camera). Hooks only.
      data-clinic-cost-hand={interactions?.hand ?? undefined}
      data-clinic-cost-agent={interactions?.agent ?? undefined}
      data-clinic-booked-under-permission={interactions?.delegated ? 'true' : undefined}
    >
      <h2 className="cl-appt__head">Your appointment</h2>

      <p className="cl-appt__time">{timeLabel}</p>
      <p className="cl-appt__detail">
        {startsAt === null ? kind : `${formatAppointmentDate(startsAt, bookedDate)} · ${kind}`} with {clinician}
      </p>

      <p className="cl-appt__ref">
        Reference <b data-clinic-reference={reference}>{reference}</b>
      </p>

      <div className="cl-appt__actions">
        {startsAt === null ? null : (
          <button type="button" className="cl-quiet" data-clinic-action="add-to-calendar" onClick={download}>
            Add to calendar
          </button>
        )}
        {onMove && moveOptions.length > 0 ? (
          <button
            type="button"
            className="cl-quiet"
            data-clinic-action="move-appointment"
            aria-expanded={showMoves}
            aria-disabled={armed}
            onClick={() => (armed ? setNotice('Finish the change in the bar below first.') : setShowMoves((open) => !open))}
          >
            Move appointment
          </button>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            className="cl-quiet"
            data-clinic-action="cancel-appointment"
            aria-disabled={armed}
            onClick={() => (armed ? setNotice('Finish the change in the bar below first.') : cancel())}
          >
            Cancel appointment
          </button>
        ) : null}
      </div>

      {showMoves && onMove ? (
        <ul className="cl-appt__moves" data-clinic-move-options={moveOptions.length}>
          {moveOptions.map((option) => (
            <li key={option.slotId}>
              <button type="button" className="cl-link" data-clinic-move-to={option.slotId} onClick={() => move(option)}>
                Move to {option.timeLabel} <span>with {option.clinician}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="cl-appt__note" role="status" data-clinic-appointment-notice>
        {notice === ''
          ? 'Cancelling or moving takes one more press to confirm. Nothing changes until you make it.'
          : notice}
      </p>

      {/* The download's anchor. Kept out of the tab order: the button above is the control. */}
      <a ref={downloadRef} className="cl-sr" aria-hidden="true" tabIndex={-1} href="#" download>
        Calendar file
      </a>
    </div>
  );
}
