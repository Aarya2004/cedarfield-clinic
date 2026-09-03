import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ClinicBooking } from '@/components/clinic/ClinicBooking';
import { bootstrapScript, loadToolDescriptors } from '@/lib/drop/clinic-bootstrap';

/** Static: the same twelve descriptors on every request, computed once per server. */
const BOOTSTRAP = bootstrapScript(loadToolDescriptors());
/** Stamped once per server start: Vercel's commit for this deployment, and when this server came up. */
const BUILD = {
  sha: (process.env.NEXT_PUBLIC_BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'local').slice(0, 7),
  at: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
};

/**
 * Load-bearing, not cosmetic — the same reason as `/clinic`. `middleware.ts` mints the CSP nonce per
 * request, so a statically prerendered route ships script tags with no nonce and every chunk is
 * refused by `script-src 'strict-dynamic'`: the page renders its SSR shell and never hydrates, which
 * on this route would mean no board, no clock and no tools. Bench finding #5 (tickets/T8).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Book an appointment — Cedarfield Clinic',
  description:
    'Cancelled appointments at Cedarfield Clinic, released as they come in. Choose a time, give the patient’s details, and confirm.',
};

export default async function ClinicBookPage() {
  // The tools exist from the first byte (clinic-bootstrap.ts): registered by this inline script under
  // the request's CSP nonce, before any bundle; the app takes over their execution when it hydrates.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOTSTRAP }} />
      <ClinicBooking build={BUILD} />
    </>
  );
}
