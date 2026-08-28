/**
 * rokan-sandbox — judge mode. A stranger gets a throttled container running OUR bridge; the
 * page pairs over the same protocol as builder mode. Routes:
 *   POST   /api/session        → { sid, ws, token, ttl_ms, mode:"judge", cold_ms }   (rate-limited per IP)
 *   GET    /ws/:sid            → WebSocket upgrade proxied to the bridge inside the sandbox (port 7331)
 *   GET    /api/health         → { ok:true }
 * `sid` is HMAC-signed with the `SID_SECRET` secret (`wrangler secret put SID_SECRET`); `/ws/:sid`
 * verifies it before touching a sandbox, so an unissued id never starts a container. There is no
 * DELETE route: nothing calls one, and an unauthenticated one let a third party destroy a session.
 * The bridge token is issued once and never stored by the Worker; the bridge verifies it.
 */
import { getSandbox, Sandbox } from '@cloudflare/sandbox';

// The sandbox DO reaches its container through `ctx.exports.ContainerProxy`; the SDK requires the
// Worker entrypoint to re-export it. Without this every container start logs
// `ctx.exports.ContainerProxy is undefined` and times out (measured 2026-08-28: 135 s → 503).
export { ContainerProxy } from '@cloudflare/sandbox';
import { Gate } from './gate';
import { corsHeaders, originAllowed } from './origin';
import { issueSid, verifySid } from './sid';

export { Gate };

export interface Env {
  Sandbox: DurableObjectNamespace<RokanSandbox>;
  Gate: DurableObjectNamespace<Gate>;
  APP_ORIGIN: string;
  SESSION_TTL_MS: string;
  SESSIONS_PER_IP_PER_10MIN: string;
  MAX_CONCURRENT_PER_IP: string;
  /** secret: `wrangler secret put SID_SECRET` (any long random string); sessions are refused without it */
  SID_SECRET?: string;
  // No model key is wired into the sandbox on purpose: rokan-do there can only replay seeds; nothing can spend.
}

/** Egress: nothing but the demo hosts (HTTP/S only — the SDK cannot filter raw TCP/UDP; say so). */
export class RokanSandbox extends Sandbox<Env> {
  enableInternet = false;
  allowedHosts = ['news.ycombinator.com', 'lobste.rs', 'example.org', 'api.anthropic.com'];
}

const BRIDGE_PORT = 7331;
/** A session counts as active for this long until the bridge answers; a client that gives up (or a
 *  Worker invocation that dies) before then must not lock its IP for the full TTL (measured
 *  2026-08-28: three aborted starts → "3 active sandboxes", retry in 977 s). */
const PROVISIONAL_MS = 180_000;

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

function hex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Disallowed origin → 403 before any handler (never before-the-Gate work for a stranger's page).
    const origin = request.headers.get('origin');
    if (origin !== null && !originAllowed(env.APP_ORIGIN, origin)) return json({ error: 'origin not allowed' }, 403);
    const h = corsHeaders(env.APP_ORIGIN, origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    if (url.pathname === '/api/health') return json({ ok: true, mode: 'judge' }, 200, h);

    if (url.pathname === '/api/session' && request.method === 'POST') {
      if (!env.SID_SECRET) {
        console.error('SID_SECRET is not set — refusing to issue sessions (wrangler secret put SID_SECRET)');
        return json({ error: 'the sandbox is not configured; please try again later' }, 503, h);
      }
      const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
      const ttl = Number.parseInt(env.SESSION_TTL_MS, 10) || 1_800_000;
      const id = hex(12);
      const sid = await issueSid(env.SID_SECRET, id, Date.now() + ttl);
      const gate = env.Gate.get(env.Gate.idFromName(ip));
      const perWindow = Number.parseInt(env.SESSIONS_PER_IP_PER_10MIN, 10) || 1;
      const maxConcurrent = Number.parseInt(env.MAX_CONCURRENT_PER_IP, 10) || 3;
      const d = await gate.allow(sid, PROVISIONAL_MS, perWindow, maxConcurrent);
      if (!d.ok) {
        const msg = d.reason === 'rate' ? `This IP already started ${perWindow} sandbox${perWindow === 1 ? '' : 'es'} in the last 10 minutes; try again in ${d.retry_after_s} s` : `This IP already has ${d.active} active sandboxes (limit ${maxConcurrent})`;
        return json({ error: msg, retry_after_s: d.retry_after_s }, 429, { ...h, 'retry-after': String(d.retry_after_s ?? 60) });
      }
      const t0 = Date.now();
      const token = hex(16);
      const sandbox = getSandbox(env.Sandbox, id, { sleepAfter: '10m' /* idle instances count against max_instances (Opus VERIFY: 7/10 live while idle) */ });
      try {
        await sandbox.startProcess(`node /opt/bridge/bin/rokan-terminal.js --no-tunnel --mode judge --host 0.0.0.0 --port ${BRIDGE_PORT} --token ${token} --ttl-ms ${ttl} --app ${env.APP_ORIGIN}`);
        // wait until the bridge answers on its port (measured cold start)
        let up = false;
        for (let i = 0; i < 80 && !up; i++) {
          const r = await sandbox.exec(`curl -sf -o /dev/null http://127.0.0.1:${BRIDGE_PORT}/ && echo up`);
          up = r.stdout.includes('up');
          if (!up) await new Promise((res) => setTimeout(res, 250));
        }
        if (!up) {
          await gate.release(sid);
          await sandbox.destroy().catch(() => undefined);
          return json({ error: 'sandbox did not start in time' }, 503, h);
        }
        await gate.confirm(sid, ttl); // the bridge answered: now the session holds its full TTL
      } catch (e) {
        await gate.release(sid);
        await sandbox.destroy().catch(() => undefined); // never leave a half-started instance counting against max_instances
        // Log internals server-side; return a generic message (never leak stack/SDK details to clients).
        console.error('session start failed', sid, e instanceof Error ? e.stack : String(e));
        return json({ error: 'the sandbox could not be started; please try again' }, 503, h);
      }
      const ws = `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}/ws/${sid}`;
      return json({ sid, ws, token, ttl_ms: ttl, mode: 'judge', cold_ms: Date.now() - t0 }, 201, h);
    }

    const wsm = /^\/ws\/([a-f0-9.]{1,96})$/.exec(url.pathname);
    if (wsm) {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocket upgrade required' }, 426, h);
      // Verify the signature BEFORE getSandbox(): the SDK starts a container on first fetch, so an
      // unverified id would let anyone burn max_instances with random sids (Fable F4).
      const id = env.SID_SECRET ? await verifySid(env.SID_SECRET, wsm[1], Date.now()) : null;
      if (!id) return json({ error: 'unknown or expired session' }, 403, h);
      const sandbox = getSandbox(env.Sandbox, id, { sleepAfter: '10m' /* idle instances count against max_instances (Opus VERIFY: 7/10 live while idle) */ });
      return sandbox.wsConnect(request, BRIDGE_PORT);
    }

    return json({ error: 'not found' }, 404, h);
  },
};
