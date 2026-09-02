'use client';

/**
 * The confirm step — the last thing between a held time and a booking (SPEC-V3 §2).
 *
 * WHY IT IS A DOCK. A confirm control that is disabled most of the session trains people to ignore
 * it, so this one does not exist until there is something to confirm. It arrives from the bottom of
 * the viewport the moment a time is held, it is the only dark object on the page, and it carries its
 * own complete `--clinic-dock-*` ink family so it can never read a token meant for paper (a dark
 * panel reading the app shell's `--ink` was the 1.2:1 bug — bench findings #2 / #3).
 *
 * The sentence is the hero, the seconds are the counterweight, and the keycap is the affordance:
 * confirming an appointment is a deliberate act, so it looks like one. `Confirm your way` sits under
 * it because the key is one route and never the only one — a switch or the held gesture confirm the
 * same booking (WCAG 2.5.4, 2.1.1).
 *
 * The gate is `lib/drop/confirm-logic.ts`, unchanged: `onConfirm` fires only for a native event the
 * browser marked `isTrusted`, so nothing books an appointment on the visitor's behalf. Presses that
 * fail the gate are counted into `data-untrusted-attempts` / `data-clinic-blocked` for the harness
 * and are silent on screen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  announcementFor,
  decideConfirm,
  isConfirmKey,
  surfaceUrgency,
  type ConfirmSurfaceState,
} from '../../lib/drop/confirm-logic.ts';
import {
  createCuePlayer,
  cueFor,
  defaultBackendFactory,
  loadAudioPref,
  saveAudioPref,
  type CuePlayer,
} from '../../lib/drop/audio-cues.ts';
import { displaySeconds, fractionLeft } from '../../lib/drop/time.ts';
import { assistantTag, type HoldOrigin } from './hold-origin.ts';

/** SPEC-V2: which consequential act one trusted press performs. The dock never performs two. */
export type DockAct = 'book' | 'cancel' | 'move';

export interface ConfirmDockProps {
  /**
   * The act this dock is armed for. Defaults to 'book' (the hold flow). 'cancel' and 'move' arrive
   * only via clinic_prepare_cancel / clinic_prepare_move — the agent arms them, the person performs
   * them, and the trusted-event gate is the same one in all three cases.
   */
  act?: DockAct;
  /** Seconds remaining on the hold. The parent mounts the dock only while this is above zero. */
  secondsLeft: number;
  /** The hold's full length, for the retreating rule. */
  ttlSeconds: number;
  /** "9:20 AM" — printed on the cap's sentence and spoken on arrival. */
  slotLabel: string;
  /** "Dr. Alvarez · New patient". */
  slotDetail: string;
  /** Who asked for the hold. Adds the "via your assistant" tag and nothing else — `hold-origin.ts`. */
  origin: HoldOrigin;
  onConfirm: () => void;
  onRelease?: () => void;
  /** The parent scopes the agent-lane counter to this element. */
  measuredRef?: (element: HTMLDivElement | null) => void;
  /** T6's camera dwell. On in the submitted build, opt-in per person at runtime (GESTURE.md). */
  gestureSlot?: React.ReactNode;
}

/**
 * The clinic's words for the one act, in the order a person meets them: what state this is in, what
 * will happen, what to press, and what it costs to walk away. An action keeps its name all the way
 * through — the dock says `Confirm this booking`, the line says `Book 8:40 AM`.
 */
const ACT_COPY: Record<DockAct, { eyebrow: string; line: string; key: string; note: string; region: string }> = {
  book: {
    // Short on purpose: the strip above the board carries the full sentence with the clock in it,
    // and the dock repeating it verbatim two inches away is the page saying one thing twice.
    eyebrow: 'Held for you',
    line: 'Book',
    key: 'Confirm this booking — press Enter',
    note: 'Confirm and this appointment goes in the book. Let the hold run out and the time goes back on the board.',
    region: 'Confirm your appointment',
  },
  cancel: {
    eyebrow: 'Cancel this appointment',
    line: 'Cancel',
    key: 'Cancel this appointment — press Enter to confirm',
    note: 'Confirm and this time is released for someone else. Do nothing and the appointment stands.',
    region: 'Confirm the cancellation',
  },
  move: {
    eyebrow: 'Move this appointment',
    line: 'Move',
    key: 'Move this appointment — press Enter to confirm',
    note: 'Confirm and both times change in one step — the new one is held until you do. Do nothing and the appointment stands.',
    region: 'Confirm the move',
  },
};

