/**
 * Kept tools — a forged tool a viewer keeps survives a reload (COMPOSE-PLAN §3).
 *
 * Posture, on purpose: a kept entry is *data*, never a registration. Loading the store
 * NEVER calls `registerTool`; the restore card re-opens the approval card and the human
 * approves again — that approval gate, not the hash, is the guarantee that nothing arms
 * itself. Every entry carries the spec's content hash; on restore the hash is recomputed
 * and a mismatch flags the entry `changed`. The hash is a *drift signal* (spec edited but
 * hash stale, or engine version drift), not a tamper boundary: the store is same-origin and
 * the hash is deterministic, so anyone able to write it could recompute a matching hash.
 * Never treat `changed:false` as "safe to register" — restore always re-approves.
 * Pure helpers, unit-tested; `App.tsx` wires them to the engine.
 *
 * Mirrors `terminal/judge-resume.ts`: a `StorageLike` seam, field-by-field validation,
 * every access wrapped so a private-mode / blocked / throwing `localStorage` degrades to
 * "nothing kept" rather than crashing the page.
 */
import { validateForgeSpec, type ForgeSpec } from './forge-spec.ts';

export const KEPT_KEY = 'rokan.kept.v1';
/** The ≤ 12 picker budget leaves room for the six fixed tools; keep at most this many. */
export const KEPT_CAP = 20;

export interface KeptTool {
  spec: ForgeSpec;
  /** the content hash computed by the engine at forge time (`forge.hashOf`). */
  hash: string;
  pinned: boolean;
  /** ISO instant the tool was forged. */
  forged_at: string;
  /** identity that approved it, when known (display only). */
  forged_by?: string;
}

interface KeptStore {
  v: 1;
  tools: KeptTool[];
}

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Length bounds — reject the absurd rather than store it. A sha-256 hex hash is 64 chars; an ISO instant is 24. */
const HASH_MAX = 128;
const FORGED_AT_MAX = 40;
const FORGED_BY_MAX = 64;
/** The largest `Date`-representable epoch-ms magnitude; `new Date(x).toISOString()` throws past it. */
const MAX_EPOCH_MS = 8_640_000_000_000_000;

/**
 * A single stored entry that passes structural validation, or null. Wrapped so that even a
 * future validator change (or a hostile object with throwing getters) can never crash the
 * load path — the caller's no-throw guarantee does not depend on `validateForgeSpec` staying total.
 */
function parseEntry(raw: unknown): KeptTool | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const e = raw as Partial<KeptTool>;
    if (validateForgeSpec(e.spec) !== null) return null;
    if (typeof e.hash !== 'string' || e.hash.length === 0 || e.hash.length > HASH_MAX) return null;
    if (typeof e.forged_at !== 'string' || e.forged_at.length === 0 || e.forged_at.length > FORGED_AT_MAX) return null;
    const out: KeptTool = {
      spec: e.spec as ForgeSpec,
      hash: e.hash,
      pinned: e.pinned === true,
      forged_at: e.forged_at,
    };
    if (typeof e.forged_by === 'string' && e.forged_by.length > 0 && e.forged_by.length <= FORGED_BY_MAX)
      out.forged_by = e.forged_by;
    return out;
  } catch {
    return null; // defense-in-depth: a bad entry is skipped, never thrown
  }
}

/**
 * The kept tools that survive structural validation, de-duplicated by tool name (last wins),
 * capped at {@link KEPT_CAP}. A corrupt store, a missing store, or a throwing `localStorage`
 * yields `[]` — never a throw. Loading NEVER registers anything.
 */
