'use client';

/**
 * ConfirmSurface — the one human act (ticket T1).
 *
 * DESIGN: the target is drawn as an oversized mechanical keycap, with a real lip that collapses
 * under a real keypress. That is the argument in visual form: the thing being demonstrated is that
 * booking is a *physical* act, so the control is a physical object rather than a rectangle with a
 * countdown in it. Everything around the cap is deliberately flat — hairline rules, uppercase
 * micro-type, one serif sentence — so the cap is the only object on the stage.
 *
 * The load-bearing behaviour is in `../../lib/drop/confirm-logic.ts`: a press fires `onConfirm`
 * only when the native event is trusted. A dispatched KeyboardEvent or an `el.click()` from a tool,
 * an extension or the console is counted in `data-untrusted-attempts` and goes no further — the
 * counter measures, it is never scripted.
 *
 * Transplant notes: no `@/…` imports, no app-global CSS. Every colour is `var(--drop-*, fallback)`
 * so the playground (T8) or the brand pass can re-skin it by declaring tokens on any ancestor, and
 * the fallbacks are complete enough that the component looks finished mounted bare.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  announcementFor,
  blockedAnnouncement,
  decideConfirm,
  isConfirmKey,
  surfaceCopy,
  surfaceUrgency,
  type ConfirmSurfaceState,
} from '../../lib/drop/confirm-logic.ts';
import { URGENCY_TOKEN, type Urgency } from '../../lib/drop/urgency.ts';
import {
  createCuePlayer,
  cueFor,
  defaultBackendFactory,
  loadAudioPref,
  saveAudioPref,
  type CuePlayer,
} from '../../lib/drop/audio-cues.ts';

/**
 * Text-safe companions to URGENCY_TOKEN. The shared fills are tuned as fills; `critical` (#b91c1c)
 * is only 2.45:1 on the cap and may never carry the readout. Ratios below are measured against the
 * cap fallback #26221a. Additive to the contract, not a replacement: the fills still come from
 * URGENCY_TOKEN, and a theme that overrides `--drop-critical` should override this alongside it.
 */
const URGENCY_INK: Record<Urgency, string> = {
  calm: 'var(--drop-calm-ink, #7fe0ac)', // 9.9:1
  attention: 'var(--drop-attention-ink, #f0a648)', // 7.7:1
  critical: 'var(--drop-critical-ink, #ff8f84)', // 7.2:1
};

export interface ConfirmSurfaceProps {
  /** Seconds remaining on the hold. `<= 0` means the hold ran out. */
  secondsLeft: number;
  /** Human-readable slot, e.g. "9:20 AM with Dr. Okonjo". Spoken on arm and printed on the cap. */
  slotLabel: string;
  /** Fired only from a trusted press. Never from a dispatched event. */
  onConfirm: () => void;
  /** No hold is active. The surface stays focusable and explains itself. */
  disabled?: boolean;
  /** Optional alternative input (T6's camera gesture module). Absent = keyboard and pointer only. */
  gestureSlot?: ReactNode;
}

