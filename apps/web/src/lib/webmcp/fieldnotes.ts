/**
 * Field notes: measured consumer behaviour (which consumer called what, when, how long a
 * blocking call was allowed to run before its AbortSignal fired). Every number here is measured
 * by this code — nothing synthetic. Mirrored to localStorage so it survives a reload.
 */
export interface FieldNote {
  t: string; // ISO timestamp
  event: string;
  detail?: Record<string, string | number | boolean | undefined>;
}

const KEY = 'rokan-terminal.fieldnotes.v0';
const listeners = new Set<() => void>();
let notes: FieldNote[] = [];

function load(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) notes = JSON.parse(raw) as FieldNote[];
  } catch {
    notes = [];
  }
}
load();

export function note(event: string, detail?: FieldNote['detail']): void {
  const n: FieldNote = { t: new Date().toISOString(), event, detail };
  notes = [...notes, n].slice(-200);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* private mode etc. — keep in memory only */
  }
  listeners.forEach((fn) => fn());
}

export function fieldNotes(): FieldNote[] {
  return notes;
}

export function subscribeFieldNotes(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearFieldNotes(): void {
  notes = [];
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}
