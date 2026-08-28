// Rendered per request so the CSP nonce from middleware is fresh (see src/middleware.ts).
export const dynamic = 'force-dynamic';

import { ClientApp } from '@/components/ClientApp';

export default function Home() {
  return <ClientApp />;
}
