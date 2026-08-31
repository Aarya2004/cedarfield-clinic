'use client';

/**
 * The confirm dock — the one human act, redesigned for paper (SPEC-V1 §2, §5).
 *
 * WHY IT IS A DOCK. The bench drew this as an oversized mechanical keycap on its own dark stage,
 * always present, saying "nothing held" for most of the demo. Two problems, both fatal to a product
 * surface: a control that is disabled 90% of the time trains you to ignore it, and a dark panel
 * dropped into a paper page collided with the app's `--ink` (bench findings #2 / #3, 1.2:1). So:
 * the dock does not exist until a slot is held for you. It arrives from the bottom of the viewport
 * the moment the hold lands, it is the only dark object on the page, and it carries its own
 * complete `--clinic-dock-*` ink family so it can never read a token meant for paper.
 *
 * The keycap survives, shrunk. The physical argument — booking is an act a body performs — is worth
 * one object, but on the bench the cap WAS the design and the page read as a rig. Here the sentence
 * is the hero, the seconds are the counterweight, and the cap is the evidence.
 *
 * The gate is `lib/drop/confirm-logic.ts`, unchanged: `onConfirm` fires only for a native event the
 * browser marked `isTrusted`. A press dispatched by a tool, an extension or the console is counted
 * into `data-untrusted-attempts` and printed on screen. That number is measured, never scripted.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  announcementFor,
  blockedAnnouncement,
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
import type { HoldOrigin } from './hold-origin.ts';

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
  /** Who took the hold. Changes one sentence and nothing else — see `hold-origin.ts`. */
  origin: HoldOrigin;
  onConfirm: () => void;
  onRelease?: () => void;
  /** The parent scopes the agent-lane counter to this element. */
  measuredRef?: (element: HTMLDivElement | null) => void;
  /** T6's camera dwell, when the flag is on. Absent by default (GESTURE.md). */
  gestureSlot?: React.ReactNode;
}

const ACT_COPY: Record<DockAct, { eyebrowAgent: string; eyebrowYou: string; line: string; key: string; region: string }> = {
  book: {
    eyebrowAgent: 'Held by your agent · you book it',
    eyebrowYou: 'Held for you · you book it',
    line: 'Book',
    key: 'Press Enter to book',
    region: 'Confirm your appointment',
  },
  cancel: {
    eyebrowAgent: 'Your agent prepared this cancel · you decide',
    eyebrowYou: 'Ready to cancel · you decide',
    line: 'Cancel',
    key: 'Press Enter to cancel',
    region: 'Confirm the cancellation',
  },
  move: {
    eyebrowAgent: 'Your agent prepared this move · you decide',
    eyebrowYou: 'Ready to move · you decide',
    line: 'Move',
    key: 'Press Enter to move',
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
      const active = typeof document === 'undefined' ? null : document.activeElement;
      const typing =
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
      if (!typing) capRef.current?.focus();
    }
  }, [armed, secondsLeft, slotLabel, audioOn, player, act]);

  const attempt = useCallback(
    (a: { isTrusted: boolean | undefined; source: 'key' | 'pointer'; key?: string; repeat?: boolean }) => {
      const decision = decideConfirm({ ...a, disabled: !armed, secondsLeft, alreadyConfirmed: confirmed });
      if (decision.kind === 'blocked') {
        setUntrusted((n) => n + 1);
        return;
      }
      if (decision.kind === 'confirm') {
        setConfirmed(true);
        onConfirm();
      }
    },
    [armed, confirmed, onConfirm, secondsLeft],
  );

  const blocked = blockedAnnouncement(untrusted, act);
  const copy = ACT_COPY[act];
  const fraction = fractionLeft(ttlSeconds, secondsLeft);

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
            {origin === 'agent' ? copy.eyebrowAgent : copy.eyebrowYou}
          </p>
          <p className="cl-dock__line">
            {copy.line} {slotLabel} <span style={{ opacity: 0.62 }}>· {slotDetail}</span>
          </p>
          <p className="cl-dock__note">
            {act === 'book'
              ? origin === 'agent'
                ? 'Your agent took this hold and cannot take the next step. Only a keypress the browser marks as trusted books it.'
                : 'The hold is yours for now. Only a keypress the browser marks as trusted books it.'
              : act === 'cancel'
                ? 'Your agent armed this and cannot press the key. Only a keypress the browser marks as trusted cancels it — or ignore it and nothing changes.'
                : 'Your agent armed this and cannot press the key. One trusted keypress swaps the appointments atomically — or ignore it and nothing changes.'}
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
              {act === 'book' ? 'Give it back' : 'Never mind'}
            </button>
          ) : null}

          <p className="cl-dock__blocked" data-hot={untrusted > 0 ? 'true' : 'false'} data-clinic-blocked={untrusted}>
            {untrusted} synthetic {untrusted === 1 ? 'press' : 'presses'} blocked
          </p>
          </div>
        </div>

        {gestureSlot ? <div className="cl-dock__gesture">{gestureSlot}</div> : null}
      </div>

      {/* Assertive: arrival, 30s, 10s, expiry. Never per second — it would interrupt itself. */}
      <div className="cl-sr" role="status" aria-live="assertive" data-clinic-dock-live>
        {live}
      </div>
      {/* Polite: a blocked press is proof, not an emergency. */}
      <div className="cl-sr" aria-live="polite">
        {blocked ?? ''}
      </div>
    </div>
  );
}
