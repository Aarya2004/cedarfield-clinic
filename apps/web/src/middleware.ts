/**
 * Per-request CSP with a script nonce (Next.js picks the nonce up from the request header and
 * stamps it on its own inline scripts). Removes `'unsafe-inline'` from script-src.
 * connect-src stays the enforced allowlist for WebSocket targets (bridge / tunnel / judge Worker).
 */
import { NextResponse, type NextRequest } from 'next/server';

const bridgeHosts = (process.env.NEXT_PUBLIC_BRIDGE_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)
  .map((h) => ` wss://${h} https://${h}`)
  .join('');

export function middleware(request: NextRequest) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const dev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'",
    // dev needs eval for React Refresh; production is nonce-only
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ws://127.0.0.1:* ws://localhost:* wss://*.trycloudflare.com${bridgeHosts}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('content-security-policy', csp);
  res.headers.set('referrer-policy', 'no-referrer');
  res.headers.set('x-content-type-options', 'nosniff');
  res.headers.set('x-frame-options', 'DENY');
  res.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
};
