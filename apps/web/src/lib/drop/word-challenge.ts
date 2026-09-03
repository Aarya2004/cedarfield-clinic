/**
 * The spoken word (2026-09-03) — a third consent act beside the press and the palm, for a person
 * with no hands and no camera.
 *
 * Why not "yes"? Because an assistant can say "yes" too: the page's own voice agent speaks through
 * the speakers the microphone hears, and any text an agent reads may contain it. So the page asks
 * with a WORD SHOWN ON SCREEN ONLY — never spoken by the page, never handed to any tool, never in a
 * screen-reader line, new for every act. A text agent cannot speak; the voice agent cannot see the
 * screen (and "Listen for me" is off while it is live). The only thing that can say the word into
 * that microphone is the person looking at it. Same class as the palm: page-defined intent that no
 * agent can perform.
 */

/** Plain, two-syllable, unlike each other, and never a word a person might say by accident. */
export const CONFIRM_WORDS: readonly string[] = [
  'maple', 'river', 'candle', 'violet', 'harbor', 'meadow', 'pepper', 'saddle',
  'lantern', 'orchard', 'willow', 'copper', 'marble', 'falcon', 'garden', 'pebble',
];

/** Words the panel already means something by; a confirm word must never be one of them. */
const RESERVED = new Set(['yes', 'no', 'stop', 'book', 'cancel', 'move', 'confirm']);

export function pickWord(random: () => number = Math.random, not?: string): string {
  const pool = CONFIRM_WORDS.filter((w) => w !== not && !RESERVED.has(w));
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
}

/** Letters only, lower-cased, split on everything else. "Maple." → ["maple"]. */
export function tokens(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/['’]/g, '') // "don't" → "dont", so a contraction still reads as one word
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Did the person say the word? Whole-token match, anywhere in the sentence. */
export function heardWord(transcript: string, word: string): boolean {
  const w = word.toLowerCase();
  return tokens(transcript).includes(w);
}

const YES = new Set(['yes', 'yeah', 'yep', 'yup']);
const NEGATION = new Set(['no', 'not', 'dont', 'never', 'nope', 'cancel', 'stop', 'wait']);

/**
 * A plain "yes" answers the question the PAGE asked (2026-09-03, Arav: "saying yes is fine").
 * It counts only because the page controls the other voices: its own speech is ignored while it
 * talks, its voice agent is off while "Listen for me" is on, and a text agent cannot make sound.
 * "No, not yes", "yes, wait" and "yes, stop" are refused: any negation in the sentence wins.
 */
export function heardYes(transcript: string): boolean {
  const t = tokens(transcript);
  if (t.some((x) => NEGATION.has(x))) return false;
  return t.some((x) => YES.has(x));
}

/** Either road confirms: the word on screen, or a clean "yes". */
export function heardConfirm(transcript: string, word: string): boolean {
  return heardWord(transcript, word) || heardYes(transcript);
}
