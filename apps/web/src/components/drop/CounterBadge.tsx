/**
 * The tally, and then the receipt. One component with two settings, because they are the same
 * claim at two moments: a quiet running count while you work, and the line you read out at the end.
 *
 * Everything shown here comes from `lib/drop/interaction-counter.ts` measuring real input under
 * `lib/drop/COUNTING.md`. There is no prop, constant, or fallback in this file that supplies a
 * count — if the counter is not running, this renders zero.
 *
 * Type: numerals are mono and tabular so the digit does not jitter as it climbs; labels are the
 * body face, lower case, quiet. The receipt sets the breakdown as a ruled table with the sum ruled
 * underneath — a reader who wants to check our arithmetic, or drop a bucket they disagree with,
 * can do it from the screen.
 */
import { describeCount, type InteractionBreakdown } from '../../lib/drop/interaction-counter.ts';

export type CounterMode = 'manual' | 'agent';

// Fallbacks match the drop skin's defaults (components/drop/drop-tokens.css) so the badge is
// legible with or without that stylesheet, and identical to the board when both are present.
const INK = 'var(--drop-ink, #14171a)';
const MUTED = 'var(--drop-muted, #555c62)';
const RULE = 'var(--drop-rule, #c7ccc8)';
const PAPER = 'var(--drop-card, #fcfdfb)';
const MONO = 'var(--drop-font-mono, var(--font-mono), ui-monospace, monospace)';

const MODE_LABEL: Record<CounterMode, string> = {
  manual: 'manual mode',
  agent: 'agent mode',
};

/** Bucket order matches COUNTING.md, and the labels say what the user did, not what the DOM fired. */
const BUCKETS: ReadonlyArray<{ key: keyof InteractionBreakdown; label: string; note: string }> = [
  { key: 'clicks', label: 'presses', note: 'pointer or touch presses' },
  { key: 'keys', label: 'keys', note: 'key presses, one per character' },
  { key: 'scrolls', label: 'scrolls', note: 'scroll gestures, coalesced' },
  { key: 'tabs', label: 'tab moves', note: 'keyboard focus moves' },
];

export interface CounterBadgeProps {
  count: number;
  mode: CounterMode;
  /** `tally` while the task runs, `receipt` once it ends. */
  variant?: 'tally' | 'receipt';
  /** Shown on the receipt so the total can be recomputed from the screen. */
  breakdown?: InteractionBreakdown;
  className?: string;
}

export function CounterBadge({ count, mode, variant = 'tally', breakdown, className = '' }: CounterBadgeProps) {
  if (variant === 'receipt') {
    return (
      <div
        data-drop-counter="receipt"
        data-drop-mode={mode}
        data-drop-count={count}
        role="status"
        aria-live="polite"
        className={`w-full max-w-sm ${className}`}
        style={{ background: PAPER, borderTop: `1px solid ${INK}`, color: INK }}
      >
        <p
          className="pt-2 text-[10px] uppercase"
          style={{ color: MUTED, fontFamily: MONO, letterSpacing: '0.14em' }}
        >
          {MODE_LABEL[mode]} — what it cost
        </p>

        <p className="mt-1 flex items-baseline gap-2">
          <span
            data-drop-receipt-total
            className="text-3xl leading-none"
            style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}
          >
            {count}
          </span>
          <span className="text-sm" style={{ color: MUTED }}>
            {count === 1 ? 'interaction' : 'interactions'}
          </span>
        </p>

        {breakdown ? (
          <dl className="mt-3 text-[13px]" data-drop-receipt-breakdown>
            {BUCKETS.map(({ key, label, note }) => (
              <div key={key} data-drop-bucket={key} className="flex items-baseline justify-between gap-3 py-[3px]">
                <dt style={{ color: MUTED }} title={note}>
                  {label}
                </dt>
                <dd
                  className="tabular-nums"
                  style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}
                >
                  {breakdown[key]}
                </dd>
              </div>
            ))}
            <div
              className="mt-1 flex items-baseline justify-between gap-3 pt-1"
              style={{ borderTop: `1px solid ${RULE}` }}
              data-drop-bucket="total"
            >
              <dt>total</dt>
              <dd style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                {breakdown.clicks + breakdown.keys + breakdown.scrolls + breakdown.tabs}
              </dd>
            </div>
          </dl>
        ) : null}

        <p className="mt-3 pb-1 text-[11px] leading-snug" style={{ color: MUTED }}>
          Measured on this page while you used it, by the rules in COUNTING.md. Synthetic events do
          not count.
        </p>
      </div>
    );
  }

  // Tally. Deliberately not a live region: announcing a new total on every keystroke would make the
  // instrument the loudest thing on the page for a screen-reader user. It is labelled and readable
  // on demand; the receipt is the part that announces.
  return (
    <span
      data-drop-counter="tally"
      data-drop-mode={mode}
      data-drop-count={count}
      role="status"
      aria-live="off"
      aria-label={`${MODE_LABEL[mode]}: ${describeCount(count)} so far`}
      title="Counted from your real input — see COUNTING.md"
      className={`inline-flex items-baseline gap-2 whitespace-nowrap ${className}`}
      style={{ color: MUTED }}
    >
      <span className="text-[10px] uppercase" style={{ fontFamily: MONO, letterSpacing: '0.14em' }}>
        {MODE_LABEL[mode]}
      </span>
      <span
        aria-hidden="true"
        className="text-sm"
        style={{
          color: INK,
          fontFamily: MONO,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
      <span aria-hidden="true" className="text-[11px]">
        {count === 1 ? 'interaction' : 'interactions'}
      </span>
    </span>
  );
}
