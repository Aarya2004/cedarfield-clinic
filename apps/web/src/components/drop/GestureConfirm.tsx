'use client';

/**
 * GestureConfirm — the camera dwell (ticket T6). Plugs into `ConfirmSurface`'s `gestureSlot`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT IS. An open palm held in front of the lens for a configurable dwell (default 1000ms, ring
 * fills while you hold) calls the *same* `onConfirm` the Enter key calls. Nothing else in the drop
 * changes: the keycap is still focused, still armed, still the thing that books. This is an
 * enhancement laid on top of a control that already works without it — WCAG 2.5.4 requires motion
 * actuation to have a UI alternative and to be disableable, and here the alternative is the whole
 * product and the off switch is one click.
 *
 * WHAT IT IS NOT. Proof that a human acted. `ConfirmSurface` can make that claim about the keyboard
 * because the UA marks synthetic events `isTrusted === false`; a classifier has no equivalent — a
 * printed hand or a video of one is an `Open_Palm` to any model. So the gesture path is off by
 * default, behind `NEXT_PUBLIC_DROP_GESTURE=1`, and the demo's security line stays a keyboard line.
 *
 * SHAPE. All the rules — dwell accumulation, flicker tolerance, cancel-on-lost-palm, fire-once,
 * the six `data-gesture-state` values, the persisted prefs — live in `../../lib/drop/gesture-logic.ts`
 * and are unit-tested against synthetic frames. This file is the adapter: it loads wasm, opens a
 * camera, converts `GestureRecognizerResult` into `GestureFrame`, and paints a ring. Keep it that
 * way; anything that can be decided without a webcam belongs downstairs.
 *
 * ASSETS + LICENCE. `@mediapipe/tasks-vision` is imported dynamically and *only* from the enable
 * click, so its ~200KB of JS and 42MB of wasm/model are absent from every other page load. Both the
 * wasm runtime and `gesture_recognizer.task` are served from our own origin under
 * `/models/mediapipe/` — no runtime request to a Google CDN, ever. That is deliberate on three
 * counts: a visitor's IP is not handed to a third party the moment they turn on a camera, the demo
 * does not depend on someone else's uptime, and our CSP stays closed.
 *   The MediaPipe *code* is Apache-2.0. The *model weights* are NOT — `gesture_recognizer.task` is
 * governed by Google's MediaPipe model terms of service, which is why the file is gitignored and
 * provisioned per-deployment by `apps/web/scripts/fetch-gesture-model.sh` rather than redistributed
 * in this repository. If the assets are missing, this module fails into `unavailable` and says the
 * keyboard still books.
 *
 * Manual test steps, and the open ChatGPT-desktop question, are in `GESTURE.md` beside this file.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_GRACE_MS,
  DEFAULT_MIN_SCORE,
  DWELL_MAX_MS,
  DWELL_MIN_MS,
  DWELL_STEP_MS,
  classifyCameraError,
  dwellProgress,
  failureCopy,
  gestureUiState,
  initialDwellState,
  isHolding,
  loadDwellMs,
  loadGestureEnabled,
  saveDwellMs,
  saveGestureEnabled,
  shouldAutoStart,
  stepDwell,
  type CameraPermission,
  type DwellConfig,
  type DwellState,
  type GestureFailure,
} from '../../lib/drop/gesture-logic.ts';

/** Same-origin, provisioned by `scripts/fetch-gesture-model.sh`. Never a CDN. */
export const WASM_BASE_PATH = '/models/mediapipe/wasm';
export const MODEL_PATH = '/models/mediapipe/gesture_recognizer.task';

export interface GestureConfirmProps {
  /** The same callback the keycap fires. Called once per completed dwell. */
  onConfirm: () => void;
  /** SPEC-V2: the act one completed dwell performs. Every sentence this module says uses it. */
  verb?: 'book' | 'cancel' | 'move';
  /** Is there a live hold to confirm? A dwell over an idle surface accumulates nothing. */
  armed: boolean;
  /** Override for tests or a different deployment layout. */
  wasmBasePath?: string;
  modelPath?: string;
}

type LoadPhase = 'runtime' | 'model' | 'camera' | null;

/** The half of the module that talks to MediaPipe, kept behind one small surface. */
interface Recognizer {
  recognizeForVideo(video: HTMLVideoElement, timestampMs: number): { gestures: { categoryName: string; score: number }[][] };
  close(): void;
}

