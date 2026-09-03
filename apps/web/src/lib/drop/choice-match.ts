/**
 * Reading a person's answer to a bounded question (2026-09-03). The agent asked through the page
 * ("Hold 10:30 with Dr Lin?" — Hold it / Show another time); the person answers by button, by
 * voice, by the typed line, or by a hand shape whose phrase is "yes", "no", "the first one" or
 * "another one". This maps any of those sentences to a choice, or to "stop", or to nothing.
 * Pure, so every rule is unit-tested; the request queue calls it on every push while a question
 * is open.
 */
import { heardYes, tokens } from './word-challenge.ts';

export interface Choice {
  id: string;
  label: string;
}

export type ChoiceMatch = { kind: 'choice'; index: number } | { kind: 'stop' } | null;

/** Words that carry no meaning about WHICH choice. */
const STOPWORDS = new Set(['the', 'a', 'an', 'it', 'one', 'me', 'please', 'to', 'of', 'i', 'want', 'would', 'like', 'yes', 'no', 'that', 'this', 'option', 'go', 'with', 'for', 'ok', 'okay']);
const ORDINAL: Record<string, number> = { first: 0, second: 1, another: 1, other: 1, next: 1, third: 2 };
const NO = new Set(['no', 'nope', 'not']);

export function matchChoice(text: string, choices: readonly Choice[]): ChoiceMatch {
  if (choices.length === 0) return null;
  const t = tokens(text);
  // A bare digit has no letters: read it before the token check.
  const digit = /(?:^|\s)([1-3])(?:\s|$|[.,!?])/.exec(text);
  if (t.length === 0) return digit && Number(digit[1]) - 1 < choices.length ? { kind: 'choice', index: Number(digit[1]) - 1 } : null;
  if (t.includes('stop') || /never\s*mind/i.test(text)) return { kind: 'stop' };

  // 1. The label itself, or a distinctive word from it ("show another time" / "the later one").
  const scores = choices.map((c) => tokens(c.label).filter((w) => !STOPWORDS.has(w) && t.includes(w)).length);
  const best = Math.max(...scores);
  if (best > 0 && scores.filter((s) => s === best).length === 1) return { kind: 'choice', index: scores.indexOf(best) };

  // 2. An ordinal: "the first one", "another one", "the third".
  for (const w of t) {
    const i = ORDINAL[w];
    if (i !== undefined && i < choices.length) return { kind: 'choice', index: i };
  }
  if (t.includes('last')) return { kind: 'choice', index: choices.length - 1 };
  if (digit) {
    const i = Number(digit[1]) - 1;
    if (i < choices.length) return { kind: 'choice', index: i };
  }

  // 3. Yes / no — the first choice is the affirmative by convention; "no" means the second of two.
  if (heardYes(text)) return { kind: 'choice', index: 0 };
  if (t.some((w) => NO.has(w))) return choices.length === 2 ? { kind: 'choice', index: 1 } : null;
  return null;
}
