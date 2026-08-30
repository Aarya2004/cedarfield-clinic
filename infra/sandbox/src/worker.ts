/**
 * rokan-sandbox — judge mode. A stranger gets a throttled container running OUR bridge; the
 * page pairs over the same protocol as builder mode. Routes:
 *   POST   /api/session                   → { sid, ws, token, ttl_ms, mode:"judge", cold_ms }   (rate-limited per IP; app origin or eval secret)
 *   GET    /ws/:sid                       → WebSocket upgrade proxied to the bridge inside the sandbox (port 7331)
 *   POST   /api/model/:sid/v1/messages    → capped, sid-authenticated proxy to the Anthropic Messages API (src/model-proxy.ts)
 *   GET    /api/health                    → { ok:true }
 * `sid` is HMAC-signed with the `SID_SECRET` secret (`wrangler secret put SID_SECRET`); `/ws/:sid` and the
 * model proxy verify it before touching anything, so an unissued id never starts a container or spends.
 * There is no DELETE route: nothing calls one, and an unauthenticated one let a third party destroy a
 * session. The bridge token is issued once and never stored by the Worker; the bridge verifies it.
 *
 * Isolation model (docs/SECURITY.md §6): the container holds NO real secret. It gets
 * `ANTHROPIC_BASE_URL=https://<this worker>/api/model/<sid>` and the literal `ANTHROPIC_API_KEY=judge-sandbox-proxy`;
 * the real key lives only here as a Worker secret and every call is charged against the per-session,
 * per-IP, per-day and all-time caps in gate-logic.ts BEFORE it is forwarded. The sid is readable from the
 * judge's own shell — the caps, not secrecy, bound the spend.
 */
import { getSandbox, Sandbox } from '@cloudflare/sandbox';

// The sandbox DO reaches its container through `ctx.exports.ContainerProxy`; the SDK requires the
// Worker entrypoint to re-export it. Without this every container start logs
// `ctx.exports.ContainerProxy is undefined` and times out (measured 2026-08-28: 135 s → 503).
export { ContainerProxy } from '@cloudflare/sandbox';
import { Gate, MODEL_BUDGET_NAME } from './gate';
import { gateKey, type ModelCaps } from './gate-logic';
import { corsHeaders, originAllowed } from './origin';
import { issueSid, verifySid, SID_RE } from './sid';
import { PROBE_HTML } from './probe-page';
import { NATIVE_PROBE_PY } from './probe-native';
import { allowedPath, validateModelRequest, upstreamHeaders, settledUsdMicros, estimateUsdMicros, callWeight, capError, isPassthroughStatus, UPSTREAM_MESSAGES, MAX_BODY_BYTES, DUMMY_API_KEY, type Usage } from './model-proxy';

export { Gate };

export interface Env {
  Sandbox: DurableObjectNamespace<RokanSandbox>;
  Gate: DurableObjectNamespace<Gate>;
  APP_ORIGIN: string;
  SESSION_TTL_MS: string;
  SESSIONS_PER_IP_PER_10MIN: string;
  MAX_CONCURRENT_PER_IP: string;
  MODEL_CALLS_PER_SID: string;
  MODEL_CALLS_PER_SID_PER_MIN: string;
  MODEL_CALLS_PER_IP_PER_10MIN: string;
  MODEL_CALLS_PER_DAY: string;
  MODEL_USD_TOTAL_MAX: string;
  /** secret: `wrangler secret put SID_SECRET` (any long random string); sessions are refused without it */
  SID_SECRET?: string;
  /** secret: `wrangler secret put ANTHROPIC_API_KEY` — a DEDICATED key with a spend limit in the Anthropic console; never the personal one. Lives only here. */
  ANTHROPIC_API_KEY?: string;
  /** secret: `wrangler secret put EVAL_SECRET` — lets the eval harness (no browser Origin) mint sessions via the `x-rokan-eval` header. */
  EVAL_SECRET?: string;
}

