/**
 * Where a spoken sentence goes first (2026-09-03). While a confirm word is on screen, the
 * recognizer's final sentences are checked for it before they reach the request queue; the sentence
 * that carries the word performs the act and is never queued. Anything else flows to the queue as
 * usual. One challenge at a time, page-wide: the docks and the grant card are never armed together.
 */
import { heardConfirm, heardWord } from './word-challenge.ts';

let challenge: { word: string; onHeard: () => void; acceptYes: boolean } | null = null;

/** `acceptYes`: only when the PAGE asked a question (a dock). A standing offer (the grant) takes the word alone. */
export function setWordChallenge(word: string, onHeard: () => void, acceptYes: boolean): void {
  challenge = { word, onHeard, acceptYes };
}

export function clearWordChallenge(word: string): void {
  if (challenge?.word === word) challenge = null;
}

export function activeWord(): string | null {
  return challenge?.word ?? null;
}

/** True when the sentence carried the word or a clean yes (the act fired; do not queue it). */
export function routeTranscript(text: string): boolean {
  if (challenge === null) return false;
  const heard = challenge.acceptYes ? heardConfirm(text, challenge.word) : heardWord(text, challenge.word);
  if (!heard) return false;
  const c = challenge;
  challenge = null; // one act per word; a repeat is a new word
  c.onHeard();
  return true;
}
