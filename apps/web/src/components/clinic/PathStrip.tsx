'use client';

/**
 * The primary path, in three words at the top of the page (2026-09-02, Codex: "make the primary path
 * visually dominant: Ask → agent holds → you confirm"). It tracks the real state: which step the
 * person is on right now, from the same board the tools read. Everything explanatory folds away
 * under it; this line never does.
 */
export type PathStep = 'ask' | 'held' | 'confirm' | 'booked';

export interface PathStripProps {
  step: PathStep;
  /** The act the confirm step is for: a booking, or an armed cancel / move. */
  act?: 'book' | 'cancel' | 'move';
}

const STEPS: Array<{ id: PathStep; n: number; title: string; detail: string }> = [
  { id: 'ask', n: 1, title: 'Ask your assistant', detail: 'speak, type, or sign — it searches and holds' },
  { id: 'held', n: 2, title: 'It holds a time', detail: 'three minutes, for you alone' },
  { id: 'confirm', n: 3, title: 'You confirm', detail: 'one press, a switch, or an open palm' },
];

export function PathStrip({ step, act = 'book' }: PathStripProps) {
  const current = step === 'booked' ? 4 : STEPS.find((s) => s.id === step)?.n ?? 1;
  return (
    <ol className="cl-path" aria-label="How booking works here" data-clinic-path={step}>
      {STEPS.map((s) => {
        const state = s.n < current ? 'done' : s.n === current ? 'now' : 'next';
        const title = s.id === 'confirm' && act !== 'book' ? (act === 'cancel' ? 'You confirm the cancel' : 'You confirm the move') : s.title;
        return (
          <li key={s.id} className="cl-path__step" data-clinic-path-step={state}>
            <span className="cl-path__n" aria-hidden="true">
              {state === 'done' ? '✓' : s.n}
            </span>
            <span className="cl-path__text">
              <span className="cl-path__title">
                {title}
                {state === 'now' ? <span className="cl-sr"> (now)</span> : null}
              </span>
              <span className="cl-path__detail">{s.detail}</span>
            </span>
          </li>
        );
      })}
      {step === 'booked' ? (
        <li className="cl-path__step cl-path__step--booked" data-clinic-path-step="booked">
          <span className="cl-path__n" aria-hidden="true">
            ✓
          </span>
          <span className="cl-path__text">
            <span className="cl-path__title">Booked</span>
            <span className="cl-path__detail">for you — cancel or move it below whenever you like</span>
          </span>
        </li>
      ) : null}
    </ol>
  );
}
