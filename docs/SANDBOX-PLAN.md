# SANDBOX-PLAN — judge mode: a stranger opens the live URL and gets a real, throttled terminal

Status: written 2026-08-28 11:50 PT by C after TERMINAL-PLAN went green (headless + headed). Same
discipline: Handset-scoped, every external fact verified today (Cloudflare docs + the installed
`sandbox-stable` skill + npm/Docker Hub), test every baby step, measured numbers only.

---

## 0. Context — why judge mode, and the one design decision

- PLAN §0.2: two modes, one client. Judges never install anything. Gate D (Mon 08-31 22:00 PT):
  a stranger with ChatGPT desktop opens the live URL, gets a sandbox, proposes, presses Enter,
  forges, invokes — with no help. Galloni (Cloudflare) scores this row; Execution (tiebreak #2)
  depends on "opens cold".
- **Decision: the judge sandbox runs *our own bridge* inside the container and the Worker
  proxies its WebSocket with `sandbox.wsConnect(request, 7331)`.** One client protocol
  (`protocol.ts`), one honest `status` stream (OSC 133 shell integration), one ledger format,
  one `TerminalAdapter` — builder and judge modes differ only in the WebSocket target. The
  Sandbox SDK's own `terminal()` + `SandboxAddon` would mean a second transport, a second key
  handler, and no exit codes; rejected.
- Everything reused: `packages/bridge` (with two new flags: `--mode judge --ttl-ms`), the client
  session store (`startWith(params)`), the pairing allowlist (`extraHosts` = the Worker host).

## 1. Verified facts this plan stands on (2026-08-28)

| fact | source |
| --- | --- |
| Package `@cloudflare/sandbox` stable = **0.12.9** (`next` = 0.13.0-next); image tag must match the npm version; variants `:<v>`, `:<v>-python` (Python 3.11), `:<v>-opencode`; base Ubuntu 22.04 with Node 20 + Bun | npm view; docs/sandbox/configuration/dockerfile |
| Wrangler: `containers: [{class_name:"Sandbox", image:"./Dockerfile"}]`, `durable_objects.bindings: [{class_name:"Sandbox", name:"Sandbox"}]`, `migrations: [{new_sqlite_classes:["Sandbox"], tag:"v1"}]`, `compatibility_flags:["nodejs_compat"]`; Worker must `export { Sandbox }` | docs/sandbox/configuration/wrangler |
| `getSandbox(env.Sandbox, id, { sleepAfter: "10m" (default), keepAlive:false, enableDefaultSession:true })` — container starts lazily on first operation; `sandbox.destroy()` deletes everything | docs/sandbox/api/lifecycle |
| `await sandbox.startProcess('cmd')` (background), `await sandbox.exec('cmd')` → `{stdout, stderr, exitCode, success}`; `sandbox.wsConnect(request, port)` proxies a browser WebSocket upgrade to a service inside; "in production all ports are automatically accessible" | docs/sandbox/guides/websocket-connections, sandbox-stable skill |
| Egress: `class MySandbox extends Sandbox { enableInternet = false; allowedHosts = [...] }`; only ports 80/443 go through outbound handlers; DNS goes to Cloudflare resolvers only when `enableInternet=false`; raw TCP/UDP cannot be intercepted | docs/sandbox/guides/outbound-traffic |
| Instance types: lite 1/16 vCPU · 256 MiB · 2 GB; **basic 1/4 · 1 GiB · 4 GB**; standard-1 1/2 · 4 GiB · 8 GB … Image size ≤ instance disk; 50 GB image storage/account | docs/containers/platform-details/limits |
| `wrangler dev`/`deploy` builds the Dockerfile locally and pushes it → **Docker daemon required on this Mac** (Docker 29.3.1 installed; daemon started by C 11:45 PT) | docs/sandbox/configuration/dockerfile |
| Workers Paid plan required; wrangler **not logged in** on this Mac (`! wrangler login`) | docs; `wrangler whoami` |
| node-pty ships linux-x64 prebuilds (seen in `prebuilds/`), so the bridge runs in the container without a compiler | node_modules inspection |

## 2. Product specification

### 2.1 Judge flow (what a stranger does)
1. Opens `https://rokan-terminal.vercel.app` (unpaired) → PairingCard shows two paths:
   **"Try it now — judge sandbox (no install)"** button, and the `npx rokan-terminal` path.
2. Click → `POST https://<worker>/api/session` → `{ ws: "wss://<worker>/ws/<sid>", token, ttl_ms, mode:"judge" }`
   (≤ 15 s cold; measured and shown as "sandbox ready in N s").
3. The page pairs (same `BridgeClient`), status bar shows `judge sandbox · expires in 29:5x`,
   shell prompt appears (`judge@rokan:~$`), `~/README` says what's seeded and what's blocked.
4. Everything else is identical: propose → Enter, forge → born → invoke, Share-screen → redacted.
5. At TTL: bridge exits → `exit` frame → page shows "session ended · start a new one".

### 2.2 Limits (enforced in code; numbers on screen are measured)
| limit | value | where |
| --- | --- | --- |
| sessions per IP | 1 new session / 10 min; 3 concurrent per IP | `Gate` Durable Object (sqlite) |
| session TTL | 30 min (bridge `--ttl-ms 1800000` exits; sandbox `sleepAfter:"35m"`; `destroy()` on `DELETE /api/session/:id` and from the bridge exit hook) | Worker + bridge |
| instance | `basic` (1/4 vCPU, 1 GiB, 4 GB) — enough for zsh + node + rokan-do replay; `standard-1` if Chromium is needed on D3 | wrangler.jsonc |
| egress | **open** — `enableInternet = true`. `allowedHosts` is kept as a list of the demo hosts but enforces nothing: the SDK's HTTPS interception never activated in this deployment (measured 2026-08-29 — no ephemeral CA, and `enableInternet=false` timed out even an allowlisted host, curl exit 28), and rokan-do's seeded replay needs a real HTTPS fetch. Isolation rests on "no real secret in the container, ephemeral disk, no write path to the PTY, rate-limited, model spend capped by the Worker's own proxy" instead — see `RokanSandbox` in `worker.ts` for the measurement and the reasoning. | `RokanSandbox` in `infra/sandbox/src/worker.ts` |
| model calls | none possible — no key is injected (a 20/session cap was planned; not implemented because not needed) | container |
| user | non-root `judge` (uid 1000), home `/home/judge`, no sudo | Dockerfile |
| tools in the shell | zsh, git, curl, python3.11 + uv (python image), node 20, rokan-do (D3) | Dockerfile |

### 2.3 Failure states shown to the judge
- Rate-limited → "This IP already has a sandbox; try again in N min" (from the Worker's 429 body).
- Cold start > 25 s → "still starting… (N s)" then error card with retry.
- Sandbox unreachable / Worker down → PairingCard falls back to the `npx` path + prompt line.
- TTL reached → "session ended" + "new session" button.

## 3. Contracts
- `protocol.ts` / `protocol.js`: `hello` gains `mode:"judge"` (already typed as `BridgeMode`) and
  `ttl_ms?: number`, `expires_at?: string`. `terminal_status.mode` reports `judge`.
- Bridge flags: `--mode builder|judge`, `--ttl-ms <n>`, `--host 0.0.0.0` (inside the container the
  Worker connects over the container network), `--origin <app origin>` (Origin allowlist).
- Client: `session.startWith({ws, token})` (no hash); `parsePairingHash`/`isAllowedBridgeUrl`
  accept `extraHosts` from `NEXT_PUBLIC_BRIDGE_HOSTS` (comma-separated; the Worker host).
- Worker API: `POST /api/session` → 201 `{sid, ws, token, ttl_ms, mode, cold_ms}` · `DELETE
  /api/session/:sid` · `GET /ws/:sid` (WebSocket upgrade → `wsConnect`) · `GET /api/health`.

## 4. Technical specification — `infra/sandbox/`
```
infra/sandbox/
  wrangler.jsonc          name rokan-sandbox · main src/worker.ts · nodejs_compat · containers[Sandbox, ./Dockerfile, instance_type basic, max_instances 10] · DO bindings Sandbox + Gate · migrations v1
  Dockerfile              FROM docker.io/cloudflare/sandbox:0.12.9-python · apt zsh git · useradd judge · COPY container/bridge /opt/bridge · npm ci --omit=dev in /opt/bridge · seed files · CMD default
  container/bridge/       synced copy of packages/bridge (scripts/sync-bridge.sh; gitignored)
  container/seed/         README, SKILL.md (D3), operations.json (D3)
  src/worker.ts           routes; RokanSandbox extends Sandbox {enableInternet=true; allowedHosts kept as docs only — §2.2}; Gate DO
  src/gate.ts             sqlite DO: ip → [timestamps]; allow(ip) → {ok, retry_after_s}
  test/worker.test.mjs    unit tests for gate logic + route parsing (node:test, no network)
  scripts/sync-bridge.sh  copies bridge into the build context
  scripts/smoke-image.sh  docker build + docker run the image locally: bridge starts, pairs over ws, echo works (real PTY inside the container)
```
- `POST /api/session`: ip = `cf-connecting-ip`; `Gate.allow(ip)`; `sid = hex(12)`; `token = hex(16)`;
  `sandbox = getSandbox(env.Sandbox, sid, {sleepAfter:'35m'})`; `await sandbox.startProcess('node /opt/bridge/bin/rokan-terminal.js --no-tunnel --mode judge --host 0.0.0.0 --port 7331 --token <t> --ttl-ms 1800000 --origin <APP_ORIGIN>')`;
  wait until `sandbox.exec('curl -sf http://127.0.0.1:7331/')` succeeds (≤ 20 s, 250 ms poll) → measured `cold_ms`; respond.
- `GET /ws/:sid`: sid format check; `getSandbox(env.Sandbox, sid)`; `return sandbox.wsConnect(request, 7331)`.
  The bridge still verifies the token (first frame) — the Worker never sees a token after issuing it.
- `DELETE /api/session/:sid`: `destroy()`.
- The bridge in judge mode: after TTL, `process.exit(0)` (shell + PTY die with it); on exit it
  cannot call the Worker — the sandbox sleeps at `sleepAfter`; the next session id is new anyway.
- Secrets: `APP_ORIGIN` var; `SID_SECRET` Worker secret (session-id HMAC + expiry). No `ANTHROPIC_API_KEY` is wired — deliberately: the judge sandbox replays seeds only, nothing in it can spend.
- Client: PairingCard "Try it now" → `fetch(`${NEXT_PUBLIC_SANDBOX_URL}/api/session`, {method:'POST'})` → `session.startWith`.

## 5. Security (delta from PLAN §4)
Non-root user; no internet except the allowlist (HTTP/S only — state honestly that raw TCP/UDP is
not filtered by the SDK; the container has no credentials to leak); per-IP rate limit; 30-min TTL;
no persistent volume; token-gated bridge; Origin allowlist = app origin; the Worker exposes only
`/api/session`, `/ws/:sid`, `/api/health`; the pairing allowlist on the page accepts the Worker
host only via `NEXT_PUBLIC_BRIDGE_HOSTS`; CSP `connect-src` gains `wss://<worker host>`.

## 6. Verification
- L1: `node --test infra/sandbox/test/*.mjs` (gate: 1/10 min, 3 concurrent, retry_after; route parsing).
- L5': `scripts/smoke-image.sh` — `docker build` the image, `docker run -p 7331:7331` with the
  judge flags, then `packages/bridge/test/smoke.mjs`-style pairing over ws://127.0.0.1:7331 from
  the host (**real PTY inside the real image**), TTL exit measured with `--ttl-ms 5000`.
- `wrangler deploy --dry-run` green; `wrangler deploy` once Arav logs in; then
  `curl -X POST https://<worker>/api/session` → `cold_ms` recorded in FIELD-NOTES; the page pairs;
  all `terminal-*.json` harness cases run against the judge sandbox via `run-all.mjs --judge <url>`.
- L8 stranger test (second account/laptop) — Gate D.

## 7. Files (C)
`infra/sandbox/{wrangler.jsonc,Dockerfile,package.json,src/worker.ts,src/gate.ts,test/gate.test.mjs,scripts/*.sh,.gitignore}` ·
`packages/bridge/{bin/rokan-terminal.js,src/bridge.js,src/protocol.js}` (flags, hello fields) ·
`apps/web/src/lib/ws/protocol.ts` (`contract:`), `apps/web/src/lib/terminal/session.ts`, `Panes.tsx` (PairingCard button, judge chip + countdown), `next.config.ts` (CSP host), `evals/run-all.mjs --judge` · docs.

## 8. Schedule + kill rules
12:30 bridge flags + contracts + unit tests · 13:30 Worker + Gate + Dockerfile, image builds locally, `smoke-image.sh` green · 14:30 client judge path + harness against the local image (run the bridge in Docker, page on :3311) · then deploy the moment wrangler is logged in. Kill rule (PLAN §10.4): if the image cannot run the bridge by 16:00, judge mode ships the SDK's own `terminal()` + `SandboxAddon` (no exit codes; say so).

## 9. Next after this
`rokan do` seeding + `--json` trailer → `calls` column (D3) → §13 upgrades → polish + submission plan.
