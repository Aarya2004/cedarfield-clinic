'use client';

/**
 * The no-shell prompt line (unpaired mode). Same trust semantics as the live terminal: a
 * proposal is shown as ghost text; Enter accepts, Esc dismisses, dangerous needs Enter twice.
 * Keeps `[data-prompt]` and the `~ $ <command>` text so the headless cases run against it.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { proposals, type Proposal } from '@/lib/webmcp/proposals';

const EMPTY: never[] = [];

export function usePending(): Proposal | undefined {
  const list = useSyncExternalStore((fn) => proposals.subscribe(fn), () => proposals.snapshot(), () => EMPTY);
  return [...list].reverse().find((p) => p.status === 'awaiting_human');
}

export function PromptLine() {
  const pending = usePending();
  const [armed, setArmed] = useState<string | null>(null);

  const decide = useCallback(
    (key: string): boolean => {
      if (!pending) return false;
      if (key === 'Enter') {
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

  return (
    <section
      tabIndex={0}
      data-prompt
      onKeyDown={(e) => {
        if (decide(e.key)) e.preventDefault();
      }}
      className="mono rounded-md border border-line bg-surface p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      aria-label="terminal prompt (no shell attached)"
      aria-live="polite"
    >
      <div className="text-muted"># No shell attached. Pair a bridge for a real terminal — proposals still appear here as ghost text.</div>
      <div className="text-muted"># Enter = accept · Esc = dismiss. Nothing runs anywhere.</div>
      <div className="mt-3 flex items-start gap-2">
        <span className="select-none text-accent-ink" aria-hidden>~ $</span>
        {pending ? (
          <span className={pending.dangerous ? 'text-danger' : 'text-accent-ink'}>
            {pending.command}
            <span className="ml-3 text-xs text-muted [unicode-bidi:isolate]" dir="auto">
              ← {pending.why ?? 'proposed'} · Enter / Esc
              {pending.dangerous ? (armed === pending.id ? ' · ⚠ press Enter again to confirm' : ' · ⚠ hard-blocked pattern: Enter twice') : ''}
            </span>
          </span>
        ) : (
          <span className="animate-pulse text-muted">▍</span>
        )}
      </div>
    </section>
  );
}
