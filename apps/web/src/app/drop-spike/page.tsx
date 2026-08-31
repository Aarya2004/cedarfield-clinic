/**
 * /drop-spike — the playground for the Drop UI spike (T8).
 *
 * A lock-decision aid, not a product surface: it exists so two humans can watch the 60-second arc
 * end to end before deciding whether to build the drop. It composes T1–T5 and T7 through the single
 * adapter seam in `components/drop/useDropSession.ts` and registers no WebMCP tool of any kind —
 * `navigator.modelContext` is not touched anywhere on this route.
 *
 * The whole page is client-side (one rAF clock drives the simulation), so this file is only the
 * route: metadata here, everything else in `DropBench`.
 */
import type { Metadata } from 'next';
import { DropBench } from '@/components/drop/DropBench';

/**
 * Same reason as `app/page.tsx`, and it is load-bearing rather than cosmetic: the nonce in our CSP
 * is minted per request by `middleware.ts`, so a statically prerendered route ships HTML whose
 * script tags carry no nonce and every chunk is refused by `script-src 'strict-dynamic'`. Caught by
 * driving the built page in headless Chromium — without this line /drop-spike renders its SSR shell
 * and then never hydrates.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Drop bench — UI spike',
  description:
    'The same appointment drop run twice, by hand and by agent, with both interaction costs measured on the page. A spike prototype: no WebMCP tools are registered here.',
};

export default function DropSpikePage() {
  return <DropBench />;
}
