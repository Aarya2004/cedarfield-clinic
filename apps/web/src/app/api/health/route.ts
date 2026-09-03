import { NextResponse } from 'next/server';

/**
 * Liveness for the judging window (2026-09-03 → 2026-10-01 and beyond).
 *
 * Two things can take a page down with nobody touching the code: a Supabase project on the free
 * tier pauses after a week without traffic, and a board nobody reads never sweeps forward. This
 * route reads the board through the service role once — which counts as activity and advances the
 * waves — and reports what it saw. Vercel's daily cron (vercel.json) calls it; a person can too.
 * It spends nothing, writes nothing of its own, and leaks nothing: the body is counts and a build.
 */
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://hxqpaquhkmnrnjfutuyu.supabase.co';

export async function GET() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return NextResponse.json({ ok: false, board: 'no service key' }, { status: 503 });
  const t0 = Date.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/clinic_board`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ ok: false, board: `rpc ${r.status}` }, { status: 503 });
    const data = (await r.json()) as { slots?: unknown[]; live?: boolean; next_wave_at?: string } | null;
    const slots = Array.isArray(data?.slots) ? data!.slots!.length : 0;
    return NextResponse.json({
      ok: true,
      board: data?.live === false ? 'offline (kill switch)' : 'live',
      slots,
      next_wave_at: data?.next_wave_at ?? null,
      ms: Date.now() - t0,
    });
  } catch {
    return NextResponse.json({ ok: false, board: 'unreachable' }, { status: 503 });
  }
}
