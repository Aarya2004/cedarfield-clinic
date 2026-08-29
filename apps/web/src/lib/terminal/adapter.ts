/**
 * The real `TerminalAdapter`: xterm buffer + BridgeClient behind the `terminal_*` tools.
 *
 * Enter on a ghost-typed proposal → `acceptProposal(id)` sends exactly `command + "\r"` to the
 * bridge (the only path to the PTY), then the proposal is "in flight" until the shell's end
 * marker arrives: `start` (OSC 133;C in `data`), then `end` (OSC 133;D in `data`) **and** the
 * `status` frame with `running:false` carrying the measured `exit_code` / `ms` — both, in either
 * order, so the tail always contains the output that shares a frame with the end marker (Fable F1).
 * Output between Enter and the end marker is kept as a raw `tail` (ANSI-stripped) — `register.ts`
 * redacts it before any agent sees it.
 *
 * Honest refusals / non-executions (Fable F2/F3):
 * - while the bridge reports `running:true` (a program owns stdin) `acceptProposal` returns false —
 *   the caller must let the key through as an ordinary Enter;
 * - a prompt marker (133;A) arriving before any 133;C means nothing ran (empty line, Tab-insert then
 *   Ctrl-U, …): the proposal resolves with `exit_code:null, ms:null, measured:false`.
 *
 * Without shell integration (`hello.integration === false`: bash, sh, any non-zsh shell) the bridge
 * emits neither OSC 133 markers nor `status` frames, so an accepted proposal would stay in flight
 * forever and every later `acceptProposal` would be refused. Fallback: the proposal completes when
 * output has been quiet for `FALLBACK_QUIET_MS`, with `exit_code: null`, `ms: null`,
 * `measured: false` — the honest values; nothing is inferred.
 *
 * Run feed (ticket #4, additive): the same byte stream also feeds `runfeed.ts`.
 * - every resolved proposal is recorded once, inside `finish()` — no second capture;
 * - a command with NO proposal in flight (the human typed it) gets its own small state machine:
 *   7331;cmd gives the command line, 133;C starts it, 133;D + the `status` frame end it. It is
 *   deliberately the same shape as the proposal machine, and deliberately requires 133;C — the
 *   shell's first prompt and a bare Enter emit 133;D alone and must never invent a record.
 *   Without shell integration there are no markers, so human runs are simply not captured.
 */
import type { BridgeStatus } from '@/lib/ws/protocol';
import type { HelloFrame } from '@/lib/ws/client';
import { proposals as defaultStore, type ProposalStore, type ProposeOptions } from '../webmcp/proposals.ts';
import type { ResolvedProposal, TerminalAdapter } from '@/lib/webmcp/adapter';
import { stripAnsi } from '../webmcp/redact.ts';
import { PromptDetector } from './osc.ts';
import { runFeed, runFromResolved, type RunSink } from './runfeed.ts';

export interface TermLike {
  buffer: {
    active: {
      length: number;
      cursorX: number;
      cursorY: number;
      baseY: number;
      getLine(y: number): { translateToString(trimRight?: boolean): string; isWrapped?: boolean } | undefined;
    };
  };
}

export interface ClientLike {
  readonly paired: boolean;
  readonly hello: HelloFrame | null;
  readonly lastStatus: BridgeStatus | null;
  sendInput(data: string): boolean;
  on(event: 'data', fn: (d: string) => void): () => void;
  on(event: 'status', fn: (s: BridgeStatus) => void): () => void;
  on(event: 'state', fn: (s: string) => void): () => void;
}

export interface LiveTerminalAdapter extends TerminalAdapter {
  /** Enter on the ghost text (or Enter after a Tab-insert with `alreadySent`). */
  acceptProposal(id: string, opts?: { edited?: boolean; alreadySent?: boolean }): boolean;
  /** Result of an accepted proposal once its end marker arrived (or interrupted). */
  result(id: string): ResolvedProposal | undefined;
  /** true while an accepted proposal has not reached its end marker */
  inFlight(): string | null;
  /** every resolved proposal (measured or not), for the UI to react (e.g. unmeasured → line unknown) */
  subscribeResults(fn: (r: ResolvedProposal) => void): () => void;
  destroy(): void;
}

