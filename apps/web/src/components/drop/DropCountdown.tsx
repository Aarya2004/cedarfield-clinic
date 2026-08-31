/**
 * DropCountdown — the wave banner (T2).
 *
 * One line that answers one question: how long until slots exist? It counts down, and at zero it
 * flips to a live state. It does NOT decide when slots appear — the parent (the driver, T7) does
 * that; this banner only reports the clock it is handed. Same rule as TtlBar: no timer lives here,
 * `now` arrives as a prop, so the component is pure and the whole screen shares one clock.
 *
 * The state change is carried by the left rail, not by colour alone: waiting is a hairline in the
 * line token, live is a lit 2px rail plus the word "Live" in text. The countdown numerals are quiet
 * on purpose — this is a wait, not an emergency, and the noisy component on the page should be the
 * hold that is actually burning.
 *
 * `--drop-live` is a swappable token; the playground (T8) defines the themed value and the brand
 * pass replaces it. The fallback is the current amber.
 */
import { dropAnnouncement, formatClock, secondsUntil } from '../../lib/drop/time.ts';

const LIVE = 'var(--drop-live, #d97706)';

export interface DropCountdownProps {
  /** When the next wave lands. */
  dropAt: Date | number;
  /**
   * Now, from the parent's clock, in the same units as `dropAt` — epoch ms with a real backend,
   * or the mock driver's ms-since-start (`driver.now()` with `driver.waveAt()`). Passed in, never
   * read here, so the whole screen counts against one clock.
   */
  now: number;
  /** The eyebrow while waiting. Default "Next drop". */
  label?: string;
}

export function DropCountdown({ dropAt, now, label = 'Next drop' }: DropCountdownProps) {
  const secondsLeft = secondsUntil(dropAt, now);
  const live = secondsLeft <= 0;

  return (
    <div
      data-drop-countdown
      data-drop-state={live ? 'live' : 'waiting'}
      className="flex w-full items-baseline justify-between gap-4 border-l-2 py-1.5 pl-3 transition-colors"
      style={{ borderColor: live ? LIVE : 'var(--line)' }}
    >
      <span
        className="text-[10px] font-medium uppercase tracking-[0.18em]"
        style={{ color: live ? LIVE : 'var(--muted)' }}
      >
        {live ? 'Drop' : label}
      </span>

      {live ? (
        <span className="text-sm text-ink" data-drop-live-text>
          Slots are live
        </span>
      ) : (
        <span className="mono text-lg leading-none tabular-nums text-ink" data-drop-remaining>
          {formatClock(secondsLeft)}
        </span>
      )}

      <p className="sr-only" aria-live="polite" data-drop-announce>
        {dropAnnouncement(secondsLeft)}
      </p>
    </div>
  );
}
