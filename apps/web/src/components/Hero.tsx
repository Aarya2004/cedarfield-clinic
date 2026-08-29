'use client';

/**
 * The first screen tells the birth — and offers to perform it. Three typographic frames
 * (a line you ran → the Forge card you approve → the tool in your agent's list), plus one
 * button that opens the *real* card from frame 2 via the real forge engine. Approval stays
 * with the human; nothing registers from the button alone. Every value in the frames is an
 * illustration of the flow (the demo's `status_of`), never a measurement — measured numbers
 * live in the status bar, the Tools pane and the Ledger.
 */

import { useState } from 'react';

/** ready → no card/tool named status_of yet · pending → card awaits approval · born → tool registered */
export type HeroExampleState = 'ready' | 'pending' | 'born';

/**
 * Once a shell is attached the terminal owns the page, so the thesis shrinks to one line and the
 * full hero moves behind an About toggle. The line still carries the example's state, because that
 * state is the thing a first-time reader is waiting on.
 */
export function HeroStrip({ example, onForgeExample }: { example: HeroExampleState; onForgeExample: () => void }) {
  const [open, setOpen] = useState(false);
  const state =
    example === 'born' ? (
      <>
        <code className="mono text-ink">forged_status_of</code> is live — see <span className="font-medium text-ink">Site tools</span>.
      </>
    ) : example === 'pending' ? (
      <>
        A Forge card is waiting on the right — the <span className="font-medium text-ink">Approve</span> click is yours.
      </>
    ) : null;
  return (
    // Expanding About must never push the terminal past its 160 px floor, so the strip is capped at
    // half the column (a % of the grid row, which has a definite height) and the story scrolls
    // inside that. Measured 2026-08-29 in the CDP harness (493 px viewport): a vh cap overflowed.
    <div className="flex max-h-[50%] min-h-0 flex-col" data-hero-collapsed>
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-1 pb-2">
        {/* the full hero repeats this headline, so the strip yields it while expanded */}
        {!open && <h2 className="serif text-lg leading-none text-ink">Do it once. Now it&apos;s a tool.</h2>}
        {state && <span className="text-xs text-muted">{state}</span>}
        <button onClick={() => setOpen((v) => !v)} className="ml-auto rounded-sm text-[11px] text-muted underline decoration-line underline-offset-2 hover:decoration-ink" aria-expanded={open} data-hero-about>
          {open ? 'Hide' : 'About'}
        </button>
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Hero example={example} onForgeExample={onForgeExample} />
        </div>
      )}
    </div>
  );
}

export function Hero({ example, onForgeExample }: { example: HeroExampleState; onForgeExample: () => void }) {
  return (
    <section className="px-1 pb-1 pt-2" data-hero aria-labelledby="hero-title">
      <h2 id="hero-title" className="serif text-[38px] leading-none tracking-tight text-ink">
        Do it once. Now it&apos;s a tool. <span className="text-accent-ink">Now every agent can call it.</span>
      </h2>
      <p className="mt-2 max-w-[52rem] text-sm text-muted">
        Sites that ship WebMCP get called natively. Sites that don&apos;t get compiled by the people and agents who use them — and what you compose across sites and your machine becomes a new tool of your own, in the web&apos;s format, callable by any agent, run only with your approval.
      </p>

      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch" aria-label="how a tool is born">
        <Frame n="1" eyebrow="You ran it">
          <div className="mono text-[12px] leading-5">
            <span className="text-accent-ink">~ $</span> <mark className="rounded-sm bg-accent-bg px-0.5 text-ink">rokan do &quot;what is the current status at githubstatus.com&quot;</mark>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
            <span className="rounded bg-accent px-1.5 py-px text-[10px] text-white">Forge this (1 line)</span>
            select the line, one click
          </div>
        </Frame>
        <Arrow />
        <Frame n="2" eyebrow="You approve the card">
          <div className="flex flex-wrap items-center gap-1.5">
            <code className="mono text-[12px] text-ink">forged_status_of</code>
            <span className="tone-ok rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wide">read</span>
          </div>
          <div className="mono mt-1 text-[11px] leading-5 text-muted">
            rokan do &quot;what is the current status at <span className="tone-accent rounded-sm px-0.5">{'{{site}}'}</span>&quot;
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
            <span className="rounded bg-ink px-1.5 py-px text-[10px] text-on-fill">Approve</span>
            name it, type the params, hash on the card
          </div>
        </Frame>
        <Arrow />
        <Frame n="3" eyebrow="Your agent calls it · your Enter runs it">
          <ul className="mono text-[11px] leading-4 text-muted" aria-label="the agent's tool list">
            <li>terminal_propose …</li>
            <li className="text-ink">
              forged_status_of <span className="text-accent-ink">← appears live, no reload</span>
            </li>
          </ul>
          <div className="mono mt-1 text-[12px] leading-5">
            <span className="text-accent-ink">~ $</span> <span className="text-accent-ink">rokan do &quot;what is the current status at www.vercel-status.com&quot;</span>{' '}
            <kbd className="rounded border border-line bg-bg px-1 text-[10px] text-ink">Enter</kbd>
          </div>
        </Frame>
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" data-hero-cta>
        {example === 'ready' ? (
          <>
            <button onClick={onForgeExample} className="rounded bg-accent px-3 py-1.5 text-white hover:bg-amber-700" data-forge-example>
              Forge this card — for real
            </button>
            <span className="text-muted">Opens the frame-2 card in the Forge pane, via the same engine the agent uses. Nothing registers until you approve it.</span>
          </>
        ) : example === 'pending' ? (
          <span className="text-muted">
            The card is waiting in the <span className="font-medium text-ink">Forge pane on the right</span> — the Approve click is yours. That click is the birth.
          </span>
        ) : (
          <span className="text-muted">
            <code className="mono text-ink">forged_status_of</code> is live — see <span className="font-medium text-ink">Site tools</span> on the right. Born at runtime, no reload.
          </span>
        )}
      </div>
    </section>
  );
}

function Frame({ n, eyebrow, children }: { n: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <li className="min-w-0 rounded-md border border-line bg-surface px-3 py-2 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <div className="flex items-baseline gap-1.5 text-[11px]">
        <span className="serif text-sm leading-none text-accent-ink">{n}</span>
        <span className="font-medium text-ink">{eyebrow}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </li>
  );
}

function Arrow() {
  return (
    <li aria-hidden className="hidden items-center text-lg leading-none text-line md:flex">
      <span className="text-accent-ink">→</span>
    </li>
  );
}
