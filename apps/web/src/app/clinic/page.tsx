import type { Metadata } from 'next';
import { ClinicLanding } from '@/components/clinic/ClinicLanding';

/**
 * Load-bearing, not cosmetic. `middleware.ts` mints the CSP nonce per request, so a statically
 * prerendered route ships script tags with no nonce and every chunk is refused by
 * `script-src 'strict-dynamic'` — the page renders its SSR shell and never hydrates. Bench finding
 * #5 (tickets/T8), caught by driving the built page in headless Chromium. Check every new route.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cedarfield Clinic — book a same-day appointment',
  description:
    'Cancelled appointments at Cedarfield Clinic go back on the list at the next release, so nobody has to refresh the page to catch one. Book online, or call 01632 960 118.',
};

export default function ClinicPage() {
  return <ClinicLanding />;
}
