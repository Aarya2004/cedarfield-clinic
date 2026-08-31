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
| J9 | **Live judge suite 8/8** (`node evals/run-all.mjs --judge=<worker>`): pair, propose→Enter (measured exit/ms), Share-screen redaction, forge→invoke→ledger, rokan-trailer, tab takeover — all against the deployed Cloudflare container. Cold starts this evening: 4032 / 4489 / 4562 / 5015 / 5298 / 5609 ms (Worker-measured), +150–200 ms client-side | 8/8 | 6 runs |
| J10 | Stranger path from a real Chrome 152 tab (extension-driven): click **Try it now** → `judge sandbox · zsh` chip, `expires in 29:46`, ledger `paired … 304 ms ✓`, tour card; typed `echo hello_judge; uname -a` → `Linux cloudchamber 6.18.36-cloudflare-firecracker … x86_64`, chip `exit 0 · 2 ms`. Screenshots `docs/evidence/gate-d/live-judge-*.jpg` | pair 304 ms · exit measured | 1 |
| J11 | Live judge suite **8/8** after the VERIFY + Codex fix batch (`b45db33`): cold start 6524 ms Worker / 6902 ms client — slowest of the evening (range now 4.0–6.5 s; say "≈ 5 s, up to 7" on camera) | 8/8 | 1 |
| R6 | **Generalization sweep** of the star command on the demo Mac: all 54 seeded questions, one at a time, no API key in the environment → **53/54 replayed at 0 model calls**, mean **1 232 ms wall** per `rokan-do run` (includes ~300 ms Python start; fastest 302 ms iana.org, slowest 6 659 ms pypi.org). The one miss (`www.dockerstatus.com`): the seed had rotted, retired itself, fell to planning, and abstained honestly (`abstained_planner_unavailable`, no key) — exactly the product's stated behaviour. Sites: 24 status pages, docs (aws, github, stripe, oracle, microsoft, mozilla, python, postgres, redis, nginx, curl, sqlite, unicode, rfc-editor, httpwg, iana, gov.uk), pypi, wikipedia ×2, debian, ubuntu, numpy, prometheus, flask, cloudflare | 53/54 · 1.23 s | 54 |
| R7 | HN on the demo Mac: `rokan do "top 5 HN titles at news.ycombinator.com"` with the live key (Keychain service `rokan-anthropic-key`, account `rokan` — the `ANTHROPIC_API_KEY` entry is dead, HTTP 401) → real titles via **1 model call**, twice; Rokan marks the site *known* but does not persist a replayable op (keyless run plans again; `seed export` has no HN entry). Engine behaviour, not ours. Demo: HN beat = `calls:1 · ~4 s` (PLAN §8 1:10 as scripted); the `calls:0 ⚡` beat uses a seeded site (R3/R6) | 1 call, not seeded | 3 |

## Builder-mode rehearsal on the real video path (2026-08-28 night; live page + quick tunnel + Arav's Mac shell, driven from a real Chrome tab)

