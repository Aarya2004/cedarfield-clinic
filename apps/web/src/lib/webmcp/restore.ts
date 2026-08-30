/**
 * Kept-tools restore: the decision logic behind `RestoreCard.tsx`, kept out of the component so
 * the node test runner (which cannot resolve `@/…` imports) can drive every branch.
 *
 * Two halves, both pure of React:
 *
 *  - **the write path** (`createKeptWriter`) — subscribed to the forge, it mirrors the live tools
 *    into `rokan.kept.v1` on every engine change. It also *retains* the entries loaded at page load
 *    that this page has never seen live, so the very first `emit()` of a session (tools() is empty
 *    then — a card opening is an emit) cannot erase a store the human has not restored yet. A name
 *    that HAS been live this session is never retained again: restore-then-unforge means forgotten,
 *    not resurrected.
 *  - **the restore path** (`restoreKept`) — sequential `openCard` → `approve` per selected entry,
 *    the same approval path the Forge card uses. It never passes `confirmDangerous`: a kept spec
 *    that trips a hard-blocked pattern comes back as `needs_confirmation` and its card stays in the
 *    Forge pane for the human to approve there, deliberately, a second time.
 *
 * The engine stamps `ForgedTool.forgedAt` with `performance.now()` (a monotonic clock, not a wall
 * clock), so the mapper adds `performance.timeOrigin` before handing epoch ms to `keptFromTools`.
 * Without that every stored `forged_at` reads 1970 — a number on screen that nothing measured.
 */
import { keptFromTools, type KeptTool, type VerifiedKept } from './kept.ts';
import type { ForgeError, ForgeSpec } from './forge-spec.ts';

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** The fields of the engine's `ForgedTool` the kept store reads. */
export interface ForgedLike {
  name: string;
  spec: ForgeSpec;
  hash: string;
  pinned: boolean;
  /** `performance.now()` at registration — monotonic, NOT epoch ms. */
  forgedAt: number;
  forged_by?: string;
}

/**
 * Live tools as kept entries, with `forgedAt` moved from the monotonic clock onto the wall clock.
 * `timeOrigin` is `performance.timeOrigin` in the browser; tests pass their own.
 */
export function keptEntriesFor(tools: readonly ForgedLike[], timeOrigin: number): KeptTool[] {
  const origin = Number.isFinite(timeOrigin) ? timeOrigin : 0;
  return keptFromTools(tools.map((t) => ({ ...t, forgedAt: origin + t.forgedAt })));
}

/** Kept entries whose tool is not registered right now — the ones a restore card can offer. */
export function pendingKept(kept: readonly KeptTool[], live: readonly { name: string }[]): KeptTool[] {
  const names = new Set(live.map((t) => t.name));
  return kept.filter((k) => !names.has(k.spec.name));
}

export interface KeptWriter {
  /** Mirror the current tools into the store. Idempotent: an unchanged list writes nothing. */
  write(): void;
  /** Entries loaded at page load that have never been live in this session. */
  retained(): KeptTool[];
}

export interface KeptWriterDeps {
  storage: StorageLike | null;
  tools: () => readonly ForgedLike[];
  /** Entries read from the store at page load (`loadKept`), retained until restored or unforged. */
  loaded?: readonly KeptTool[];
  timeOrigin?: number;
  persist: (storage: StorageLike | null, tools: readonly KeptTool[]) => void;
}

/**
 * The forge → store mirror. Call `write()` from the `forge.subscribe` handler; every approve, pin,
 * unforge and restore goes through the engine's `emit()`, so one subscription covers them all.
 */
export function createKeptWriter(deps: KeptWriterDeps): KeptWriter {
  const loaded = deps.loaded ?? [];
  const everLive = new Set<string>();
  let last: string | null = null;
  const retained = () => loaded.filter((k) => !everLive.has(k.spec.name));
  return {
    retained,
    write() {
      const live = deps.tools();
      for (const t of live) everLive.add(t.name);
      // Live first: `persistKept` keeps the first entry per name, so a restored tool's current
      // hash wins over the stale copy the store was loaded with.
      const entries = [...keptEntriesFor(live, deps.timeOrigin ?? 0), ...retained()];
      const key = JSON.stringify(entries.map((e) => [e.spec.name, e.hash, e.pinned, e.forged_at, e.forged_by ?? '']));
      if (key === last) return;
      last = key;
      deps.persist(deps.storage, entries);
    },
  };
}

