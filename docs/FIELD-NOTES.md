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
| 5 | node-pty 1.1.0 has **no linux prebuild for the image's Node 22 ABI** → `node-gyp rebuild` → needs `build-essential` (+ python3) in the image | fixed | 1 |
| 6 | Our bridge inside the image: first WebSocket accepted → `hello` (incl. container start under amd64 emulation) | 1079 ms | 1 |
| 7 | Command inside the image as `judge` (uid 1000): `whoami; id -u; echo probe_ok; false` → measured | exit 1 · 23 ms | 1 |
| 8 | `--ttl-ms 20000` → session ended (error frame `timeout`) at | 20 735 ms | 1 |

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

## rokan-do on the demo Mac (measured 2026-08-28 21:05 PT)

| # | Fact | Measured | N |
| --- | --- | --- | --- |
| R1 | `rokan-do` installed as a user tool from the local Rokan tree (`uv tool install --from ~/dev/Rokan/packages/rokan-do rokan-do`); `rokan-do can` prints the offer; Rokan ships **no `rokan` binary** (`rokan-do` is the console script) — the terminal's `rokan` shim (`packages/bridge/shims/rokan`, on the PTY PATH) makes `rokan do "…"` real | works | 1 |
| R2 | `rokan-do seed install` → 54 seeded operations (status pages, docs sites, pypi, wikipedia, curl.se, ubuntu.com …). **Hacker News is not seeded**: `rokan do "top 5 HN titles"` is a model-call path (needs `ANTHROPIC_API_KEY`), not a 0-call replay | 54 seeds | 1 |
| R3 | Seeded replay, cold store: `rokan-do run "what is the maximum file size GitHub blocks at docs.github.com/…/about-large-files-on-github"` → `GitHub blocks files larger than 100 MiB.   312ms  ⚡` (⚡ = replayed, 0 model calls) | 312 ms | 1 |
| R4 | A question not matching a seed's own text (`"is github up?"`) → `⏸ abstained — Rokan cannot prove this one` (exit 0, the trust line). Seeds match their recorded question, e.g. `what is the current status at githubstatus.com` | abstains | 1 |
| R5 | Result-line grammar (from `rokan_agent/adapters/cli/render.py`): `  <answer>   <elapsed_ms>ms` + `  ⚡` only when `transport_used == "replay"`; ANSI (dim timing, saffron bolt) only on a TTY. Model-call counts are **not** printed → the bridge reports `calls:0` for ⚡ and `calls:null` otherwise | grammar | — |

## Judge sandbox — deployed (measured 2026-08-28 ~16:25 PT)

| # | Fact | Measured | N |
| --- | --- | --- | --- |
| J1 | Root cause of every failed start after the first deploy: `@cloudflare/sandbox` 0.12.9's DO reaches its container via `ctx.exports.ContainerProxy`; the Worker entrypoint must `export { ContainerProxy } from '@cloudflare/sandbox'`. Without it: `container.startup … ctx.exports.ContainerProxy is undefined` in the Worker log, retries for ~135 s, then our 503; instances pile up (7 live) | log line | 3 |
| J2 | With the export: `POST /api/session` → 201 in **4.76 s**, `cold_ms: 4543` (container start + bridge answering on :7331, two `exec curl` probes at 78 / 65 ms) | 4543 ms | 1 |
| J3 | Aborted client requests (curl `-m 60`) left Gate rows active for the full 30-min TTL → `429 This IP already has 3 active sandboxes, retry 977 s`. Fixed: rows are provisional (180 s) until the bridge answers, then `confirm` sets the full TTL | 977 s lockout | 1 |
| J4 | Builder and judge behind one public IP: three aborted starts (pre-J3 rows, full 30-min TTL) made every later start from that IP — including Arav's own "Try it now" click — answer `429 … 3 active sandboxes` until the rows expired (~30 min). With J3 (provisional 180 s rows) an abort now frees the slot in 3 min. Demo rule: never start a judge session from the demo network in the 30 min before a rehearsal you might abort | 429 ×4 | 1 |
| J5 | First end-to-end drive of the live sandbox from the page: session 201 (cold 4032 ms Worker / 4597 ms client), raw WS through `/ws/<sid>` → `hello judge zsh` for both the app and a localhost Origin, but the page refused the URL — `isAllowedBridgeUrl` rejected any path. Fixed `c541b4d` (path allowed only on the configured judge host). Also: three successful sessions from one IP fill `MAX_CONCURRENT_PER_IP=3` for their full 30-min TTL (sessions end on TTL or bridge idle, not on tab close) — a builder testing from the demo network locks that network for 30 min | measured | 1 |
| J6 | Judge-mode tab takeover through the Cloudflare DO proxy (`87bf205`): tab 1 pairs (`hello`), closes; tab 2 with the same token pairs **662 ms** later (`hello`, no `busy`) — a page reload or a lingering proxied socket no longer locks a judge out. Cold start this run 4810 ms | 662 ms | 1 |
| J7 | Judge-only mid-session drop, root-caused with the harness `diag` dump: close **4400 "bad frame"** ~1.5 s after pairing; the only judge-only frame in that window is a `resize` from the auto-tour's layout change on a collapsed pane (`rows < 2`), which the bridge treated as fatal. Fixed `91102e4` (bridge ignores 'bad dimensions'; client never sends them). After the fix the live suite ran **6/8** (demo-dryrun, forge-live, rokan-trailer, ghost-ux, propose-enter, evidence-ghost) | close 4400 → 6/8 | 2 |
| J8 | Live-only redaction gap: the judge prompt (`judge@rokan:/tmp/rokan-demo %`) wrapped `export AWS_SECRET_ACCESS_KEY=…` at 101 cols; per-row redaction saw the key name and the bare value on different rows → `terminal_read_screen` returned the value. Fixed `fc716a4`: `screenLines` joins `isWrapped` rows into logical lines before the choke point (unit test reproduces the wrap) | leak → fixed | 1 |
