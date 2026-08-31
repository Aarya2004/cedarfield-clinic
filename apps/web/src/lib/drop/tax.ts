/**
 * The interaction tax, measured honestly (DROP-PLAN §2.2, locked decision §0.2).
 *
 * Both modes are counted by THIS code from real input events — never estimated. `manual` counts
 * every human input it takes to book by hand; `agent` counts the human inputs while the agent
 * does the structure (expected ≤ 3: enable, maybe scroll, the confirm press). The on-screen
 * claim is exactly `manual.total` vs `agent.total`, with the event breakdown available on
 * hover/expand so a judge can audit what counted.
 *
 * What counts as one interaction (and why):
 *  - pointerdown  — a click/tap costs a motor action (not `click`: drags fire pointerdown too)
 *  - keydown      — each key press (screen-reader/switch users pay per key); held-key repeats
 *                   are collapsed (repeat=true ignored)
 *  - wheel/scroll — bucketed: a burst of wheel events within SCROLL_BURST_MS counts once
 *                   (scrolling a page costs one motor action, not sixty deltas)
 *  - gesture      — a completed held gesture (the page's own dwell ring firing) counts one
 *
 * Deliberately NOT counted: pointermove (free for mouse users, would inflate manual mode),
 * focus/blur (side effects), agent tool calls (they are the point — zero human cost).
 */

export type TaxMode = 'manual' | 'agent';
export type TaxEvent = 'pointer' | 'key' | 'scroll' | 'gesture';

export const SCROLL_BURST_MS = 350;

export interface TaxCount {
  pointer: number;
  key: number;
  scroll: number;
  gesture: number;
}

export interface TaxSnapshot {
  mode: TaxMode;
  counts: TaxCount;
  total: number;
  startedAt: number;
}

const zero = (): TaxCount => ({ pointer: 0, key: 0, scroll: 0, gesture: 0 });

export class TaxMeter {
  private counts: TaxCount = zero();
  private lastScrollAt = -Infinity;
  private startedAt: number;

  constructor(
    readonly mode: TaxMode,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.startedAt = this.now();
  }

  /** Record one raw input event; returns true when it counted. */
  record(event: TaxEvent, opts: { repeat?: boolean } = {}): boolean {
    if (event === 'key' && opts.repeat) return false;
    if (event === 'scroll') {
      const t = this.now();
      if (t - this.lastScrollAt < SCROLL_BURST_MS) {
        this.lastScrollAt = t;
        return false;
      }
      this.lastScrollAt = t;
    }
    this.counts[
      event === 'pointer' ? 'pointer' : event === 'key' ? 'key' : event === 'scroll' ? 'scroll' : 'gesture'
    ] += 1;
    return true;
  }

  snapshot(): TaxSnapshot {
    const { pointer, key, scroll, gesture } = this.counts;
    return {
      mode: this.mode,
      counts: { pointer, key, scroll, gesture },
      total: pointer + key + scroll + gesture,
      startedAt: this.startedAt,
    };
  }

  reset(): void {
    this.counts = zero();
    this.lastScrollAt = -Infinity;
    this.startedAt = this.now();
  }
}

/**
 * Wire a meter to a DOM root. Returns the detach function. Kept tiny and side-effect-free so the
 * unit tests exercise TaxMeter directly; this is the only DOM-touching seam.
 */
export function attachTaxMeter(meter: TaxMeter, root: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>): () => void {
  const onPointer = (): void => void meter.record('pointer');
  const onKey = (e: Event): void => void meter.record('key', { repeat: (e as KeyboardEvent).repeat });
  const onWheel = (): void => void meter.record('scroll');
  root.addEventListener('pointerdown', onPointer, { capture: true, passive: true });
  root.addEventListener('keydown', onKey, { capture: true, passive: true });
  root.addEventListener('wheel', onWheel, { capture: true, passive: true });
  return () => {
    root.removeEventListener('pointerdown', onPointer, { capture: true });
    root.removeEventListener('keydown', onKey, { capture: true });
    root.removeEventListener('wheel', onWheel, { capture: true });
  };
}