/**
 * Egress is ON. Measured live (2026-08-29): the SDK's HTTPS interception never wired up in this deployment —
 * the ephemeral CA at /etc/cloudflare/certs/cloudflare-containers-ca.crt is never created and, with
 * enableInternet=false, egress to an allowlisted host (githubstatus.com) times out (curl exit 28).
 * `allowedHosts` is enforced only *through* that interception proxy, so it gated nothing for HTTPS — the
 * "egress allowlist" was aspirational, not real. `rokan do` on any site needs open egress anyway (that is the
 * product), so we are honest about the isolation model instead (docs/SECURITY.md): no real secret in the
 * container, ephemeral disk, no agent path can write to the PTY, sessions per-IP rate-limited and TTL-capped,
 * model spend capped by the proxy. If interception is ever turned on, this Worker's own host must be
 * reachable and a CA bundle injected for httpx — the proxy URL is HTTPS.
 */
export class RokanSandbox extends Sandbox<Env> {
  enableInternet = true;
}

const BRIDGE_PORT = 7331;
/** A session counts as active for this long until the bridge answers; a client that gives up (or a
 *  Worker invocation that dies) before then must not lock its IP for the full TTL (measured
 *  2026-08-28: three aborted starts → "3 active sandboxes", retry in 977 s). */
const PROVISIONAL_MS = 180_000;
/** Longer than the TTL: the bridge ends the session at TTL and the Gate alarm destroys the sandbox then;
 *  a shorter sleepAfter (the old 10m) hibernated a live session's container mid-TTL (review P1). */
const SLEEP_AFTER = '35m';

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

function hex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

