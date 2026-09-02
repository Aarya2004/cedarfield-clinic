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

/**
 * T6's camera dwell, and ONLY when the build asked for it (`NEXT_PUBLIC_DROP_GESTURE=1`).
 * MediaPipe needs two doors opened that are shut by default here, and both are shut again the
 * moment the flag is absent — with the flag off these headers are byte-identical to before T6:
 *   · `wasm-unsafe-eval` — Chrome refuses `WebAssembly.instantiate` under an explicit `script-src`
 *     without it. It permits wasm compilation only; it does NOT restore `eval` for JavaScript.
 *   · `camera=(self)` in Permissions-Policy — the default `camera=()` disables `getUserMedia` for
 *     this origin outright, so without this the module could only ever report `unavailable`.
 */
const gesture = process.env.NEXT_PUBLIC_DROP_GESTURE === '1';
// SPEC-V3: the shared live board. Same rule as the gesture doors: present only when the build
// asked for it, and scoped to the one project origin — never a wildcard over all of Supabase.
const liveBoard = process.env.NEXT_PUBLIC_LIVE_BOARD !== '0';
const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://hxqpaquhkmnrnjfutuyu.supabase.co').replace(/\/$/, '');
const supabaseWs = supabaseOrigin.replace(/^https:/, 'wss:');
const liveHosts = liveBoard ? ` ${supabaseOrigin} ${supabaseWs}` : '';

export function middleware(request: NextRequest) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const dev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'",
    // dev needs eval for React Refresh; production is nonce-only
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}${gesture ? " 'wasm-unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ws://127.0.0.1:* ws://localhost:* wss://*.trycloudflare.com${bridgeHosts}${liveHosts}`,
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
  // `tools=(self)`: WebMCP's own Permissions-Policy feature — only this origin may register tools
  // (no embedded third party ever could). Unknown to older browsers, harmlessly ignored.
  res.headers.set('permissions-policy', `tools=(self), camera=${gesture ? '(self)' : '()'}, microphone=(), geolocation=()`);
  // Chrome disables WebMCP under `Origin-Agent-Cluster: ?0`; state the opposite explicitly.
  res.headers.set('origin-agent-cluster', '?1');
  return res;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
};
