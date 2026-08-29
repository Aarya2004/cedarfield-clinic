'use client';

/**
 * App shell: status bar · terminal (or hero + pairing card + prompt line) · Tools / Forge / Ledger.
 * Registers the six fixed tools once; installs test hooks when enabled.
 */
import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { registerTerminalTools, type RegistrationState } from '@/lib/webmcp/register';
import { forge, type ForgeCard as Card } from '@/lib/webmcp/forge';
import { installTestHooks } from '@/lib/webmcp/testhooks';
import { forgeFromLines } from '@/lib/webmcp/forge-this';
import { session } from '@/lib/terminal/session';
import { clearFieldNotes, fieldNotes, note, subscribeFieldNotes } from '@/lib/webmcp/fieldnotes';
import { Terminal } from './Terminal';
import { PromptLine } from './PromptLine';
import { ForgeCardView } from './ForgeCard';
import { Hero } from './Hero';
import { LedgerPane, MobileCard, PairingCard, StatusBar, ToolsPane, useSession } from './Panes';
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
        <section className="rounded-md border border-danger bg-white p-3 text-xs text-danger" data-pane-error={this.props.name} role="alert">
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
  const s = useSession();
  const cards = useCards();
  const notes = useFieldNotes();
  const mobile = useIsMobile();

  useEffect(() => {
    setHooks(installTestHooks());
    if (tourRequested()) setTour('on');
    session.start();
    // If the effect is torn down before registration resolves, dispose on arrival instead of
    // leaking the AbortController (and six tools) — Fable pass-1 P2.
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

  return (
    <main className="mx-auto flex h-screen max-w-[1400px] flex-col gap-3 px-4 py-3">
      <StatusBar reg={reg} />
      {showTour && <Tour judge={s.hello?.mode === 'judge'} onClose={() => setTour('off')} />}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          {liveTerminal ? (
            <Boundary name="terminal">
              <Terminal onForgeThis={forgeThis} />
            </Boundary>
          ) : (
            <>
              {showHero && <Hero />}
              <PairingCard />
              <PromptLine />
              <section className="rounded-md border border-line bg-white p-4 text-sm" data-how aria-labelledby="how-title">
                <h2 id="how-title" className="font-medium">
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
            </>
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-auto">
          <Boundary name="tools">
            <ToolsPane reg={reg} />
          </Boundary>
          <section className="rounded-md border border-line bg-white p-3 text-sm" data-forge-pane aria-labelledby="forge-title">
            <h2 id="forge-title" className="font-medium">
              Forge{cards.length > 0 ? ` · ${cards.length} awaiting you` : ''}
            </h2>
            <Boundary name="forge card">
              {cards.length === 0 ? (
                <p className="text-xs text-muted">No card yet. Select 1–5 lines in the terminal and press “Forge this”, or let the agent call forge_create. A card appears here for your approval — nothing registers until you approve it.</p>
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
          <section className="rounded-md border border-line bg-white p-3 text-xs text-muted">
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
        </div>
      </div>
      <footer className="text-[11px] text-muted">
        Test in ChatGPT desktop (GPT-5.6 Sol/Terra → Site tools) or Chrome 149+ with <code className="mono">chrome://flags/#enable-webmcp-testing</code>. Every number on this page is measured by the code that shows it.
      </footer>
    </main>
  );
}
