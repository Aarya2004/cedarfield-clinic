/**
 * The first screen tells the birth — and offers to perform it. Three typographic frames
 * (a line you ran → the Forge card you approve → the tool in your agent's list), plus one
 * button that opens the *real* card from frame 2 via the real forge engine. Approval stays
 * with the human; nothing registers from the button alone. Every value in the frames is an
 * illustration of the flow (the demo's `hn_top`), never a measurement — measured numbers
 * live in the status bar, the Tools pane and the Ledger.
 */

/** ready → no card/tool named hn_top yet · pending → card awaits approval · born → tool registered */
export type HeroExampleState = 'ready' | 'pending' | 'born';

export function Hero({ example, onForgeExample }: { example: HeroExampleState; onForgeExample: () => void }) {
  return (
    <section className="px-1 pb-1 pt-2" data-hero aria-labelledby="hero-title">
      <h2 id="hero-title" className="serif text-[38px] leading-none tracking-tight text-ink">
        Do it once. <span className="text-accent-ink">Now it&apos;s a tool.</span>
      </h2>
      <p className="mt-2 max-w-[46rem] text-sm text-muted">A command you approve becomes a live WebMCP tool your agent can call — born at runtime, without a reload, run only by your Enter.</p>

      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch" aria-label="how a tool is born">
        <Frame n="1" eyebrow="You ran it">
          <div className="mono text-[12px] leading-5">
            <span className="text-accent-ink">~ $</span> <mark className="rounded-sm bg-amber-100 px-0.5 text-ink">rokan do &quot;top 5 HN titles&quot;</mark>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
            <span className="rounded bg-accent px-1.5 py-px text-[10px] text-white">Forge this (1 line)</span>
            select the line, one click
          </div>
        </Frame>
        <Arrow />
        <Frame n="2" eyebrow="You approve the card">
          <div className="flex flex-wrap items-center gap-1.5">
            <code className="mono text-[12px] text-ink">forged_hn_top</code>
            <span className="rounded bg-emerald-100 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-emerald-800">read</span>
          </div>
          <div className="mono mt-1 text-[11px] leading-5 text-muted">
            rokan do &quot;top <span className="rounded-sm bg-amber-100 px-0.5 text-amber-900">{'{{n}}'}</span> HN titles&quot;
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
            <span className="rounded bg-ink px-1.5 py-px text-[10px] text-white">Approve</span>
            name it, type the params, hash on the card
          </div>
        </Frame>
        <Arrow />
        <Frame n="3" eyebrow="Your agent calls it · your Enter runs it">
          <ul className="mono text-[11px] leading-4 text-muted" aria-label="the agent's tool list">
            <li>terminal_propose …</li>
            <li className="text-ink">
              forged_hn_top <span className="text-accent-ink">← appears live, no reload</span>
            </li>
          </ul>
          <div className="mono mt-1 text-[12px] leading-5">
            <span className="text-accent-ink">~ $</span> <span className="text-accent-ink">rokan do &quot;top 3 HN titles&quot;</span>{' '}
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
            <code className="mono text-ink">forged_hn_top</code> is live — see <span className="font-medium text-ink">Site tools</span> on the right. Born at runtime, no reload.
          </span>
        )}
      </div>
    </section>
  );
}

function Frame({ n, eyebrow, children }: { n: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <li className="min-w-0 rounded-md border border-line bg-white px-3 py-2 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
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
