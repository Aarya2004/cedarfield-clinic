/**
 * Switch scanning — how a person with one or two switches types (2026-09-02).
 *
 * The standard AAC method: the keyboard highlights one ROW at a time; a "select" picks the row;
 * it then highlights one KEY at a time; a "select" types it. "Back" steps out (or deletes when
 * nothing is being scanned). Two inputs, the whole alphabet. Here the inputs are two hand shapes
 * the camera reads (thumbs up = select, fist = back), a hardware switch, or Space / Escape.
 *
 * Pure: every transition is a function of state, so it is unit-tested; the component only renders
 * it and feeds ticks and presses.
 */
export const SCAN_ROWS: readonly (readonly string[])[] = [
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ['h', 'i', 'j', 'k', 'l', 'm', 'n'],
  ['o', 'p', 'q', 'r', 's', 't', 'u'],
  ['v', 'w', 'x', 'y', 'z', 'space', 'delete'],
  ['0', '1', '2', '3', '4', '5', '6'],
  ['7', '8', '9', '/', '-', '+', 'done'],
];

export interface ScanState {
  /** Which row the sweep is on. */
  row: number;
  /** Which key inside the chosen row, or null while rows are being swept. */
  key: number | null;
  /** What has been typed so far. */
  text: string;
  /** Set once "done" is selected; the host reads `text` and closes the keyboard. */
  done: boolean;
}

export function initialScan(text = ''): ScanState {
  return { row: 0, key: null, text, done: false };
}

/** The sweep advances: next row, or next key within the chosen row. Wraps. */
export function tick(s: ScanState): ScanState {
  if (s.done) return s;
  if (s.key === null) return { ...s, row: (s.row + 1) % SCAN_ROWS.length };
  return { ...s, key: (s.key + 1) % SCAN_ROWS[s.row]!.length };
}

/** "Select": pick the highlighted row, or type the highlighted key. */
export function select(s: ScanState): ScanState {
  if (s.done) return s;
  if (s.key === null) return { ...s, key: 0 };
  const k = SCAN_ROWS[s.row]![s.key]!;
  if (k === 'done') return { ...s, done: true, key: null };
  if (k === 'delete') return { ...s, text: s.text.slice(0, -1), key: null, row: 0 };
  const ch = k === 'space' ? ' ' : k;
  // After a key, the sweep returns to the rows so the next letter starts fresh.
  return { ...s, text: s.text + ch, key: null, row: 0 };
}

/** "Back": leave the row sweep, or, while sweeping rows, delete the last character. */
export function back(s: ScanState): ScanState {
  if (s.done) return s;
  if (s.key !== null) return { ...s, key: null };
  return { ...s, text: s.text.slice(0, -1) };
}

/** What is highlighted right now, in words a screen reader can say. */
export function highlightLabel(s: ScanState): string {
  if (s.done) return 'Done.';
  if (s.key === null) {
    const r = SCAN_ROWS[s.row]!;
    return `Row: ${r.map(keyLabel).join(', ')}`;
  }
  return keyLabel(SCAN_ROWS[s.row]![s.key]!);
}

export function keyLabel(k: string): string {
  if (k === 'space') return 'space';
  if (k === 'delete') return 'delete';
  if (k === 'done') return 'done';
  return k;
}

/** The two switch actions, from the camera's shape names or a key. Null for anything else. */
export function switchAction(input: string): 'select' | 'back' | null {
  switch (input) {
    case 'Thumb_Up':
    case ' ':
    case 'Space':
    case 'Enter':
      return 'select';
    case 'Closed_Fist':
    case 'Escape':
    case 'Backspace':
      return 'back';
    default:
      return null;
  }
}
