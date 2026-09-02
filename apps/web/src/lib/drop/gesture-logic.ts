// The rules behind the camera gesture (ticket T6). Pure functions, no DOM, no MediaPipe — the
// component is a thin adapter that feeds this file classifier frames and renders what it decides.
//
// WHY THE SPLIT: a recognizer is 34MB of wasm and a webcam. Neither can run in `node --test`. So
// every rule that could be wrong — how dwell accumulates, what counts as flicker, when the palm is
// considered gone, whether one hold can book twice — lives here and is tested against synthetic
// frames. The adapter above it only converts `GestureRecognizerResult` into `GestureFrame` and
// paints a ring.
//
// WHAT THIS IS NOT: an authentication factor. A dwell on an open palm is not a trusted event —
// `ConfirmSurface` blocks synthetic presses because the UA marks them untrusted, and this path has
// no such guarantee (a photograph of a hand in front of the lens is a palm as far as any classifier
// is concerned). That is exactly why the gesture is off by default, behind a build flag, and never
// the only way to confirm: WCAG 2.5.4 wants a UI alternative, and the honest reading of this module
// is that the keyboard is the real control and the camera is a convenience laid on top of it.

/** The one canned category we accept. Blink/close-fist are not options — see the ticket. */
export const TARGET_GESTURE = 'Open_Palm';

/** Dwell bounds for the user-visible slider, in ms. */
export const DWELL_MIN_MS = 400;
export const DWELL_MAX_MS = 3000;
export const DWELL_DEFAULT_MS = 1000;
export const DWELL_STEP_MS = 100;

/**
 * How long the classifier may lose the palm before the hold is considered broken. MediaPipe drops a
 * frame or two whenever the hand rotates or the exposure shifts; without this, a still hand loses
 * its progress several times a second and the ring never fills.
 */
export const DEFAULT_GRACE_MS = 250;

/** Confidence floor on the canned-gesture score. Below this the frame is treated as no gesture. */
export const DEFAULT_MIN_SCORE = 0.6;

/**
 * The largest gap a single frame may credit. A backgrounded tab, a stalled decode or a laptop lid
 * produces one frame with a multi-second delta; without this clamp that frame alone would complete
 * the dwell and book an appointment nobody was in the room for.
 */
export const MAX_FRAME_MS = 200;

/**
 * TIME IS CREDITED FROM THE LAST *SIGHTING*, NOT THE LAST FRAME. The display refreshes at 60Hz and
 * a webcam delivers 30, so half of the adapter's frames carry no new camera image and are fed here
 * as "no gesture". Crediting from the previous frame would therefore lose half the hold and double
 * every dwell. Crediting from the last sighting means the accounting is wall-clock either way, and
 * the grace window below is what decides whether a stall is a flicker or a departure.
 */

export interface DwellConfig {
  /** How long `TARGET_GESTURE` must be held before it fires. */
  dwellMs: number;
  /** Flicker tolerance: a loss shorter than this keeps the accumulated hold. */
  graceMs: number;
  /** Minimum classifier score for a frame to count. */
  minScore: number;
}

export const DEFAULT_DWELL_CONFIG: DwellConfig = {
  dwellMs: DWELL_DEFAULT_MS,
  graceMs: DEFAULT_GRACE_MS,
  minScore: DEFAULT_MIN_SCORE,
};

/** One classifier result, flattened. `gesture: null` means "no hand, or nothing recognised". */
export interface GestureFrame {
  /** Monotonic ms. `performance.now()` in the browser, a counter in tests. */
  at: number;
  gesture: string | null;
  score: number;
  /**
   * Is there anything to confirm right now? A dwell over a surface with no live hold accumulates
   * nothing — otherwise the ring would be full before the slot even arrived.
   */
  armed: boolean;
}

export interface DwellState {
  /** Accumulated hold, in ms. Never exceeds `dwellMs`. */
  heldMs: number;
  /** When the palm was last counted. `null` = the palm is gone (grace already expired). */
  lastSeenAt: number | null;
  /** Timestamp of the previous frame, for the delta. */
  lastFrameAt: number | null;
  /** One completed dwell fires once. Cleared only when the palm actually leaves. */
  fired: boolean;
}

export function initialDwellState(): DwellState {
  return { heldMs: 0, lastSeenAt: null, lastFrameAt: null, fired: false };
}

export interface DwellStep {
  state: DwellState;
  /** True on exactly the frame that completes a dwell. The adapter calls `onConfirm` on it. */
  fire: boolean;
}

/** 0..1 — what the ring draws. */
export function dwellProgress(state: DwellState, config: DwellConfig): number {
  if (config.dwellMs <= 0) return state.heldMs > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, state.heldMs / config.dwellMs));
}