export function ConfirmSurface({ secondsLeft, slotLabel, onConfirm, disabled = false, gestureSlot }: ConfirmSurfaceProps) {
  const armed = !disabled && secondsLeft > 0;
  const urgency = surfaceUrgency(armed, secondsLeft);
  const copy = useMemo(() => surfaceCopy({ armed, secondsLeft, slotLabel }), [armed, secondsLeft, slotLabel]);

  const capRef = useRef<HTMLButtonElement>(null);
  const [pressed, setPressed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [untrusted, setUntrusted] = useState(0);
  const [live, setLive] = useState('');
  const [audioOn, setAudioOn] = useState(false);

  // ---- audio: nothing is constructed until a human turns it on -------------
  const playerRef = useRef<CuePlayer | null>(null);
  const player = useCallback((): CuePlayer => (playerRef.current ??= createCuePlayer(defaultBackendFactory)), []);

  useEffect(() => {
    setAudioOn(loadAudioPref(typeof window === 'undefined' ? null : window.localStorage));
  }, []);

  // ---- transitions: announce, cue, focus, re-arm ---------------------------
  const prevRef = useRef<ConfirmSurfaceState | null>(null);
  useEffect(() => {
    const next: ConfirmSurfaceState = { armed, secondsLeft, slotLabel };
    const prev = prevRef.current;
    prevRef.current = next;

    const said = announcementFor(next, prev);
    if (said) setLive(said);

    if (audioOn) {
      const cue = cueFor(next, prev);
      if (cue) player().play(cue); // fire-and-forget; never awaited, never on the confirm path
    }

    if (next.armed && (prev === null || !prev.armed)) {
      setConfirmed(false); // a new hold is a new chance to press
      setPressed(false);
      capRef.current?.focus(); // keyboard-first: the key is under the fingers the moment it arms
    }
  }, [armed, secondsLeft, slotLabel, audioOn, player]);

  // ---- the gate -----------------------------------------------------------
  const attempt = useCallback(
    (a: { isTrusted: boolean | undefined; source: 'key' | 'pointer'; key?: string; repeat?: boolean }) => {
      const decision = decideConfirm({ ...a, disabled, secondsLeft, alreadyConfirmed: confirmed });
      if (decision.kind === 'blocked') {
        setUntrusted((n) => n + 1);
        return;
      }
      if (decision.kind === 'confirm') {
        setConfirmed(true);
        onConfirm();
      }
    },
    [confirmed, disabled, onConfirm, secondsLeft],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isConfirmKey(e.key)) return;
    // Cancels the page scroll on Space *and* the UA's activation click, so one press is one attempt.
    e.preventDefault();
    if (armed && !e.repeat) setPressed(true);
    attempt({ isTrusted: e.nativeEvent.isTrusted, source: 'key', key: e.key, repeat: e.repeat });
  };

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioOn(next);
    saveAudioPref(typeof window === 'undefined' ? null : window.localStorage, next);
    if (next) {
      // This click is the user gesture browsers require, so the context is resumed here — and the
      // preview note tells you how loud "on" is before a hold ever depends on it.
      player().unlock();
      player().play('armed');
    }
  };

  const blockedLine = blockedAnnouncement(untrusted);

  return (
    <section
      className="rk-cs"
      data-confirm-surface
      data-armed={armed ? 'true' : 'false'}
      data-urgency={urgency}
      data-confirmed={confirmed ? 'true' : 'false'}
      data-untrusted-attempts={untrusted}
      data-audio-cues={audioOn ? 'on' : 'off'}
      aria-labelledby="rk-cs-status"
      style={{ ['--u' as string]: URGENCY_TOKEN[urgency], ['--u-ink' as string]: URGENCY_INK[urgency] }}
    >
      <style>{SHEET}</style>

      <header className="rk-cs-eyebrow">
        <span className="rk-cs-led" aria-hidden="true" />
        <h2 id="rk-cs-status" className="rk-cs-status">
          {copy.status}
        </h2>
        <button
          type="button"
          className="rk-cs-audio"
          data-confirm-audio-toggle
          data-audio-cues={audioOn ? 'on' : 'off'}
          aria-pressed={audioOn}
          onClick={toggleAudio}
          title="Two short tones: one when a slot is held for you, one at ten seconds left. Off until you turn it on."
        >
          <span aria-hidden="true" className="rk-cs-audio-mark">
            {audioOn ? '◉' : '○'}
          </span>
          Sound {audioOn ? 'on' : 'off'}
        </button>
      </header>

      <button
        type="button"
        role="button"
        ref={capRef}
        className="rk-cs-cap"
        data-confirm-cap
        data-pressed={pressed ? 'true' : 'false'}
        data-untrusted-attempts={untrusted}
        aria-disabled={!armed}
        aria-describedby="rk-cs-foot"
        onKeyDown={onKeyDown}
        onKeyUp={() => setPressed(false)}
        onBlur={() => setPressed(false)}
        onPointerDown={() => armed && setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onClick={(e) => attempt({ isTrusted: e.nativeEvent.isTrusted, source: 'pointer' })}
      >
        <span className="rk-cs-cap-text">
          <span className="rk-cs-action">{copy.action}</span>
          <span className="rk-cs-legend">{copy.legend}</span>
        </span>
        <span className="rk-cs-well" aria-hidden="true">
          <span className="rk-cs-count">{armed ? Math.max(0, Math.ceil(secondsLeft)) : '—'}</span>
          <span className="rk-cs-unit">{armed ? 'sec left' : 'no hold'}</span>
        </span>
      </button>

      <footer className="rk-cs-foot">
        <p id="rk-cs-foot" className="rk-cs-note">
          {copy.footnote}
        </p>
        <p className="rk-cs-blocked" data-untrusted-attempts={untrusted} data-hot={untrusted > 0 ? 'true' : 'false'}>
          <span className="rk-cs-blocked-n">{untrusted}</span>
          {untrusted === 1 ? ' synthetic press blocked' : ' synthetic presses blocked'}
        </p>
      </footer>

      {gestureSlot ? (
        <div className="rk-cs-gesture" data-confirm-gesture-slot>
          {gestureSlot}
        </div>
      ) : null}

      {/* Assertive: arm, 30s, 10s, expiry. Never per-second — it would interrupt itself forever. */}
      <div className="rk-cs-sr" role="status" aria-live="assertive" data-confirm-live>
        {live}
      </div>
      {/* Polite: a blocked press is proof, not an emergency. */}
      <div className="rk-cs-sr" aria-live="polite" data-confirm-live-blocked>
        {blockedLine ?? ''}
      </div>
    </section>
  );
}

