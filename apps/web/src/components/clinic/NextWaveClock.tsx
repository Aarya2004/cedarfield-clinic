'use client';

/**
 * The live countdown to the next release (SPEC-V1 §2).
 *
 * It is a real clock. Waves land on a fixed period from the epoch (`wave-clock.ts`), so this number
 * is not a prop someone typed and not a loop that restarts on mount — it is the wall clock, read
 * every animation frame, and the booking page stages its board from the same arithmetic. Nothing on
 * screen here is scripted, which is the standing rule for every number this project shows.
 *
 * Hydration: the server has no idea what second it is on the visitor's machine, so the first paint
 * ships a dashed placeholder of the same width and the clock starts on mount. That avoids a
 * mismatch without a suppressHydrationWarning escape hatch.
 */
import { useEffect, useState } from 'react';
import { formatClock } from '../../lib/drop/time.ts';
import { dropAnnouncement } from '../../lib/drop/time.ts';
import { WAVE_PERIOD_MS, secondsUntilNextWave } from './wave-clock.ts';

export function NextWaveClock({ periodMs = WAVE_PERIOD_MS }: { periodMs?: number }) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    let handle = 0;
    const frame = () => {
      setSeconds(secondsUntilNextWave(Date.now(), periodMs));
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, [periodMs]);

  const shown = seconds === null ? null : formatClock(seconds);
  // Milestone-only: a live region that read every tick would never finish a sentence.
  const said = seconds === null ? '' : dropAnnouncement(seconds);

  return (
    <p className="cl-clock" data-clinic-clock={seconds === null ? 'pending' : formatClock(seconds)}>
      <span className="cl-clock__unit">Next release</span>
      <span className="cl-clock__value">{shown === null ? 'checking\u2026' : `in ${shown}`}</span>
      <span className="cl-sr" role="status" aria-live="polite">
        {said}
      </span>
    </p>
  );
}
