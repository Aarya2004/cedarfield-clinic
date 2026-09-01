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
  title: 'Cedarfield Clinic — appointments released in waves',
  description:
    'A clinic that hands the structure of booking to your agent and keeps the one act that must stay yours: the keypress. A fictional clinic with a simulated rival — nothing real is booked.',
};

export default function ClinicPage() {
  return <ClinicLanding />;
}
