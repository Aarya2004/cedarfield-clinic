'use client';

/**
 * Gate A page. Registers `terminal_propose` + `terminal_wait`, shows proposals as ghost text
 * in a prompt line, and lets the human accept (Enter) or dismiss (Esc). No shell is attached
 * in this build — the page says so. Aarya's lane replaces this component on D1; keep the
 * registration shape (feature-detect, AbortController, "never executes" in the description).
 */
import { useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import { registerTerminalTools, type RegistrationState } from '@/lib/webmcp/register';
import { proposals, type Proposal } from '@/lib/webmcp/proposals';
import { clearFieldNotes, fieldNotes, subscribeFieldNotes } from '@/lib/webmcp/fieldnotes';

function useProposals(): Proposal[] {
  return useSyncExternalStore(
    (fn) => proposals.subscribe(fn),
    () => proposals.snapshot(),
    () => [],
  );
}

function useFieldNotes() {
  return useSyncExternalStore(subscribeFieldNotes, fieldNotes, () => []);
}

export function TerminalTools() {
  const [reg, setReg] = useState<RegistrationState | { kind: 'pending' }>({ kind: 'pending' });
  const list = useProposals();
  const notes = useFieldNotes();
  const pending = [...list].reverse().find((p) => p.status === 'awaiting_human');

  useEffect(() => {
    let dispose = () => {};
    registerTerminalTools(setReg).then((d) => (dispose = d));
    return () => dispose();
  }, []);

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!pending) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        proposals.resolve(pending.id, 'accepted');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        proposals.resolve(pending.id, 'dismissed');
      }
    },
    [pending],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Rokan Terminal</h1>
        <p className="text-sm text-muted">
          A terminal you and your agent share. Your Enter is the trust boundary.
        </p>
      </header>

      <section
        tabIndex={0}
        onKeyDown={onKey}
        className="mono rounded-md border border-line bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        aria-label="terminal prompt (Gate A build, no shell attached)"
      >
        <div className="text-muted">
          # Gate A build — no shell attached. Proposals appear below as ghost text.
        </div>
        <div className="text-muted"># Enter = accept · Esc = dismiss. Nothing runs anywhere.</div>
        <div className="mt-3 flex items-start gap-2">
          <span className="select-none text-accent">~ $</span>
          {pending ? (
            <span className="text-accent/80">
              {pending.command}
              <span className="ml-3 text-xs text-muted">
                ← proposed{pending.why ? `: ${pending.why}` : ''} · Enter / Esc
              </span>
            </span>
          ) : (
            <span className="animate-pulse text-muted">▍</span>
          )}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-line bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium">Site tools</h2>
          <RegStatus state={reg} />
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>
              <code className="mono">terminal_propose</code> — ghost-types one command. Never
              executes.
            </li>
            <li>
              <code className="mono">terminal_read_screen</code> — last N lines, redacted, only if shared.
            </li>
            <li>
              <code className="mono">terminal_status</code> — cwd, running, last exit code + ms (measured).
            </li>
            <li>
              <code className="mono">terminal_wait</code> — blocks until Enter/Esc or 45 s.
            </li>
          </ul>
        </section>

        <section className="rounded-md border border-line bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium">Ledger</h2>
          {list.length === 0 ? (
            <p className="text-xs text-muted">
              Empty. Ask your agent to propose <code className="mono">ls</code>.
            </p>
          ) : (
            <ol className="mono space-y-1 text-xs">
              {[...list].reverse().map((p) => (
                <li key={p.id} className="flex flex-wrap gap-2">
                  <span className="text-muted">{p.id}</span>
                  <span>{p.command}</span>
                  <span
                    className={
                      p.status === 'awaiting_human'
                        ? 'text-accent'
                        : p.status === 'accepted'
                          ? 'text-emerald-700'
                          : 'text-muted'
                    }
                  >
                    {p.status}
                  </span>
                  {p.resolvedAt !== undefined && (
                    <span className="text-muted">
                      {Math.round(p.resolvedAt - p.proposedAt)} ms to decide
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

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
          <ol className="mono max-h-64 space-y-0.5 overflow-auto text-xs">
            {[...notes].reverse().map((n, i) => (
              <li key={i}>
                <span className="text-muted">{n.t.slice(11, 23)}</span> {n.event}{' '}
                {n.detail ? <span className="text-muted">{JSON.stringify(n.detail)}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="text-xs text-muted">
        Test in ChatGPT desktop (GPT-5.6 Sol/Terra → Site tools) or Chrome 149+ with{' '}
        <code className="mono">chrome://flags/#enable-webmcp-testing</code>. Every number on
        this page is measured by the code that shows it.
      </footer>
    </main>
  );
}

function RegStatus({ state }: { state: RegistrationState | { kind: 'pending' } }) {
  switch (state.kind) {
    case 'pending':
      return <p className="text-xs text-muted">Detecting document.modelContext…</p>;
    case 'unsupported':
      return (
        <p className="text-xs text-muted">
          WebMCP not available in this browser. The page still works; tools are hidden.
        </p>
      );
    case 'error':
      return <p className="text-xs text-red-700">registerTool failed: {state.message}</p>;
    case 'registered':
      return (
        <p className="text-xs text-emerald-700">
          Registered {state.names.length} tools via document.modelContext.
        </p>
      );
  }
}
