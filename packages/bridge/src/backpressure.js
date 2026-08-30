/**
 * PTY → WebSocket backpressure (review P1-5, 2026-08-29). Before this, every PTY chunk was sent
 * regardless of `ws.bufferedAmount`; a `yes`/`cat bigfile` over a slow tunnel grew the socket's
 * send queue without bound. Now: when the paired socket's queue passes HIGH_WATER the PTY is
 * paused (node-pty `pause()` → the child blocks on a full pipe, exactly like a slow real
 * terminal); a 50 ms poll resumes it once the queue drains below LOW_WATER, or as soon as the
 * client is gone (nothing to wait for — and a dead tab must never wedge the shell).
 *
 * Pure control logic with injected `getClient` / `pause` / `resume` so a fake socket whose
 * `bufferedAmount` the test controls can drive it (test/backpressure.test.mjs).
 */
export const HIGH_WATER = 4 * 1024 * 1024;
export const LOW_WATER = 1 * 1024 * 1024;
export const POLL_MS = 50;

export class Backpressure {
  constructor({ getClient, pause, resume, log = () => {}, highWater = HIGH_WATER, lowWater = LOW_WATER, pollMs = POLL_MS }) {
    this.getClient = getClient;
    this.pauseFn = pause;
    this.resumeFn = resume;
    this.log = log;
    this.highWater = highWater;
    this.lowWater = lowWater;
    this.pollMs = pollMs;
    this.paused = false;
    this.timer = null;
    this.pauses = 0; // measured, for the status line / tests
  }

  /** Call after every send. Pauses the PTY when the client's queue is over the high-water mark. */
  check() {
    if (this.paused) return;
    const c = this.getClient();
    if (!c || c.readyState !== c.OPEN) return;
    if ((c.bufferedAmount ?? 0) <= this.highWater) return;
    this.paused = true;
    this.pauses++;
    this.pauseFn();
    this.log(`backpressure: ${c.bufferedAmount} B queued to the tab — PTY paused`);
    this.schedule();
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.poll(), this.pollMs);
    this.timer.unref?.();
  }

  poll() {
    this.timer = null;
    if (!this.paused) return;
    const c = this.getClient();
    const gone = !c || c.readyState !== c.OPEN;
    if (gone || (c.bufferedAmount ?? 0) < this.lowWater) {
      this.paused = false;
      this.resumeFn();
      this.log(gone ? 'backpressure: tab gone — PTY resumed' : `backpressure: drained to ${c.bufferedAmount} B — PTY resumed`);
      return;
    }
    this.schedule();
  }

  /** Forget the paused state without touching the PTY (a fresh shell starts unpaused). */
  reset() {
    clearTimeout(this.timer);
    this.timer = null;
    this.paused = false;
  }
}
