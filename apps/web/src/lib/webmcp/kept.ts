/**
 * Kept tools — a forged tool a viewer keeps survives a reload (COMPOSE-PLAN §3).
 *
 * Posture, on purpose: a kept entry is *data*, never a registration. Loading the store
 * NEVER calls `registerTool`; the restore card re-opens the approval card and the human
 * approves again. Every entry carries the spec's content hash; on restore the hash is
 * recomputed and a mismatch flags the entry `changed` so a tampered or drifted store can
 * never silently arm a tool. Pure helpers, unit-tested; `App.tsx` wires them to the engine.
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

/** A single stored entry that passes structural validation, or null. */
function parseEntry(raw: unknown): KeptTool | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<KeptTool>;
  if (validateForgeSpec(e.spec) !== null) return null;
  if (typeof e.hash !== 'string' || e.hash.length === 0) return null;
  if (typeof e.forged_at !== 'string' || e.forged_at.length === 0) return null;
  const out: KeptTool = {
    spec: e.spec as ForgeSpec,
    hash: e.hash,
    pinned: e.pinned === true,
    forged_at: e.forged_at,
  };
  if (typeof e.forged_by === 'string' && e.forged_by.length > 0) out.forged_by = e.forged_by;
  return out;
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
  const byName = new Map<string, KeptTool>();
  for (const raw of list) {
    const entry = parseEntry(raw);
    if (entry) byName.set(entry.spec.name, entry); // last wins on a duplicate name
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
    const forged_at = new Date(Number.isFinite(t.forgedAt) ? t.forgedAt : Date.now()).toISOString();
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
