/**
 * rokan-sandbox — judge mode. A stranger gets a throttled container running OUR bridge; the
 * page pairs over the same protocol as builder mode. Routes:
 *   POST   /api/session        → { sid, ws, token, ttl_ms, mode:"judge", cold_ms }   (rate-limited per IP)
 *   DELETE /api/session/:sid   → destroys the sandbox
 *   GET    /ws/:sid            → WebSocket upgrade proxied to the bridge inside the sandbox (port 7331)
 *   GET    /api/health         → { ok:true }
 * The bridge token is issued once and never stored by the Worker; the bridge verifies it.
 */
import { getSandbox, Sandbox } from '@cloudflare/sandbox';
import { Gate } from './gate';
import { corsHeaders, originAllowed } from './origin';

export { Gate };

export interface Env {
  Sandbox: DurableObjectNamespace<RokanSandbox>;
  Gate: DurableObjectNamespace<Gate>;
  APP_ORIGIN: string;
  SESSION_TTL_MS: string;
  SESSIONS_PER_IP_PER_10MIN: string;
  MAX_CONCURRENT_PER_IP: string;
  ANTHROPIC_API_KEY?: string;
}

/** Egress: nothing but the demo hosts (HTTP/S only — the SDK cannot filter raw TCP/UDP; say so). */
export class RokanSandbox extends Sandbox<Env> {
  enableInternet = false;
  allowedHosts = ['news.ycombinator.com', 'lobste.rs', 'example.org', 'api.anthropic.com'];
}

const BRIDGE_PORT = 7331;
const SID_RE = /^[a-f0-9]{24}$/;

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
      const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
      const ttl = Number.parseInt(env.SESSION_TTL_MS, 10) || 1_800_000;
      const sid = hex(12);
      const gate = env.Gate.get(env.Gate.idFromName(ip));
      const d = await gate.allow(sid, ttl, Number.parseInt(env.SESSIONS_PER_IP_PER_10MIN, 10) || 1, Number.parseInt(env.MAX_CONCURRENT_PER_IP, 10) || 3);
      if (!d.ok) {
        return json({ error: d.reason === 'rate' ? `This IP already started a sandbox in the last 10 minutes; try again in ${d.retry_after_s} s` : `This IP already has ${d.active} active sandboxes`, retry_after_s: d.retry_after_s }, 429, { ...h, 'retry-after': String(d.retry_after_s ?? 60) });
      }
      const t0 = Date.now();
      const token = hex(16);
      const sandbox = getSandbox(env.Sandbox, sid, { sleepAfter: '35m' });
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
      } catch (e) {
        await gate.release(sid);
        // Log internals server-side; return a generic message (never leak stack/SDK details to clients).
        console.error('session start failed', sid, e instanceof Error ? e.stack : String(e));
        return json({ error: 'the sandbox could not be started; please try again' }, 503, h);
      }
      const ws = `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}/ws/${sid}`;
      return json({ sid, ws, token, ttl_ms: ttl, mode: 'judge', cold_ms: Date.now() - t0 }, 201, h);
    }

    const del = /^\/api\/session\/([a-f0-9]{24})$/.exec(url.pathname);
    if (del && request.method === 'DELETE') {
      const sid = del[1];
      const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
      await env.Gate.get(env.Gate.idFromName(ip)).release(sid);
      await getSandbox(env.Sandbox, sid).destroy().catch(() => undefined);
      return json({ ok: true }, 200, h);
    }

    const wsm = /^\/ws\/([a-f0-9]{24})$/.exec(url.pathname);
    if (wsm) {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocket upgrade required' }, 426, h);
      if (!SID_RE.test(wsm[1])) return json({ error: 'bad session id' }, 400, h);
      const sandbox = getSandbox(env.Sandbox, wsm[1]);
      return sandbox.wsConnect(request, BRIDGE_PORT);
    }

    return json({ error: 'not found' }, 404, h);
  },
};
