# Field notes — measured consumer behaviour

Every number here was produced by the code in this repo on the date shown. Nothing is quoted
from docs. N is stated. Add rows; never edit a measured value.

## Chrome 152.0.7977.65 (macOS, headless, `--enable-features=WebMCP`) — 2026-08-28

Harness: raw CDP over Node 25's built-in WebSocket, page = the Gate A build served by
`next start`. Log + screenshot: `docs/evidence/gate-a/2026-08-28-chrome152-cdp.*`.

| # | Observation | Value | N |
|---|---|---|---|
| 1 | `document.modelContext` exists; `navigator.modelContext` does **not** (alias already gone in 152) | `object` / `undefined` | 3 runs |
| 2 | Prototype surface | `ontoolchange, executeTool, getTools, registerTool` | 1 |
| 3 | `registerTool` × 2 wall time | 2 ms, 8 ms, 47 ms (cold) | 3 |
| 4 | CDP `WebMCP.enable` → one `WebMCP.toolsAdded` event **per registerTool call**; annotations arrive as `{readOnly, untrustedContent}` (not `*Hint`) | yes | 3 |
| 5 | `execute(input, options)` — Chrome 152 passes **no second argument**; destructuring `{signal}` throws `TypeError` | `options === undefined` | 2 |
| 6 | Spec-level `executeTool(tool, input)` from page JS requires a **JSON string** input; an object input rejects `UnknownError: Failed to parse input arguments` (spec #246 says object since 2026-08-17 — Chrome 152 lags) | string works, object fails | 2 |
| 7 | CDP `WebMCP.invokeTool(frameId, name, object)` accepts an **object**; result arrives as `toolResponded {status:"Completed", output:<object>}`; handler exceptions arrive as `status:"Error"` with a full `exception` | yes | 6 |
| 8 | `terminal_propose` handler time (validate + store + note) | 0 – 0.5 ms | 4 |
| 9 | ESC (U+001B) inside `command` | rejected: "control characters are not allowed" | 2 |
| 10 | RLO (U+202E) inside `command` | rejected: "invisible format characters are not allowed" | 2 |
| 11 | `terminal_wait` blocked 705 ms until a real `Input.dispatchKeyEvent` Enter, returned `executed`; no consumer abort observed at that duration | 705 ms | 1 |
| 12 | Human decision latency as rendered in the ledger (proposal → Enter) | 1809 – 1810 ms | 2 |
| 13 | `navigator.modelContextTesting` (the Cloudflare Browser Run surface) | `undefined` under `WebMCP` feature; flag name unknown | 1 |

Consequences already applied in code: `execute(input, options?)` with `options?.signal`
(`types.ts`, `register.ts`). Per-call timeout budget of Chrome's own agent: **not yet measured**
(no built-in agent in 152 stable; Inspector extension not exercised headless).

## ChatGPT desktop (GPT-5.6 Sol/Terra) — not yet measured

Blocked 2026-08-28 night: no ChatGPT desktop app on this Mac. To measure: open the deployed URL,
ask "propose ls", then ask it to `terminal_wait` on the id and do nothing — the page records
`terminal_wait.aborted_by_consumer {after_ms}` (if it passes a signal) or `still_waiting` at 45 s.

## Cloudflare quick tunnel — 2026-08-28

| # | Observation | Value | N |
|---|---|---|---|
| 1 | `cloudflared tunnel --url http://127.0.0.1:7331` prints the URL after | 3 s | 3 |
| 2 | Hostname resolvable at 1.1.1.1 after URL print | ~25 s | 1 |
| 3 | Querying the local resolver before it propagates **negative-caches NXDOMAIN** for minutes — the first two runs "failed" for this reason only | yes | 2 |
| 4 | WebSocket upgrade through the tunnel (dependency-free RFC 6455 echo) | open 197 ms, echo RTT 216 ms | 1 |
| 5 | `rokan-terminal` CLI: URL printed → DNS-over-HTTPS (1.1.1.1) answers | 12.1 s, 18.3 s | 2 |
| 6 | Pair through the tunnel with the real bridge: `auth` → `hello` / first honest `status` after a command | 367 ms / 411 ms | 1 |
| 7 | Real-PTY smoke (`packages/bridge/test/smoke.mjs`, 14 checks incl. tamper detection) | 14/14 in 331 ms | 1 |

Bridge rule: after cloudflared prints the URL, poll `1.1.1.1` (not the system resolver) until
it answers, *then* print the pairing link. PLAN §10 risk #2 is closed: quick tunnels pass WS.
