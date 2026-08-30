/**
 * The run feed store (ticket #4): one record per command that actually ran in the paired terminal —
 * typed by the human, ghost-typed by the agent, or stepped through by a forged tool. The raw xterm
 * below stays the authentic surface; this is the parallel structured view the browser can scroll,
 * filter and forge from.
 *
 * Where records come from (both filled in by `terminal/adapter.ts`, the only thing that watches the
 * byte stream):
 *   - agent / forged: every `ResolvedProposal` the adapter finishes, converted by `runFromResolved`;
 *   - human: the adapter's marker state machine for commands with no proposal in flight.
 * Nothing here parses bytes itself, so a command is never captured twice.
 *
 * Honest by construction: `exit_code` / `ms` are copied from what the shell measured and are `null`
 * (with `measured:false`) whenever they were not measured — this store never infers a number.
 *
 * NOT a redaction boundary. These records are human-facing UI state and stay un-redacted, exactly
 * like the terminal the human is looking at; redaction is the agent boundary and belongs to the
 * tool that exposes this history (`terminal_history`, ticket #6). In memory only — a reload starts
 * an empty feed, like the adapter's results.
 */
import type { ResolvedProposal } from '@/lib/webmcp/adapter';

export type RunOrigin = 'human' | 'agent' | 'forged';

export interface Run {
  /** Proposal id for agent/forged runs (so a resolution can never be recorded twice), `r_…` for human ones. */
  id: string;
  /** The command line, or null when the shell never told us what ran. */
  command: string | null;
  origin: RunOrigin;
  /** Measured by the shell; null when nothing measured it. */
  exit_code: number | null;
  ms: number | null;
  cwd: string | null;
  /** Output printed after the command started, ANSI-stripped, ≤ TAIL_MAX_LINES. */
  tail: string[];
  /** Wall clock of the moment the record was made (Date.now), for display only. */
  t: number;
  /** false: the shell had no integration or the run was cut short — exit_code/ms are unknown. */
  measured: boolean;
  /** the bridge disconnected before the command ended */
  interrupted?: boolean;
  /** the human inserted the ghost text (Tab) and edited before running */
  edited?: boolean;
  /**
   * rokan-do trailer parsed by the bridge: replayed=true means zero model calls. `native` is set
   * only when a site's own WebMCP tools served the answer — display provenance, never inferred.
   */
  rokan?: { ms: number; replayed: boolean; native?: { site: string; tool: string } };
}

/** Bounded on purpose: a long session must not grow the tab without limit. Oldest out first. */
export const RUN_FEED_MAX = 200;
/** A single tail line longer than this is clipped for display (a `cat` of a minified file). */
const LINE_MAX = 2000;

/** What the adapter needs from the store — the seam the unit tests substitute. */
export interface RunSink {
  record(run: Run): Run | null;
}

/**
 * Strip C0/C1 controls and Unicode format characters (bidi overrides) from anything that will be
 * painted into the DOM: the bytes the human reads must be the bytes that ran. Same rule as
 * `register.ts` applies to an agent's `why`.
 */
function clean(s: string): string {
  return s.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]|\p{Cf}/gu, '').slice(0, LINE_MAX);
}

export class RunFeedStore implements RunSink {
  private items: Run[] = [];
  private ids = new Set<string>();
  private listeners = new Set<() => void>();

  /** Stable array identity between changes: safe for useSyncExternalStore. */
  snapshot(): Run[] {
    return this.items;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Records a run. A repeated id (the same resolution seen twice) is ignored, not duplicated. */
  record(run: Run): Run | null {
    if (this.ids.has(run.id)) return null;
    const r: Run = { ...run, command: run.command === null ? null : clean(run.command), tail: run.tail.map(clean) };
    this.ids.add(r.id);
    this.items = [...this.items, r];
    while (this.items.length > RUN_FEED_MAX) {
      const dropped = this.items[0];
      this.items = this.items.slice(1);
      this.ids.delete(dropped.id);
    }
    this.listeners.forEach((fn) => fn());
    return r;
  }

  clear(): void {
    this.items = [];
    this.ids.clear();
    this.listeners.forEach((fn) => fn());
  }
}

/** One store per tab; the adapter writes to it, the RunFeed pane reads it. */
export const runFeed: RunFeedStore = new RunFeedStore();

/**
 * A resolved proposal, as a run. `invocation_id` is set only by a forged tool's steps, so it is
 * what separates "the agent proposed this" from "a tool the human forged ran this step".
 */
export function runFromResolved(r: ResolvedProposal, cwd: string | null): Run {
  return {
    id: r.id,
    command: r.command,
    origin: r.invocation_id ? 'forged' : 'agent',
    exit_code: r.exit_code ?? null,
    ms: r.ms ?? null,
    cwd,
    tail: r.tail ?? [],
    t: Date.now(),
    measured: r.measured !== false && r.exit_code != null,
    ...(r.interrupted ? { interrupted: true } : {}),
    ...(r.edited ? { edited: true } : {}),
    ...(r.rokan ? { rokan: r.rokan } : {}),
  };
}

/** Filters offered by the feed header. Kept here so the store and the pane agree on the words. */
export type RunFilter = 'all' | 'failures' | 'forged' | 'rokan';

export function matchesFilter(r: Run, f: RunFilter): boolean {
  switch (f) {
    case 'failures':
      return r.exit_code !== null && r.exit_code !== 0;
    case 'forged':
      return r.origin === 'forged';
    case 'rokan':
      return r.rokan != null;
    default:
      return true;
  }
}
