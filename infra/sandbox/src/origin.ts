/**
 * Origin policy for the judge Worker (pure, unit-tested). A request that *carries* an `Origin`
 * header from anywhere but the app (or localhost dev) is refused with 403 **before** it can touch
 * the Gate: a cross-origin simple POST needs no preflight, so hiding CORS headers alone still lets
 * any page a judge visits burn their 1-per-10-min sandbox quota. Requests without an `Origin`
 * (curl, the eval harness, server-to-server) are not browsers and are unaffected.
 */
const LOCAL_DEV = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function originAllowed(appOrigin: string, origin: string): boolean {
  if (!origin) return false; // `Origin: null` (opaque / sandboxed) — fail closed
  return origin === appOrigin || LOCAL_DEV.test(origin);
}

/** CORS headers for an allowed origin; `{}` when the request carries no Origin. */
export function corsHeaders(appOrigin: string, origin: string | null): Record<string, string> {
  if (origin === null || !originAllowed(appOrigin, origin)) return {};
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
}
