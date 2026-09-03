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
import { matchChoice, type Choice } from './choice-match.ts';

export type RequestVia = 'voice' | 'sign' | 'typed';

/** One bounded question from the agent, on the page, waiting for the person (2026-09-03). */
export interface Question {
  at: number;
  question: string;
  choices: readonly Choice[];
}

export interface Answer {
  at: number;
  index: number;
  choice: Choice;
  /** How the person answered: a button/key on the card, or the same three roads as a request. */
  via: RequestVia | 'button';
}

export interface AskResult {
  answer: Answer | null;
  /** The person said stop (or the panel's Stop): end the conversation. */
  stopped: boolean;
}

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
  /**
   * Fires on every push (with the request) and on every hand-over to an agent (with null), so a
   * panel showing "N waiting" is right the instant the agent takes one — never a second later.
   */
  subscribe(fn: (req: PersonRequest | null) => void): () => void;
  /**
   * Puts one question with 2–3 choices in front of the person and waits. A sentence pushed meanwhile
   * that reads as an answer resolves it (and is never queued as a request); "stop" ends it; anything
   * else queues as usual. A second ask supersedes the first (which resolves with no answer).
   */
  ask(question: string, choices: readonly Choice[], timeoutMs: number, signal?: AbortSignal): Promise<AskResult>;
  /** The open question, if any — the panel renders it. */
  question(): Question | null;
  /** The person picked a choice on the card itself (button, key, switch). False if nothing was open. */
  answer(index: number): boolean;
}

const MAX_TEXT = 400;
const MAX_PENDING = 20;
const MAX_HISTORY = 12;
/** How far back a pending request may be read as the answer to a question that opens after it. */
const EARLY_ANSWER_MS = 20_000;

export function createRequestQueue(): RequestQueue {
  const pending: PersonRequest[] = [];
  const history: PersonRequest[] = [];
  const waiters: Array<(r: PersonRequest | null) => void> = [];
  const listeners = new Set<(req: PersonRequest | null) => void>();
  const taken = () => {
    for (const fn of listeners) fn(null);
  };
  let open: { q: Question; resolve: (r: AskResult) => void } | null = null;
  const settle = (r: AskResult) => {
    const o = open;
    if (o === null) return;
    open = null;
    o.resolve(r);
    for (const fn of listeners) fn(null);
  };

  return {
    push(text, via, at = Date.now()) {
      const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
      if (clean === '') return null;
      const req: PersonRequest = { at, text: clean, via };
      history.unshift(req);
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      // An open question reads the sentence first: an answer resolves it and is never a request.
      if (open !== null) {
        const m = matchChoice(clean, open.q.choices);
        if (m !== null) {
          for (const fn of listeners) fn(req);
          if (m.kind === 'stop') settle({ answer: null, stopped: true });
          else settle({ answer: { at, index: m.index, choice: open.q.choices[m.index]!, via }, stopped: false });
          return req;
        }
      }
      const waiter = waiters.shift();
      if (waiter) waiter(req); // straight to the agent already waiting: never counted as pending
      else {
        pending.push(req);
        if (pending.length > MAX_PENDING) pending.shift();
      }
      for (const fn of listeners) fn(req);
      return req;
    },
    take() {
      const r = pending.shift() ?? null;
      if (r) taken();
      return r;
    },
    wait(timeoutMs, signal) {
      const now = pending.shift();
      if (now) {
        taken();
        return Promise.resolve(now);
      }
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
    ask(question, choices, timeoutMs, signal) {
      settle({ answer: null, stopped: false }); // a newer question supersedes an older one
      if (signal?.aborted) return Promise.resolve({ answer: null, stopped: false });
      const q: Question = { at: Date.now(), question, choices: choices.slice(0, 3) };
      // A person often answers before the agent's call lands — the agent said the question in its
      // chat, they typed "the first one", then the tool opened (Codex re-audit 2026-09-03). A pending
      // request from the last EARLY_ANSWER_MS that reads as a choice is that answer, not a request.
      const cutoff = q.at - EARLY_ANSWER_MS;
      for (let i = 0; i < pending.length; i++) {
        const r = pending[i]!;
        if (r.at < cutoff) continue;
        const m = matchChoice(r.text, q.choices);
        if (m === null) continue;
        pending.splice(i, 1);
        taken();
        if (m.kind === 'stop') return Promise.resolve({ answer: null, stopped: true });
        return Promise.resolve({ answer: { at: r.at, index: m.index, choice: q.choices[m.index]!, via: r.via }, stopped: false });
      }
      return new Promise<AskResult>((resolve) => {
        const timer = setTimeout(() => settle({ answer: null, stopped: false }), Math.max(0, timeoutMs));
        const onAbort = () => settle({ answer: null, stopped: false });
        signal?.addEventListener('abort', onAbort, { once: true });
        open = {
          q,
          resolve: (r) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            resolve(r);
          },
        };
        for (const fn of listeners) fn(null);
      });
    },
    question: () => open?.q ?? null,
    answer(index) {
      if (open === null || index < 0 || index >= open.q.choices.length) return false;
      const choice = open.q.choices[index]!;
      const at = Date.now();
      history.unshift({ at, text: choice.label, via: 'typed' });
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      settle({ answer: { at, index, choice, via: 'button' }, stopped: false });
      return true;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// The five hand shapes and what they mean live in sign-map.ts (per-person, editable).
