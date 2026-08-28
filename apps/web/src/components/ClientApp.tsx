'use client';

import dynamic from 'next/dynamic';

// xterm touches `window` at import time; the app shell is client-only.
export const ClientApp = dynamic(() => import('./App').then((m) => m.App), { ssr: false });