export function GestureConfirm({
  onConfirm,
  armed,
  verb = 'book',
  wasmBasePath = WASM_BASE_PATH,
  modelPath = MODEL_PATH,
}: GestureConfirmProps) {
  const done = verb === 'book' ? 'Booked.' : verb === 'cancel' ? 'Cancelled.' : 'Moved.';
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<LoadPhase>(null);
  const [modelPct, setModelPct] = useState(0);
  const [failure, setFailure] = useState<GestureFailure | null>(null);
  const [running, setRunning] = useState(false);
  const [dwellMs, setDwellMs] = useState(1000);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [fired, setFired] = useState(false);
  const [live, setLive] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const rafRef = useRef<number | null>(null);
  const dwellRef = useRef<DwellState>(initialDwellState());
  const lastVideoTime = useRef(-1);

  // The loop reads these through refs so a re-render never restarts the camera.
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const armedRef = useRef(armed);
  armedRef.current = armed;
  const configRef = useRef<DwellConfig>({ dwellMs: 1000, graceMs: DEFAULT_GRACE_MS, minScore: DEFAULT_MIN_SCORE });
  configRef.current = { dwellMs, graceMs: DEFAULT_GRACE_MS, minScore: DEFAULT_MIN_SCORE };

  // ---- teardown: one function, called on disable, on failure and on unmount ----
  const teardown = useCallback(() => {
    if (rafRef.current !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    try {
      recognizerRef.current?.close();
    } catch {
      /* a recognizer that will not close is not worth an error on the confirm path */
    }
    recognizerRef.current = null;
    dwellRef.current = initialDwellState();
    lastVideoTime.current = -1;
    setRunning(false);
    setHolding(false);
    setProgress(0);
    setFired(false);
  }, []);

  useEffect(() => teardown, [teardown]);

  // ---- the frame loop ---------------------------------------------------------
  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    const recognizer = recognizerRef.current;
    if (!video || !recognizer || video.readyState < 2) return;

    const at = performance.now();
    let gesture: string | null = null;
    let score = 0;

    // rAF runs at the display's rate (60Hz+) and the camera delivers ~30fps, so roughly every other
    // tick carries an image MediaPipe has already seen — and MediaPipe rejects a repeated timestamp
    // outright. Those ticks are reported to the dwell as *no gesture* rather than as the last
    // answer repeated: the grace window absorbs them (that is what it is for), and a camera that
    // freezes entirely therefore cancels the hold instead of quietly filling the ring on a still
    // image. `stepDwell` credits wall-clock time from the last real sighting, so nothing is lost.
    if (video.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = video.currentTime;
      try {
        const result = recognizer.recognizeForVideo(video, at);
        const top = result.gestures?.[0]?.[0];
        if (top) {
          gesture = top.categoryName;
          score = top.score;
        }
      } catch {
        return; // a dropped inference is a dropped frame, not an outage
      }
    }

    const step = stepDwell(dwellRef.current, { at, gesture, score, armed: armedRef.current }, configRef.current);
    dwellRef.current = step.state;
    setProgress(dwellProgress(step.state, configRef.current));
    setHolding(isHolding(step.state));
    if (step.fire) {
      setFired(true);
      setLive(`Palm held. ${done}`);
      onConfirmRef.current();
    } else if (!armedRef.current) {
      setFired(false);
    }
  }, []);

  // ---- start: the only place the camera is ever opened -------------------------
  const start = useCallback(async () => {
    setFailure(null);
    setPhase('runtime');
    setModelPct(0);
    // Which half of the start-up we are in, so the catch can tell "the assets never arrived" from
    // "the camera said no" without inspecting React state it may already have cleared.
    let step: 'assets' | 'camera' = 'assets';
    try {
      // Dynamic on purpose: nothing about MediaPipe is in any bundle a visitor loads by default.
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(wasmBasePath);

      setPhase('model');
      // Streamed rather than handed to `createFromModelPath` so the percentage on screen is the
      // real byte count, not a spinner pretending to know something.
      const response = await fetch(modelPath);
      if (!response.ok) throw new Error(`model ${response.status}`);
      const total = Number(response.headers.get('content-length') ?? 0);
      const chunks: Uint8Array[] = [];
      let received = 0;
      const reader = response.body?.getReader();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          if (total > 0) setModelPct(Math.min(99, Math.round((received / total) * 100)));
        }
      } else {
        chunks.push(new Uint8Array(await response.arrayBuffer()));
      }
      const buffer = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }
      setModelPct(100);

      const recognizer = await vision.GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: buffer, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
        cannedGesturesClassifierOptions: { scoreThreshold: DEFAULT_MIN_SCORE },
      });
      recognizerRef.current = recognizer as unknown as Recognizer;

      step = 'camera';
      setPhase('camera');
      const media = navigator.mediaDevices;
      if (!media?.getUserMedia) throw Object.assign(new Error('no mediaDevices'), { name: 'TypeError' });
      const stream = await media.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('no video element');
      video.srcObject = stream;
      await video.play();

      dwellRef.current = initialDwellState();
      lastVideoTime.current = -1;
      setPhase(null);
      setRunning(true);
      setLive(`Camera on. Hold an open palm for ${(dwellMs / 1000).toFixed(1)} seconds to ${verb}.`);
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      // Two failure families, told apart honestly: the assets did not arrive, or the camera did not.
      const kind: GestureFailure = step === 'camera' ? classifyCameraError(err) : 'load-failed';
      teardown();
      setPhase(null);
      setFailure(kind);
      setLive(failureCopy(kind, verb));
    }
  }, [dwellMs, loop, modelPath, teardown, wasmBasePath, verb]);

  // ---- the switch, persisted ---------------------------------------------------
  const enable = useCallback(() => {
    setEnabled(true);
    saveGestureEnabled(typeof window === 'undefined' ? null : window.localStorage, true);
    void start();
  }, [start]);

  const disable = useCallback(() => {
    setEnabled(false);
    saveGestureEnabled(typeof window === 'undefined' ? null : window.localStorage, false);
    setFailure(null);
    setPhase(null);
    teardown();
    setLive(`Camera off. Enter still ${verb === 'book' ? 'books' : verb === 'cancel' ? 'cancels' : 'moves'} it.`);
  }, [teardown, verb]);

  // ---- mount: read the prefs; reopen the lens only where a grant already stands ----
  const startedOnce = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const store = window.localStorage;
    setDwellMs(loadDwellMs(store));
    const pref = loadGestureEnabled(store);
    if (!pref) return;
    setEnabled(true);
    let cancelled = false;
    void (async () => {
      let permission: CameraPermission = 'unknown';
      try {
        const status = await navigator.permissions?.query({ name: 'camera' as PermissionName });
        if (status) permission = status.state as CameraPermission;
      } catch {
        permission = 'unknown'; // Firefox and Safari have no camera permission descriptor
      }
      if (cancelled || startedOnce.current) return;
      if (shouldAutoStart(pref, permission)) {
        startedOnce.current = true;
        void start();
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount only: this must never re-run and re-open a camera mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDwellChange = (value: number) => {
    setDwellMs(value);
    saveDwellMs(typeof window === 'undefined' ? null : window.localStorage, value);
  };

  const state = gestureUiState({ enabled, loading: phase !== null, failure, running, fired, holding });
  const seconds = (dwellMs / 1000).toFixed(1);
  const headline = useMemo(() => copyFor(state, seconds, phase, modelPct, verb), [state, seconds, phase, modelPct, verb]);

  return (
    <section
      className="rk-g"
      data-gesture-confirm
      data-gesture-state={state}
      data-gesture-failure={failure ?? undefined}
      data-gesture-dwell-ms={dwellMs}
      data-gesture-progress={progress.toFixed(2)}
      aria-label="Confirm with a hand gesture (optional)"
      style={{ ['--p' as string]: progress }}
    >
      <style>{SHEET}</style>

      <div className="rk-g-row">
        <div className="rk-g-eye" aria-hidden="true">
          {/* The porthole is the instrument: the ring around your own face is the dwell. */}
          <video ref={videoRef} className="rk-g-video" playsInline muted />
          {!running ? <span className="rk-g-glyph">{state === 'unavailable' ? '⃠' : '◉'}</span> : null}
          <svg className="rk-g-ring" viewBox="0 0 64 64">
            <circle className="rk-g-track" cx="32" cy="32" r="29" />
            <circle
              className="rk-g-fill"
              cx="32"
              cy="32"
              r="29"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - progress)}
            />
          </svg>
        </div>

        <div className="rk-g-body">
          <p className="rk-g-head">{headline}</p>
          {/* The failure line is *rendered*, not just announced: a module that fails silently and
              leaves a dead control on the surface is the thing this state exists to prevent. */}
          <p className="rk-g-sub" data-gesture-note>
            {failure !== null
              ? failureCopy(failure, verb)
              : `Optional. Enter ${verb === 'book' ? 'books' : verb === 'cancel' ? 'cancels' : 'moves'} it either way, and the camera never leaves this page.`}
          </p>
        </div>

        <div className="rk-g-controls">
          {state === 'unavailable' ? (
            <button type="button" className="rk-g-btn" data-gesture-retry onClick={enable}>
              Try again
            </button>
          ) : null}
          <button
            type="button"
            className="rk-g-btn"
            data-gesture-toggle
            data-gesture-enable={enabled ? undefined : 'true'}
            aria-pressed={enabled}
            onClick={enabled ? disable : enable}
          >
            {enabled ? 'Camera off' : 'Enable camera'}
          </button>
        </div>
      </div>

      {enabled && failure === null ? (
        <div className="rk-g-slider">
          <label className="rk-g-slider-label" htmlFor="rk-g-dwell">
            Hold for
          </label>
          <input
            id="rk-g-dwell"
            className="rk-g-range"
            data-gesture-dwell-input
            type="range"
            min={DWELL_MIN_MS}
            max={DWELL_MAX_MS}
            step={DWELL_STEP_MS}
            value={dwellMs}
            onChange={(e) => onDwellChange(Number(e.target.value))}
          />
          <output className="rk-g-slider-value" htmlFor="rk-g-dwell">
            {seconds}s
          </output>
        </div>
      ) : null}

      <div className="rk-g-sr" role="status" aria-live="polite" data-gesture-live>
        {live}
      </div>
    </section>
  );
}