export function ConfirmDock({
  act = 'book',
  secondsLeft,
  ttlSeconds,
  slotLabel,
  slotDetail,
  origin,
  onConfirm,
  onRelease,
  measuredRef,
  gestureSlot,
}: ConfirmDockProps) {
  const armed = secondsLeft > 0;
  const urgency = surfaceUrgency(armed, secondsLeft);

  const capRef = useRef<HTMLButtonElement>(null);
  const [pressed, setPressed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [untrusted, setUntrusted] = useState(0);
  const [live, setLive] = useState('');
  const [audioOn, setAudioOn] = useState(false);

  const playerRef = useRef<CuePlayer | null>(null);
  const player = useCallback((): CuePlayer => (playerRef.current ??= createCuePlayer(defaultBackendFactory)), []);

  useEffect(() => {
    setAudioOn(loadAudioPref(typeof window === 'undefined' ? null : window.localStorage));
  }, []);

  // Announce, cue, and put the key under the fingers — but never steal a caret. Someone typing
  // their phone number into the manual form must not lose the next character to an arriving hold.
  const prevRef = useRef<ConfirmSurfaceState | null>(null);
  useEffect(() => {
    const next: ConfirmSurfaceState = { armed, secondsLeft, slotLabel };
    const prev = prevRef.current;
    prevRef.current = next;

    const said = announcementFor(next, prev, act);
    if (said) setLive(said);

    if (audioOn) {
      const cue = cueFor(next, prev);
      if (cue) player().play(cue); // fire-and-forget: the confirm path never waits on a sound
    }

    if (next.armed && (prev === null || !prev.armed)) {
      setConfirmed(false);
      setPressed(false);
      // P1-1: only the BOOK dock may take focus. A cancel/move dock is armed at a moment the agent
      // chose — stealing focus would aim the person's in-flight Enter at a destructive act. Those
      // docks announce themselves and wait to be reached deliberately (Tab, click, or gesture).
      // A waitlist grant also arrives at a moment nobody at this keyboard chose (SPEC-V5).
      if (act === 'book' && origin !== 'waitlist') {
        const active = typeof document === 'undefined' ? null : document.activeElement;
        const typing =
          active instanceof HTMLElement &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
        if (!typing) capRef.current?.focus();
      }
    }
  }, [armed, secondsLeft, slotLabel, audioOn, player, act, origin]);

  // When this dock mounted — which, for the keyed act docks, is when it was armed (P1-1/P1-3).
  const armedAtRef = useRef<number>(typeof performance === 'undefined' ? 0 : performance.now());

  const attempt = useCallback(
    (a: { isTrusted: boolean | undefined; source: 'key' | 'pointer'; key?: string; repeat?: boolean }) => {
      const decision = decideConfirm({
        ...a,
        disabled: !armed,
        secondsLeft,
        alreadyConfirmed: confirmed,
        ...(act !== 'book' || origin === 'waitlist'
          ? { msSinceArmed: (typeof performance === 'undefined' ? 0 : performance.now()) - armedAtRef.current }
          : {}),
      });
      if (decision.kind === 'blocked') {
        setUntrusted((n) => n + 1);
        return;
      }
      if (decision.kind === 'confirm') {
        setConfirmed(true);
        onConfirm();
      }
    },
    [armed, confirmed, onConfirm, secondsLeft, act, origin],
  );

  const copy = ACT_COPY[act];
  const via = assistantTag(origin);
  const fraction = fractionLeft(ttlSeconds, secondsLeft);
  // A press the browser did not mark as trusted books nothing. Saying so on screen would be noise
  // for a visitor who never made one, so the count lives in `data-clinic-blocked` and the only human
  // feedback is this polite line — and only once it has actually happened.
  const blocked = untrusted > 0 ? 'That did not confirm. Press Enter, or select the confirm button.' : '';

  return (
    <div
      className="cl-dock"
      role="region"
      aria-label={copy.region}
      data-clinic-dock
      data-clinic-act={act}
      data-armed={armed ? 'true' : 'false'}
      data-origin={origin}
      data-urgency={urgency}
      data-confirmed={confirmed ? 'true' : 'false'}
      data-untrusted-attempts={untrusted}
      data-clinic-blocked={untrusted}
      data-audio-cues={audioOn ? 'on' : 'off'}
      ref={measuredRef}
    >
      {/* The hold's clock, run edge to edge. Written per frame, never transitioned — a CSS
          transition here would make the rule lag the number it belongs to. */}
      <span
        className="cl-dock__ttl"
        aria-hidden="true"
        data-clinic-dock-ttl={fraction.toFixed(3)}
        style={{ ['--cl-fraction' as string]: fraction }}
      />

      <div className="cl-dock__inner">
        <div className="cl-dock__main">
          {/* Deliberately not the board's sentence. The strip above the sheet carries the full
              line with the seconds in it; repeating that here, six inches from a numeral the size
              of a fist, would be the page saying the same thing twice. */}
          <p className="cl-dock__eyebrow" data-clinic-dock-eyebrow>
            {origin === 'waitlist' && act === 'book' ? 'This time came back to you' : copy.eyebrow}
            {via === null ? null : <span className="cl-dock__via"> · {via}</span>}
          </p>
          <p className="cl-dock__line">
            {copy.line} {slotLabel} <span className="cl-dock__detail">· {slotDetail}</span>
          </p>
          <p className="cl-dock__note">
            {origin === 'waitlist' && act === 'book'
              ? 'You were next on the waiting list for this time, so it is yours to confirm. Let the hold run out and it passes to the next person in line.'
              : copy.note}
          </p>
        </div>

        <p className="cl-dock__clock">
          <span className="cl-dock__seconds" data-clinic-dock-seconds={displaySeconds(secondsLeft)}>
            {displaySeconds(secondsLeft)}
          </span>
          <span className="cl-dock__unit">seconds left</span>
        </p>

        <div className="cl-dock__aside">
          <button
            type="button"
            ref={capRef}
            className="cl-key"
            data-clinic-confirm
            data-pressed={pressed ? 'true' : 'false'}
            data-untrusted-attempts={untrusted}
            aria-disabled={!armed}
            onKeyDown={(e) => {
              if (!isConfirmKey(e.key)) return;
              // Cancels the page scroll on Space and the UA's synthetic activation click, so one
              // press is one attempt rather than two.
              e.preventDefault();
              if (armed && !e.repeat) setPressed(true);
              attempt({ isTrusted: e.nativeEvent.isTrusted, source: 'key', key: e.key, repeat: e.repeat });
            }}
            onKeyUp={() => setPressed(false)}
            onBlur={() => setPressed(false)}
            onPointerDown={() => armed && setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            onClick={(e) => attempt({ isTrusted: e.nativeEvent.isTrusted, source: 'pointer' })}
          >
            <span className="cl-key__glyph" aria-hidden="true">
              ⏎
            </span>
            {copy.key}
          </button>

          <div className="cl-dock__minor">
          <button
            type="button"
            className="cl-dock__toggle"
            data-clinic-audio
            aria-pressed={audioOn}
            title="Two short tones: one when a hold arrives, one at ten seconds left. Off until you turn it on."
            onClick={() => {
              const next = !audioOn;
              setAudioOn(next);
              saveAudioPref(typeof window === 'undefined' ? null : window.localStorage, next);
              if (next) {
                // This click is the gesture the browser requires before a context may start.
                player().unlock();
                player().play('armed');
              }
            }}
          >
            Sound {audioOn ? 'on' : 'off'}
          </button>

          {onRelease ? (
            <button type="button" className="cl-dock__toggle" data-clinic-release onClick={onRelease}>
              {act === 'book' ? 'Release this time' : 'Never mind'}
            </button>
          ) : null}
          </div>

          {/* One act, several ways in. Named on screen rather than left for someone to discover:
              a person who cannot use a keyboard should not have to guess that the button is one. */}
          <p className="cl-dock__ways" data-clinic-dock-ways>
            Confirm your way: press Enter, select the button, use a switch
            {gestureSlot ? ', or hold the gesture below' : ''}.
          </p>
        </div>

        {gestureSlot ? <div className="cl-dock__gesture">{gestureSlot}</div> : null}
      </div>

      {/* Assertive: arrival, 30s, 10s, expiry. Never per second — it would interrupt itself. */}
      <div className="cl-sr" role="status" aria-live="assertive" data-clinic-dock-live>
        {live}
      </div>
      {/* Polite: a press that did not land is worth saying once, not worth interrupting for. */}
      <div className="cl-sr" aria-live="polite">
        {blocked}
      </div>
    </div>
  );
}
