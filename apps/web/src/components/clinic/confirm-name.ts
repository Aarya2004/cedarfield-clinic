/**
 * The confirm control's accessible name (SPEC-V10 §1.3).
 *
 * Visible text stays the act alone — "Confirm booking" — because that is the compact summary the
 * bar already prints beside it. The accessible name adds the time so a Voice Control user says one
 * unambiguous phrase ("Click Confirm booking nine twenty") and a screen reader user hears what the
 * press will do without leaving the button. The name starts with the visible text (WCAG 2.5.3,
 * Label in Name), so what a person sees is what they say.
 *
 * Pure so it runs under `node --test`; `ConfirmDock` reads both exports.
 */
import type { DockAct } from './ConfirmDock.tsx';

/** The visible text of the confirm key per act — the start of every accessible name. */
export const CONFIRM_KEY: Record<DockAct, string> = {
  book: 'Confirm booking',
  cancel: 'Confirm cancellation',
  move: 'Confirm move',
};

export function confirmControlName(act: DockAct, slotLabel: string): string {
  let time = slotLabel.replace(/\s+/g, ' ').trim();
  if (act === 'move') {
    // The move dock is handed "9:00 AM → 9:20 AM". An arrow is not a word a person can say, and the
    // act is defined by where the appointment ends up, so the name keeps the target only.
    const arrow = time.lastIndexOf('→');
    if (arrow !== -1) time = time.slice(arrow + 1).trim();
    if (time !== '') time = `to ${time}`;
  }
  return time === '' ? CONFIRM_KEY[act] : `${CONFIRM_KEY[act]} ${time}`;
}
