/**
 * The person's requests to the page, queued for whichever agent is listening (2026-09-02).
 *
 * WebMCP has no page → agent push: the agent calls tools, the page answers. So the page keeps a
 * queue of what the person said (browser speech recognition), signed (five canned hand shapes) or
 * typed, and one tool — `clinic_wait_for_request` — hands the next one to the agent, waiting up to a
 * minute for it. The agent loops: wait, act, wait. The person never touches the agent's window.
 *
 * Pure and small so it is unit-tested; the page owns exactly one instance.
 */
export type RequestVia = 'voice' | 'sign' | 'typed';

export interface PersonRequest {
  /** Wall-clock ms when the page heard it. */
  at: number;
  text: string;
  via: RequestVia;
}

export interface RequestQueue {
  push(text: string, via: RequestVia, at?: number): PersonRequest | null;
  /** The oldest request not yet handed over, removed from the queue; null if none. */
  take(): PersonRequest | null;
  /** Waits up to `timeoutMs` for a request; resolves null on timeout or abort. */
  wait(timeoutMs: number, signal?: AbortSignal): Promise<PersonRequest | null>;
  pending(): number;
  /** Every request ever pushed, newest first, capped — the panel shows the last few. */
  history(): readonly PersonRequest[];
  /** Fires on every push (the panel re-renders; the page announces). */
  subscribe(fn: (req: PersonRequest) => void): () => void;
}

const MAX_TEXT = 400;
const MAX_PENDING = 20;
const MAX_HISTORY = 12;

export function createRequestQueue(): RequestQueue {
  const pending: PersonRequest[] = [];
  const history: PersonRequest[] = [];
  const waiters: Array<(r: PersonRequest | null) => void> = [];
  const listeners = new Set<(req: PersonRequest) => void>();

  return {
    push(text, via, at = Date.now()) {
      const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
      if (clean === '') return null;
      const req: PersonRequest = { at, text: clean, via };
      history.unshift(req);
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      const waiter = waiters.shift();
      if (waiter) waiter(req);
      else {
        pending.push(req);
        if (pending.length > MAX_PENDING) pending.shift();
      }
      for (const fn of listeners) fn(req);
      return req;
    },
    take() {
      return pending.shift() ?? null;
    },
    wait(timeoutMs, signal) {
      const now = pending.shift();
      if (now) return Promise.resolve(now);
      if (signal?.aborted) return Promise.resolve(null);
      return new Promise((resolve) => {
        let done = false;
        const finish = (r: PersonRequest | null) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          const i = waiters.indexOf(finish);
          if (i >= 0) waiters.splice(i, 1);
          resolve(r);
        };
        const onAbort = () => finish(null);
        const timer = setTimeout(() => finish(null), Math.max(0, timeoutMs));
        signal?.addEventListener('abort', onAbort, { once: true });
        waiters.push(finish);
      });
    },
    pending: () => pending.length,
    history: () => history,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// The five hand shapes and what they mean live in sign-map.ts (per-person, editable).
