'use client';

/**
 * App shell: status bar over a two-track grid — main column (the work: collapsed hero, run feed,
 * live terminal; or hero + pairing + prompt line when no shell is attached) and a right rail
 * (the state: Tools · Forge · Ledger, one bordered box divided by hairlines).
 * Height is owned by the shell: every ancestor of the terminal is `min-h-0` so the xterm host is
 * the only thing that grows, and its ResizeObserver sees a stable box.
 * Registers the seven fixed tools once; installs test hooks when enabled.
 */
import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { registerTerminalTools, type RegistrationState } from '@/lib/webmcp/register';
import { forge, type ForgeCard as Card } from '@/lib/webmcp/forge';
import { installTestHooks } from '@/lib/webmcp/testhooks';
import { forgeFromLines } from '@/lib/webmcp/forge-this';
import { session } from '@/lib/terminal/session';
import { runFeed } from '@/lib/terminal/runfeed';
import { clearFieldNotes, fieldNotes, note, subscribeFieldNotes } from '@/lib/webmcp/fieldnotes';
import { initTheme } from '@/lib/theme';
import type { OpenArtifact } from '@/lib/terminal/artifacts';
import { Terminal } from './Terminal';
import { RunFeed } from './RunFeed';
import { ArtifactPanel } from './ArtifactPanel';
import { PromptLine } from './PromptLine';
import { ForgeCardView } from './ForgeCard';
import { Hero, HeroStrip, type HeroExampleState } from './Hero';
import { LedgerPane, MobileCard, PairingCard, StatusBar, ToolsPane, useForged, useSession } from './Panes';
import { Tour, tourRequested } from './Tour';

const EMPTY: never[] = [];
const LINK = 'rounded-sm underline decoration-line underline-offset-2 hover:decoration-ink';

