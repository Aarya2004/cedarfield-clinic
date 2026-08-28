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
| 14 | Aborting a registration `AbortSignal` → `WebMCP.toolsRemoved` **and** `toolchange` fire; the tool disappears from `getTools()`; a CDP `invokeTool` on it is refused (harness status `CDP_ERROR`) | yes (evals `forge-budget.json`; Fable review #1 agrees) | 3 |
| 15 | Same name re-registered after abort | 0.2 ms (Fable review measurement) | 1 |
| 16 | Duplicate name **without** abort | throws `InvalidStateError: Duplicate tool name` (Fable review) — engine always aborts first | 1 |
| 17 | Runtime `registerTool` of a forged tool → visible to CDP `toolsAdded` | < 1 ms after `approve()` resolves (evals `forge-birth.json`, `approve_ms` printed) | 3 |

Consequences already applied in code: `execute(input, options?)` with `options?.signal`
(`types.ts`, `register.ts`). Per-call timeout budget of Chrome's own agent: **not yet measured**
(no built-in agent in 152 stable; Inspector extension not exercised headless).

## xterm 6.0.0 (measured 2026-08-28 via the real-PTY harness)

| # | Observation | Value | N |
|---|---|---|---|
| 1 | `registerDecoration` throws `You must set the allowProposedApi option to true to use proposed API` — the decorations API is still proposed in 6.0.0 despite being in the public typings | `allowProposedApi: true` required for ghost text | 1 |
| 2 | An exception thrown inside a React effect in a production build unmounts the whole tree → the `registerTerminalTools` cleanup aborts every tool → CDP `toolsRemoved` for all six | now fenced by per-pane error boundaries | 1 |
| 3 | `Input.insertText` (CDP) bypasses keydown, so a page that keys off `keydown` never sees "typing" — the harness types with real key events | harness rule | 1 |
| 4 | Returning `false` from `attachCustomKeyEventHandler` for Tab does **not** stop the browser default: focus leaves the xterm textarea and every later key is lost — `preventDefault()` is required on consumed keys | measured on a real PTY | 1 |
| 5 | Bridge pair time seen by the page (`pairMs`, WebSocket open → `hello`) over loopback | 11 ms headless · 63–83 ms headed | 5 |
| 6 | xterm's decoration API (`registerDecoration` + `onRender`) does **not** paint on a static prompt under the WebGL renderer in headed Chrome — the element exists but `onRender` never fires until a render frame; ghost text is now an overlay positioned from `buffer.active.cursorX/Y` and the `.xterm-screen` cell size | overlay | 2 |
| 7 | `fontFamily: 'var(--font-mono)'` makes xterm measure glyphs with an unresolvable canvas font → tiny, letter-spaced text; resolve the CSS variable to concrete family names first | fixed | 1 |
| 8 | Headed Chrome 152, real `document.modelContext.executeTool`: first call after load 1206 ms, warm 12 ms; `terminal_wait` resolving an already-finished command 3 ms | measured | 2 |

## Cloudflare Sandbox image (measured 2026-08-28, local Docker on Apple Silicon)

| # | Observation | Value | N |
|---|---|---|---|
| 1 | `docker.io/cloudflare/sandbox:0.12.9-python` is **linux/amd64 only** — builds and runs on this M-series Mac under emulation with a platform warning; production Containers are amd64 anyway | works, slow | 1 |
| 2 | Node inside the image | v22.23.2 (docs say Node 20) | 1 |
| 3 | The sandbox entrypoint spawns the user command and logs `User command failed exitCode:1` **without the command's stderr** — debug with `docker run --entrypoint sh … -c 'node …'` | lesson | 1 |
| 4 | A `RUN a && b \|\| true` chain swallowed a failed `npm install` (no `ws`, no `node-pty`) — never `\|\| true` an install step | lesson | 1 |

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
