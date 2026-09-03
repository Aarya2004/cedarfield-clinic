import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ClinicBooking } from '@/components/clinic/ClinicBooking';
import { bootstrapScript, loadToolDescriptors } from '@/lib/drop/clinic-bootstrap';
import { BUILD_AT, BUILD_SHA } from '@/build-info';

/** Static: the same twelve descriptors on every request, computed once per server. */
const BOOTSTRAP = bootstrapScript(loadToolDescriptors());
/** Stamped by the deploy step into src/build-info.ts (see there). */
const BUILD = { sha: BUILD_SHA, at: BUILD_AT };

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