/** What happened to one entry in a restore batch. */
export type RestoreStatus = 'restored' | 'needs_card' | 'failed';

export interface RestoreOutcome {
  name: string;
  status: RestoreStatus;
  hash?: string;
  error?: string;
  detail?: string;
}

/** The slice of the forge engine a restore needs (so tests can drive it without a browser). */
export interface RestoreEngine {
  openCard(spec: unknown, opts: { origin: 'agent' | 'human' }): { card_id: string } | ForgeError;
  approve(card_id: string): Promise<{ hash: string } | ForgeError>;
}

export interface RestoreDeps {
  engine: RestoreEngine;
  /** Appended once per entry that came back registered; `restored` is in `CLIENT_LEDGER_KINDS`. */
  ledger?: { append(kind: 'restored', fields: Record<string, string | number | boolean | null>): unknown };
}

/**
 * Restore each entry through the ordinary approval path, one at a time — the engine allows a single
 * pending invocation and caps pending cards, and a batch that opened five cards at once would bury
 * the human under them. Never throws: a rejected card or a failed registration is an outcome row.
 */
export async function restoreKept(entries: readonly KeptTool[], deps: RestoreDeps): Promise<RestoreOutcome[]> {
  const out: RestoreOutcome[] = [];
  for (const entry of entries) {
    const name = entry.spec.name;
    let card: { card_id: string } | ForgeError;
    try {
      card = deps.engine.openCard(entry.spec, { origin: 'human' });
    } catch (e) {
      out.push({ name, status: 'failed', error: 'unsupported', detail: e instanceof Error ? e.message : String(e) });
      continue;
    }
    if ('error' in card) {
      out.push({ name, status: 'failed', error: card.error, ...(card.detail ? { detail: card.detail } : {}) });
      continue;
    }
    let res: { hash: string } | ForgeError;
    try {
      res = await deps.engine.approve(card.card_id);
    } catch (e) {
      out.push({ name, status: 'failed', error: 'unsupported', detail: e instanceof Error ? e.message : String(e) });
      continue;
    }
    if ('error' in res) {
      // `needs_confirmation` leaves the card open in the Forge pane on purpose: a kept spec that
      // matches a hard-blocked pattern is confirmed there, by hand, never by this batch.
      out.push({
        name,
        status: res.error === 'needs_confirmation' ? 'needs_card' : 'failed',
        error: res.error,
        ...(res.detail ? { detail: res.detail } : {}),
      });
      continue;
    }
    out.push({ name, status: 'restored', hash: res.hash });
    try {
      deps.ledger?.append('restored', { name, tool: `forged_${name}`, hash: res.hash, source: 'kept', drifted: res.hash !== entry.hash });
    } catch {
      /* a ledger that cannot append must never abort the batch */
    }
  }
  return out;
}

/** The one line the restore card says after a batch, in the words the buttons used. */
export function restoreSummary(out: readonly RestoreOutcome[]): string {
  const restored = out.filter((o) => o.status === 'restored').length;
  const cards = out.filter((o) => o.status === 'needs_card').length;
  const failed = out.filter((o) => o.status === 'failed');
  const parts: string[] = [`${restored} restored`];
  if (cards) parts.push(`${cards} waiting in Forge — approve there to confirm`);
  for (const f of failed) parts.push(`${f.name} failed: ${f.detail ?? f.error}`);
  return parts.join(' · ');
}

/** A row the card paints: identity first (that is what the human is approving), drift second. */
export interface RestoreRow {
  name: string;
  tool: string;
  hash: string;
  changed: boolean;
}

/** Drifted entries first — they are the ones that need reading before Approve. */
export function restoreRows(verified: readonly VerifiedKept[]): RestoreRow[] {
  return [...verified]
    .sort((a, b) => Number(b.changed) - Number(a.changed))
    .map((v) => ({ name: v.entry.spec.name, tool: `forged_${v.entry.spec.name}`, hash: v.entry.hash, changed: v.changed }));
}