| # | Beat | Measured |
| --- | --- | --- |
| V1 | `node packages/bridge/bin/rokan-terminal.js` (key in env) → tunnel up 9 489 ms, DNS live 9 569 ms, link printed | 19 s to link |
| V2 | Live URL + `#ws=…&t=…` in Chrome → `paired · zsh`, hash stripped, ledger `paired ✓` | pair 855 ms |
| V3 | `terminal_propose ls -la` → ghost at the prompt → Enter → `exit 0 · 3 ms` | measured |
| V4 | Share on → `export AWS_SECRET_ACCESS_KEY=…` → `screen_read 17 lines, 1 redacted`; value never in the agent's view | 1 redaction |
| V5 | `rokan do "…githubstatus.com"` (seeded) → `All Systems Operational   347ms ⚡` | 0 calls |
| V6 | `forge_create site_status({{site}})` → approve → `tools · 7`, `forged_site_status READ c5b4e8301a8e` → invoke → ghost → Enter → `212ms ⚡`, ledger `executed_step … exit 0 · 430 ms` | 0 calls, hero complete |
| V7 | `rokan do "top 5 HN titles at news.ycombinator.com"` → 5 real titles, `2186ms` (planned, 1 model call, no bolt), chip `exit 0 · 2473 ms` | model path |
| V8 | Ledger 10 rows, countersigned 9/10 (the last row's ack was in flight at the screenshot) | screenshots `docs/evidence/gate-b/rehearsal-*.jpg` |

## Codex as the consumer (2026-08-29 ~00:40 PT; Codex CLI 0.150.1, ChatGPT-plan account, via `codex mcp-server` → our `rokan-terminal mcp` relay; live page + tunnel + Arav's shell)

| # | Fact | Measured | N |
| --- | --- | --- | --- |
| C1 | Codex lists our six tools with our descriptions; `terminal_status` → `{paired:true, measured:true}`; `terminal_propose ls -la` → `p_… awaiting_human`; the ghost appears at the human's prompt (`codex-1`); human Enter → `exit 0 · 11 ms`; Codex `terminal_wait` → `executed, exit 0, ms 11, waited_ms 1` | works | 2 |
| C2 | Codex `forge_create list_here` → card with `hash afc8ef9d0d38` returned to the agent and shown on the card before approval (`codex-3`); human Approve → `tools · 7`, `forged_list_here READ afc8ef9d0d38` (`codex-4`) | works | 2 |
| C3 | **Codex CLI reads MCP tools once per session and ignores `notifications/tools/list_changed`**: in the same session `forge_list` shows the forged tool `visible:true` but calling it fails `tools.mcp__rokan__forged_list_here is not a function`. A **new** Codex session lists seven tools and calls `forged_list_here` → `inv_…`, ghost at the prompt (`codex-5`), human Enter → `executed_step exit 0 · 6 ms` (`codex-6`), `terminal_wait` → `executed`, `forge_list` → `runs 1, median_ms 6`. Chrome 152 refreshes live (FIELD-NOTES §Chrome); ChatGPT desktop unmeasured | new session needed | 3 |
| C4 | The content hash of an identical spec is identical across sessions and pages (`afc8ef9d0d38` ×3) — tool identity is content, not registration order | stable | 3 |
| C5 | One MCP agent process per bridge: the newest process with the valid token takes the slot (`replaced` to the old one), and a replaced relay stands down — before this fix the old session's reconnect loop took the slot back within ~1 s and the new session's call failed `not connected to the bridge` (measured, fixed, tested) | takeover | 2 |
| C6 | Relay latency Codex → tab → shell: `agent_call` round-trip 8 ms for `forge_create`; proposal-to-ghost < 1 s on the live tunnel | ms | 2 |
| R8 | **A/B, same 54 questions**: replay (seeded, 0 model calls) vs `--fresh` (forced planning = the model + browser doing it, 1 call each). Replay: 53/54 answered, mean **1 232 ms** wall per `rokan-do run` (operation itself ≈ 350 ms, R3/V5). Planning: **46/54** answered (8 honest abstentions), mean **5 885 ms** (min 2 963, max 8 700), 1 model call each. ⇒ replay ≈ **4.8× faster wall-to-wall, ≈17× on the operation, 0 vs 1 call, and more reliable**. Not 100×; this is the measured number | 4.8× / 17× · 0 vs 1 call | 54 + 54 |
| J12 | **Judge image with the star command** (`Dockerfile.rokan`, 1.31 GB): local smoke under amd64 emulation — bridge hello **1 605 ms**, `rokan-do` at `/usr/local/python/bin`, **54 seeds** learned at build, `rokan` shim on the PTY PATH, seeded replay **`All Systems Operational   454ms ⚡`** (wall 975 ms incl. Python start), TTL ends the session at 21 s (20 s configured), no `ANTHROPIC_API_KEY` in the container. Under `--cpus 0.25` the emulated bridge takes > 30 s to open a socket (emulation artefact) — the ¼-vCPU number is measured on Cloudflare after deploy (J13) | 454 ms ⚡ in-container | 1 |
| J13 | **The rollout that never applied → `rokan do` 127 live, root-caused.** The rokan image unpacked to **2 221 MB** (a 1.46 GB `playwright install --with-deps` apt layer + build-essential + 266 MB apt cache) > the 4 GB `basic` disk Cloudflare counts the image against; its rollout **stuck at step 1** (container API: `failed 1, healthy 0`) and the fleet silently kept the 654 MB pre-rokan image, so the PTY had no `/usr/local/python/bin` and `rokan do` exited 127. A diagnostic eval case (propose `echo $PATH; command -v rokan-do` → Enter → screen read) + `wrangler containers info` (applied digest = old) proved it. Fix `7bef1d3`: **multi-stage** Dockerfile (node-pty compiles in a throwaway stage), no browser, caches purged → **1 532 MB** unpacked; `smoke:image:rokan` fails > 1800 MB and runs `rokan do` via the shim in a login zsh (exit 0); replay **373 ms ⚡**. Deployed `3a1d0ee7` / digest `b159699a`, rollout **applied** (`containers info`: new digest, failed 0). Chromium was never in the image; replays are browserless. Rule: after a sandbox deploy, confirm the rollout *applied* — a green `wrangler deploy` only means it *started*. | applied; 1532 MB; replay 373 ms ⚡ | 1 |
| J14 | **`rokan do` works live — the 127 was egress, not the shim.** After the image + PATH fixes it still abstained: `rokan do` runs (exit 0) but rokan-do's seeded replay does a stdlib-urllib **HTTPS fetch** of the status page, and the judge container had **no working egress**. Live curl probe: the SDK HTTPS interception never activates here (CA never created), and `allowedHosts` is enforced only *through* that proxy, so with `enableInternet=false` egress to an allowlisted host **timed out** (curl 28) — the "egress allowlist" was aspirational (Opus P0). Fix `3178a34`: **`enableInternet=true`**. Measured live after deploy `9fba0038`: ALLOWED(githubstatus)=301, BLOCKED(icanhazip)=200 → egress **open**, documented honestly; isolation = no key + no vault + ephemeral + no agent→PTY + rate-limit/TTL (`terminal-judge-isolation.json`). **Live judge 11/11.** Also fixed en route: eval runner bakes `NEXT_PUBLIC_BRIDGE_HOSTS` from `--judge` (empty allowlist silently refused pairing → 0/10). | 11/11 live; egress open (honest) | 1 |
| J15 | **The `terminal-insert-cancel` judge failure was a one-off stall, not a budget problem — measured.** Added `--trace=<dir>` to `evals/run-all.mjs` (keeps every harness step's `ms`). 5 live judge sessions (2 full 12/12, 2 isolated, 1 probe), 0 failures. Every wait finishes within **6 %** of its budget (worst 259 ms / 4000 on the post-Ctrl-C ghost re-show; typing round-trip 4–65 ms; `terminal_wait` 146–294 ms / 10 000). The original miss needed > 4000 ms on a 259 ms step → a ~15× stall on the `basic` (¼ vCPU) container / WS, not WAN latency. Budgets stay as they are (loosening would hide a judge-visible lag). Judge mode now retries a failed case **once**, labels it `RETRY … / (attempt 2)` and counts it on the final line (`N failed of 12, M retried`) — proven with a synthetic always-fail probe (`1 failed of 1, 1 retried`, both attempt traces kept). | measured | 5 |
| J16 | **A `--bridge` eval run silently overwrote the judge-sandbox evidence.** `terminal-demo-dryrun` shoots `docs/evidence/demo/beat*.png` on every run, in whatever mode it runs — a builder-mode pass replaced the committed judge shots (caught by `git status`, restored). Harness now honours `ROKAN_EVAL_SHOT_DIR`; `run-all` sets it to the trace dir (or `evals/.shots/`, gitignored) for every non-judge run, so only `--judge` writes the committed evidence. Proven: `--bridge --only=demo-dryrun` → 0 dirty pngs, 9 shots in scratch. | lesson | 1 |
| J17 | **Open-net sandbox: what it actually took.** Two blockers only — a browser and a model route (egress was already open; the allowlist gated nothing). Chromium fits once the instance is `standard-1` (image limit = instance disk): **2 424 MB unpacked** with Playwright's full chromium + `install-deps`, apt lists/archives purged in the same RUN. Headless Chromium launches as uid 1000 with `--no-sandbox --disable-dev-shm-usage --disable-gpu` and loads a page in **2.6 s** in the local smoke. `example.org` resolves to 127.0.0.1 on this Mac (and therefore inside local Docker) — probes and evals use httpbin.org. | measured | 2 |
| J18 | **No key in the container, ever — the judge's zsh inherits the bridge env.** The proxy shape was checked against the real SDK before deploy: rokan-do's venv runs anthropic **1.2.0**, `messages.parse` sends `output_config` (no `anthropic-beta`), body keys `{model,max_tokens,messages,system,temperature,output_config}`, 9.9 KB, `anthropic-version 2023-06-01`, and one built-in retry on a 5xx. The vendored wheels had been pre-Tier-0 under unchanged version numbers — bump versions whenever the wheel content changes. | lesson | 1 |
| J19 | **Cold planning on unseeded pages inside the sandbox — measured, not assumed.** Same wheels + Chromium as production, local image, key present: `what is the boiling point of water at en.wikipedia.org/wiki/Water` → **1 call · 2 722 ms · verified**; `population of Montreal at en.wikipedia.org/wiki/Montreal` → verified; `default port at www.postgresql.org/docs/current/runtime-config-connection.html` → verified (`5432 by default`); `latest version of flask/requests at pypi.org/project/…` → **abstained** (`drift_detected` — the planner anchors on `'requests '`/`'pip install requests=='`, which its own line reader then can't find; the same pypi question verified on the Mac with real Chrome, and the `<h1>` line boxes/fonts are identical in both — root cause open, filed as a Rokan planner issue); `status at status.slack.com` / `status.openai.com` → abstained (`'We're fully operational' is present but carries no value` — the value IS the sentence; the read_value verifier wants label→value). Sonnet 5 rung: with `thinking` pinned off, 5.4 s / 110 tokens instead of 48 s / 4 000. The open-net eval uses the PostgreSQL question. | measured | 3 |


## Tier 0 — native WebMCP consumption via the CDP `WebMCP` domain (measured 2026-08-29 ~02:20 PT, Engineer #4)

Probe: `evals/diagnostics/tier0-probe.py` (Playwright, `--enable-features=WebMCP`, `new_cdp_session` →
`WebMCP.enable`, collect `toolsAdded` for 3 s after `domcontentloaded`). Pre-registered question: *does a
Shopify Liquid storefront expose its native tools to a third-party CDP consumer, and from which Chromium?*

| T | site | channel / Chromium | `WebMCP.enable` | tools seen via CDP | ms |
| --- | --- | --- | --- | --- | --- |
| T1 | https://template.vercel.shop/ (home) | bundled 151.0.7922.34 | ok | 0 (registers elsewhere/lazily) | 4012 |
| T2 | https://template.vercel.shop/ (home) | chrome 152.0.7977.65 | ok | 0 | 3514 |
| T3 | https://rokan-terminal.vercel.app/ | chrome 152 | ok | 6 (our six fixed tools — probe validated) | 4360 |
| T4 | https://webmcp-coffee.jilles.fyi/ | chrome 152 | ok | 4: filter_coffees_by_roast, add_to_cart, remove_from_cart, update_cart_quantity | 3437 |
| T5 | **https://www.allbirds.com/** (Shopify Liquid) | chrome 152 | ok | **10**: search_catalog, browse_store, get_product, show_variant, get_cart, update_cart, cancel_cart, proceed_to_checkout, manage_orders, search_shop_policies_and_faqs | 4107 |
| T6 | https://www.gymshark.com/ | chrome 152 | ok | 0 | 4641 |

Facts: `document.modelContext` present on every page under the flag; `navigator.modelContext` alias only
on bundled 151; `navigator.modelContextTesting` absent (Cloudflare Browser Run's path) on both. No headless
Chromium left running after each probe (checked). **Conclusion:** Tier 0 is mechanically feasible from
rokan-do's own Playwright; Allbirds is the demo storefront; invoke/latency numbers pending
`docs/measurements/2026-08-29-tier0.md` in the Rokan repo.

## Agent-as-executor probe — `next_step()` two-site workflow (2026-08-30, Engineer #4; Workbench directive step 1)

- **Page:** `https://rokan-sandbox.rokan-sandbox.workers.dev/probe/next-step` (`infra/sandbox/src/probe-page.ts`, commit `2316970`). One tool `next_step` → literal instruction: allbirds.com `search_catalog` "wool runners" → brooklinen.com `search_catalog` "linen sheets" → `DONE`. Logs to `#log` + `localStorage`.
- **Contract (Chrome 152 + `--enable-features=WebMCP`, CDP harness):** `list` → `[next_step]`; 3 invocations CONTINUE(1) → CONTINUE(2) → DONE at **22–24 ms** each; 0 failed, 0 page errors; N=2. Evidence: `docs/evidence/probe/2026-08-30-next-step-contract-chrome-harness.jsonl`.
- **Site survey (same Chrome, `list` after 4 s):** allbirds / brooklinen / kyliecosmetics each declare the identical 10 Shopify tools (`search_catalog browse_store get_product show_variant get_cart update_cart cancel_cart proceed_to_checkout manage_orders search_shop_policies_and_faqs`); gymshark, bombas declare **0**; Cloudflare's `webmcp-challenge.examples.workers.dev` declares 1 promo tool (`reveal_extra_credits_link`) — it is not a store, so it was dropped as site 2.
- **Consumer runs — NOT yet measured:** ChatGPT desktop (Sol/Terra) needs Arav's keyboard; Chrome's `document.modelContext` absent in the running Chrome until restart. Prior from research (ChatGPT drops a page's tools when the page closes) + A/B agent overhead (15.8 s Claude / 23.2 s Codex per tool call): a two-site run via the agent ≈ 60–120 s vs 783 ms compiled. Verdict + scores: `docs/SELF-EVAL-WORKBENCH.md`.

## Executor (a) — a store's declared tool invoked by the judge image's own Chromium, 0 model calls (2026-08-30, Engineer #4)

- **Local judge image** (`rokan-sandbox-rokansandbox:a20dc8f6`, amd64 under emulation, `--user 1000`, the image's policy env: headless, no-sandbox, `ROKAN_TASK_CLASSES=read_value,read_list`, `ROKAN_GUARD_ALL_HOSTS=1`; Mac egress), `evals/diagnostics/native-invoke-probe.py`: `list_tools(allbirds.com)` → **10 tools in 8 866 ms** (5 auto-invokable: search_catalog, browse_store, get_product, show_variant, get_cart, search_shop_policies_and_faqs; 4 writes refused by name); `invoke search_catalog {"catalog":{"query":"wool runners"}}` → **ok, 469 ms tool time (1 300 ms wall), 0 model calls**: "Men's Wool Runner - True Black … $110.00". Evidence: `docs/evidence/probe/2026-08-30-native-invoke-local-image.jsonl`. Bundled Chromium 151 is enough (also lists Allbirds' tools from the Mac via the CDP harness after a 6 s settle; Playwright 1.62.0 — newest — bundles the same 151.0.7922.34).
- **Live judge sandbox** (Cloudflare egress, ½ vCPU): curl to allbirds/brooklinen → HTTP 200; `rokan do "find wool runners at allbirds.com"` → tools listed, 1 select call spent, **`native.invoke` returned not-ok** ("native tool declined; falling back to the browser") → planner → `navigation_failed` after ~85–150 s. **Root cause: CPU.** Same probe script from the live sandbox (`/probe/native-invoke.py`): on `standard-1` (½ vCPU) `list_tools` → **0 tools in 14 839 ms** (the daemon stops listening 3 s after `domcontentloaded`; Allbirds registers later); on **`standard-3` (2 vCPU), same image → 10 tools in 8 181 ms, `search_catalog` ok, 226 ms tool time (1 286 ms wall), 0 model calls** (`docs/evidence/probe/2026-08-30-native-invoke-live-sandbox-standard-3.jsonl`). Shipped both: instance `standard-3` (wrangler.jsonc) and `ROKAN_WEBMCP_QUIET_MS=15000` (Rokan `d62b290`, rokan-mcp 0.1.3, image `787f810`). **Re-verified live after the image deploy (standard-3 + 15 s window): 10 tools in 5 463 ms; `search_catalog` ok, 233 ms tool time (1 250 ms wall) was observed in the harness output but my capture truncated the invoke record — `docs/evidence/probe/2026-08-30-native-invoke-live-sandbox-new-image.jsonl` holds only the `list` line (hostile review 2026-08-30 caught this). The complete live invoke record is the standard-3 file (226 ms); the 0.0.3-image run replaces it with a full `--json` record.**
- Reading: executor (a) is real and measured; the sandbox gap is ops, not architecture, and it matters for the shipped product's Tier 0 story as much as for any Workbench.

## D1/D2 — explicit native invoke across two stores from the CLI, 0 model calls (2026-08-30 ~03:40 PT, Mac, Engineer #4)

- `rokan-do native list <url>` / `native invoke <url> <tool> --set path=value … [--json]` (Rokan `9e4c900`, 13 tests,
  1 722 rokan-do tests green, gate 7/7) + first-line attribution in the renderer (`f5fea13`): the attributed line is
  now `  Found 2 products … 1032ms ⚡ ⚙ native:www.allbirds.com:search_catalog`; the store's own "Next steps: call
  update_cart" prose hangs under it at four spaces and can no longer be read as our answer.
- Dry run of the composed workflow, sandbox policy env on (`ROKAN_TASK_CLASSES=read_value,read_list`): **A**
  allbirds.com `search_catalog {catalog.query: wool runners}` → ok, **993 ms tool / 2 891 ms wall**; **B**
  brooklinen.com `search_catalog {catalog.query: linen sheets}` → ok, **2 265 ms tool / 5 661 ms wall**; **C** `jq`
  over `~/.rokan/native-last.json` → `$369.00 $258.30`. N=1 each, cold daemon per host, 0 model calls by construction.
  `--allow-write` on `update_cart` → refused (exit 2) under the policy env. Not yet run inside the judge sandbox
  (0.0.3 wheels vendored `17cfb45`, image smoke green, deploy after the judge suite finishes).
- **In the judge sandbox, 0.0.3 image (Worker `4b9b9d03`, standard-3):** `rokan-do native invoke https://www.allbirds.com search_catalog --set catalog.query="wool runners" --json` from the judge shell → propose → Enter → idle in **7 749 ms** wall (Chromium cold in the container), products + prices on screen with the store's "Next steps" prose hanging under the attributed line (`docs/evidence/probe/2026-08-30-native-cli-live-sandbox-003.txt`, `…-native-cli-sandbox.png`). **Judge suite on this image: 15/15, 0 retries** (`docs/evidence/sandbox/2026-08-30-judge-suite-15-of-15-image-003.txt`). D0 + D1 are live.
