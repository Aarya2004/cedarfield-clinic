/**
 * In-page proposal store for the Gate A build. No PTY attached yet: Enter marks a proposal
 * "accepted", Esc "dismissed". Every timestamp is `performance.now()` at the moment it happened.
 */
export type ProposalStatus = 'awaiting_human' | 'accepted' | 'dismissed';

export interface Proposal {
  id: string;
  command: string;
  why?: string;
  status: ProposalStatus;
  proposedAt: number;
  resolvedAt?: number;
}

type Listener = () => void;

class ProposalStore {
  private items: Proposal[] = [];
  private listeners = new Set<Listener>();
  private waiters = new Map<string, Set<(p: Proposal) => void>>();

  snapshot(): Proposal[] {
    return this.items;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  propose(command: string, why?: string): Proposal {
    const p: Proposal = {
      id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      command,
      why,
      status: 'awaiting_human',
      proposedAt: performance.now(),
    };
    this.items = [...this.items, p];
    this.emit();
    return p;
  }

  pending(): Proposal | undefined {
    return [...this.items].reverse().find((p) => p.status === 'awaiting_human');
  }

  resolve(id: string, status: 'accepted' | 'dismissed'): void {
    const p = this.items.find((x) => x.id === id);
    if (!p || p.status !== 'awaiting_human') return;
    const next = { ...p, status, resolvedAt: performance.now() };
    this.items = this.items.map((x) => (x.id === id ? next : x));
    this.emit();
    this.waiters.get(id)?.forEach((fn) => fn(next));
    this.waiters.delete(id);
  }

  /** Resolves with the proposal once it leaves awaiting_human, or null on timeout/abort. */
  wait(id: string, ms: number, signal?: AbortSignal): Promise<Proposal | null> {
    const existing = this.items.find((x) => x.id === id);
    if (!existing) return Promise.resolve(null);
    if (existing.status !== 'awaiting_human') return Promise.resolve(existing);
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
