'use client';

/**
 * "Say yes, or the word on screen" (2026-09-03): the consent act for a person with no hands and no camera.
 * The page shows a word it never speaks and never hands to a tool; saying it while "Listen for me"
 * is on performs the act — book, cancel, move, or the one grant. A screen reader is told the word is
 * visual only (aria-hidden), so no machine on the desk can voice it into the microphone.
 */
import { useEffect, useRef, useState } from 'react';
import type { GestureVerb } from '../../lib/drop/gesture-logic.ts';
import { pickWord } from '../../lib/drop/word-challenge.ts';
import { clearWordChallenge, setWordChallenge } from '../../lib/drop/word-sink.ts';

export interface SpokenWordProps {
  verb: GestureVerb;
  /** Is there a live act to confirm? An idle surface shows no word. */
  armed: boolean;
  /** The page's recognizer ("Listen for me") is running, so the word can be heard right now. */
  listening: boolean;
  /** The same callback the keycap and the palm fire. */
  onConfirm: () => void;
  /**
   * A plain "yes" counts only where the page asked a question (the docks). The grant card is a
   * standing offer, not a question, so a stray "yes" must not hand an assistant a booking: word only.
   */
  acceptYes?: boolean;
}

const ACT: Record<GestureVerb, string> = {
  book: 'book it',
  cancel: 'cancel it',
  move: 'move it',
  grant: 'let your assistant book once',
  sign: '',
};

export function SpokenWord({ verb, armed, listening, onConfirm, acceptYes = true }: SpokenWordProps) {
  // Picked on the client only: a random word in the server render would never match the client's (hydration).
  const [word, setWord] = useState('');
  const [heard, setHeard] = useState(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  // A fresh word every time something new is armed; the old one is worthless after its act.
  useEffect(() => {
    if (!armed) return;
    setHeard(false);
    setWord((w) => pickWord(Math.random, w === '' ? undefined : w));
  }, [armed]);

  useEffect(() => {
    if (!armed || word === '') return;
    setWordChallenge(
      word,
      () => {
        setHeard(true);
        onConfirmRef.current();
      },
      acceptYes,
    );
    return () => clearWordChallenge(word);
  }, [armed, word, acceptYes]);

  if (!armed || verb === 'sign' || word === '') return null;
  const state = heard ? 'heard' : listening ? 'listening' : 'idle';
  return (
    <p className="cl-word" data-clinic-word={word} data-clinic-word-state={state}>
      {heard ? (
        <>Heard the word. Done.</>
      ) : (
        <>
          {listening ? 'Or answer aloud to ' : 'Or, with “Listen for me” on, answer aloud to '}
          {ACT[verb]}: say{' '}
          {acceptYes ? (
            <>
              <b className="cl-word__word" aria-hidden="true">
                yes
              </b>{' '}
              <span aria-hidden="true">or the word on screen</span>{' '}
            </>
          ) : (
            <span aria-hidden="true">the word on screen </span>
          )}
          <b className="cl-word__word" aria-hidden="true">
            {word}
          </b>
          <span className="cl-sr">
            The spoken answers are shown on screen only, so no screen reader can voice them into the microphone; use the button or a switch.
          </span>
        </>
      )}
    </p>
  );
}
