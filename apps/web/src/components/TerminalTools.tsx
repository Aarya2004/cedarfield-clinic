'use client';

/**
 * Prompt-line page (no PTY yet): registers the six fixed tools, renders ghost text, the Forge
 * card, the forged-tool list, the ledger and measured field notes. Enter accepts, Esc dismisses.
 * The Terminal plan replaces the prompt line with xterm.js; everything else stays.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { registerTerminalTools, type RegistrationState } from '@/lib/webmcp/register';
import { proposals, type Proposal } from '@/lib/webmcp/proposals';
import { forge, type ForgeCard, type ForgedTool } from '@/lib/webmcp/forge';
import { ledger, type LedgerRow } from '@/lib/webmcp/ledger';
import { clearFieldNotes, fieldNotes, subscribeFieldNotes } from '@/lib/webmcp/fieldnotes';
import { getGateAShare, setGateAShare } from '@/lib/webmcp/adapter';
import { installTestHooks } from '@/lib/webmcp/testhooks';
import { FIXED_TOOL_NAMES } from '@/lib/webmcp/schemas';

const EMPTY: never[] = [];

function useProposals(): Proposal[] {
  return useSyncExternalStore((fn) => proposals.subscribe(fn), () => proposals.snapshot(), () => EMPTY);
}
function useCards(): ForgeCard[] {
  return useSyncExternalStore((fn) => forge.subscribe(fn), () => forge.cards(), () => EMPTY);
}
function useForged(): ForgedTool[] {
  const [snap, setSnap] = useState<ForgedTool[]>(() => forge.tools());
  useEffect(() => forge.subscribe(() => setSnap(forge.tools())), []);
  return snap;
}
function useLedger(): LedgerRow[] {
  return useSyncExternalStore((fn) => ledger.subscribe(fn), () => ledger.snapshot(), () => EMPTY);
}
function useFieldNotes() {
  return useSyncExternalStore(subscribeFieldNotes, fieldNotes, () => EMPTY);
}

export function TerminalTools() {
  const [reg, setReg] = useState<RegistrationState | { kind: 'pending' }>({ kind: 'pending' });
  const [share, setShare] = useState(false);
  const [hooks, setHooks] = useState(false);
  const list = useProposals();
  const cards = useCards();
  const forged = useForged();
  const rows = useLedger();
  const notes = useFieldNotes();
  const pending = [...list].reverse().find((p) => p.status === 'awaiting_human');
  const visibleForged = forged.filter((t) => t.visible).length;

  useEffect(() => {
    setHooks(installTestHooks());
    setShare(getGateAShare());
    let dispose = () => {};
    registerTerminalTools(setReg).then((d) => (dispose = d));
    return () => dispose();
  }, []);

  const [armed, setArmed] = useState<string | null>(null);
  const decide = useCallback(
    (key: string): boolean => {
      if (!pending) return false;
      if (key === 'Enter') {
        // Hard-blocked patterns need a second Enter (PLAN §4): first press arms, second accepts.
        if (pending.dangerous && armed !== pending.id) {
          setArmed(pending.id);
          return true;
        }
        setArmed(null);
        proposals.resolve(pending.id, 'accepted');
        return true;
      }
      if (key === 'Escape') {
        setArmed(null);
        proposals.resolve(pending.id, 'dismissed');
        return true;
      }
      return false;
    },
    [pending, armed],
  );
  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (decide(e.key)) e.preventDefault();
    },
    [decide],
  );
  // Enter/Esc work without clicking first (Opus review P1): document-level handler unless the
  // human is typing in a form control, plus autofocus of the prompt on mount.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing || el?.hasAttribute('data-prompt')) return;
      if (decide(e.key)) e.preventDefault();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [decide]);
  useEffect(() => {
    document.querySelector<HTMLElement>('[data-prompt]')?.focus();
  }, []);

  const toggleShare = (on: boolean) => {
    setGateAShare(on);
    setShare(on);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-6 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Rokan Terminal</h1>
        <p className="text-sm text-muted">Do it once. Now it&apos;s a tool.</p>
      </header>

      <section
        tabIndex={0}
        data-prompt
        onKeyDown={onKey}
        className="mono rounded-md border border-line bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        aria-label="terminal prompt (no shell attached in this build)"
      >
        <div className="text-muted"># No shell attached in this build. Proposals appear below as ghost text.</div>
        <div className="text-muted"># Enter = accept · Esc = dismiss. Nothing runs anywhere.</div>
        <div className="mt-3 flex items-start gap-2">
          <span className="select-none text-accent">~ $</span>
          {pending ? (
            <span className={pending.dangerous ? 'text-red-700' : 'text-accent/80'}>
              {pending.command}
              <span className="ml-3 text-xs text-muted">
                ← {pending.why ?? 'proposed'} · Enter / Esc
                {pending.dangerous ? (armed === pending.id ? ' · ⚠ press Enter again to confirm' : ' · ⚠ hard-blocked pattern: Enter twice') : ''}
              </span>
            </span>
          ) : (
            <span className="animate-pulse text-muted">▍</span>
          )}
        </div>
      </section>

      {cards.map((c) => (
        <ForgeCardView key={c.card_id} card={c} />
      ))}

      <div className="grid gap-5 md:grid-cols-3">
        <section className="rounded-md border border-line bg-white p-4 text-sm">
          <h2 className="mb-1 font-medium">Site tools · {reg.kind === 'registered' ? FIXED_TOOL_NAMES.length + visibleForged : 0}</h2>
          <RegStatus state={reg} />
          <p className="mt-1 text-xs text-muted">
            Registered this session: {rows.filter((r) => r.kind === 'registered' || r.kind === 'forged' || r.kind === 'restored').length} · forged visible {visibleForged}/5
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted">
            {FIXED_TOOL_NAMES.map((n) => (
              <li key={n}>
                <code className="mono">{n}</code>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={share} onChange={(e) => toggleShare(e.target.checked)} />
            Share screen with agent {share ? '(on — redacted)' : '(off)'}
          </label>
          {hooks && <p className="mt-2 text-[10px] text-muted">test hooks on (window.__rokan)</p>}
        </section>

        <section className="rounded-md border border-line bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium">Forged tools</h2>
          {forged.length === 0 ? (
            <p className="text-xs text-muted">None yet. Ask your agent to forge one, e.g. “forge a tool hn_top that runs rokan do &quot;top {'{{n}}'} HN titles&quot;”.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {forged.map((t) => (
                <ForgedRow key={t.name} t={t} />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-line bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium">Ledger · {rows.length}</h2>
          {rows.length === 0 ? (
            <p className="text-xs text-muted">Empty. Ask your agent to propose <code className="mono">ls</code>.</p>
          ) : (
            <ol className="mono max-h-72 space-y-0.5 overflow-auto text-xs">
              {[...rows].reverse().map((r) => (
                <li key={r.seq} className="flex flex-wrap gap-1">
                  <span className="text-muted">{r.seq}</span>
                  <span className={r.kind === 'forged' ? 'text-accent' : r.kind === 'executed' ? 'text-emerald-700' : ''}>{r.kind}</span>
                  <span className="text-muted">{summarise(r)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="rounded-md border border-line bg-white p-4 text-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-medium">Proposals</h2>
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-muted">None.</p>
        ) : (
          <ol className="mono max-h-48 space-y-1 overflow-auto text-xs">
            {[...list].reverse().map((p) => (
              <li key={p.id} className="flex flex-wrap gap-2">
                <span className="text-muted">{p.id}</span>
                <span>{p.command}</span>
                <span className={p.status === 'awaiting_human' ? 'text-accent' : p.status === 'accepted' ? 'text-emerald-700' : 'text-muted'}>{p.status}</span>
                {p.reason && <span className="text-muted">{p.reason}</span>}
                {p.resolvedAt !== undefined && <span className="text-muted">{Math.round(p.resolvedAt - p.proposedAt)} ms to decide</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-md border border-line bg-white p-4 text-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-medium">Field notes (measured on this device)</h2>
          <button onClick={clearFieldNotes} className="text-xs text-muted underline">
            clear
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-muted">No events yet.</p>
        ) : (
          <ol className="mono max-h-48 space-y-0.5 overflow-auto text-xs">
            {[...notes].reverse().map((n, i) => (
              <li key={i}>
                <span className="text-muted">{n.t.slice(11, 23)}</span> {n.event} {n.detail ? <span className="text-muted">{JSON.stringify(n.detail)}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="text-xs text-muted">
        Test in ChatGPT desktop (GPT-5.6 Sol/Terra → Site tools) or Chrome 149+ with <code className="mono">chrome://flags/#enable-webmcp-testing</code>. Every number on this page is measured by the code that shows it.
      </footer>
    </main>
  );
}

function summarise(r: LedgerRow): string {
  const f = r.fields;
  switch (r.kind) {
    case 'proposed':
      return String(f.command ?? '');
    case 'forged':
      return `${f.tool} ${f.hash} ${f.kind}`;
    case 'invoked':
      return `${f.tool} ×${f.steps} ${f.hash}`;
    case 'executed':
      return `${f.tool ?? ''} step ${f.step ?? ''} exit ${f.exit_code ?? '–'} ${f.ms ?? '–'} ms`;
    case 'screen_read':
      return f.shared ? `${f.lines} lines, ${f.redactions} redacted` : 'refused (share off)';
    default:
      return Object.entries(f)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
  }
}

function ForgeCardView({ card }: { card: ForgeCard }) {
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const approve = async () => {
    const r = await forge.approve(card.card_id, undefined, { confirmDangerous: confirm });
    if ('error' in r) {
      if (r.error === 'needs_confirmation') setConfirm(true);
      setErr(`${r.error}${r.detail ? ': ' + r.detail : ''}`);
    }
  };
  const s = card.spec;
  return (
    <section data-card={card.card_id} className={`rounded-md border-2 bg-white p-4 text-sm ${card.dangerous ? 'border-red-600' : 'border-accent'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">
          Forge card · <code className="mono">forged_{s.name}</code>
          <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${s.kind === 'write' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{s.kind}</span>
        </h2>
        <span className="text-xs text-muted">from {card.origin}{card.previousHash ? ` · replaces ${card.previousHash}` : ''}</span>
      </div>
      {card.dangerous && <p className="mt-1 text-xs text-red-700">⚠ A command matches a hard-blocked pattern. Approve twice to confirm.</p>}
      {card.kindOverridden && <p className="mt-1 text-xs text-muted">kind set to “write” because a command changes state.</p>}
      <p className="mt-2 text-sm">{s.description}</p>
      <ol className="mono mt-2 space-y-0.5 text-xs">
        {s.commands.map((c, i) => (
          <li key={i}>
            <span className="text-muted">{i + 1}.</span> {c}
          </li>
        ))}
      </ol>
      {s.params.length > 0 && (
        <ul className="mt-2 text-xs text-muted">
          {s.params.map((p) => (
            <li key={p.name}>
              <code className="mono">{'{{' + p.name + '}}'}</code> — {p.description} (e.g. <code className="mono">{p.example}</code>)
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">The agent can call this. Each command still needs your Enter.</p>
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button data-approve onClick={approve} className="rounded bg-ink px-3 py-1 text-xs text-white">
          {confirm ? 'Approve anyway' : 'Approve'}
        </button>
        <button data-reject onClick={() => forge.reject(card.card_id)} className="rounded border border-line px-3 py-1 text-xs">
          Reject
        </button>
      </div>
    </section>
  );
}

function ForgedRow({ t }: { t: ForgedTool }) {
  const entry = forge.list().tools.find((x) => x.name === t.name);
  return (
    <li className="flex flex-wrap items-center gap-2">
      <code className="mono">{t.tool}</code>
      <span className={`rounded px-1 text-[10px] uppercase ${t.spec.kind === 'write' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{t.spec.kind}</span>
      <span className="mono text-muted">{t.hash}</span>
      <span className="text-muted">
        {entry?.runs ?? 0} runs{entry?.median_ms != null ? ` · ${entry.median_ms} ms` : ''}{entry?.last_exit != null ? ` · exit ${entry.last_exit}` : ''}
      </span>
      {!t.visible && <span className="text-red-700">evicted</span>}
      <button onClick={() => forge.pin(t.name, !t.pinned)} className="text-muted underline">
        {t.pinned ? 'unpin' : 'pin'}
      </button>
      {!t.visible && (
        <button onClick={() => void forge.restore(t.name)} className="text-muted underline">
          restore
        </button>
      )}
      <button onClick={() => forge.unforge(t.name)} className="text-muted underline">
        unforge
      </button>
    </li>
  );
}

function RegStatus({ state }: { state: RegistrationState | { kind: 'pending' } }) {
  switch (state.kind) {
    case 'pending':
      return <p className="text-xs text-muted">Detecting document.modelContext…</p>;
    case 'unsupported':
      return <p className="text-xs text-muted">WebMCP not available in this browser. The page still works; tools are hidden.</p>;
    case 'error':
      return <p className="text-xs text-red-700">registerTool failed: {state.message}</p>;
    case 'registered':
      return <p className="text-xs text-emerald-700">Registered {state.names.length} fixed tools via document.modelContext.</p>;
  }
}
