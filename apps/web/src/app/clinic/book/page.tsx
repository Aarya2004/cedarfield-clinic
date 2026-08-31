import type { Metadata } from 'next';
import { ClinicBooking } from '@/components/clinic/ClinicBooking';

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
    'Book by hand, or let your agent hold a time and book it with one keypress. Both costs are counted on the page. Demo inventory, simulated rival, nothing real is booked.',
};

export default function ClinicBookPage() {
  return <ClinicBooking />;
}
