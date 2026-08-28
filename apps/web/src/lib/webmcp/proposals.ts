/**
 * Proposal store — every command the agent wants shown on the prompt line, in order.
 * `awaiting_human` = ghost-typed now; `queued` = a later step of a forged invocation, promoted
 * one at a time; `accepted` = the human pressed Enter; `dismissed` = Esc / cancelled.
 * Every timestamp is `performance.now()` at the moment it happened.
 */
export type ProposalStatus = 'queued' | 'awaiting_human' | 'accepted' | 'dismissed';
export type DismissReason = 'dismissed_by_human' | 'prior_step_failed' | 'step_timeout' | 'invocation_cancelled' | 'superseded';

export interface Proposal {
  id: string;
  command: string;
  why?: string;
  status: ProposalStatus;
  proposedAt: number;
  resolvedAt?: number;
  reason?: DismissReason;
  /** accepted after the human inserted the ghost text with Tab and possibly edited it */
  edited?: boolean;
  dangerous?: boolean;
  invocation_id?: string;
  step?: number;
}

export interface ProposeOptions {
  queued?: boolean;
  dangerous?: boolean;
  invocation_id?: string;
  step?: number;
}

type Listener = () => void;

export class ProposalStore {
  private items: Proposal[] = [];
  private listeners = new Set<Listener>();
  private waiters = new Map<string, Set<(p: Proposal) => void>>();

  snapshot(): Proposal[] {
    return this.items;
  }

  get(id: string): Proposal | undefined {
    return this.items.find((x) => x.id === id);
  }

  has(id: string): boolean {
    return this.items.some((x) => x.id === id);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  propose(command: string, why?: string, opts: ProposeOptions = {}): Proposal {
    const p: Proposal = {
      id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      command,
      why,
      status: opts.queued ? 'queued' : 'awaiting_human',
      proposedAt: performance.now(),
      ...(opts.dangerous ? { dangerous: true } : {}),
      ...(opts.invocation_id !== undefined ? { invocation_id: opts.invocation_id } : {}),
      ...(opts.step !== undefined ? { step: opts.step } : {}),
    };
    this.items = [...this.items, p];
    this.emit();
    return p;
  }

  /** The proposal currently ghost-typed (newest awaiting_human). Queued steps are not pending. */
  pending(): Proposal | undefined {
    return [...this.items].reverse().find((p) => p.status === 'awaiting_human');
  }

  /** queued → awaiting_human (ghost-type it now). No-op otherwise. */
  promote(id: string): Proposal | undefined {
    const p = this.get(id);
    if (!p || p.status !== 'queued') return p;
    const next: Proposal = { ...p, status: 'awaiting_human', proposedAt: performance.now() };
    this.items = this.items.map((x) => (x.id === id ? next : x));
    this.emit();
    return next;
  }

  resolve(id: string, status: 'accepted' | 'dismissed', reason?: DismissReason, opts: { edited?: boolean } = {}): void {
    const p = this.get(id);
    if (!p || (p.status !== 'awaiting_human' && p.status !== 'queued')) return;
    if (p.status === 'queued' && status === 'accepted') return; // a queued step cannot be accepted before it is shown
    const next: Proposal = {
      ...p,
      status,
      resolvedAt: performance.now(),
      ...(status === 'dismissed' ? { reason: reason ?? 'dismissed_by_human' } : {}),
      ...(status === 'accepted' && opts.edited ? { edited: true } : {}),
    };
    this.items = this.items.map((x) => (x.id === id ? next : x));
    this.emit();
    this.waiters.get(id)?.forEach((fn) => fn(next));
    this.waiters.delete(id);
  }

  /** Resolves with the proposal once it is accepted/dismissed, or null on timeout/abort/unknown id. */
  wait(id: string, ms: number, signal?: AbortSignal): Promise<Proposal | null> {
    const existing = this.get(id);
    if (!existing) return Promise.resolve(null);
    if (existing.status === 'accepted' || existing.status === 'dismissed') return Promise.resolve(existing);
    if (signal?.aborted) return Promise.resolve(null);
    return new Promise((resolve) => {
      const set = this.waiters.get(id) ?? new Set();
      const done = (p: Proposal | null) => {
        clearTimeout(timer);
        set.delete(done);
        signal?.removeEventListener('abort', onAbort);
        resolve(p);
      };
      const onAbort = () => done(null);
      const timer = setTimeout(() => done(null), ms);
      set.add(done);
      this.waiters.set(id, set);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const proposals = new ProposalStore();
