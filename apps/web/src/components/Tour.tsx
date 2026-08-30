'use client';

/**
 * Guided first 60 seconds. Shown with `?tour=1` or automatically in judge mode (first visit per
 * tab). Three steps, each verified by real state (a proposal appeared, Enter ran it, a tool was
 * forged) — never faked. Dismissible; never covers the terminal.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { proposals } from '@/lib/webmcp/proposals';
import { forge } from '@/lib/webmcp/forge';
import { note } from '@/lib/webmcp/fieldnotes';

const EMPTY: never[] = [];

export function tourRequested(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('tour') === '1';
  } catch {
    return false;
  }
}

export function Tour({ judge, onClose }: { judge: boolean; onClose: () => void }) {
  const list = useSyncExternalStore((fn) => proposals.subscribe(fn), () => proposals.snapshot(), () => EMPTY);
  const [forgedCount, setForged] = useState(0);
  useEffect(() => forge.subscribe(() => setForged(forge.tools().length)), []);
  const proposed = list.length > 0;
  const ran = list.some((p) => p.status === 'accepted');
  const forged = forgedCount > 0;
  const step = !proposed ? 1 : !ran ? 2 : !forged ? 3 : 4;
  useEffect(() => {
    note('tour.step', { step });
  }, [step]);

  const steps = [
    {
      n: 1,
      done: proposed,
      title: 'Ask your agent to propose a command',
      body: judge ? 'In ChatGPT (Site tools) or Chrome, say: “propose ls”. It appears as ghost text at the prompt.' : 'Say: “propose ls”. The command appears as ghost text — nothing has run.',
    },
    { n: 2, done: ran, title: 'Press Enter', body: 'Your Enter runs it on the shell. The agent reads the redacted result only if you turn on Share screen.' },
    { n: 3, done: forged, title: 'Forge it into a tool', body: 'Select the line → “Forge this” → Approve. `forged_<name>` is registered live; ask the agent to call it.' },
  ];
  return (
    <aside data-tour className="wash-accent rounded-md border border-accent p-3 text-xs">
      <div className="flex items-baseline justify-between">
        <strong className="text-sm">{step === 4 ? 'You just gave your agent a tool. That is the whole product.' : 'First 60 seconds'}</strong>
        <button onClick={onClose} className="underline text-muted" data-tour-close>
          close
        </button>
      </div>
      <ol className="mt-2 space-y-1">
        {steps.map((s) => (
          <li key={s.n} className={s.done ? 'text-muted line-through' : s.n === step ? 'text-ink' : 'text-muted'}>
            <span className="mono">{s.done ? '✓' : s.n}</span> {s.title} — <span className={s.n === step ? '' : 'opacity-70'}>{s.body}</span>
          </li>
        ))}
      </ol>
      {judge && <p className="mt-2 text-muted">This sandbox lives 30 minutes, runs as a non-root user with open egress; <code className="mono">rokan do</code> plans with our model key through a capped proxy (read-only tasks) — the text of pages you name goes to Anthropic; nothing runs without your Enter.</p>}
    </aside>
  );
}
