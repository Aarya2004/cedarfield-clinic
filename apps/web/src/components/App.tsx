'use client';

/**
 * App shell: status bar · terminal (or prompt line + pairing card) · Tools / Forge / Ledger.
 * Registers the six fixed tools once; installs test hooks when enabled.
 */
import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { registerTerminalTools, type RegistrationState } from '@/lib/webmcp/register';
import { forge, type ForgeCard as Card } from '@/lib/webmcp/forge';
import { installTestHooks } from '@/lib/webmcp/testhooks';
import { session } from '@/lib/terminal/session';
import { clearFieldNotes, fieldNotes, note, subscribeFieldNotes } from '@/lib/webmcp/fieldnotes';
import { Terminal } from './Terminal';
import { PromptLine } from './PromptLine';
import { ForgeCardView } from './ForgeCard';
import { LedgerPane, MobileCard, PairingCard, StatusBar, ToolsPane, useSession } from './Panes';
import { Tour, tourRequested } from './Tour';

const EMPTY: never[] = [];

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
        <section className="rounded-md border border-danger bg-white p-3 text-xs text-danger" data-pane-error={this.props.name}>
          {this.props.name} failed to render: {this.state.error}.{' '}
          <button className="underline" onClick={() => this.setState({ error: null })}>
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
    let dispose = () => {};
    registerTerminalTools(setReg).then((d) => (dispose = d));
    return () => dispose();
  }, []);

  if (mobile) return <MobileCard />;
  const showTour = tour === 'on' || (tour === 'unset' && s.hello?.mode === 'judge');

  const forgeThis = (lines: string[]) => {
    const first = lines[0]?.replace(/^[~$%❯#]\s*\$?\s*/, '') ?? '';
    const guess = (first.split(/\s+/)[0] ?? 'tool').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '').slice(0, 20) || 'tool';
    const commands = lines.map((l) => l.replace(/^(?:[~\w./-]*\s*)?[$%❯#]\s+/, '').trim()).filter(Boolean).slice(0, 5);
    const r = forge.openCard({ name: `${guess}_${Math.floor(Math.random() * 90 + 10)}`, description: `Forged from ${commands.length} command${commands.length === 1 ? '' : 's'} the human ran.`, commands, params: [], kind: 'read' }, { origin: 'human' });
    if ('error' in r) window.alert?.(`Cannot forge: ${r.error}${r.detail ? ' — ' + r.detail : ''}`);
  };

  return (
    <main className="mx-auto flex h-screen max-w-[1400px] flex-col gap-3 px-4 py-3">
      <StatusBar reg={reg} />
      {showTour && <Tour judge={s.hello?.mode === 'judge'} onClose={() => setTour('off')} />}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          {s.mode === 'live' && s.state !== 'busy' && s.state !== 'unauthorized' ? (
            <Boundary name="terminal">
              <Terminal onForgeThis={forgeThis} />
            </Boundary>
          ) : (
            <>
              <PairingCard />
              <PromptLine />
              <section className="rounded-md border border-line bg-white p-4 text-sm" data-how>
                <h2 className="font-medium">How it works</h2>
                <ol className="mt-2 grid gap-2 text-xs text-muted md:grid-cols-3">
                  <li>
                    <span className="text-ink">1 · The agent proposes.</span> `terminal_propose` ghost-types a command at your prompt. Nothing runs.
                  </li>
                  <li>
                    <span className="text-ink">2 · You press Enter.</span> Your key runs it on your shell; exit code and duration are measured by the shell and shown here.
                  </li>
                  <li>
                    <span className="text-ink">3 · Forge it.</span> Select what you ran → Forge this → Approve. A new WebMCP tool is registered live; the agent calls it; your Enter still gates each step.
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
          <section className="rounded-md border border-line bg-white p-3 text-sm" data-forge-pane>
            <h2 className="font-medium">Forge</h2>
            <Boundary name="forge card">
              {cards.length === 0 ? <p className="text-xs text-muted">Select 1–5 lines in the terminal and press “Forge this”, or let the agent call forge_create. A card appears here for your approval.</p> : cards.map((c) => <ForgeCardView key={c.card_id} card={c} />)}
            </Boundary>
          </section>
          <Boundary name="ledger">
            <LedgerPane />
          </Boundary>
          <section className="rounded-md border border-line bg-white p-3 text-xs text-muted">
            <button onClick={() => setShowNotes((v) => !v)} className="underline">
              {showNotes ? 'hide' : 'show'} field notes ({notes.length}, measured on this device)
            </button>
            {hooks && <span className="ml-2">· test hooks on</span>}
            {showNotes && (
              <>
                <button onClick={clearFieldNotes} className="ml-2 underline">
                  clear
                </button>
                <ol className="mono mt-1 max-h-40 space-y-0.5 overflow-auto">
                  {[...notes].reverse().map((n, i) => (
                    <li key={i}>
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
