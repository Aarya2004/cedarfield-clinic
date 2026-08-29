'use client';

/**
 * The run feed (ticket #4): the browser-native history of everything that ran in the paired
 * terminal — the human's own commands, the agent's proposals, a forged tool's steps.
 *
 * Deliberately NOT a Warp-style block terminal: the xterm below stays the live, authentic surface
 * and keeps every byte. This is the parallel structured view — one quiet line per run, expandable
 * to the captured output, filterable, and the shortest path from "I ran this" to "now it's a tool".
 * Per the design brief the boldness budget is spent on the birth pulse, so everything here is
 * hairlines, mono data and one amber accent on the primary action.
 *
 * Every number shown is copied from what the shell measured; an unmeasured run says so rather than
 * showing a plausible zero.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { matchesFilter, runFeed, type Run, type RunFilter } from '@/lib/terminal/runfeed';
import { Chip } from './Chip';
import { ProvenanceChip } from './Provenance';

const EMPTY: Run[] = [];
const FILTERS: { id: RunFilter; label: string; title: string }[] = [
  { id: 'all', label: 'All', title: 'Every run in this session' },
  { id: 'failures', label: 'Failures', title: 'Runs the shell reported with a non-zero exit code' },
  { id: 'forged', label: 'Forged', title: 'Steps run by a tool you forged' },
  { id: 'rokan', label: 'rokan', title: 'Runs that printed a rokan-do result line' },
];

/** How the run got to the prompt, in the words of who controls it. */
const ORIGIN: Record<Run['origin'], { label: string; title: string }> = {
  human: { label: 'you', title: 'You typed this at the prompt.' },
  agent: { label: 'agent', title: 'Your agent proposed it; your Enter ran it.' },
  forged: { label: 'tool', title: 'A step of a tool you forged; your Enter ran it.' },
};

function useRuns(): Run[] {
  return useSyncExternalStore((fn) => runFeed.subscribe(fn), () => runFeed.snapshot(), () => EMPTY);
}

export function RunFeed({ onForgeThis }: { onForgeThis: (lines: string[]) => void }) {
  const runs = useRuns();
  const [filter, setFilter] = useState<RunFilter>('all');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  // Follow the newest run unless the human scrolled up — then they are reading, and the feed waits.
  const [follow, setFollow] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const shown = filter === 'all' ? runs : runs.filter((r) => matchesFilter(r, filter));

  const toBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setFollow(true);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [shown.length, follow, open]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <section className="flex max-h-[45%] min-h-0 shrink-0 flex-col" data-run-feed aria-label="run feed">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <h2 className="text-xs font-medium">
          Runs · {runs.length}
          {filter !== 'all' && <span className="text-muted"> · showing {shown.length}</span>}
        </h2>
        {/* Nothing to filter yet is not a control: the empty feed is one invitation, not a toolbar. */}
        <div className={`flex items-center gap-1 text-[11px] ${runs.length === 0 ? 'hidden' : ''}`} role="group" aria-label="filter runs">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              data-run-filter={f.id}
              aria-pressed={filter === f.id}
              title={f.title}
              onClick={() => setFilter(f.id)}
              className={`rounded px-1.5 py-0.5 ${filter === f.id ? 'tone-accent' : 'text-muted hover:text-ink'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={onScroll} className="h-full min-h-0 overflow-y-auto px-1 text-xs">
          {runs.length === 0 ? (
            <p className="text-muted">Runs will appear here as you and your agent work — each command with its output, exit and timing.</p>
          ) : shown.length === 0 ? (
            <p className="text-muted">No runs match this filter yet.</p>
          ) : (
            <ol className="space-y-0.5">
              {shown.map((r) => (
                <RunRow key={r.id} run={r} open={open.has(r.id)} onToggle={() => toggle(r.id)} onForgeThis={onForgeThis} />
              ))}
            </ol>
          )}
        </div>
        {!follow && shown.length > 0 && (
          <button type="button" data-run-jump onClick={toBottom} className="btn-ink absolute bottom-1 right-2 rounded-full px-2.5 py-0.5 text-[11px] shadow-sm">
            Jump to latest
          </button>
        )}
      </div>
    </section>
  );
}

function RunRow({ run, open, onToggle, onForgeThis }: { run: Run; open: boolean; onToggle: () => void; onForgeThis: (lines: string[]) => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  const origin = ORIGIN[run.origin];
  const command = run.command; // a const so the null check still holds inside the action handlers
  const copy = () => {
    const c = navigator.clipboard;
    if (!c || !command) return;
    void c.writeText(command).then(() => setCopied(true));
  };
  return (
    <li data-run={run.id} data-run-origin={run.origin} className="rounded border border-transparent hover:border-line">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-1 py-0.5 text-left">
        <span aria-hidden className="w-2 shrink-0 text-muted">
          {open ? '▾' : '▸'}
        </span>
        <span className="w-7 shrink-0 text-[10px] text-muted" title={origin.title}>
          {origin.label}
        </span>
        {/* dir=ltr: a command must read in the order it would run, whatever it contains */}
        <code className="mono min-w-0 flex-1 truncate text-ink" dir="ltr" title={command ?? undefined}>
          {command ?? <span className="text-muted">command not recorded by the shell</span>}
        </code>
        {run.exit_code === null ? (
          <Chip tone="muted" title={run.interrupted ? 'The bridge disconnected before this command ended.' : 'No shell integration: this exit code was never measured.'}>
            {run.interrupted ? 'cut short' : 'exit unknown'}
          </Chip>
        ) : (
          <Chip tone={run.exit_code === 0 ? 'ok' : 'danger'} className="mono" title="Exit code, as reported by the shell">
            exit {run.exit_code}
          </Chip>
        )}
        <span className="mono shrink-0 text-muted tabular-nums" title={run.ms === null ? 'Duration was not measured' : 'Duration, measured by the shell'}>
          {run.ms === null ? '– ms' : `${run.ms} ms`}
        </span>
        {run.rokan && <ProvenanceChip p={{ kind: run.rokan.replayed ? 'compiled' : 'planned', ms: run.rokan.ms, ...(run.rokan.replayed ? { calls: 0 } : {}) }} />}
        {run.cwd && (
          <span className="mono hidden max-w-[28%] shrink-0 truncate text-muted lg:inline" title={run.cwd}>
            {run.cwd}
          </span>
        )}
      </button>
      {open && (
        <div className="mb-1 ml-5 mr-1">
          <pre className="terminal-canvas mono max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-line p-2 text-[11px] leading-4" data-run-tail>
            {run.tail.length > 0 ? run.tail.join('\n') : 'No output was captured for this run.'}
          </pre>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted">
            {command && (
              <>
                <button type="button" data-run-forge onClick={() => onForgeThis([command])} className="rounded bg-accent px-2 py-0.5 text-white hover:bg-amber-700" title="Turn this command into a WebMCP tool — a card appears for your approval">
                  Forge this
                </button>
                <button type="button" data-run-copy onClick={copy} className="rounded-sm underline decoration-line underline-offset-2 hover:decoration-ink">
                  {copied ? 'copied' : 'Copy'}
                </button>
              </>
            )}
            <span className="mono">{new Date(run.t).toLocaleTimeString()}</span>
            {run.edited && <span title="You inserted the proposal with Tab and edited it before running">edited</span>}
            {run.cwd && <span className="mono lg:hidden">{run.cwd}</span>}
          </div>
        </div>
      )}
    </li>
  );
}
