/**
 * Wave staging on the wall clock — the one piece of new logic the clinic needed (SPEC-V1 §2).
 *
 * The mock driver (lib/drop/mock-driver.ts) simulates ONE wave per instance: it is constructed,
 * the wave lands, the rival works through its seeded budget, and that run is over. A real clinic
 * releases cancellations again and again, and both clinic routes have to agree about when the next
 * release is — the landing page counts down to it, the booking page stages a fresh driver at it.
 *
 * Rather than hold shared state between two routes, both derive everything from the wall clock:
 * waves land on a fixed period from the epoch, so `waveIndexAt(Date.now())` is the same number in
 * both tabs, in both routes, with no coordination. The index seeds the driver, so the board a
 * visitor sees during a given wave is the same board anyone else sees during that wave — and
 * arriving mid-wave is handled by advancing a fresh driver to `msIntoWave` before it is rendered.
 *
 * Pure and clock-free (every function takes `now`), relative `.ts` imports only, so it runs under
 * `node --test` without a browser (tickets/MAP.md).
 */

/**
 * How long a wave owns the board. Retuned 2026-09-02 for the judged client: ChatGPT desktop's
 * per-call latency measured 10–39 s, so a 45 s hold had 31 s left by the time the agent finished
 * reporting it and a 90 s wave rolled between two answers. A hold is now three minutes (a person
 * on voice, a slow client, a real decision) and a wave six, so a hold always fits inside the wave
 * it was placed in with room either side. The seeded rival still moves in the first 40 seconds.
 */
export const WAVE_PERIOD_MS = 360_000;

/** Seconds a hold survives. Named here because the landing page promises it and the board burns it. */
export const HOLD_TTL_SECONDS = 180;

function period(periodMs: number): number {
  return Number.isFinite(periodMs) && periodMs > 0 ? periodMs : WAVE_PERIOD_MS;
}

/** Which wave owns `now`. Counts from the epoch, so it never depends on when the page was opened. */
export function waveIndexAt(now: number, periodMs: number = WAVE_PERIOD_MS): number {
  if (!Number.isFinite(now)) return 0;
  return Math.floor(now / period(periodMs));
}

/** The instant that wave landed. */
export function waveStartAt(index: number, periodMs: number = WAVE_PERIOD_MS): number {
  return index * period(periodMs);
}

/** How far into the current wave `now` is, in ms. 0 exactly on a boundary. */
export function msIntoWave(now: number, periodMs: number = WAVE_PERIOD_MS): number {
  const p = period(periodMs);
  return now - waveIndexAt(now, p) * p;
}

/**
 * Milliseconds until the next release. Exactly on a boundary this is a full period, never 0 — the
 * countdown reads "1:30", not a frame of "0:00" that looks like a stalled clock.
 */
export function msUntilNextWave(now: number, periodMs: number = WAVE_PERIOD_MS): number {
  const p = period(periodMs);
  return p - msIntoWave(now, p);
}

/** Seconds until the next release, for `formatClock` in lib/drop/time.ts. */
export function secondsUntilNextWave(now: number, periodMs: number = WAVE_PERIOD_MS): number {
  return msUntilNextWave(now, periodMs) / 1000;
}

/**
 * The driver seed for a wave. A string so the driver's FNV-1a path is used and consecutive waves
 * look nothing like each other — a numeric index would walk the generator one step at a time and
 * every wave would open with almost the same board.
 */
export function waveSeed(index: number): string {
  return `cedarfield-wave-${index}`;
}

/** "Released 0:34 ago" / "Released just now" — the line above the sheet. */
export function describeWaveAge(msElapsed: number): string {
  const s = Math.floor(Math.max(0, msElapsed) / 1000);
  if (s < 5) return 'Released just now';
  if (s < 60) return `Released ${s} seconds ago`;
  const m = Math.floor(s / 60);
  return m === 1 ? 'Released a minute ago' : `Released ${m} minutes ago`;
}