/** Is the palm currently counted as present (a live frame, or inside the grace window)? */
export function isHolding(state: DwellState): boolean {
  return state.lastSeenAt !== null;
}

/**
 * The whole state machine, one frame at a time.
 *
 * Order of business:
 *  1. A frame with nothing to confirm (`armed: false`) is treated exactly like an empty frame, so
 *     progress cannot be banked before a hold exists.
 *  2. A qualifying frame credits the time since the last sighting *if* that was within `graceMs` —
 *     which deliberately includes short dropouts, because the hand did not actually leave the frame
 *     during them. Re-acquiring after the grace has expired restarts at zero.
 *  3. A non-qualifying frame inside the grace window freezes the hold (no credit, no loss). Past
 *     it, the palm is gone: progress resets and the fire-once latch is released, so the next hold
 *     can book again.
 *  4. `fire` is emitted on the single frame that crosses `dwellMs`.
 */
export function stepDwell(state: DwellState, frame: GestureFrame, config: DwellConfig = DEFAULT_DWELL_CONFIG): DwellStep {
  const qualifies = frame.armed && frame.gesture === TARGET_GESTURE && frame.score >= config.minScore;

  if (!qualifies) {
    const withinGrace = state.lastSeenAt !== null && frame.at - state.lastSeenAt <= config.graceMs;
    if (withinGrace) {
      // Flicker. Hold what we have; the grace clock keeps running from `lastSeenAt`.
      return { state: { ...state, lastFrameAt: frame.at }, fire: false };
    }
    return { state: { heldMs: 0, lastSeenAt: null, lastFrameAt: frame.at, fired: false }, fire: false };
  }

  const sinceSeen = state.lastSeenAt === null ? Number.POSITIVE_INFINITY : Math.max(0, frame.at - state.lastSeenAt);
  const continuous = sinceSeen <= config.graceMs;
  const credit = Math.min(MAX_FRAME_MS, sinceSeen);
  const heldMs = continuous ? Math.min(config.dwellMs, state.heldMs + credit) : 0;
  const complete = heldMs >= config.dwellMs && config.dwellMs > 0;
  const fire = complete && !state.fired;

  return {
    state: { heldMs, lastSeenAt: frame.at, lastFrameAt: frame.at, fired: state.fired || complete },
    fire,
  };
}

// ---------------------------------------------------------------------------
// Why the camera is not available — said plainly
// ---------------------------------------------------------------------------

export type GestureFailure =
  /** The user (or the OS) said no. */
  | 'denied'
  /** No camera on this machine, or it is unplugged. */
  | 'no-camera'
  /** Another app owns the camera. */
  | 'in-use'
  /** No `getUserMedia` at all: an insecure origin, an embedded webview, a locked-down host. */
  | 'unsupported'
  /** The wasm or the model did not load — offline, or the assets were never provisioned. */
  | 'load-failed'
  /** Anything else. */
  | 'error';

interface NamedError {
  name?: unknown;
  message?: unknown;
}

/**
 * Maps a `getUserMedia` rejection onto something we can say out loud. The DOMException names are
 * the spec's, not a guess: NotAllowedError / NotFoundError / NotReadableError / OverconstrainedError.
 */
export function classifyCameraError(err: unknown): GestureFailure {
  const name = typeof (err as NamedError)?.name === 'string' ? ((err as NamedError).name as string) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no-camera';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'in-use';
    case 'TypeError':
      // `navigator.mediaDevices` is undefined on an insecure origin, so the call itself throws.
      return 'unsupported';
    default:
      return 'error';
  }
}

/**
 * The honest line. Every one of these ends the same way on purpose: whatever the camera did, the
 * key still books, and the module has to say so rather than leave a dead button on the surface.
 */
export const FAILURE_COPY: Record<GestureFailure, string> = {
  denied: 'Camera access was declined.',
  'no-camera': 'No camera found on this device.',
  'in-use': 'The camera is busy in another app.',
  unsupported: 'This browser will not hand out a camera here.',
  'load-failed': 'The hand model did not load.',
  error: 'The camera did not start.',
};

/**
 * The four acts one held palm can perform (SPEC-V2, SPEC-V9): book, cancel, move — and `grant`,
 * which gives the assistant standing permission to book (births `clinic_book_slot`).
 */
export type GestureVerb = 'book' | 'cancel' | 'move' | 'grant' | 'sign';