const RING = 2 * Math.PI * 29;

function copyFor(
  state: ReturnType<typeof gestureUiState>,
  seconds: string,
  phase: LoadPhase,
  pct: number,
  verb: 'book' | 'cancel' | 'move',
): string {
  switch (state) {
    case 'disabled':
      return `Or ${verb} it with an open palm.`;
    case 'loading':
      return phase === 'model'
        ? `Loading the hand model — ${pct}%`
        : phase === 'camera'
          ? 'Waiting for the camera…'
          : 'Loading the vision runtime…';
    case 'ready':
      return `Hold an open palm for ${seconds}s.`;
    case 'held':
      return 'Holding — keep it up.';
    case 'fired':
      return `${verb === 'book' ? 'Booked' : verb === 'cancel' ? 'Cancelled' : 'Moved'}, from your palm.`;
    case 'unavailable':
    default:
      return 'Camera unavailable.';
  }
}

/**
 * One sheet, matching `ConfirmSurface`'s material: the same stage/cap/edge ladder, the same mono
 * micro-type, and the urgency ink the surface already publishes as `--u-ink` — so mounted in the
 * `gestureSlot` the module reads as part of the instrument rather than a widget bolted under it.
 * Fallbacks are complete, so it also looks finished mounted bare.
 */
const SHEET = `
.rk-g {
  --edge: var(--drop-cap-edge, #3d372b);
  --ink: var(--drop-ink, #f2ede2);
  --muted: var(--drop-muted, #a49a88);
  --accent: var(--u-ink, var(--drop-attention-ink, #f0a648));
  display: block;
  color: var(--ink);
  font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
}
.rk-g-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

/* the porthole */
.rk-g-eye {
  position: relative;
  flex: none;
  width: 46px; height: 46px;
  border-radius: 50%;
  background: var(--drop-lip, #0a0806);
  display: grid; place-items: center;
  overflow: hidden;
}
.rk-g-video {
  width: 100%; height: 100%;
  object-fit: cover;
  transform: scaleX(-1);            /* a mirror, because that is what a hand expects of a mirror */
  border-radius: 50%;
  opacity: 0.85;
}
.rk-g[data-gesture-state='disabled'] .rk-g-video,
.rk-g[data-gesture-state='unavailable'] .rk-g-video { display: none; }
.rk-g-glyph { position: absolute; font-size: 13px; color: var(--muted); line-height: 1; }
.rk-g-ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.rk-g-track { fill: none; stroke: var(--edge); stroke-width: 4; }
.rk-g-fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 90ms linear;
}
.rk-g[data-gesture-state='fired'] .rk-g-fill { stroke: var(--drop-calm-ink, #7fe0ac); }

.rk-g-body { flex: 1 1 190px; min-width: 0; }
.rk-g-head {
  margin: 0;
  font: 500 11px/1.3 var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink);
}
.rk-g[data-gesture-state='held'] .rk-g-head { color: var(--accent); }
.rk-g[data-gesture-state='unavailable'] .rk-g-head { color: var(--drop-critical-ink, #ff8f84); }
.rk-g-sub { margin: 4px 0 0; font-size: 11px; line-height: 1.45; color: var(--muted); }

.rk-g-controls { display: flex; gap: 6px; margin-left: auto; }
.rk-g-btn {
  padding: 5px 10px;
  border: 1px solid var(--edge);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font: 500 10px/1 var(--font-mono, ui-monospace, Menlo, monospace);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
}
.rk-g-btn:hover { color: var(--ink); border-color: var(--muted); }
.rk-g-btn:focus-visible { outline: 2px solid var(--drop-focus, #f0a648); outline-offset: 3px; }

.rk-g-slider { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.rk-g-slider-label, .rk-g-slider-value {
  font: 500 9px/1 var(--font-mono, ui-monospace, Menlo, monospace);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.rk-g-slider-value { font-variant-numeric: tabular-nums; color: var(--ink); }
.rk-g-range { flex: 1 1 auto; max-width: 220px; accent-color: var(--accent); cursor: pointer; }

.rk-g-sr {
  position: absolute; width: 1px; height: 1px;
  margin: -1px; padding: 0; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; border: 0;
}

/* The ring is the only moving part, and it moves at the speed of a human hand, not a strobe. */
@media (prefers-reduced-motion: reduce) {
  .rk-g-fill { transition: none; }
}
`;

export default GestureConfirm;
