/**
 * The phrase board (2026-09-03): what most AAC boards actually are — a few ready sentences a person
 * selects with one press instead of composing. Each press hands the sentence to the agent through
 * the same queue as speech, the typed line and the hand shapes. Pure, so it is unit-tested; the
 * panel only renders it.
 */
export const DEFAULT_PHRASES: readonly string[] = [
  'hold me the earliest appointment',
  'show me afternoon times',
  'show me another time',
  'say that more simply',
  'the first one',
  'yes',
  'no',
  'stop',
];

export const PHRASES_KEY = 'cedarfield.phrases';
const MAX_PHRASES = 12;
const MAX_LENGTH = 120;

export function cleanPhrases(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PHRASES];
  const out: string[] = [];
  for (const p of raw) {
    if (typeof p !== 'string') continue;
    const s = p.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH);
    if (s !== '' && !out.includes(s)) out.push(s);
    if (out.length === MAX_PHRASES) break;
  }
  return out.length > 0 ? out : [...DEFAULT_PHRASES];
}

interface StoreLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function loadPhrases(store: StoreLike | null | undefined): string[] {
  if (!store) return [...DEFAULT_PHRASES];
  try {
    const raw = store.getItem(PHRASES_KEY);
    return raw === null ? [...DEFAULT_PHRASES] : cleanPhrases(JSON.parse(raw));
  } catch {
    return [...DEFAULT_PHRASES];
  }
}

/** Saves the person's own board; the defaults are never written (a reset is a removal). */
export function savePhrases(store: StoreLike | null | undefined, phrases: readonly string[]): string[] {
  const clean = cleanPhrases(phrases);
  if (!store) return clean;
  try {
    if (clean.join('\n') === DEFAULT_PHRASES.join('\n')) store.removeItem(PHRASES_KEY);
    else store.setItem(PHRASES_KEY, JSON.stringify(clean));
  } catch {
    /* storage refused: the board still works for this visit */
  }
  return clean;
}
