'use client';

/**
 * The board, in the hero — proof before the scroll (SPEC-V7, 2026-09-02).
 *
 * The front door used to be words and a countdown; a judge saw no product until the second page.
 * This mounts the SAME board the booking page shows — the shared live one for real visitors, the
 * seeded one under `?test=1` or when the live board cannot be reached — read-only, compact, and
 * ticking. Clicking a row is the same act as the "Open the booking page" button: it takes you to
 * the page where a person can act. Nothing here holds or books; it only shows.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMockDriver } from '../../lib/drop/mock-driver.ts';
import { createSupabaseDriver, type LiveDriver } from '../../lib/drop/supabase-driver.ts';
import type { DropDriver } from '../../lib/drop/types.ts';
import { useDropSession } from '../drop/useDropSession.ts';
import { SlotSheet } from './SlotSheet.tsx';
import { HOLD_TTL_SECONDS, msIntoWave, waveIndexAt, waveSeed } from './wave-clock.ts';

const LIVE_BUILD = process.env.NEXT_PUBLIC_LIVE_BOARD !== '0';

function wantsLive(): boolean {
  if (!LIVE_BUILD || typeof window === 'undefined') return false;
  return !new URLSearchParams(window.location.search).has('test');
}

const INERT: DropDriver = {
  subscribe: () => () => {},
  hold: () => {},
  book: () => {},
  confirm: () => {},
  release: () => {},
  cancel: () => {},
  move: () => {},
};

export function BoardPreview() {
  const router = useRouter();
  // Decided after mount (hydration-safe, same rule as the booking page).
  const [live, setLive] = useState(false);
  const [liveFailed, setLiveFailed] = useState(false);
  const [liveDriver, setLiveDriver] = useState<LiveDriver | null>(null);
  useEffect(() => setLive(wantsLive()), []);
  useEffect(() => {
    if (!live || liveFailed) return;
    const d = createSupabaseDriver();
    setLiveDriver(d);
    const probe = setInterval(() => {
      const m = d.meta();
      if (m.ready) return;
      if (m.offline || (m.lastError !== null && m.lastError.startsWith('sign_in:'))) setLiveFailed(true);
    }, 250);
    const grace = setTimeout(() => {
      if (!d.meta().ready) setLiveFailed(true);
    }, 6000);
    return () => {
      clearInterval(probe);
      clearTimeout(grace);
      d.dispose();
      setLiveDriver(null);
    };
  }, [live, liveFailed]);

  const showLive = live && !liveFailed;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const mock = useMemo(() => {
    if (showLive || !hydrated) return null;
    const test = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('test');
    const d = createMockDriver({ seed: waveSeed(test ? 0 : waveIndexAt(Date.now())), scenario: 'hold-and-book', overrides: { slotCount: 6, ttlSeconds: HOLD_TTL_SECONDS, rivalTakes: 3, firstTakeMs: 6_000, gapMs: 14_000, taper: 1.15, waveDelayMs: 0 } });
    if (!test) d.advance(msIntoWave(Date.now()));
    return d;
  }, [showLive, hydrated]);

  const driver = showLive ? (liveDriver ?? INERT) : (mock ?? INERT);
  const session = useDropSession(driver, { running: true, clock: showLive ? null : (mock as ReturnType<typeof createMockDriver> | null) });
  const ready = showLive ? (liveDriver?.meta().ready ?? false) : session.slots.length > 0;

  return (
    <section className="cl-preview" aria-label="Appointments available now" data-clinic-preview={showLive ? 'live' : 'seeded'} data-clinic-preview-ready={ready ? 'true' : 'false'}>
      {showLive && !ready ? <p className="cl-preview__eyebrow">Checking today’s availability…</p> : null}
      {ready ? (
        <SlotSheet
          slots={session.slots}
          onOpen={() => router.push('/clinic/book')}
          heldSlotId={null}
          holdOrigin="you"
          holdSecondsLeft={0}
          holdTtlSeconds={HOLD_TTL_SECONDS}
          now={session.now}
        />
      ) : (
        <ul className="cl-sheet cl-sheet--skeleton" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="cl-row cl-row--skeleton" />
          ))}
        </ul>
      )}
      <p className="cl-preview__note">Choose a time to book it. Cancelled appointments are added as they come in.</p>
    </section>
  );
}
