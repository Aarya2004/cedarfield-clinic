// Rendered per request so the CSP nonce from middleware is fresh (see src/middleware.ts).
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { ClientApp } from '@/components/ClientApp';

// The kept pre-pivot entry names itself; the root default belongs to the clinic.
export const metadata: Metadata = {
  title: 'Rokan Terminal',
  description:
    "Do it once. Now it's a tool. A terminal where what you and your agent compose becomes a live WebMCP tool, born at runtime, run only by your Enter.",
};

export default function Home() {
  return <ClientApp />;
}
