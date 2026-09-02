// Rendered per request so the CSP nonce from middleware is fresh (see src/middleware.ts).
// A statically prerendered route ships script tags with no nonce and never hydrates — bench
// finding #5 (tickets/T8). Every route in this app needs this line.
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { ClinicLanding } from '@/components/clinic/ClinicLanding';

/**
 * The front door is the product.
 *
 * A judge who types the bare domain must land on the thing being judged. Until 2026-08-31 this
 * route served Rokan Terminal, the pre-pivot entry, which would have shown a shell prompt to
 * someone arriving to review a clinic booking page — the most expensive kind of first impression.
 * Rokan is not deleted: it still runs at `/terminal`, and its eval suite drives it there.
 *
 * Reverting is one `git revert` of this commit if the founders want the old front door back.
 */
export const metadata: Metadata = {
  title: 'Cedarfield Clinic — book a same-day appointment',
  description:
    'Cancelled appointments at Cedarfield Clinic go back on the list at the next release, so nobody has to refresh the page to catch one. Book online, or call 01632 960 118.',
};

export default function Home() {
  return <ClinicLanding />;
}
