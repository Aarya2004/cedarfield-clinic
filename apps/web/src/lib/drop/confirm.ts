/**
 * The confirm surface's state machine (DROP-PLAN §2.2, §4 token flow). Pure — no DOM, no WS —
 * so every transition is unit-tested; the React component and the room client are thin skins.
 *
 * Flow: a hold (or waitlist offer) arms the surface → a TRUSTED human input (keydown/switch, or
 * a completed gesture dwell) asks the room for a single-use confirm token → the token comes back
 * over the authenticated WS → the client immediately spends it on /confirm → booked. The token
 * round-trip exists so the consequential write cannot be forged by anything that merely holds
 * the fetch endpoint (an agent, a script with the URL): tokens are minted only in response to a
 * page-reported trusted input on the live socket, single-use, 5 s expiry. The residual boundary
 * (a malicious page script could synthesize the input report) is the same class as Rokan's
 * Enter and is stated in SECURITY §10 — the page is the trust boundary, honestly.
 *
 * Gesture dwell: the chosen gesture must stay above `threshold` for DWELL_MS continuously.
 * Progress is exposed 0..1 for the on-screen ring; ANY drop below threshold resets to 0 — a
 * tremor that flickers across the line never fires (WCAG 2.5.4 thinking: no accidental motion
 * actuation). Keyboard/switch never uses dwell: one keydown is one trusted input, full stop.
 */

export const DWELL_MS = 800;
export const TOKEN_TTL_MS = 5_000;

export type ConfirmPhase =
  | 'idle' // no hold — nothing to confirm
  | 'armed' // hold live; waiting for the person
  | 'requesting' // trusted input seen; token asked of the room
  | 'confirming' // token in hand; /confirm in flight
  | 'booked'
  | 'lapsed'; // hold expired while waiting

export type TrustedInput = { kind: 'key' } | { kind: 'switch' } | { kind: 'gesture'; name: string };

export interface ConfirmState {
  phase: ConfirmPhase;
  holdId?: string;
  expiresAt?: number;
  input?: TrustedInput;
  tokenRequestedAt?: number;
  error?: 'token_expired' | 'hold_lapsed' | 'refused';
}

export const initialConfirm: ConfirmState = { phase: 'idle' };

export type ConfirmEvent =
  | { t: 'hold'; holdId: string; expiresAt: number }
  | { t: 'hold_gone' } // released or taken over (never happens for a live hold; defensive)
  | { t: 'trusted_input'; input: TrustedInput; at: number }
  | { t: 'token'; at: number }
  | { t: 'confirm_ok' }
  | { t: 'confirm_refused' }
  | { t: 'tick'; at: number };

export function reduceConfirm(state: ConfirmState, ev: ConfirmEvent): ConfirmState {
  switch (ev.t) {
    case 'hold':
      // A new hold always re-arms, including after booked/lapsed (next round).
      return { phase: 'armed', holdId: ev.holdId, expiresAt: ev.expiresAt };
    case 'hold_gone':
      return state.phase === 'booked' ? state : { phase: 'idle' };
    case 'trusted_input':
      if (state.phase !== 'armed') return state; // ignore inputs with nothing to confirm
      return { ...state, phase: 'requesting', input: ev.input, tokenRequestedAt: ev.at };
    case 'token':
      if (state.phase !== 'requesting') return state;
      if (state.tokenRequestedAt !== undefined && ev.at - state.tokenRequestedAt > TOKEN_TTL_MS) {
        // The room minted it but we were too slow (tab bg, jank): fail closed, re-arm.
        return { phase: 'armed', holdId: state.holdId, expiresAt: state.expiresAt, error: 'token_expired' };
      }
      return { ...state, phase: 'confirming' };
    case 'confirm_ok':
      return state.phase === 'confirming' ? { phase: 'booked', holdId: state.holdId } : state;
    case 'confirm_refused':
      return state.phase === 'confirming' || state.phase === 'requesting'
        ? { phase: 'armed', holdId: state.holdId, expiresAt: state.expiresAt, error: 'refused' }
        : state;
    case 'tick':
      if (
        (state.phase === 'armed' || state.phase === 'requesting') &&
        state.expiresAt !== undefined &&
        ev.at >= state.expiresAt
      ) {
        return { phase: 'lapsed', holdId: state.holdId, error: 'hold_lapsed' };
      }
      return state;
    default:
      return state;
  }
}

/** Gesture dwell tracker: feed per-frame recognition; fires once when held DWELL_MS above threshold. */
export class DwellTracker {
  private since: number | undefined;
  private fired = false;
  private readonly gesture: string;
  private readonly threshold: number;

  constructor(gesture: string, threshold: number) {
    this.gesture = gesture;
    this.threshold = threshold;
  }

  /** Returns dwell progress 0..1; exactly one frame returns `fire: true`. */
  frame(name: string | undefined, score: number, at: number): { progress: number; fire: boolean } {
    const on = name === this.gesture && score >= this.threshold;
    if (!on) {
      this.since = undefined;
      this.fired = false;
      return { progress: 0, fire: false };
    }
    if (this.since === undefined) this.since = at;
    const progress = Math.min(1, (at - this.since) / DWELL_MS);
    if (progress >= 1 && !this.fired) {
      this.fired = true;
      return { progress: 1, fire: true };
    }
    return { progress, fire: false };
  }
}
