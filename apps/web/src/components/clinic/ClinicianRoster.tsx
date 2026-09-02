'use client';

/**
 * The roster — six doctors and, beside each, the first time they still have open right now.
 *
 * It reads rather than describes. Releases land on a fixed period from the epoch (`wave-clock.ts`)
 * and the board for a release is generated from that release's seed, so building the same driver
 * the booking page builds and reading its board gives the roster the same times a visitor will see
 * one click later. Nothing here is typed by hand; a clinician with nothing left says so in words.
 *
 * Hydration: the server cannot know what second it is on the visitor's machine, so the first paint
 * ships the dash and the times arrive on mount — the same contract `NextWaveClock` keeps, and the
 * reason neither needs a `suppressHydrationWarning`. The list re-reads itself when the next release
 * lands, which is the only thing on this page that changes without the visitor doing anything.
 */
import { useEffect, useState } from 'react';
import { createMockDriver } from '../../lib/drop/mock-driver.ts';
import { ROSTER, nextAvailable } from './clinicians.ts';
import { msUntilNextWave, waveIndexAt, waveSeed } from './wave-clock.ts';

/** name → the time, or null for "this release has nothing for them". Absent until mount. */
type Availability = Record<string, string | null>;

export function ClinicianRoster() {
  const [times, setTimes] = useState<Availability | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const read = () => {
      const now = Date.now();
      // Only `slotCount` shapes the board, and the 'hold-and-book' preset carries the same six the
      // booking page overrides it to — the rival's cadence is never run here, so what this reads is
      // the release exactly as it was published.
      const board = createMockDriver({ seed: waveSeed(waveIndexAt(now)), scenario: 'hold-and-book' }).snapshot().slots;
      const next: Availability = {};
      for (const clinician of ROSTER) next[clinician.name] = nextAvailable(board, clinician.name);
      setTimes(next);
      timer = setTimeout(read, msUntilNextWave(now) + 60);
    };
    read();
    return () => clearTimeout(timer);
  }, []);

  return (
    <ul className="cl-roster" data-clinic-roster={times === null ? 'pending' : 'read'}>
      {ROSTER.map((clinician) => {
        const time = times === null ? undefined : times[clinician.name];
        return (
          <li className="cl-roster__row" key={clinician.name} data-clinic-clinician={clinician.name}>
            <h3 className="cl-roster__name">{clinician.name}</h3>
            <p className="cl-roster__spec">{clinician.specialty}</p>
            <p className="cl-roster__next" data-clinic-next={time ?? ''}>
              <span className="cl-roster__unit">
                {time === undefined
                  ? 'Checking availability'
                  : time === null
                    ? 'No appointments left today'
                    : 'Next available'}
              </span>
              {time === null || time === undefined ? null : <span className="cl-roster__time">{time}</span>}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
