/**
 * TtlBar — the burning hold (T2).
 *
 * A hold is a promise with a fuse on it, so the bar is drawn as one: a spent track, a lit fill, and
 * a bright head at the burn line. The head is the only flourish in this component; everything else
 * is a rule, a number, and space.
 *
 * Three disciplines, all load-bearing:
 * 1. NO TIMER LIVES HERE. The parent owns the clock (the mock driver, T7) and passes `secondsLeft`
 *    down, which is what makes this component deterministic, screenshot-testable, and transplantable
 *    onto Arav's real state machine without touching a line of it.
 * 2. NO WIDTH ANIMATION. The fill is a `scaleX` transform on a composited layer — no layout, no
 *    per-tick reflow, and it stays smooth when the parent drives it from rAF.
 * 3. NEVER COLOUR-ONLY. The seconds are always on screen as a numeral, the urgency colour only
 *    reinforces them, and the bar itself is `aria-hidden` with a milestone-only `aria-live` line
 *    beside it — so a screen reader hears "10 seconds left on your hold", not 20 ticks.
 *
 * Colours come from the shared urgency thresholds (`lib/drop/urgency.ts`) as `var(--drop-*, …)`
 * tokens, so T1's confirm surface and this bar can never drift apart, and the brand pass reskins
 * both by redefining three variables.
 */
import { formatClock, fractionLeft, holdAnnouncement, urgencyAt, urgencyColorAt } from '../../lib/drop/time.ts';

export interface TtlBarProps {
  /** Full length of the hold, in seconds — the denominator the bar is drawn against. */
  totalSeconds: number;
  /** What is left, in seconds. May be fractional (rAF) or whole (a 1 Hz tick); both are clamped. */
  secondsLeft: number;
  /** The eyebrow, and the noun the screen reader hears. Default "Hold". */
  label?: string;
  /**
   * How long the fill takes to reach a new value. Default 0: correct when the parent re-renders
   * from rAF, because the transform is already frame-smooth. Pass 1000 when the parent only ticks
   * once a second, and the bar glides between whole seconds instead of stepping.
   */
  transitionMs?: number;
}

export function TtlBar({ totalSeconds, secondsLeft, label = 'Hold', transitionMs = 0 }: TtlBarProps) {
  const fraction = fractionLeft(totalSeconds, secondsLeft);
  const urgency = urgencyAt(secondsLeft);
  const color = urgencyColorAt(secondsLeft);
  const announcement = holdAnnouncement(secondsLeft, label);

  return (
    <div
      data-ttl-bar
      data-ttl-urgency={urgency}
      data-ttl-seconds={formatClock(secondsLeft)}
      className="w-full select-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">{label}</span>
        <span className="mono text-lg leading-none tabular-nums text-ink">{formatClock(secondsLeft)}</span>
      </div>

      {/* The bar carries no information the numeral above does not already carry. */}
      <div aria-hidden className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="absolute inset-0 origin-left rounded-full transition-transform ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${fraction})`, background: color, transitionDuration: `${transitionMs}ms` }}
        />
        {/* The burn head: a full-width rule slid left so its right edge sits exactly on the fill edge. */}
        <div
          className="absolute inset-0 border-r-2 border-ink transition-transform ease-linear motion-reduce:transition-none"
          style={{
            transform: `translateX(${(fraction - 1) * 100}%)`,
            transitionDuration: `${transitionMs}ms`,
            opacity: fraction > 0 ? 1 : 0,
          }}
        />
      </div>

      <p className="sr-only" aria-live="polite" data-ttl-announce>
        {announcement}
      </p>
    </div>
  );
}