/** Every sentence the module says, conjugated once here so no verb is ever misdescribed. */
export function verbForms(verb: GestureVerb): { infinitive: string; does: string; done: string; keyboard: string } {
  switch (verb) {
    case 'cancel':
      return { infinitive: 'cancel it', does: 'cancels it', done: 'Cancelled', keyboard: 'press Enter' };
    case 'move':
      return { infinitive: 'move it', does: 'moves it', done: 'Moved', keyboard: 'press Enter' };
    case 'grant':
      return {
        infinitive: 'let your assistant book',
        does: 'grants it',
        done: 'Permission given',
        keyboard: 'press the button',
      };
    case 'sign':
      return {
        infinitive: 'sign to your assistant',
        does: 'hands it over',
        done: 'Signed',
        keyboard: 'type it below',
      };
    case 'book':
    default:
      return { infinitive: 'book it', does: 'books it', done: 'Booked', keyboard: 'press Enter' };
  }
}

/**
 * Accessible name for the module's buttons (SPEC-V10). Two modules can share a page — a dock and
 * the grant band — so a bare "Enable camera" is ambiguous to Voice Control. Visible text first
 * (WCAG 2.5.3), then what the palm would do.
 */
export function cameraControlName(visible: string, verb: GestureVerb): string {
  return `${visible} to ${verbForms(verb).infinitive}`;
}

export function failureCopy(failure: GestureFailure, verb: GestureVerb = 'book'): string {
  const f = verbForms(verb);
  return `${FAILURE_COPY[failure]} The keyboard still ${f.does.replace(/ it$/, ' this')} — ${f.keyboard}.`;
}

// ---------------------------------------------------------------------------
// The state hook the DOM exposes
// ---------------------------------------------------------------------------

/** `data-gesture-state`. Exactly the six the ticket names. */
export type GestureUiState = 'disabled' | 'loading' | 'ready' | 'held' | 'fired' | 'unavailable';

export interface GestureUiInputs {
  /** The user's switch. False = the module is dormant and nothing has been loaded. */
  enabled: boolean;
  /** Assets or camera in flight. */
  loading: boolean;
  /** Set once, when something failed. Sticky until the user tries again. */
  failure: GestureFailure | null;
  /** The recognizer is running and frames are arriving. */
  running: boolean;
  /** This hold has already been booked by a dwell. */
  fired: boolean;
  /** Palm currently counted (incl. grace). */
  holding: boolean;
}

export function gestureUiState(input: GestureUiInputs): GestureUiState {
  if (input.failure !== null) return 'unavailable';
  if (!input.enabled) return 'disabled';
  if (input.loading) return 'loading';
  if (input.fired) return 'fired';
  if (input.running && input.holding) return 'held';
  return 'ready';
}

// ---------------------------------------------------------------------------
// Preferences — the off switch and the slider, persisted
// ---------------------------------------------------------------------------

export const GESTURE_ENABLED_KEY = 'drop.gesture.enabled';
export const GESTURE_DWELL_KEY = 'drop.gesture.dwellMs';

/** Any `Storage`-shaped thing. `null` (SSR, or a browser refusing storage) means "default off". */
export interface PrefStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadGestureEnabled(store: PrefStore | null | undefined): boolean {
  if (!store) return false;
  try {
    return store.getItem(GESTURE_ENABLED_KEY) === 'on';
  } catch {
    return false; // a locked-down storage must not decide we open a camera
  }
}

export function saveGestureEnabled(store: PrefStore | null | undefined, on: boolean): void {
  if (!store) return;
  try {
    store.setItem(GESTURE_ENABLED_KEY, on ? 'on' : 'off');
  } catch {
    /* a preference we cannot persist is still a preference for this session */
  }
}

/** Out-of-range, missing or junk values fall back to the default rather than to a broken dwell. */
export function clampDwellMs(value: number): number {
  if (!Number.isFinite(value)) return DWELL_DEFAULT_MS;
  return Math.min(DWELL_MAX_MS, Math.max(DWELL_MIN_MS, Math.round(value)));
}

export function loadDwellMs(store: PrefStore | null | undefined): number {
  if (!store) return DWELL_DEFAULT_MS;
  try {
    const raw = store.getItem(GESTURE_DWELL_KEY);
    if (raw === null) return DWELL_DEFAULT_MS;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? DWELL_DEFAULT_MS : clampDwellMs(parsed);
  } catch {
    return DWELL_DEFAULT_MS;
  }
}

export function saveDwellMs(store: PrefStore | null | undefined, ms: number): void {
  if (!store) return;
  try {
    store.setItem(GESTURE_DWELL_KEY, String(clampDwellMs(ms)));
  } catch {
    /* same */
  }
}

export type CameraPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Whether the module may start the camera without a fresh click.
 *
 * "The switch persists" must not mean "we open the lens on page load". A remembered `on` only
 * auto-starts when the browser already holds a standing grant for this origin — otherwise the user
 * gets a permission prompt they did not ask for, from a page they may have only just opened.
 */
export function shouldAutoStart(pref: boolean, permission: CameraPermission): boolean {
  return pref && permission === 'granted';
}