export function loadKept(storage: StorageLike | null): KeptTool[] {
  if (!storage) return [];
  let parsed: unknown;
  try {
    const raw = storage.getItem(KEPT_KEY);
    if (!raw) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const list = (parsed as Partial<KeptStore>).tools;
  if (!Array.isArray(list)) return [];
  // Bound the validation work a hostile/corrupt store can force on the page-load path:
  // scan at most MAX_SCAN entries and stop once KEPT_CAP unique names are collected.
  const MAX_SCAN = KEPT_CAP * 10;
  const byName = new Map<string, KeptTool>();
  for (let i = 0; i < list.length && i < MAX_SCAN; i++) {
    const entry = parseEntry(list[i]);
    if (!entry) continue;
    byName.set(entry.spec.name, entry); // last wins within the scanned window
    if (byName.size >= KEPT_CAP) break;
  }
  return [...byName.values()].slice(0, KEPT_CAP);
}

/**
 * Persist the given kept tools (validated + capped). A throwing `localStorage` is swallowed —
 * kept tools are a convenience, never a correctness dependency. An empty list clears the store.
 */
export function persistKept(storage: StorageLike | null, tools: readonly KeptTool[]): void {
  if (!storage) return;
  const clean: KeptTool[] = [];
  const seen = new Set<string>();
  for (const t of tools) {
    const entry = parseEntry(t);
    if (!entry || seen.has(entry.spec.name)) continue;
    seen.add(entry.spec.name);
    clean.push(entry);
    if (clean.length >= KEPT_CAP) break;
  }
  try {
    if (clean.length === 0) storage.removeItem(KEPT_KEY);
    else storage.setItem(KEPT_KEY, JSON.stringify({ v: 1, tools: clean } satisfies KeptStore));
  } catch {
    /* storage unavailable — kept tools are best-effort */
  }
}

export interface VerifiedKept {
  entry: KeptTool;
  /** true when the spec no longer hashes to the stored hash — the entry must be re-approved, never auto-registered. */
  changed: boolean;
}

/**
 * Recompute each spec's content hash with the engine's `hashOf` and flag a mismatch `changed`.
 * The restore card shows `changed` entries as needing a fresh look; it registers none of them
 * without the human's approval either way — this only surfaces which specs drifted since forging.
 * A `hashOf` that rejects a spec (throws) marks the entry `changed` (fail closed).
 */
export async function verifyKeptHashes(
  entries: readonly KeptTool[],
  hashOf: (spec: ForgeSpec) => Promise<string>,
): Promise<VerifiedKept[]> {
  return Promise.all(
    entries.map(async (entry) => {
      try {
        const current = await hashOf(entry.spec);
        return { entry, changed: current !== entry.hash };
      } catch {
        return { entry, changed: true };
      }
    }),
  );
}

/** The minimal shape of an engine `ForgedTool` this mapper reads. */
interface ForgedLike {
  spec: ForgeSpec;
  hash: string;
  pinned: boolean;
  /** epoch ms (the engine's `forgedAt`). */
  forgedAt: number;
  forged_by?: string;
}

/**
 * Map the engine's live tools (`forge.tools()`) to kept entries — the write path is then
 * `persistKept(storage, keptFromTools(forge.tools()))`. Converts the engine's epoch-ms `forgedAt`
 * to the stored ISO `forged_at`; a non-finite timestamp falls back to now, never `Invalid Date`.
 */
export function keptFromTools(tools: readonly ForgedLike[]): KeptTool[] {
  return tools.map((t) => {
    // Finite-but-out-of-range timestamps (past ±8.64e15 ms) make `new Date(x).toISOString()` throw,
    // so bound the magnitude too — never `Invalid Date`, never a RangeError.
    const ms = Number.isFinite(t.forgedAt) && Math.abs(t.forgedAt) <= MAX_EPOCH_MS ? t.forgedAt : Date.now();
    const forged_at = new Date(ms).toISOString();
    const entry: KeptTool = { spec: t.spec, hash: t.hash, pinned: t.pinned === true, forged_at };
    if (typeof t.forged_by === 'string' && t.forged_by.length > 0) entry.forged_by = t.forged_by;
    return entry;
  });
}

export function clearKept(storage: StorageLike | null): void {
  try {
    storage?.removeItem(KEPT_KEY);
  } catch {
    /* ignore */
  }
}
