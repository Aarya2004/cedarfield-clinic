/**
 * The clinicians — the practice's own roster, and how the home page reads a release for them.
 *
 * The six names are NOT new content: they are the exact six `lib/drop/mock-driver.ts` puts on the
 * board, in the same spelling. A home page that listed four doctors while the board offered six
 * would be a lie the visitor could catch in one click, so the roster is derived from the same list
 * and the specialties are the only thing added here.
 *
 * `nextAvailable` reads a released board rather than describing one. The home page builds the
 * current release from the wall clock (`wave-clock.ts`) and the same seeded generator the booking
 * page uses, so the time printed beside a name is the time that name really has on offer right now.
 * When a release has nothing for a clinician the answer is null and the page prints the absence —
 * never a placeholder time (DESIGN.md: measured or absent).
 *
 * Pure, relative `.ts` imports only, so it runs under `node --test` without a browser.
 */
import type { Slot } from '../../lib/drop/types.ts';

export interface Clinician {
  /** Exactly as the board spells it — the join key. */
  name: string;
  /** What this doctor is the one to see about. Fictional, like the practice. */
  specialty: string;
}

export const ROSTER: readonly Clinician[] = [
  { name: 'Dr. Alvarez', specialty: 'Minor injuries and wound care' },
  { name: 'Dr. Boone', specialty: 'Asthma and respiratory reviews' },
  { name: 'Dr. Chatterjee', specialty: 'Diabetes and long-term conditions' },
  { name: 'Dr. Duarte', specialty: "Women's health and contraception" },
  { name: 'Dr. Eriksson', specialty: 'Children and young people' },
  { name: 'Dr. Fanning', specialty: 'Joint, back and muscle pain' },
];

/**
 * The first time this clinician still has open in the given release, or null.
 *
 * The board is generated in ascending time order, so first match is earliest match; scanning rather
 * than sorting keeps this honest about what it is reading.
 */
export function nextAvailable(slots: readonly Slot[], clinician: string): string | null {
  for (const slot of slots) {
    if (slot.clinician === clinician && slot.state === 'open') return slot.timeLabel;
  }
  return null;
}