interface InFlight {
  id: string;
  command: string;
  edited: boolean;
  /** sent → running (133;C seen) → ended (133;D seen; waiting for / already holding the status) */
  phase: 'sent' | 'running' | 'ended';
  /** end status that arrived before the data frame carrying 133;D (older bridge order) */
  pendingStatus: BridgeStatus | null;
  tail: string[];
  partial: string;
  startedAt: number;
}

/** A command the human typed: no proposal, so only the shell's markers describe it. */
interface HumanRun {
  /** from OSC 7331;cmd; null when the shell did not announce it */
  command: string | null;
  /** running (133;C seen) → ended (133;D seen; waiting for the status frame) */
  phase: 'running' | 'ended';
  /** exit code from the 133;D marker, kept in case the run is cut short before the status frame */
  exitFromMarker: number | null;
  pendingStatus: BridgeStatus | null;
  cwd: string | null;
  tail: string[];
  partial: string;
}

let humanSeq = 0;

export const TAIL_MAX_LINES = 200;
/** No-integration fallback: a command counts as finished after this much output silence. */
export const FALLBACK_QUIET_MS = 750;

export function createTerminalAdapter(deps: { term: TermLike; client: ClientLike; share: () => boolean; store?: ProposalStore; quietMs?: number; runs?: RunSink }): LiveTerminalAdapter {
  const store = deps.store ?? defaultStore;
  const detector = new PromptDetector();
  const quietMs = deps.quietMs ?? FALLBACK_QUIET_MS;
  const runs = deps.runs ?? runFeed;
  let inflight: InFlight | null = null;
  let quietTimer: ReturnType<typeof setTimeout> | null = null;
  const results = new Map<string, ResolvedProposal>();
  const waiters = new Map<string, Set<(r: ResolvedProposal) => void>>();
  const resultListeners = new Set<(r: ResolvedProposal) => void>();
  // run-feed state (ticket #4): the human's own commands, plus the newest cwd/command the shell announced
  let human: HumanRun | null = null;
  let pendingCommand: string | null = null;
  let lastCwd: string | null = null;

  const integrated = () => deps.client.hello?.integration === true;
  const cwdNow = () => deps.client.lastStatus?.cwd ?? lastCwd;

  const finish = (r: ResolvedProposal) => {
    if (quietTimer) clearTimeout(quietTimer);
    quietTimer = null;
    results.set(r.id, r);
    inflight = null;
    // The one place a proposal ends, so the one place it becomes a run: the feed can never
    // double-count a resolution, and never re-parses the byte stream to get one.
    runs.record(runFromResolved(r, cwdNow()));
    waiters.get(r.id)?.forEach((fn) => fn(r));
    waiters.delete(r.id);
    resultListeners.forEach((fn) => fn(r));
  };

  const tailOf = (f: { tail: string[]; partial: string }) => {
    const lines = f.partial ? [...f.tail, f.partial] : f.tail;
    return lines.filter((l, i, a) => !(i === a.length - 1 && l.trim() === '')).slice(-TAIL_MAX_LINES);
  };

  /** Append a raw PTY chunk to a capture's tail (ANSI stripped, bounded). */
  const appendTail = (f: { tail: string[]; partial: string }, chunk: string) => {
    const text = stripAnsi(f.partial + chunk).replace(/\r/g, '');
    const parts = text.split('\n');
    f.partial = parts.pop() ?? '';
    for (const line of parts) {
      if (f.tail.length < TAIL_MAX_LINES) f.tail.push(line);
    }
  };

  /** A human-typed command ended. `st` present = the shell measured exit/ms; absent = it did not. */
  const finishHuman = (h: HumanRun, st: BridgeStatus | null) => {
    human = null;
    runs.record({
      id: `r_${Date.now().toString(36)}_${humanSeq++}`,
      command: h.command,
      origin: 'human',
      exit_code: st ? st.last_exit_code : h.exitFromMarker,
      ms: st ? st.last_command_ms : null,
      cwd: st?.cwd ?? h.cwd,
      tail: tailOf(h),
      t: Date.now(),
      measured: st !== null,
      ...(st ? {} : { interrupted: true }),
      ...(st?.last_rokan ? { rokan: st.last_rokan } : {}),
    });
  };

  /** Nothing measurable will come: close the in-flight proposal honestly (exit/ms unknown). */
  const finishUnmeasured = (f: InFlight) => {
    const p = store.get(f.id);
    if (!p) {
      inflight = null;
      return;
    }
    finish({ ...p, status: 'accepted', exit_code: null, ms: null, measured: false, tail: tailOf(f), ...(f.edited ? { edited: true } : {}) });
  };

  const finishMeasured = (f: InFlight, st: BridgeStatus) => {
    const p = store.get(f.id);
    if (!p) {
      inflight = null;
      return;
    }
    finish({ ...p, status: 'accepted', exit_code: st.last_exit_code, ms: st.last_command_ms, tail: tailOf(f), ...(f.edited ? { edited: true } : {}), ...(st.last_rokan ? { rokan: st.last_rokan } : {}) });
  };

  /** (Re)arm the quiescence timer — only used when the shell has no integration. */
  const armQuiet = () => {
    if (quietTimer) clearTimeout(quietTimer);
    quietTimer = setTimeout(() => {
      quietTimer = null;
      if (inflight) finishUnmeasured(inflight);
    }, quietMs);
  };

  const offData = deps.client.on('data', (chunk) => {
    const events = detector.feed(chunk);
    const f = inflight;
    if (f) {
      // capture output lines (ANSI stripped) for the tail — before the markers are interpreted, so
      // output sharing a frame with 133;D is in the tail when the proposal finishes
      appendTail(f, chunk);
      for (const ev of events) {
        if (inflight !== f) break; // finished inside this loop
        if (ev.kind === 'start' && f.phase === 'sent') {
          f.phase = 'running';
        } else if (ev.kind === 'end' && f.phase === 'running') {
          f.phase = 'ended';
          if (f.pendingStatus) finishMeasured(f, f.pendingStatus);
        } else if (ev.kind === 'prompt' && f.phase === 'sent' && integrated()) {
          finishUnmeasured(f); // the prompt came back without a 133;C: nothing ran
        }
      }
      if (inflight === f && !integrated()) armQuiet();
    }
    // Run feed (ticket #4). Runs after the proposal machine so `inflight` already reflects a
    // proposal that ended inside this same frame; the same chunk's tail is captured first, for the
    // same reason it is above.
    if (human) appendTail(human, chunk);
    for (const ev of events) {
      if (ev.kind === 'cwd') {
        lastCwd = ev.cwd;
      } else if (ev.kind === 'command') {
        pendingCommand = ev.command; // preexec: always immediately before 133;C
      } else if (ev.kind === 'start') {
        const command = pendingCommand;
        pendingCommand = null;
        // A proposal in flight owns this command; only an unclaimed 133;C is the human's own.
        if (!inflight && !human) human = { command, phase: 'running', exitFromMarker: null, pendingStatus: null, cwd: lastCwd, tail: [], partial: '' };
      } else if (ev.kind === 'end' && human && human.phase === 'running') {
        human.phase = 'ended';
        human.exitFromMarker = ev.code;
        if (human.pendingStatus) finishHuman(human, human.pendingStatus);
      }
    }
  });

  const offStatus = deps.client.on('status', (st) => {
    const f = inflight;
    if (f) {
      if (st.running) return;
      if (f.phase === 'ended') finishMeasured(f, st);
      else if (f.phase === 'running') f.pendingStatus = st; // the data frame carrying 133;D is still to come
      return;
    }
    const h = human;
    if (!h || st.running) return;
    if (h.phase === 'ended') finishHuman(h, st);
    else h.pendingStatus = st; // the data frame carrying 133;D is still to come
  });

  const offState = deps.client.on('state', (s) => {
    if (s !== 'disconnected' && s !== 'closed') return;
    if (human) finishHuman(human, null); // cut short: exit/ms unknown, whatever was printed is kept
    if (!inflight) return;
    const p = store.get(inflight.id);
    if (!p) return;
    finish({ ...p, status: 'accepted', exit_code: null, ms: null, tail: inflight.tail.slice(-TAIL_MAX_LINES), interrupted: true, ...(inflight.edited ? { edited: true } : {}) });
  });

  const adapter: LiveTerminalAdapter = {
    get mode() {
      return deps.client.hello?.mode === 'judge' ? 'judge' : 'builder';
    },
    shareScreen: () => deps.share(),
    screenLines: (n) => {
      // Logical lines, not visual rows: a long line wraps into rows flagged `isWrapped`, and the
      // redactor must see `KEY=value` whole — split across rows the bare value leaked (measured in
      // judge mode 2026-08-28: a longer prompt wrapped the export line).
      const b = deps.term.buffer.active;
      const out: string[] = [];
      let seenContent = false;
      let y = b.length - 1;
      while (y >= 0 && out.length < n) {
        let start = y;
        while (start > 0 && b.getLine(start)?.isWrapped) start--;
        let s = '';
        for (let k = start; k <= y; k++) s += (b.getLine(k)?.translateToString(k === y) ?? '').replace(/\s+$/, k === y ? '' : '$&');
        s = s.replace(/\s+$/, '');
        y = start - 1;
        if (!seenContent && s.trim() === '') continue; // drop trailing blank rows below the cursor
        seenContent = true;
        out.push(s);
      }
      return out.reverse();
    },
    status: () => {
      const st = deps.client.lastStatus;
      if (!st || !deps.client.paired) return null;
      return { ...st, integration: deps.client.hello?.integration ?? false };
    },
    ghostType: (command, why, opts?: ProposeOptions) => store.propose(command, why, opts),
    waitProposal: async (id, ms, signal) => {
      const done = results.get(id);
      if (done) return done;
      const p = store.get(id);
      if (!p) return null;
      if (p.status === 'dismissed') return p;
      if (p.status === 'accepted' && inflight?.id !== id) return p; // accepted before this adapter existed
      if (p.status === 'accepted' || p.status === 'awaiting_human' || p.status === 'queued') {
        // wait for resolution (accept/dismiss) and, if accepted, for the end marker
        return new Promise<ResolvedProposal | null>((resolve) => {
          let settled = false;
          const settle = (r: ResolvedProposal | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            offStore();
            waiters.get(id)?.delete(onEnd);
            resolve(r);
          };
          const onAbort = () => settle(null);
          const timer = setTimeout(() => settle(null), ms);
          const onEnd = (r: ResolvedProposal) => settle(r);
          const set = waiters.get(id) ?? new Set();
          set.add(onEnd);
          waiters.set(id, set);
          const offStore = store.subscribe(() => {
            const q = store.get(id);
            if (q?.status === 'dismissed') settle(q);
          });
          signal?.addEventListener('abort', onAbort, { once: true });
          if (signal?.aborted) settle(null);
        });
      }
      return p;
    },
    acceptProposal: (id, opts = {}) => {
      const p = store.get(id);
      if (!p || p.status !== 'awaiting_human') return false;
      if (!deps.client.paired) return false; // never queue a proposal into a shell that has not said hello yet (Codex review)
      // A program owns stdin (cat, vim, ssh, python…): typing the proposal would feed it, not the shell.
      if (integrated() && deps.client.lastStatus?.running) return false;
      if (inflight) {
        if (integrated()) return false; // one command in flight at a time; it will end with a marker
        finishUnmeasured(inflight); // no integration: nothing can observe the previous one ending — never wedge
      }
      if (!opts.alreadySent) {
        if (!deps.client.sendInput(p.command + '\r')) return false;
      }
      store.resolve(id, 'accepted', undefined, { edited: !!opts.edited });
      inflight = { id, command: p.command, edited: !!opts.edited, phase: 'sent', pendingStatus: null, tail: [], partial: '', startedAt: performance.now() };
      if (!integrated()) {
        inflight.phase = 'running'; // no OSC 133;C will ever come
        armQuiet();
      }
      return true;
    },
    result: (id) => results.get(id),
    inFlight: () => inflight?.id ?? null,
    subscribeResults: (fn) => {
      resultListeners.add(fn);
      return () => resultListeners.delete(fn);
    },
    destroy: () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = null;
      offData();
      offStatus();
      offState();
    },
  };
  return adapter;
}