/** A render fault in one pane must never unmount the app (that would abort every registered tool). */
class Boundary extends Component<{ name: string; children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  componentDidCatch(e: unknown) {
    note('ui.pane_error', { pane: this.props.name, message: e instanceof Error ? e.message : String(e) });
  }
  render() {
    if (this.state.error) {
      return (
        <section className="rounded-md border border-danger bg-surface p-3 text-xs text-danger" data-pane-error={this.props.name} role="alert">
          The {this.props.name} pane failed to render: {this.state.error}. The tools are still registered.{' '}
          <button className={LINK} onClick={() => this.setState({ error: null })}>
            retry
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

function useCards(): Card[] {
  return useSyncExternalStore((fn) => forge.subscribe(fn), () => forge.cards(), () => EMPTY);
}
function useFieldNotes() {
  return useSyncExternalStore(subscribeFieldNotes, fieldNotes, () => EMPTY);
}
/** Below 720 px (phones) show the desktop note; narrow laptops still get the full app (the harness runs at 1440×900). */
function useIsMobile(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 719px)');
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

export function App() {
  const [reg, setReg] = useState<RegistrationState | { kind: 'pending' }>({ kind: 'pending' });
  const [hooks, setHooks] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [tour, setTour] = useState<'unset' | 'on' | 'off'>('unset');
  // One artifact at a time: opening another replaces it, Close returns the column to full width.
  const [artifact, setArtifact] = useState<OpenArtifact | null>(null);
  const s = useSession();
  const cards = useCards();
  const forged = useForged();
  const notes = useFieldNotes();
  const mobile = useIsMobile();

  useEffect(() => {
    initTheme();
    const hooksOn = installTestHooks();
    setHooks(hooksOn);
    // The run feed lives in this lane, so its read-only handle is installed here rather than in
    // the shared testhooks.ts. Read-only on purpose: nothing may write a run that did not run.
    if (hooksOn) {
      const w = window as Window & { __rokan?: Record<string, unknown> };
      if (w.__rokan) w.__rokan.runFeed = () => runFeed.snapshot();
    }
    if (tourRequested()) setTour('on');
    session.start();
    // If the effect is torn down before registration resolves, dispose on arrival instead of
    // leaking the AbortController (and seven tools) — Fable pass-1 P2.
    let disposed = false;
    let dispose: (() => void) | null = null;
    registerTerminalTools(setReg).then((d) => {
      if (disposed) d();
      else dispose = d;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);

  if (mobile) return <MobileCard />;
  const showTour = tour === 'on' || (tour === 'unset' && s.hello?.mode === 'judge');
  const liveTerminal = s.mode === 'live' && s.state !== 'busy' && s.state !== 'unauthorized' && s.state !== 'ended';
  // The birth story leads only when there is nothing more urgent to say (busy / bad link go first).
  const showHero = !liveTerminal && (s.state === 'unpaired' || s.state === 'ended');

  const forgeThis = (lines: string[]) => {
    const r = forgeFromLines(lines);
    if ('error' in r) note('forge_this.rejected', { error: r.error, detail: r.detail });
  };

  // The hero's one button: open the real frame-2 card through the same engine the agent uses.
  // Approval (the birth) stays a human click on the card — the button alone registers nothing.
  const heroExample: HeroExampleState = forged.some((t) => t.name === 'status_of') ? 'born' : cards.some((c) => c.spec.name === 'status_of') ? 'pending' : 'ready';
  const forgeExample = () => {
    const r = forge.openCard(
      {
        // Seeded phrasing: replays at 0 model calls in the judge sandbox for 24 status pages
        // (githubstatus.com, www.vercel-status.com, www.netlifystatus.com, www.shopifystatus.com, …).
        // Keep it byte-exact — rokan-do keys the replay on the normalised question + host.
        name: 'status_of',
        description: 'Current status of a service status page via rokan do in your shell — every step still gated by your Enter.',
        commands: ['rokan do "what is the current status at {{site}}"'],
        params: [{ name: 'site', description: 'A status page host, e.g. githubstatus.com or www.vercel-status.com', example: 'githubstatus.com' }],
        kind: 'read',
      },
      { origin: 'human' },
    );
    if ('error' in r) note('hero.example_rejected', { error: r.error, detail: r.detail });
    else note('hero.example_card_opened', { card: r.card_id });
  };

  return (
    <main className="mx-auto flex h-screen max-w-[1600px] flex-col gap-3 px-4 py-3">
      <StatusBar reg={reg} />
      {showTour && <Tour judge={s.hello?.mode === 'judge'} onClose={() => setTour('off')} />}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
        {liveTerminal ? (
          // The work, and (when one is open) the artifact beside it: on a wide screen the panel
          // takes ~40 % and the feed + terminal keep the rest; under 1100 px it overlays this
          // column instead of squeezing the terminal (the panel is `absolute inset-0` there).
          <div className="relative flex min-h-0 gap-3">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
              <HeroStrip example={heroExample} onForgeExample={forgeExample} />
              {/* The history: grows with its content to at most 45 % of the column, so the live
                  terminal below always keeps the larger half. Empty, it is one line of invitation. */}
              <Boundary name="run feed">
                <RunFeed onForgeThis={forgeThis} onOpenArtifact={(run, detection) => setArtifact({ runId: run.id, command: run.command, detection })} />
              </Boundary>
              {/* The floor the xterm host (min-h-[160px]) plus its ghost bar need. Stated here so
                  flex shrinks the expanded hero instead of clipping the terminal on a short screen. */}
              <div className="min-h-[200px] flex-1">
                <Boundary name="terminal">
                  <Terminal onForgeThis={forgeThis} />
                </Boundary>
              </div>
            </div>
            {artifact && (
              <Boundary name="artifact">
                <ArtifactPanel key={`${artifact.runId}:${artifact.detection.artifact.kind}`} open={artifact} onClose={() => setArtifact(null)} />
              </Boundary>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {showHero && <Hero example={heroExample} onForgeExample={forgeExample} />}
            <PairingCard />
            <PromptLine />
            <section className="px-1 pb-1 text-sm" data-how aria-labelledby="how-title">
              <h2 id="how-title" className="text-xs font-medium text-muted">
                How it works
              </h2>
              <ol className="mt-2 grid gap-3 text-xs text-muted md:grid-cols-3">
                <li>
                  <span className="font-medium text-ink">Do it once, forge it.</span> Select lines you ran → Forge this → Approve. <code className="mono">forged_&lt;name&gt;</code> is registered as a live WebMCP tool — born at runtime, hash on the card.
                </li>
                <li>
                  <span className="font-medium text-ink">The agent calls it.</span> The tool only ghost-types; your Enter runs each step. Exit code and duration are measured by the shell and shown in the Ledger.
                </li>
                <li>
                  <span className="font-medium text-ink">Or the agent proposes.</span> <code className="mono">terminal_propose</code> ghost-types any command; Share screen lets it read a redacted screen. Nothing runs without your key.
                </li>
              </ol>
            </section>
          </div>
        )}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface" data-rail aria-label="session state">
          <Boundary name="tools">
            <ToolsPane reg={reg} />
          </Boundary>
          <section className="max-h-[45%] shrink-0 overflow-y-auto border-b border-line p-2.5 text-sm" data-forge-pane aria-labelledby="forge-title">
            <h2 id="forge-title" className="text-xs font-medium">
              Forge{cards.length > 0 ? ` · ${cards.length} awaiting you` : ''}
            </h2>
            <Boundary name="forge card">
              {cards.length === 0 ? (
                <p className="text-xs text-muted">Select 1–5 lines in the terminal and press “Forge this”, ask your agent to call <code className="mono">forge_create</code> — or use the hero’s example button. Nothing registers until you approve the card here.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {cards.map((c) => (
                    <ForgeCardView key={c.card_id} card={c} />
                  ))}
                </div>
              )}
            </Boundary>
          </section>
          <Boundary name="ledger">
            <LedgerPane />
          </Boundary>
          <section className="shrink-0 border-t border-line px-2.5 py-1.5 text-[11px] text-muted">
            <button onClick={() => setShowNotes((v) => !v)} className={LINK} aria-expanded={showNotes}>
              {showNotes ? 'hide' : 'show'} field notes ({notes.length}, measured on this device)
            </button>
            {hooks && <span className="ml-2">· test hooks on</span>}
            {showNotes && (
              <>
                <button onClick={clearFieldNotes} className={`ml-2 ${LINK}`}>
                  clear
                </button>
                <ol className="mono mt-1 max-h-40 space-y-0.5 overflow-auto">
                  {[...notes].reverse().map((n, i) => (
                    <li key={i} className="break-all">
                      {n.t.slice(11, 23)} {n.event} {n.detail ? JSON.stringify(n.detail) : ''}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        </aside>
      </div>
      <footer className="text-[11px] text-muted">
        Test in ChatGPT desktop (GPT-5.6 Sol/Terra → Site tools) or Chrome 149+ with <code className="mono">chrome://flags/#enable-webmcp-testing</code>. Every number on this page is measured by the code that shows it.
      </footer>
    </main>
  );
}
