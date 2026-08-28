/**
 * The real `TerminalAdapter`: xterm buffer + BridgeClient behind the `terminal_*` tools.
 *
 * Enter on a ghost-typed proposal → `acceptProposal(id)` sends exactly `command + "\r"` to the
 * bridge (the only path to the PTY), then the proposal is "in flight" until the shell's end
 * marker arrives: `start` (OSC 133;C in `data`) then a `status` frame with `running:false`
 * carrying the measured `exit_code` / `ms`. Output between Enter and the end marker is kept as
 * a raw `tail` (ANSI-stripped) — `register.ts` redacts it before any agent sees it.
 *
 * Without shell integration (`hello.integration === false`: bash, sh, any non-zsh shell) the bridge
 * emits neither OSC 133 markers nor `status` frames, so an accepted proposal would stay in flight
 * forever and every later `acceptProposal` would be refused. Fallback: the proposal completes when
 * output has been quiet for `FALLBACK_QUIET_MS`, with `exit_code: null`, `ms: null`,
 * `measured: false` — the honest values; nothing is inferred.
 */
import type { BridgeStatus } from '@/lib/ws/protocol';
import type { HelloFrame } from '@/lib/ws/client';
import { proposals as defaultStore, type ProposalStore, type ProposeOptions } from '../webmcp/proposals.ts';
import type { ResolvedProposal, TerminalAdapter } from '@/lib/webmcp/adapter';
import { stripAnsi } from '../webmcp/redact.ts';
import { PromptDetector } from './osc.ts';

export interface TermLike {
  buffer: {
    active: {
      length: number;
      cursorX: number;
      cursorY: number;
      baseY: number;
      getLine(y: number): { translateToString(trimRight?: boolean): string } | undefined;
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
  destroy(): void;
}

interface InFlight {
  id: string;
  command: string;
  edited: boolean;
  phase: 'sent' | 'running';
  tail: string[];
  partial: string;
  startedAt: number;
}

export const TAIL_MAX_LINES = 200;
/** No-integration fallback: a command counts as finished after this much output silence. */
export const FALLBACK_QUIET_MS = 750;

export function createTerminalAdapter(deps: { term: TermLike; client: ClientLike; share: () => boolean; store?: ProposalStore; quietMs?: number }): LiveTerminalAdapter {
  const store = deps.store ?? defaultStore;
  const detector = new PromptDetector();
  const quietMs = deps.quietMs ?? FALLBACK_QUIET_MS;
  let inflight: InFlight | null = null;
  let quietTimer: ReturnType<typeof setTimeout> | null = null;
  const results = new Map<string, ResolvedProposal>();
  const waiters = new Map<string, Set<(r: ResolvedProposal) => void>>();

  const integrated = () => deps.client.hello?.integration === true;

  const finish = (r: ResolvedProposal) => {
    if (quietTimer) clearTimeout(quietTimer);
    quietTimer = null;
    results.set(r.id, r);
    inflight = null;
    waiters.get(r.id)?.forEach((fn) => fn(r));
    waiters.delete(r.id);
  };

  const tailOf = (f: InFlight) => {
    const lines = f.partial ? [...f.tail, f.partial] : f.tail;
    return lines.filter((l, i, a) => !(i === a.length - 1 && l.trim() === '')).slice(-TAIL_MAX_LINES);
  };

  /** (Re)arm the quiescence timer — only used when the shell has no integration. */
  const armQuiet = () => {
    if (quietTimer) clearTimeout(quietTimer);
    quietTimer = setTimeout(() => {
      quietTimer = null;
      if (!inflight) return;
      const p = store.get(inflight.id);
      if (!p) return;
      finish({ ...p, status: 'accepted', exit_code: null, ms: null, measured: false, tail: tailOf(inflight), ...(inflight.edited ? { edited: true } : {}) });
    }, quietMs);
  };

  const offData = deps.client.on('data', (chunk) => {
    const events = detector.feed(chunk);
    if (inflight) {
      // capture output lines (ANSI stripped) for the tail
      const text = stripAnsi(inflight.partial + chunk).replace(/\r/g, '');
      const parts = text.split('\n');
      inflight.partial = parts.pop() ?? '';
      for (const line of parts) {
        if (inflight.tail.length < TAIL_MAX_LINES) inflight.tail.push(line);
      }
      for (const ev of events) if (ev.kind === 'start' && inflight.phase === 'sent') inflight.phase = 'running';
      if (!integrated()) armQuiet();
    }
  });

  const offStatus = deps.client.on('status', (st) => {
    if (!inflight || inflight.phase !== 'running' || st.running) return;
    const p = store.get(inflight.id);
    if (!p) return;
    finish({
      ...p,
      status: 'accepted',
      exit_code: st.last_exit_code,
      ms: st.last_command_ms,
      tail: tailOf(inflight),
      ...(inflight.edited ? { edited: true } : {}),
    });
  });

  const offState = deps.client.on('state', (s) => {
    if (s !== 'disconnected' && s !== 'closed') return;
    if (!inflight) return;
    const p = store.get(inflight.id);
    if (!p) return;
    finish({ ...p, status: 'accepted', exit_code: null, ms: null, tail: inflight.tail.slice(-TAIL_MAX_LINES), interrupted: true, ...(inflight.edited ? { edited: true } : {}) });
  });

  const adapter: LiveTerminalAdapter = {
    mode: 'builder',
    shareScreen: () => deps.share(),
    screenLines: (n) => {
      const b = deps.term.buffer.active;
      const out: string[] = [];
      let seenContent = false;
      for (let y = b.length - 1; y >= 0 && out.length < n; y--) {
        const s = b.getLine(y)?.translateToString(true) ?? '';
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
      if (inflight) return false; // one command in flight at a time
      if (!opts.alreadySent) {
        if (!deps.client.sendInput(p.command + '\r')) return false;
      }
      store.resolve(id, 'accepted', undefined, { edited: !!opts.edited });
      inflight = { id, command: p.command, edited: !!opts.edited, phase: 'sent', tail: [], partial: '', startedAt: performance.now() };
      if (!integrated()) {
        inflight.phase = 'running'; // no OSC 133;C will ever come
        armQuiet();
      }
      return true;
    },
    result: (id) => results.get(id),
    inFlight: () => inflight?.id ?? null,
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