const num = (v: string | undefined, dflt: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

function modelCaps(env: Env): ModelCaps {
  return {
    perSid: num(env.MODEL_CALLS_PER_SID, 120),
    perSidPerMin: num(env.MODEL_CALLS_PER_SID_PER_MIN, 40),
    perSidInflight: 1,
    perIpPerWindow: num(env.MODEL_CALLS_PER_IP_PER_10MIN, 240),
    perDay: num(env.MODEL_CALLS_PER_DAY, 2000),
    usdTotalMicros: num(env.MODEL_USD_TOTAL_MAX, 40) * 1_000_000,
  };
}

/** Constant-time-enough comparison for the eval secret (short, non-attacker-controlled lengths). */
function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Disallowed origin → 403 before any handler (never before-the-Gate work for a stranger's page).
    const origin = request.headers.get('origin');
    if (origin !== null && !originAllowed(env.APP_ORIGIN, origin)) return json({ error: 'origin not allowed' }, 403, corsHeaders(env.APP_ORIGIN, null));
    const h = corsHeaders(env.APP_ORIGIN, origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    if (url.pathname === '/api/health') return json({ ok: true, mode: 'judge' }, 200, h);
    // Step-1 probe page for the Workbench decision (2026-08-30) — static, registers one tool; no session.
    if (url.pathname === '/probe/next-step') return new Response(PROBE_HTML, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    if (url.pathname === '/probe/native-invoke.py') return new Response(NATIVE_PROBE_PY, { headers: { 'content-type': 'text/x-python; charset=utf-8', 'cache-control': 'no-store' } });

    // ---- model proxy ---------------------------------------------------------------------------
    if (url.pathname.startsWith('/api/model/')) {
      const sid = allowedPath(url.pathname);
      if (!sid) return json({ error: 'not found' }, 404, h);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, { ...h, allow: 'POST' });
      // Authenticate before anything else: an unissued sid learns nothing, not even whether the key is configured.
      const id = env.SID_SECRET ? await verifySid(env.SID_SECRET, sid, Date.now()) : null;
      if (!id) return json({ type: 'error', error: { type: 'authentication_error', message: 'unknown or expired session' } }, 403, h);
      if (!env.ANTHROPIC_API_KEY) return json({ type: 'error', error: { type: 'api_error', message: 'model proxy not configured' } }, 503, h);
      if (!/^application\/json/i.test(request.headers.get('content-type') ?? '')) return json({ type: 'error', error: { type: 'invalid_request_error', message: 'json required' } }, 415, h);
      const declared = Number(request.headers.get('content-length') ?? 0);
      if (declared > MAX_BODY_BYTES) return json({ type: 'error', error: { type: 'invalid_request_error', message: 'request too large' } }, 413, h);
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ type: 'error', error: { type: 'invalid_request_error', message: 'request too large' } }, 413, h);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return json({ type: 'error', error: { type: 'invalid_request_error', message: 'bad json' } }, 400, h);
      }
      const v = validateModelRequest(parsed);
      if (!v.ok) return json({ type: 'error', error: { type: 'invalid_request_error', message: v.message } }, v.status, h);

      const budget = env.Gate.get(env.Gate.idFromName(MODEL_BUDGET_NAME));
      const est = estimateUsdMicros(v.model, text.length, v.maxTokens);
      const weight = callWeight(v.model);
      const d = await budget.chargeModel(sid, weight, est, modelCaps(env));
      if (!d.ok) {
        const e = capError(d.reason ?? 'cap', d.retry_after_s ?? 60);
        console.log(JSON.stringify({ evt: 'model_cap', sid: sid.slice(0, 8), reason: d.reason }));
        return json(e.body, 429, { ...h, ...e.headers });
      }

      const t0 = Date.now();
      let status = 502;
      let upText = '';
      let usage: Usage | undefined;
      try {
        const up = await fetch(UPSTREAM_MESSAGES, { method: 'POST', headers: upstreamHeaders(env.ANTHROPIC_API_KEY, request.headers.get('anthropic-version')), body: JSON.stringify(v.body), signal: request.signal });
        status = up.status;
        upText = await up.text();
        if (up.ok) {
          try {
            usage = (JSON.parse(upText) as { usage?: Usage }).usage;
          } catch {
            /* body passes through regardless */
          }
        }
      } catch (e) {
        console.error('model upstream fetch failed', sid.slice(0, 8), e instanceof Error ? e.message : String(e));
      }
      const actual = settledUsdMicros(v.model, status, usage, text.length, est);
      await budget.settleModel(d.charge_id ?? -1, actual, status);
      console.log(JSON.stringify({ evt: 'model', sid: sid.slice(0, 8), model: v.model, status, ms: Date.now() - t0, in: usage?.input_tokens, out: usage?.output_tokens, cr: usage?.cache_read_input_tokens, usd_micros: actual }));
      if (isPassthroughStatus(status)) return new Response(upText, { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...h } });
      // Auth/billing/5xx/network: never relay upstream internals (a client must not learn our key's state).
      // `x-should-retry: false`: the SDK would otherwise retry once per rung — each retry is a charged
      // reservation and doubles the time to an honest abstain (measured live: 13.6 s with retries).
      return json({ type: 'error', error: { type: 'api_error', message: 'model upstream unavailable' } }, status >= 500 ? 502 : 503, { ...h, 'x-should-retry': 'false' });
    }

    // ---- session -------------------------------------------------------------------------------
    if (url.pathname === '/api/session' && request.method === 'POST') {
      if (!env.SID_SECRET) {
        console.error('SID_SECRET is not set — refusing to issue sessions (wrangler secret put SID_SECRET)');
        return json({ error: 'the sandbox is not configured; please try again later' }, 503, h);
      }
      // Minting a container needs a browser on OUR page (Origin === APP_ORIGIN) or the eval secret. A
      // header-less POST used to work (review P0: any curl, or any page on a judge's localhost, could spawn).
      const evalOk = secretMatches(request.headers.get('x-rokan-eval'), env.EVAL_SECRET);
      const localApp = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.APP_ORIGIN);
      const originOk = origin !== null && (origin === env.APP_ORIGIN || (localApp && originAllowed(env.APP_ORIGIN, origin)));
      if (!originOk && !evalOk) return json({ error: 'sessions are issued to the app only' }, 403, h);
      const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
      const key = gateKey(ip);
      const ttl = num(env.SESSION_TTL_MS, 1_800_000);
      const id = hex(12);
      const sid = await issueSid(env.SID_SECRET, id, Date.now() + ttl);
      const gate = env.Gate.get(env.Gate.idFromName(key));
      const perWindow = num(env.SESSIONS_PER_IP_PER_10MIN, 1);
      const maxConcurrent = num(env.MAX_CONCURRENT_PER_IP, 3);
      const d = await gate.allow(sid, PROVISIONAL_MS, perWindow, maxConcurrent, id);
      if (!d.ok) {
        // No time in the sentence: the page appends "(retry in N s)" from retry_after_s (it read "… in 1144 s (retry in 1144 s)" live).
        const msg = d.reason === 'rate' ? 'This IP started too many sandboxes in the last 10 minutes' : 'This IP already has its maximum of active sandboxes';
        return json({ error: msg, retry_after_s: d.retry_after_s }, 429, { ...h, 'retry-after': String(d.retry_after_s ?? 60) });
      }
      const t0 = Date.now();
      const token = hex(16);
      const sandbox = getSandbox(env.Sandbox, id, { sleepAfter: SLEEP_AFTER });
      try {
        await sandbox.startProcess(`node /opt/bridge/bin/rokan-terminal.js --no-tunnel --mode judge --host 0.0.0.0 --port ${BRIDGE_PORT} --token ${token} --ttl-ms ${ttl} --app ${env.APP_ORIGIN}`, {
          env: {
            // The judge's shell inherits all of this (bridge spreads process.env). Nothing here is a secret.
            ANTHROPIC_BASE_URL: `${url.origin}/api/model/${sid}`,
            ANTHROPIC_API_KEY: DUMMY_API_KEY,
            ROKAN_BROWSER_NO_SANDBOX: '1',
            ROKAN_BROWSER_HEADLESS: 'true',
        // A heavy storefront on the container registered its WebMCP tools after rokan's 3 s default window
        // (measured 2026-08-30: allbirds 0 tools live, 10 in the same image on a Mac). 15 s, same as the image ENV.
        ROKAN_WEBMCP_QUIET_MS: '15000',
            PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright',
          },
        });
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
        await env.Gate.get(env.Gate.idFromName(MODEL_BUDGET_NAME)).bindModelSession(sid, key, Date.now() + ttl);
      } catch (e) {
        await gate.release(sid);
        await sandbox.destroy().catch(() => undefined); // never leave a half-started instance counting against max_instances
        // Log internals server-side; return a generic message (never leak stack/SDK details to clients).
        console.error('session start failed', sid.slice(0, 8), e instanceof Error ? e.stack : String(e));
        return json({ error: 'the sandbox could not be started; please try again' }, 503, h);
      }
      console.log(JSON.stringify({ evt: 'session', sid: sid.slice(0, 8), ip: key, cold_ms: Date.now() - t0 }));
      const ws = `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}/ws/${sid}`;
      return json({ sid, ws, token, ttl_ms: ttl, mode: 'judge', cold_ms: Date.now() - t0 }, 201, h);
    }

    const wsm = /^\/ws\/([a-f0-9.]{1,96})$/.exec(url.pathname);
    if (wsm) {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocket upgrade required' }, 426, h);
      // Verify the signature BEFORE getSandbox(): the SDK starts a container on first fetch, so an
      // unverified id would let anyone burn max_instances with random sids (Fable F4).
      const id = env.SID_SECRET && SID_RE.test(wsm[1]) ? await verifySid(env.SID_SECRET, wsm[1], Date.now()) : null;
      if (!id) return json({ error: 'unknown or expired session' }, 403, h);
      const sandbox = getSandbox(env.Sandbox, id, { sleepAfter: SLEEP_AFTER });
      return sandbox.wsConnect(request, BRIDGE_PORT);
    }

    return json({ error: 'not found' }, 404, h);
  },
};
