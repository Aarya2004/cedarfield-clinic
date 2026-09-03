/**
 * The five hand shapes the camera can read, and what each one means TO THIS PERSON (2026-09-02).
 *
 * MediaPipe's canned recognizer knows seven shapes; the open palm is the act, so five are left for
 * words. The defaults are short answers. A person can assign whole requests instead — thumbs up =
 * "hold me the earliest appointment", two fingers = "cancel my appointment" — and then drive the
 * assistant with two shapes and a palm. Kept per browser, never sent anywhere. Not a language, and
 * the page says so; it is a keyboard with five keys the person labels themselves.
 */
export interface SignShape {
  category: 'Thumb_Up' | 'Thumb_Down' | 'Closed_Fist' | 'Pointing_Up' | 'Victory';
  glyph: string;
  label: string;
}

export const SIGN_SHAPES: readonly SignShape[] = [
  { category: 'Thumb_Up', glyph: '👍', label: 'thumbs up' },
  { category: 'Thumb_Down', glyph: '👎', label: 'thumbs down' },
  { category: 'Closed_Fist', glyph: '✊', label: 'a fist' },
  { category: 'Pointing_Up', glyph: '☝️', label: 'one finger up' },
  { category: 'Victory', glyph: '✌️', label: 'two fingers' },
];

export type SignMap = Record<SignShape['category'], string>;

export const DEFAULT_SIGN_MAP: SignMap = {
  Thumb_Up: 'yes',
  Thumb_Down: 'no',
  Closed_Fist: 'stop',
  Pointing_Up: 'the first one',
  Victory: 'another one',
};

export const SIGN_PHRASE_MAX = 120;
const KEY = 'cedarfield.signs';

interface StoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The person's map, or the defaults; unknown or oversized entries fall back per shape. */
export function loadSignMap(store: StoreLike | null | undefined): SignMap {
  const map: SignMap = { ...DEFAULT_SIGN_MAP };
  if (!store) return map;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    for (const shape of SIGN_SHAPES) {
      const v = parsed[shape.category];
      if (typeof v === 'string') map[shape.category] = cleanPhrase(v);
    }
  } catch {
    /* a broken record is the defaults */
  }
  return map;
}

export function saveSignMap(store: StoreLike | null | undefined, map: SignMap): void {
  if (!store) return;
  try {
    const cleaned: SignMap = { ...DEFAULT_SIGN_MAP };
    for (const shape of SIGN_SHAPES) cleaned[shape.category] = cleanPhrase(map[shape.category]);
    if (SIGN_SHAPES.every((s) => cleaned[s.category] === DEFAULT_SIGN_MAP[s.category])) store.removeItem(KEY);
    else store.setItem(KEY, JSON.stringify(cleaned));
  } catch {
    /* private mode: this session keeps the map in memory */
  }
}

export function cleanPhrase(v: string): string {
  return v.replace(/\s+/g, ' ').trim().slice(0, SIGN_PHRASE_MAX);
}

/** What a recognised category means now — null for an unmapped category or an emptied phrase. */
export function phraseFor(category: string, map: SignMap): string | null {
  if (!(category in map)) return null;
  const phrase = map[category as SignShape['category']];
  return phrase === '' ? null : phrase;
}