/**
 * One static sheet. Dynamic values arrive as `--u` / `--u-ink` on the root, so nothing here has to
 * be rebuilt per tick, and a media query for reduced motion is expressible (inline styles can't).
 * Ratios in the comments are measured against the fallbacks in this file.
 */
const SHEET = `
.rk-cs {
  /* One material, three light levels — the cap's top face is lit, its side wall is not, and the
     stage sits between them. Without that ladder the cap reads as a flat rectangle, which loses
     the whole argument. Keep stage strictly between cap and lip when re-skinning. */
  --stage: var(--drop-stage, #1e1a14);
  --cap: var(--drop-cap, #2b261d);
  --cap-edge: var(--drop-cap-edge, #3d372b);
  --lip: var(--drop-lip, #0a0806);
  --ink: var(--drop-ink, #f2ede2);            /* 12.9:1 on the cap */
  --muted: var(--drop-muted, #a49a88);        /* 5.4:1 on the cap · 6.2:1 on the stage */
  --focus: var(--drop-focus, #f0a648);
  --lift: 7px;
  position: relative;
  display: block;
  padding: 18px 18px 16px;
  border: 1px solid var(--cap-edge);
  border-radius: 18px;
  background: var(--stage);
  color: var(--ink);
  font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
  container-type: inline-size;
}

/* ---- eyebrow ---- */
.rk-cs-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--cap-edge);
}
.rk-cs-led {
  width: 7px; height: 7px; flex: none;
  background: var(--u);
  box-shadow: 0 0 8px var(--u);
  transition: background 400ms linear, box-shadow 400ms linear;
}
.rk-cs[data-armed='false'] .rk-cs-led { background: var(--muted); box-shadow: none; }
.rk-cs-status {
  margin: 0;
  font: 500 11px/1 var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--u-ink);
  transition: color 400ms linear;
}
.rk-cs[data-armed='false'] .rk-cs-status { color: var(--muted); }
.rk-cs-audio {
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 9px;
  border: 1px solid var(--cap-edge);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font: 500 10px/1 var(--font-mono, ui-monospace, Menlo, monospace);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.rk-cs-audio:hover { color: var(--ink); border-color: var(--muted); }
.rk-cs-audio[data-audio-cues='on'] { color: var(--ink); border-color: var(--muted); }
.rk-cs-audio-mark { font-size: 9px; line-height: 1; }

/* ---- the keycap: the one object on the stage ---- */
.rk-cs-cap {
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  min-height: 116px;              /* the ticket's floor is 96px; the extra is thumb room */
  margin: 18px 0 calc(var(--lift) + 6px);   /* the lip's travel is reserved, so pressing shifts nothing */
  padding: 20px 22px;
  border: 1px solid var(--cap-edge);
  border-radius: 14px;
  background: var(--cap);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transform: translateY(0);
  box-shadow:
    inset 0 0 0 1.5px color-mix(in srgb, var(--u) 55%, transparent),
    inset 0 1px 0 0 color-mix(in srgb, var(--ink) 9%, transparent),   /* the lit top chamfer */
    inset 0 -1px 0 0 color-mix(in srgb, var(--ink) 5%, transparent),  /* the bottom chamfer */
    0 var(--lift) 0 0 var(--lip),                                    /* the side wall */
    0 calc(var(--lift) + 5px) 22px rgba(0, 0, 0, 0.55);              /* what it casts on the stage */
  transition: transform 90ms cubic-bezier(0.2, 0, 0, 1), box-shadow 90ms cubic-bezier(0.2, 0, 0, 1),
    background 400ms linear;
}
.rk-cs-cap:focus-visible { outline: 2px solid var(--focus); outline-offset: 4px; }

/* the press: the cap travels down and the lip disappears under it */
.rk-cs-cap[data-pressed='true'] {
  transform: translateY(calc(var(--lift) - 1px));
  box-shadow:
    inset 0 0 0 1.5px var(--u),
    inset 0 2px 8px rgba(0, 0, 0, 0.5),
    0 1px 0 0 var(--lip);
}

/* nothing held: the key is already down and stays there, and it says so */
.rk-cs-cap[aria-disabled='true'] {
  cursor: default;
  color: var(--muted);
  transform: translateY(calc(var(--lift) - 3px));
  box-shadow: inset 0 0 0 1px var(--cap-edge), inset 0 2px 8px rgba(0, 0, 0, 0.35), 0 3px 0 0 var(--lip);
}

.rk-cs-cap-text { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.rk-cs-action {
  font: 400 clamp(24px, 4.4cqi + 14px, 34px)/1.05 var(--font-serif, ui-serif, Georgia, serif);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.rk-cs-legend {              /* the engraving */
  font: 500 10px/1 var(--font-mono, ui-monospace, Menlo, monospace);
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--muted);
}

/* the readout, recessed into the cap like an instrument window */
.rk-cs-well {
  margin-left: auto;
  flex: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  width: 88px; height: 76px;
  /* Neutral on purpose: the ring around the cap already carries the urgency colour, and a second
     coloured frame 20px inside it turns the whole control into a traffic light. The numeral is the
     only urgency-coloured thing in the well. */
  border: 1px solid var(--cap-edge);
  border-radius: 10px;
  background: color-mix(in srgb, var(--lip) 60%, transparent);
  box-shadow: inset 0 2px 7px rgba(0, 0, 0, 0.55);
}
.rk-cs-count {
  font: 500 32px/1 var(--font-mono, ui-monospace, Menlo, monospace);
  font-variant-numeric: tabular-nums;   /* digits keep their box, so a tick is never a layout shift */
  color: var(--u-ink);
  transition: color 400ms linear;
}
.rk-cs-unit {
  font: 500 8px/1 var(--font-mono, ui-monospace, Menlo, monospace);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.rk-cs[data-armed='false'] .rk-cs-count { color: var(--muted); }

/* ---- footer ---- */
.rk-cs-foot {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cap-edge);
}
.rk-cs-note { margin: 0; flex: 1 1 260px; font-size: 12px; line-height: 1.5; color: var(--muted); }
.rk-cs-blocked {
  margin: 0;
  font: 500 10px/1.4 var(--font-mono, ui-monospace, Menlo, monospace);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.rk-cs-blocked-n { font-variant-numeric: tabular-nums; }
.rk-cs-blocked[data-hot='true'] { color: var(--drop-critical-ink, #ff8f84); }  /* 8.5:1 on the stage */

.rk-cs-gesture { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--cap-edge); }

.rk-cs-sr {
  position: absolute; width: 1px; height: 1px;
  margin: -1px; padding: 0; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; border: 0;
}

/* Nothing here blinks or flashes at any rate — the urgency states are colour transitions only.
   Under reduced motion even those become instant, and the cap's travel is dropped. */
@media (prefers-reduced-motion: reduce) {
  .rk-cs-cap, .rk-cs-led, .rk-cs-status, .rk-cs-count { transition: none; }
  .rk-cs-cap[data-pressed='true'] { transform: none; }
}

@container (max-width: 420px) {
  .rk-cs-cap { flex-wrap: wrap; gap: 14px; }
  .rk-cs-well { margin-left: 0; width: 100%; height: 62px; flex-direction: row; gap: 8px; }
}
`;

export default ConfirmSurface;
