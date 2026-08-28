# PROGRESS — verified state (update before you stop; Aarya's Claude reads this, not chat)

Last update: **2026-08-28 23:40 PT** by C (Arav's Claude, Fable 5 — owns the whole tree per `docs/HANDOFF.md`). Branch `main`, all pushed.

## Gates

| Gate | State | Owner | Evidence |
| --- | --- | --- | --- |
| Plan | AGREED both sides (`docs/ALIGNMENT.md`) | A + Ay | ALIGNMENT.md |
| **A** — inert `terminal_propose` invoked by a consumer | 🟡 **Chrome half green; ChatGPT half blocked on human** | C → A | `docs/evidence/gate-a/`, `docs/FIELD-NOTES.md` |
| B — terminal + ghost-typing E2E | 🟡 **headless half GREEN on a real PTY** (Chrome 152 + `packages/bridge` via `--no-tunnel`): pair → propose → ghost decoration → Enter → measured `exit_code`/`ms`/redacted tail → bridge countersign; Tab-insert/edit; dangerous double-Enter; Share-screen gate + `[redacted]` on a real `AWS_SECRET_ACCESS_KEY`; forged tool born → invoked → Enter → `exit 0` → `forge_list median_ms`. **Headed Chrome 152 via the real `executeTool` API also green** (ghost at the cursor 12 ms, Enter runs on the shell, `exit_code 1` back to the agent). Only the ChatGPT-desktop take (through a tunnel, recorded) needs Arav | C → A | `evals/cases/terminal-*.json` (98 steps), `docs/evidence/gate-b/*.png|jpg` |
| C — forge → tool appears → invoked (**decoupled from B, PLAN §0.9**) | 🟡 **prompt-line half GREEN** (headless Chrome 152: `forge_create` → approve → `forged_hn_top` in `toolsAdded` → invoke → ghost text → Enter → `terminal_wait` executed → `forge_list runs:1`); live-terminal half after the Terminal plan; ChatGPT `toolchange` refresh unmeasured | C | `docs/evidence/gate-c/2026-08-28-forge-birth-chrome152.png`, `evals/cases/forge-*.json` (150 steps, 0 failed) |
| D — judge mode live URL | 🟢 **GREEN 2026-08-28 20:56 PT** — `https://rokan-sandbox.rokan-sandbox.workers.dev` wired into the live page; **live suite 8/8** (J9); cold start 4.0–5.6 s; signed expiring sids, provisional Gate rows, tab takeover 662 ms, bad-resize non-fatal, wrapped-line + truncated-name redaction. Not yet: `rokan do` inside the container (needs Arav's Docker go), stranger click from a *different* network (ours is cap-throttled) | C | FIELD-NOTES J1–J9, `evals/run-all.mjs --judge` |

## What is green right now (all measured — see FIELD-NOTES)

- `apps/web` scaffolded: Next 15.5.24 · TS strict · Tailwind 4 · `pnpm typecheck && pnpm lint && pnpm build` green · CI at `.github/workflows/ci.yml`.
- Page registers `terminal_propose` (inert; description says NEVER executes) + `terminal_wait` (45 s, `still_waiting`, honours `signal` when given) under one `AbortController`; feature-detects `document.modelContext ?? navigator.modelContext`; page works without WebMCP.
- Chrome 152 + `--enable-features=WebMCP`: `toolsAdded` fires per registration; CDP `WebMCP.invokeTool` → ghost text on the prompt → Enter → `terminal_wait` returns `executed` (705 ms) → ledger row with measured decision latency. ESC / bidi-override injections rejected with reasons (T2.2 half green).
- Quick tunnel passes WebSocket upgrades: open 197 ms, echo 216 ms. PLAN §10 risk #2 closed.
- **`packages/bridge` green (commit `7a3f88c`)**: `node bin/rokan-terminal.js` → node-pty zsh + ws on 127.0.0.1 + 128-bit token (first-frame auth, timing-safe) + one tab at a time (second gets `busy`) + cloudflared quick tunnel + DNS-over-HTTPS wait + one pairing link. zsh shell integration (OSC 133 / OSC 7 / private OSC 7331) gives **honest** `running / last_exit_code / last_command_ms / last_command / cwd`. `~/.rokan-terminal/ledger.jsonl` rows are HMAC-chained per session; `verifyLedger()` detects tampering. Real-PTY smoke `pnpm smoke`: **14/14 in 331 ms**. Through a real tunnel: hello 367 ms, status 411 ms.
- **All four `terminal_*` tools registered and invoked in Chrome 152** (`register.ts`): `terminal_propose` · `terminal_read_screen` (Share-screen gate → `{shared:false}` when OFF, `redactForAgent()` choke point, 1.5 K output budget with `truncated`) · `terminal_status` (honest fields from bridge `status` frames, `measured:true` only with shell integration) · `terminal_wait` (45 s, `still_waiting`, tail through the same redaction + gate). Evidence appended to `docs/evidence/gate-a/2026-08-28-chrome152-cdp.log`.
- `redact.ts` (every PLAN §4 pattern + PEM blocks + ANSI strip; 12 tests) and client `ledger.ts` (append-only, WebCrypto HMAC chain, localStorage mirror, forward-to-bridge hook, `verifyExport`; 2 tests). `pnpm test` in `apps/web` = 14/14.
- Shared contracts under `contract:`: `schemas.ts` v1 (all four fixed tools, `validateProposedCommand`, `DANGEROUS_PATTERNS`/`isDangerous`, `OUTPUT_BUDGET_CHARS`) and `apps/web/src/lib/ws/protocol.ts` v1 (frames + `parsePairingHash`).
- **Forge engine green** (`forge.ts`, 16 unit tests; `forge-spec.ts`, 15): cards with kind override + dangerous double-confirm, runtime `registerTool` with a per-tool `AbortController`, content hash, budget 5 + pin/evict/restore, sequential queue with `prior_step_failed`/`step_timeout`/`superseded`, stats, `forge_create` + `forge_list` tools, `terminal_wait` chaining (`next_proposal_id`, `unknown_proposal`), `window.__rokan` test hooks behind `?test=1`. Chrome 152 measured: abort → `toolsRemoved` + `toolchange` (FIELD-NOTES 14–17).
- **Security fixes from reviews**: recursive canonical HMAC (bridge), client key never exported (bridge countersign = the proof), pairing-host allowlist, CSP + `consumePairingHash`, redaction covers `PREFIX_TOKEN=`/JSON/URL creds/CLI flags/Stripe/Google/npm (18 leak tests), ANSI-C `$'…'` quoting, `why` sanitised, client ledger kinds allowlisted + reserved fields bridge-owned, Origin check, shell respawn, OSC 7 safe decode.
- **Live terminal (TERMINAL-PLAN) green headless:** `BridgeClient` (auth-first, backoff 1·2·4·8·15 s, ping, countersign; 6 tests), `PromptDetector` + `LineBuffer` (4), live `TerminalAdapter` (Enter sends exact bytes; end marker → measured exit/ms/tail; interrupted; Tab-insert `edited`; 7 tests), xterm 6 pane with ghost **decoration** (never through the PTY parser), session store, status bar / tools / forge / ledger panes, editable Forge card + “Try as agent” (`executeTool`), pairing/busy/unauthorized/mobile states, error boundaries per pane. `pnpm gate` = web 93/93 · bridge 25/25 · prompt-line evals 154 steps · real-PTY evals 98 steps, all 0 failed.
- **Seam for the terminal UI: `apps/web/src/lib/webmcp/adapter.ts`.** Implement `TerminalAdapter` (`shareScreen`, `screenLines(n)` from the xterm buffer, `status()` from the latest `status` frame, `ghostType`, `waitProposal` with `exit_code/ms/tail` after Enter) and call `setTerminalAdapter(...)` once — the tools need no other change. Until then `gateAAdapter` keeps everything working with no shell.

## Now / Next / Done / In flight (C builds everything — Arav 03:10 PT; Aarya takes the next *unstarted* item here, never a stale one)

**Done 13:50 PT:** `?tour=1` guided first-60-seconds (auto in judge mode; verified by real state; `evals/cases/tour.json`), `docs/SECURITY.md`, `AGENTS.md`, `docs/DEMO.md`, PLAN §3 synced. `wrangler deploy --dry-run` green.

**Done 15:10 PT — MCP parity (PLAN §13.1):** `npx rokan-terminal mcp` is an MCP stdio server for Claude Code / Cursor / Codex CLI that lists the **same** tools the page registers with WebMCP (six fixed + forged, live `listChanged`) and relays calls to the tab; the page is the single source of truth; the agent socket can never send PTY input (tests: `packages/bridge/test/mcp.test.mjs` with a real MCP client over stdio; `terminal-forge-live.json` checks `agentTools()`/`agentCall()` in the page).

**Done 15:40 PT:** judge-facing README; nonce CSP (no `unsafe-inline` scripts); UI nits from a headed pass (params grid, ledger truncation, how-it-works card). Chrome's `evals-cli` is not on npm (`webmcp-tools` on npm is a third-party SDK) — our CDP harness + 12 cases is the evals story; cite it in the submission.

**Done 16:20 PT:** `docs/SUBMISSION.md` draft; Forge-this as a tested lib (`forge-this.ts`, prompt stripping + name grammar) with a harness path (selection → card → approve → `forged_ls_*`).

**Done 17:10 PT:** CI runs the real-PTY smoke + MCP relay on Linux; `rokan-terminal verify` (ledger cross-check, smoke 29/29); **automated demo dry-run** — every §8 beat on a real PTY with a screenshot per beat (`docs/evidence/demo/`, 47 steps, 0 failed). **Incident:** `bin/rokan-terminal.js` was committed empty by a truncating edit (6c9d3d0) and restored in 072f11c; `check` now requires a non-empty bin.

**State (C, 22:50 PT): session restarted with Codex wired in as an MCP server (`claude mcp list` → codex ✔; first Codex pass found 2 real bridge bugs, fixed `6cef16b`; browser-side Codex pass running). Reviewers are mid-VERIFY pass (`docs/evidence/verify-*`; Opus: live endpoints all green, forged sids 403 with no container). Earlier: GATE D GREEN — live judge suite 8/8 (J9); pass-3 findings all closed; four judge-only bugs found and fixed by driving the real sandbox (ContainerProxy export, /ws path allowlist, fatal resize, wrapped-line redaction). Earlier: JUDGE SANDBOX LIVE — https://rokan-sandbox.rokan-sandbox.workers.dev (Workers Paid on; root cause of the 503s = missing `ContainerProxy` re-export, FIELD-NOTES J1; cold start 4.5 s, J2); web wired (`NEXT_PUBLIC_SANDBOX_URL` + `NEXT_PUBLIC_BRIDGE_HOSTS` set, CSP connect-src includes the Worker). Fable pass-3 P1 fixed; P2s next. Earlier state:** web is LIVE at https://rokan-terminal.vercel.app with all pass-2 P1s. Every reviewer finding from both passes is closed with a regression test in the same commit (see the ticked lists below; 3 still open). Judge sandbox blocked on Workers Paid only. 20:55 PT: `docs/demo.gif` (README) + `docs/evidence/demo-backup.gif` built from the measured dry-run beats (Pillow; ffmpeg is broken on this Mac). **21:20 PT: `rokan do` is real on the demo Mac** — rokan-do installed (uv tool) + 54 seeds; measured replay 312 ms ⚡ (FIELD-NOTES R1–R5); the bridge parses the result line into `terminal_wait.rokan` / `terminal_status.last_rokan` / ledger (`calls:0` only for ⚡); `rokan` shim on the PTY PATH. HN is not seeded → DEMO.md names seeded questions for the `calls:0` beat. Gate now: web 109/109 · smoke 33/33 · MCP 3/3 · sandbox 11/11 · evals 7/7 + `--bridge` 8/8. Reviewer pass-3 prompt: `docs/reviews/REVIEW-PROMPT-pass3.md`. Gate: web 108/108 · bridge smoke 29/29 + MCP 3/3 · sandbox 11/11 · evals prompt-line 7/7 (new `forge-string-input.json`) · `--bridge` 7/7.** Since 17:10: `useForgedTools()` hook (§13.7), judge-Worker self-audit (generic 503, no secret in code, self-audit note in SECURITY.md). `pnpm gate` green on macOS; **CI green on Linux** (real-PTY smoke + MCP relay + sandbox check).

**The moment a login lands (C runs immediately, no further decisions needed):**
- **DONE 18:35 PT** — `vercel link --project rokan-terminal --yes` (from `apps/web`, cwd deploy) + `vercel --prod` → **https://rokan-terminal.vercel.app** (200, nonce CSP, HSTS, `X-Frame-Options: DENY`, `?tour=1` 200); redeployed 19:20 PT with the pass-2 P1 fixes. Still to set after the Worker exists: `NEXT_PUBLIC_SANDBOX_URL` + `NEXT_PUBLIC_BRIDGE_HOSTS`, then `vercel --prod` again.
- **wrangler login DONE; BLOCKED on Workers Paid** (container rollout 401). The moment the plan is upgraded: `cd infra/sandbox && pnpm deploy` → `openssl rand -hex 32 | npx wrangler secret put SID_SECRET` (Worker refuses sessions until set — fail closed) → `curl <worker>/api/health` → `cd apps/web && vercel env add NEXT_PUBLIC_SANDBOX_URL production` (`https://<worker>.workers.dev`) + `vercel env add NEXT_PUBLIC_BRIDGE_HOSTS production` (host only) → `vercel --prod` → `node evals/run-all.mjs --judge=<worker-url>` → cold-start numbers to FIELD-NOTES.
- **ChatGPT desktop on Sol/Terra confirmed** → measure the ChatGPT half of Gates A/B (does the Site tools list refresh on `toolchange` without reload?), FIELD-NOTES + `docs/evidence/gate-a|b/`.

**Earlier — `docs/SANDBOX-PLAN.md` executing — `infra/sandbox/**` (Worker + Gate + Dockerfile scaffolded, typecheck + gate tests green), judge image building/smoking locally in Docker (amd64 under emulation), web "Try it now" path wired. Deploy blocked on `! wrangler login` (Workers Paid). Then: `evals/run-all.mjs --judge`, FIELD-NOTES cold-start numbers, Gate D stranger test.

**Done since 03:30 PT:** forge engine + contracts + 6 fixed tools + test hooks + placeholder card + 5 harness cases (`1fe5ca7`…`faf5038`); both reviewers' first passes fixed (Opus 16/16 ticked, Fable 7/7 P1 + 6 P2 ticked below). `pnpm gate`: web 76/76 · bridge smoke 24/24 · evals 150 steps 0 failed.

**Next — needs Arav's go (Docker build ≈ 10–20 min of pinned CPU under amd64 emulation, and Workers Paid to deploy):** `rokan do` inside the judge container (Gate D "seeded, `calls:0` on replay"): build the three wheels from a scratch copy of `~/dev/Rokan/packages/{rokan-mcp,rokan-agent,rokan-do}` (`uv build`, Rokan's tree untouched) → `vendor/`; Dockerfile adds `uv` + the wheels + `playwright install --with-deps chromium` (~400 MB; `instance_type: basic` = 1 GiB RAM — measure one replay under ¼ vCPU before promising a number) + `rokan-do seed install` at build + Rokan's `SKILL.md` into the seed dir; `allowedHosts` += the seeded hosts to be demoed (githubstatus.com, pypi.org, docs.github.com …); then `pnpm smoke:image` once. Everything else in HANDOFF §7 that does not need a human is done (below).

**Next (in order, all C unless Aarya claims one here first):** Terminal plan (xterm + WS client + real `TerminalAdapter` + ghost overlay + card UX + Share-screen + states) → judge sandbox (`infra/sandbox`) → `rokan do` seeded + `--json` → §13 upgrades → test protocol → README/GIF → rehearsals + backup video → Devpost.

**Done (green, measured):** see "What is green right now" above.

**Rules for anyone joining:** read `docs/FORGE-PLAN.md` §16 (test every baby step; `pnpm gate` before every commit) and `docs/ENV-ARAV.md`. Claim an item by writing your name next to it here and pushing before you start.

## Blocked on Arav (do these first — Gate A deadline Fri 23:59 PT)

1. **ChatGPT desktop is installed; confirm GPT-5.6 Sol or Terra is available in the model picker** (Luna has site tools disabled; free tier may not have Sol/Terra). This is the only thing between us and the ChatGPT half of Gates A/B.
1a. **Publish the bridge to npm** — `rokan-terminal` is not on npm (`npm view rokan-terminal` → 404), so `npx rokan-terminal` on the page, README, DEMO and SUBMISSION is untrue for a stranger until you run, from `packages/bridge`: `npm login` (if `npm whoami` fails) → `npm publish --access public` (C verified `npm pack --dry-run`: bin/ src/ shims/ package.json; no secrets). README step 2 says "clone + node" until then. Say "publish" and C will run it, or run it yourself.
1c. **History purge decision** — `docs/evidence/demo/beat3-share-redacted.png` at commit `0bb4cba` shows a listing of your home directory (regenerated version is clean). Removing it means rewriting `main` (force-push). Options: (a) leave it (repo is private until Sep 1; the file is a directory listing, no secrets), (b) C runs `git filter-repo` on that path + force-push before the repo goes public. Your call — C will not force-push unasked.
1b. **Upgrade the Cloudflare account to Workers Paid ($5/mo)** at https://dash.cloudflare.com/?to=/:account/workers/plans — wrangler login is done and the image builds, but the container rollout answers `401 Unauthorized: You do not have access to Cloudflare Containers. Deploying containers requires the Workers Paid plan.` Nothing else is needed from you; C runs the whole deploy + env wiring + judge evals the moment it's upgraded (exact commands above).
2. **DONE** (18:35 PT — live at https://rokan-terminal.vercel.app). ~~`vercel login`~~ in a terminal (device-code flow). The Vercel MCP account returned 403 "can't create a project". After login: `cd apps/web && vercel link --project rokan-terminal && vercel --prod`. Then open the URL in ChatGPT desktop → Site tools arrow → "propose ls" → screenshot into `docs/evidence/gate-a/`.
3. Claude's Chrome extension wasn't connected, so no *headed* Chrome screenshot yet. Optional: open `http://localhost:3311` (`cd apps/web && pnpm start -p 3311`) in Chrome with `chrome://flags/#enable-webmcp-testing` on, DevTools → Application → WebMCP, screenshot.
4. Kill-rule watch: if #1 can't happen by Fri 23:59 PT, PLAN §10 #1 applies — Chrome + Inspector becomes the primary demo browser and README says so. The Chrome half is already green, so the entry does not die on this.

## Decisions (Arav + Aarya veto by editing PLAN §0)

**D1 — DECIDED 02:30 PT, written as PLAN §0.9: forge leads, terminal is the vehicle.** Two outside reviews + RESEARCH §6b (≈48% of live entries are our old sentence) converge. Changes made: §1 one-liner + hero moment, §8 shot list (cold open = a tool being born and called), §10 risk 3 kill rule inverted (Gate B red kills terminal polish, never forge), §11 rule 1 inverted, CLAUDE.md one-liner. **Gate C is decoupled from Gate B:** forge must demo on the prompt line alone (no PTY) by Sat 22:00 with headless-Chrome evidence. The retrofit framing ("write sites a tool surface") stays rejected — contested lane, sponsor prior art (Cloudflare edge bridge), DOM-driving kill-shot.
- **Risk that can still change the shot:** does ChatGPT desktop's Site tools list refresh on a runtime `registerTool` without reload? Unverified. Measure the hour the app exists. Chrome 152 does (measured).
- Keep out of the submission text as fact: "dynamic registerTool is the strongest reading of criterion #1" is our inference, not a judge quote.

**D3 — LANE SWAP PROPOSED (needs Aarya's Claude ACK in ALIGNMENT.md before C touches it):** forge is now the story and the critical path; it should not be one person's Sunday. Proposal: **C takes the forge engine** — `apps/web/src/lib/webmcp/forge.ts`: `forge_create` handler, dynamic `forged_<name>` registration with a per-tool `AbortController`, `toolchange`, pin/evict at 5 visible, content hash (§13.5), `forge_list` with stats from the ledger — all headless-testable with `evals/harness/webmcp-cdp.mjs`. **Aarya keeps** the Forge card UI, "Forge this" selection from history, the ghost-text overlay, xterm + WS client, and the `TerminalAdapter`. Shared seam: the card calls `forge.approve(spec)`; the engine never renders. If Aarya's Claude prefers to keep the whole forge, say so and C builds `evals/` cases + judge sandbox instead.

Notes carried from the first review: adds if agreed (≈ 0.5 h, Ay): "tools registered this session: N" (measured) in the Tools pane; "Try as agent" on the card via the spec's own `executeTool` (string input, FIELD-NOTES #6). On "five ways you lose": #2 is false as of tonight (measured in Chrome 152); #3 is Gate D; #4 is kill rule #4; #5 is the verify discipline.

**D2 — Aarya's questions 2–6 in ALIGNMENT.md** (product name, repo rename, Vercel owner + code redemption, Netlify/Render account + credits form before Sep 1 12:00 PT, Anthropic spend cap, Rokan STATUS.md launch note). Unanswered.

## Contract pings (for Aarya's Claude)

- `schemas.ts` v0 exists (commit `ba2eb64`). The row-1 sanitizer is `validateProposedCommand()` — import it, don't re-implement.
- Chrome 152 calls `execute(input)` with **no** `{signal}`; every `execute` handler must treat options as optional (`types.ts` already types it so). Chrome's `executeTool` wants a JSON **string** input. Details in FIELD-NOTES.
- `TerminalTools.tsx` and `page.tsx` are placeholders in your lane — replace freely; keep the registration shape in `register.ts`.
- Local run: `pnpm install` at root (pnpm 11 needs `allowBuilds` — already in `pnpm-workspace.yaml`), then `cd apps/web && pnpm dev`.

## For Aarya's Claude — how to run against the real bridge (D1 morning)

```
pnpm install                                   # root
node packages/bridge/bin/rokan-terminal.js --no-tunnel --app http://localhost:3000
# prints http://localhost:3000/#ws=ws%3A%2F%2F127.0.0.1%3A7331&t=<token>
# client: parsePairingHash(location.hash) → new WebSocket(ws) → send {type:'auth',token,cols,rows}
# then {type:'input',data} for every keystroke, {type:'resize'} on fit; render {type:'data'} into xterm.
```
Drop `--no-tunnel` to get a `wss://…trycloudflare.com` link (≈ 15–20 s, waits for DNS). Smoke: `cd packages/bridge && pnpm smoke`.

## Next (C) — D1 lane work landed on D0; what remains

- **Sat morning:** ChatGPT-desktop measurements the moment Arav has the app (FIELD-NOTES "ChatGPT" section); Vercel prod deploy once logged in; headed-Chrome screenshot with DevTools → WebMCP panel.
- **Sat:** help Aarya wire `TerminalAdapter` to xterm + the WS client (I'll review, not edit `apps/web/src/components`); bridge `rokan-do` trailer parsing; `docs/SECURITY.md` first draft.
- **Sat 20:00** joint E2E from the deployed URL through a real tunnel. **22:00 Gate B.**
- **Sun:** `infra/sandbox` (Worker + Sandbox SDK + Dockerfile) — judge mode.

## Before the repo goes public (Sep 1) — checklist
- [ ] Purge `docs/evidence/demo/beat3-share-redacted.png` from history (commit `0bb4cba` captured a listing of Arav's home directory; regenerated in a scratch dir in the next commit). `git filter-repo --path docs/evidence/demo/beat3-share-redacted.png --invert-paths` on a fresh clone, then force-push — Arav's call, coordinate with Aarya.
- [x] Grep evidence images/logs for home paths and tokens (`docs/evidence/**`, `FIELD-NOTES.md`): the pairing token appears nowhere; `/Users/aravkekane` appears in status bars — acceptable. — **done 20:45 PT: `grep -rE "/Users/aravkekane|[a-f0-9]{32}"` over `docs/evidence/**` + FIELD-NOTES = 0 hits; demo PNGs regenerated on the fixed build run in `/tmp/rokan-demo` (viewed: no home listing; the shown key is AWS's public docs placeholder)**
- [x] LICENSE in GitHub About; README first line; `vendor/` note honest. — **verified 20:45 PT: `gh repo view` → licenseInfo Apache-2.0 (LICENSE file detected); README opens with the one-liner; no `vendor/` claim remains**

## Objections

- None from C yet. (D1 above is a recommendation on pitch framing, not an objection to a locked decision.)

## Review findings (open) — Opus 5 reviewer, 2026-08-28

Full report: `docs/reviews/2026-08-28-opus-1.md`. Gate re-run from a cold build before reviewing:
`pnpm gate` green — typecheck/lint clean, web 34/34, smoke 14/14 (496 ms), evals 0 failed. Every
PROGRESS claim reproduced.

- [x] P0 — `packages/bridge/src/ledger.js:16` — `canonical()` uses `JSON.stringify(obj, keys)`, a *recursive key allowlist*, so nested object keys are dropped from the digest: a `forged {params:[{…}]}` row can be rewritten and `verifyLedger()` still returns `ok:true` (proven; smoke only tampers a top-level scalar, so 14/14 is false confidence) — Opus [C's lane] — **fixed e517e6c**
- [x] P0 — `apps/web/src/lib/webmcp/ledger.ts:104` — `export()` ships `key_hex` beside the rows it authenticates (and mirrors both to localStorage), so anyone who edits rows can re-sign; use the bridge's `ledger_ack` sig (key the page never sees) as the real countersignature and stop claiming tamper-proof — Opus [C's lane] — **fixed e517e6c**
- [x] P1 — `apps/web/src/lib/ws/protocol.ts:79` — `parsePairingHash` validates scheme + token shape but **not the host**, so `#ws=wss://evil/&t=<hex>` connects the terminal to an attacker: keystroke exfiltration + spoofed screen. Allowlist the host before the WS client is written — Opus [Ay's lane, contract file] — **fixed e517e6c**
- [x] P1 — `apps/web/next.config.ts` + `bin/rokan-terminal.js:62` — pairing token stays in `location.hash` (readable by any third-party script — the exact arXiv 2606.06387 vector we cite) with no CSP, and **will be on camera in the demo video / evidence screenshots**; `history.replaceState` after parse + a real CSP — Opus [C's lane] — **fixed e517e6c + hash strip in `session.start()` (`terminal-pair.json` asserts `location.hash === ''`) + nonce CSP via middleware**
- [x] P1 — `apps/web/src/lib/webmcp/register.ts:74` — `isDangerous()` is never called on the proposal path, so `rm -rf /` ghost-types with no red banner and no second confirmation; PLAN §4 + T2.2 currently fail — Opus [C's lane] — **fixed e517e6c**
- [x] P1 — `.github/workflows/ci.yml` — CI never runs `pnpm --filter web test` or the evals, so the 12 redaction tests guarding the security choke point can regress on `main` silently — Opus [C's lane] — **fixed e517e6c**
- [x] P1 — `README.md` — describes `infra/sandbox` and `vendor/` wheels; both directories are empty. Judges read the README first and §0.6 is "say the true thing" — Opus [C's lane] — **fixed e517e6c**
- [x] P1 — `apps/web/src/components/TerminalTools.tsx:62` — Enter/Esc only work after the human clicks the section (no autofocus, no document-level handler); the harness passes only because `webmcp-cdp.mjs:67` focuses it explicitly. Green tests, dead demo — the April 23 shape — Opus [Ay's lane] — **fixed e517e6c**
- [x] P2 — `docs/PLAN.md` §3 — contract drift: row 4 + T2.4 say 120 s, `WAIT_DEFAULT_MS` is 45 s; rows 2/4 return shapes omit `redactions`/`truncated`/`reason`/`still_waiting` — Opus [C's lane] — **fixed e517e6c**
- [x] P2 — `apps/web/src/lib/webmcp/register.ts:130` — `terminal_status` returns `cwd` ungated and unredacted, bypassing both the Share-screen gate and the `redactForAgent` choke point — Opus [C's lane] — **fixed e517e6c**
- [x] P2 — `ledger.ts` (both) — client nests under `fields`, bridge spreads flat + sorts: the "same row in both ledgers" can never be cross-verified — Opus [C's lane] — **fixed e517e6c**
- [x] P2 — `apps/web/src/lib/webmcp/ledger.ts:90` — one rejected append poisons `this.chain` forever and every caller is `void`-ed, so the ledger dies silently (trigger: `crypto.subtle` undefined on a non-localhost http:// origin, e.g. LAN testing) — Opus [C's lane] — **fixed e517e6c**
- [x] P2 — `apps/web/src/lib/webmcp/register.ts` — nothing serialises `terminal_propose`; a second proposal strands the first, whose `terminal_wait` returns `still_waiting` forever — Opus [C's lane] — **fixed e517e6c**
- [x] P2 — `packages/bridge/src/shell-integration.js:96` — `feed()` discards a trailing lone ESC, losing an OSC marker split at exactly that byte; line 25 leaks one temp ZDOTDIR per run — Opus [C's lane] — **fixed e517e6c**
- [x] P2 — `packages/bridge/src/bridge.js:101` — idle timeout closes the socket but leaves the process and the **public tunnel** alive indefinitely — Opus [C's lane] — **fixed e517e6c**
- [x] P2 — `evals/run-all.mjs:6` / `evals/harness/webmcp-cdp.mjs:44` — `new URL().pathname` instead of `fileURLToPath`; `send()` has no timeout so a stalled Chrome hangs the run forever — Opus [C's lane] — **fixed e517e6c**

## Review findings (open) — Fable 5 reviewer, 2026-08-28 (does not repeat the Opus list above)

Full report: `docs/reviews/2026-08-28-fable-1.md`. Gate re-run cold at `4a6e8a6`/`1fe5ca7`: typecheck/lint clean, web 27→50 tests green, smoke 14/14 (495 ms), Gate A harness 14 steps 0 failed on an isolated :3399 build. New measured Chrome 152 rows (abort → `toolsRemoved` yes; `toolchange` fires on abort; duplicate name w/o abort → `InvalidStateError`) are in the report's "Measured" table — copy into FIELD-NOTES.

- [x] P1 — `apps/web/src/lib/webmcp/redact.ts:48` — `kv_secret` puts `\b` *before* the keyword, so `AWS_SECRET_ACCESS_KEY=`, `VERCEL_TOKEN=`, `CLOUDFLARE_API_TOKEN=`, `PGPASSWORD=`, JSON `"password": "…"`, `postgres://u:p@`, `sk_live_`, `AIza…` all leak — 18 of 29 realistic lines measured leaking; PLAN §4 promises `token=` is redacted — Fable [C] — **fixed faf5038**
- [x] P1 — `packages/bridge/src/shell-integration.js:130` — `decodeURIComponent` on the raw OSC 7 path throws `URIError` inside `term.onData` → `rokan-terminal` dies on `cd` into any dir with `%` (reproduced, real PTY) — Fable [C] — **fixed faf5038**
- [x] P1 — `packages/bridge/src/bridge.js:78,126` — after the shell exits, the next tab that pairs calls `term.resize` on a dead PTY → uncaught `ioctl(2) failed`, bridge dies (reproduced) — Fable [C] — **fixed faf5038**
- [x] P1 — `apps/web/src/lib/webmcp/forge-spec.ts:170` — `substituteLine` doesn't model `$'…'`; value `a\'; touch X #` in template `echo $'{{x}}'` executes `touch` in zsh **and** bash (reproduced); reject `$'`/`$"` templates at forge time — Fable [C] — **fixed faf5038**
- [x] P1 — `apps/web/src/lib/webmcp/register.ts:163` — `terminal_wait` on an unknown id returns `still_waiting` (1 ms) forever instead of the typed `unknown_proposal`; agent loops — Fable [C; FORGE-PLAN §3.4 lists it — verify when the in-flight register.ts lands] — **fixed faf5038**
- [x] P1 — `apps/web/src/lib/webmcp/register.ts:79` + `TerminalTools.tsx:76` — `why` is not sanitised (only sliced); U+202E + ESC in `why` render on the prompt line beside the command (reproduced via CDP) — Fable [C validates, Ay isolates the span] — **fixed faf5038**
- [x] P1 — `packages/bridge/src/bridge.js:152` + `ledger.js:33` — client `ledger` rows spread *after* `seq/t/session/kind/origin`, so a client can write `origin:'bridge', kind:'executed', session:'other', seq:1` and `verifyLedger` stays ok (reproduced); allowlist `kind`, strip reserved keys — Fable [C] — **fixed faf5038**
- [x] P2 — `schemas.ts:68` — `DANGEROUS_PATTERNS` pass `rm -rf /*`, `rm -rf ~`, `rm -rf $HOME`, `rm -Rf /`, `rm -r -f /`, `chmod -R 777 /`, `find / -delete` (measured) — Fable [C] — **fixed faf5038**
- [x] P2 — `forge-spec.ts:65` — `MUTATING_RE` `>>?\s*\S` flags `2>&1` / `2>/dev/null`, turning read tools into `CONSEQUENTIAL` writes (measured) — Fable [C] — **fixed faf5038**
- [x] P2 — `forge.ts:264-316` — a rejected `registerTool` (Chrome throws `Duplicate tool name` without a prior abort — measured) leaves a phantom `visible` tool in `toolMap` and the error escapes `approve()`; roll back + typed error — Fable [C] — **fixed faf5038**
- [x] P2 — `forge.ts:240` — `forged` ledger row stores a command *count*, not the commands; the "traceable log of registration" can't show what was registered — Fable [C] — **fixed faf5038**
- [x] P2 — `forge.ts:346` — `unforge` of the tool whose invocation is active leaves `activeInv` set; everything else stays `busy` — Fable [C] — **fixed 84759c8**
- [x] P2 — `packages/bridge/src/bridge.js:175` — no `'error'` on `http.listen`: stale bridge on 7331 → `EADDRINUSE` stack, process dies (measured) — Fable [C] — **fixed faf5038**
- [x] P2 — `packages/bridge/src/bridge.js:88` — no `Origin` check on the WS upgrade (defence in depth for a leaked fragment) — Fable [C] — **fixed faf5038**
- [x] P2 — `TerminalTools.tsx:32` — unmount before `registerTerminalTools` resolves leaks the AbortController (dispose captured before assignment); not reproduced in dev, code path only — Fable [Ay] — **fixed 84759c8 (registration now lives in App.tsx)**
- [x] P2 — `docs/FORGE-PLAN.md` §4.3 vs `forge-spec.ts` — plan says quoted placeholders are rejected; code substitutes context-aware (correct); update plan + `ForgeError` — Fable [C] — **fixed c243090**
- [x] P2 — `evals/run-all.mjs:6` — hard-kills :3311 (collides with a second reviewer / Aarya's server); take a port — Fable [C] — **fixed c243090**
- [x] P2 — `docs/PLAN.md` §4 — "`sudo` in judge mode" hard-block is not implemented anywhere — Fable [C] — **fixed c243090**
- [x] P2 — `evals/harness/webmcp-cdp.mjs:60` — no case exercises the JSON-**string** input path (`coerceInput`) that spec-level `executeTool` / ChatGPT use — Fable [C] — **fixed c243090 (`forge-string-input.json`)**

## Review findings (open) — Opus 5 reviewer, pass 2, 2026-08-28

Full report: `docs/reviews/2026-08-28-opus-2.md`. Reproduced from a clean pull at `7a32314`:
web **98/98** · bridge smoke **28/28 in 2157 ms** + 2 MCP tests · evals **6 cases / 174 steps / 0
failed / 0 pageErrors**. Pass-#1 P0s confirmed closed *with* regression tests (nested-object tamper,
key-order independence, cwd gated on Share-screen). Findings 1 and 2 are invisible to all 98 tests
and all 174 eval steps.

- [x] P1 — `apps/web/src/lib/terminal/adapter.ts:85,90` — an in-flight proposal only finishes on OSC 133;C **and** a `running:false` status, both zsh-only; with bash (measured: 0 status frames, no 133;C) `inflight` never clears and `acceptProposal` returns false forever — the first agent proposal permanently wedges the terminal on any non-zsh shell — Opus [C] — **fixed 60999c8 + e34c0c4**
- [x] P1 — `apps/web/src/lib/webmcp/forge.ts:447` — forged-tool step rows are appended as kind `executed`, but `CLIENT_LEDGER_KINDS` (`ws/protocol.ts:24`) accepts `executed_step` and nothing in the repo produces that, so the hero shot's "forged tool ran, exit 0" rows are silently dropped at `session.ts:93`, never countersigned, and will read as un-countersigned in `rokan-terminal verify` — Opus [C] — **fixed 60999c8**
- [x] P1 — `infra/sandbox/src/worker.ts:37,57` — `cors()` omits headers for a disallowed origin but the handler still runs; a cross-origin simple `POST /api/session` burns a visitor's 1-per-10-min Gate quota, so any page a judge visits can deny them a sandbox. Return 403 before `gate.allow()` — Opus [C] — **fixed abe7be1**
- [x] P2 — `infra/sandbox/src/worker.ts:102` — `/ws/:sid` instantiates a Sandbox DO for any well-formed sid with no Gate and no ownership check, outside the rate limiter (bridge token still blocks PTY access; unverified against a live deploy) — Opus [C] — **fixed 439cf19**
- [x] P2 — `infra/sandbox/src/worker.ts:93` — `DELETE /api/session/:sid` has no ownership check and releases on the *caller's* Gate DO, so a third party who learns a sid destroys the victim's sandbox while the victim stays rate-limited — Opus [C] — **fixed 439cf19**
- [x] P2 — `packages/bridge/src/mcp.js:108` — `destructiveHint: !readOnlyHint` marks the inert `terminal_propose` destructive over MCP while WebMCP calls it non-destructive: one registry, two protocols, two safety claims — Opus [C] — **fixed 6bf9a76**
- [x] P2 — `apps/web/src/components/Terminal.tsx:226` — `dir="auto"` on the ghost overlay lets a leading strong-RTL *letter* (not a Cf char, so `validateProposedCommand` passes it) flip render order → displayed ≠ executed; use `dir="ltr"` — Opus [C] — **fixed e34c0c4**
- [x] P2 — `apps/web/src/lib/webmcp/ledger.ts:12` vs `ws/protocol.ts:24` — client `LedgerKind` permits `executed` (bridge drops it) and omits `executed_step` (bridge accepts it); the enums are not the same set — root cause of the finding above — Opus [C] — **fixed 60999c8**
- [x] P2 — `apps/web/src/lib/ws/client.ts:164` — ping `setInterval` assigned without clearing an existing timer; a duplicate `hello` leaks an interval and doubles the ping rate — Opus [C] — **fixed 84759c8**
- [x] P2 — `apps/web/src/lib/ws/client.ts:251` — input queued during `connecting` is flushed on `hello`, so after a shell respawn those bytes land in a different shell than the one the human was typing at — Opus [C] — **fixed 84759c8**
- [x] P2 — `packages/bridge/src/mcp.js:42` — `AgentLink` never reconnects; after a bridge restart the MCP server serves a stale tool list and every call rejects with no recovery — Opus [C] — **fixed 6bf9a76**

## Review findings (open) — Fable 5 reviewer, pass #2, 2026-08-28 evening

Full report: `docs/reviews/2026-08-28-fable-2.md`. Gate re-run once at `7a32314`: typecheck/lint/build clean, web 98/98, smoke 28/28 (2156 ms), evals 6 cases / 174 steps / 0 failed. Pass-#1 fixes re-verified (incl. `$'…'`/`$"…"` safe on zsh+bash). All new findings are on the live-terminal / judge paths; F1–F3 reproduced on a real PTY (`scratchpad/pty-probe.ts`).

- [x] P1 — `packages/bridge/src/bridge.js:95-113` + `apps/web/src/lib/terminal/adapter.ts:89-102` — end `status` is sent *before* the `data` chunk carrying the end marker, so the adapter finishes `tail` early: measured 2/3, 1/3, 1/3 output lines on `echo a; echo b; echo c` — the recovery beat reads a partial tail — Fable [C] — **fixed e34c0c4**
- [x] P1 — `apps/web/src/components/Terminal.tsx:143-152` + `lib/terminal/adapter.ts:169-178` — Enter on a ghost ignores the bridge's honest `running:true`; measured: with `cat` running, `acceptProposal` → true and the proposal went into cat's stdin (same for vim/ssh/python) — Fable [C] — **fixed e34c0c4**
- [x] P1 — `apps/web/src/lib/terminal/adapter.ts:172` + `Terminal.tsx:150-152` — without OSC integration (bash/sh/fish) `inflight` never clears: measured `--shell /bin/bash` accept #1 true, `waitProposal` null, accept #2 **false** and the Enter key is consumed silently; same wedge in zsh via Tab-insert → Ctrl-U → Enter — Fable [C] — **fixed 60999c8 + e34c0c4**
- [x] P1 — `infra/sandbox/src/worker.ts:102-108, 93-100` — `/ws/:sid` and `DELETE` call `getSandbox()` for any well-formed sid; SDK `wsConnect`→`containerFetch`→`startAndWaitForPorts` (containers/dist/lib/container.js:864-870) starts a container on a never-issued sid — bypasses the Gate, 10 requests exhaust `max_instances: 10`; sign the sid (HMAC with a Worker secret) or check the Gate row before `getSandbox` — Fable [C] — **fixed 439cf19**
- [x] P1 — `apps/web/src/lib/terminal/linebuffer.ts:39-73` + `Terminal.tsx:116-119` — the Enter-gate is blind to paste (`onData` never counted) and ↑/↓/Ctrl-R history (arrows return false): after ⌘V or ↑ the ghost shows on a full line and Enter appends `command\r` to it; SECURITY.md §1 "Enter never sends a proposal over partial input" overclaims (code path) — Fable [C] — **fixed e34c0c4**
- [x] P2 — `apps/web/src/lib/terminal/agent-relay.ts:23` — republishes the full tool list on every forge emit (11 sites) → `listChanged` spam to MCP clients per ghost/Enter; publish on definition-key change only — Fable [C] — **fixed 84759c8**
- [x] P2 — `forge.ts:447` vs `ws/protocol.ts:24` / `bridge/src/protocol.js:48` / `ledger.ts:15` — forged steps append kind `executed`, the forward allowlist has `executed_step` (emitted nowhere), so step rows are never countersigned (no ✓) — contract drift — Fable [C] — **fixed 60999c8**
- [x] P2 — `apps/web/src/lib/ws/client.ts:135-137, 214-217` — the 5 s no-hello timer closes with 4401 → terminal `unauthorized` state, no retry; a slow cold judge pair shows "unauthorized" — Fable [C] — **fixed 84759c8**
- [x] P2 — `docs/SECURITY.md` §4/§6 — "bridge binds loopback only" is false in judge mode (`--host 0.0.0.0`, worker.ts:70); state it + "reachable only via the Worker proxy" — Fable [C] — **fixed 439cf19**
- [x] P2 — `infra/sandbox/wrangler.jsonc:25` — 1 session/IP/10 min blocks two judges behind one NAT for 10 min; 3/10 min is safe with `MAX_CONCURRENT_PER_IP=3` — Fable [C] — **fixed 439cf19**
- [x] P2 — `packages/bridge/src/mcp.js:42-79` — `AgentLink` never reconnects after a bridge restart; stale tools, every call errors — Fable [C] — **fixed 6bf9a76**
- [x] P2 — `components/Terminal.tsx:150-152` — `acceptProposal` return ignored + key consumed → silent dead Enter with no reason shown — Fable [C] — **fixed e34c0c4**
- [x] P2 — `apps/web/src/lib/ws/client.ts:163, 251-253` — keystrokes queued while `connecting` are replayed into the shell after a *re*-pair; flush only on first connect — Fable [C] — **fixed 84759c8**
- [x] P2 — `infra/sandbox/src/worker.ts:93-100` — unauthenticated, unused `DELETE /api/session/:sid`; remove or bind to the token — Fable [C] — **fixed 439cf19**

## Review findings (open) — Fable 5, pass 3 (2026-08-28 night)

Full report: `docs/reviews/2026-08-28-fable-3.md`. Gate cold at `3691189`: typecheck/lint/build clean, web 109/109, bridge 6/6 + smoke 33/33 (2401 ms), sandbox 11/11, evals 7/7 + `--bridge` 8/8; live URL 200 (nonce CSP, HSTS, DENY). All pass-2 fixes verified.

- [x] P1 — `packages/bridge/src/bridge.js:116` + `apps/web/src/components/Panes.tsx:196` + `evals/cases/terminal-rokan-trailer.json:3` — `calls:0 ⚡` is set from any command's output (the gate's own smoke + E2E prove it with `echo`), so the ledger, the hero beat and SUBMISSION show a printed line as a measured zero-call replay (§0.6); gate `parseRokanTrailer` on `state.last_command` matching `^(rokan|rokan-do)\b` (OSC 7331 already carries it), make the `echo` cases negative tests — Fable [C] — **fixed: `isRokanCommand(last_command)` gates attribution (env/path prefixes allowed); smoke + E2E flipped to negative for `echo`, positive via the shim + a fake `rokan-do` on PATH**
- [x] P2 — `README.md` — "94 unit tests" / "12 cases" are stale; measured 109 / 15 (365 steps) — Fable [C] — **fixed 523f462**
- [x] P2 — `README.md` judges step 4 — "site-tools list gains forged_<name> (no reload)" is asserted for ChatGPT desktop but measured only in Chrome 152; state it per PLAN §0.9 — Fable [C] — **fixed 523f462**
- [x] P2 — `docs/PLAN.md:143,146` — row 6 says `executed` per step (now `executed_step`); row 4 deltas lack `measured:false`, `rokan{ms,replayed,calls}`, `terminal_status.last_rokan` — Fable [C] — **fixed 523f462**
- [x] P2 — `apps/web/src/lib/webmcp/forge.ts:212,240` + `ForgeCard.tsx:23` — forge path uses mode-less `isDangerous`, so judge-mode `sudo` in a forged command is not flagged while `terminal_propose` (`isDangerousIn`) flags it — Fable [C] — **fixed 523f462**
- [x] P2 — `apps/web/src/lib/terminal/adapter.ts:170,218` — no-integration quiet fallback (750 ms) marks a silent long command done; the `running` Enter-gate cannot fire without integration; SECURITY §1 row 4 should scope the claim to zsh integration — Fable [C] — **fixed 523f462**
- [x] P2 — `infra/sandbox/src/sid.ts` — signed sids never expire: after TTL a stale tab's reconnects to `/ws/<sid>` restart an empty container each attempt; sign `id.exp` or check the Gate row's `expires_at` — Fable [C] — **fixed 523f462**
- [x] P2 — `infra/sandbox/src/worker.ts:107` — `/ws` `getSandbox(env.Sandbox, id)` omits `sleepAfter:'35m'` (SDK default 10 m); confirm the persisted value wins on first deploy — Fable [C] — **fixed 523f462**
- [x] P2 — `infra/sandbox/Dockerfile` — `rokan-do` not in the judge image while the `rokan` shim is on PATH and `api.anthropic.com` is allowlisted; `rokan do` exits 127 in the sandbox — install it (seeds, no key) or say so in the seed README — Fable [C] — **fixed 523f462**
- [x] P2 — `README.md` — "`npx rokan-terminal mcp`" before the package is published; use the `node packages/bridge/bin/rokan-terminal.js mcp` form — Fable [C] — **fixed 523f462**

## Review findings (open) — Opus 5 reviewer, pass 3, 2026-08-28

Full report: `docs/reviews/2026-08-28-opus-3.md`. Cold gate at `3691189`: web **109/109** · bridge
check + smoke **33/33 in 2404 ms** + MCP 3/3 · bridge units 6/6 + 3/3 · sandbox **11/11** · evals
**7 cases / 193 steps / 0 failed** · `--bridge` **8 cases / 172 steps / 0 failed**. **Live prod
measured healthy:** 200 in 219 ms, nonce CSP + `strict-dynamic` served, and the gate-a case driven
against `https://rokan-terminal.vercel.app/` registers 6 tools, `terminal_propose` 21 ms, ESC + RLO
both rejected. All pass-2 findings (mine and Fable's Worker ones) verified closed with regression tests.

- [x] P1 — `packages/bridge/src/bridge.js:116` — the rokan trailer is parsed from *any* command's output with no check that `last_command` was a rokan invocation (measured: `echo "  the answer is 42   7ms  ⚡"` → signed ledger row `rokan_calls:0`), so `docs/SUBMISSION.md:44`'s "parsed from rokan-do's own result line" is untrue as written, `Panes.tsx:197` renders a bare `calls:0 ⚡` badge with no qualifier, and an agent-proposed `echo` the human waves through makes the HMAC chain vouch for a replay that never happened; gate on `last_command` (one line) and the SUBMISSION sentence becomes true — Opus [C] — **fixed: `isRokanCommand(last_command)` gates attribution (env/path prefixes allowed); smoke + E2E flipped to negative for `echo`, positive via the shim + a fake `rokan-do` on PATH**
- [x] P2 — `docs/SECURITY.md:71` — says "1 new session per IP per 10 min"; `wrangler.jsonc` sets 3 and `SUBMISSION.md:54` says 3, while `SECURITY.md:7` claims everything below is implemented and regression-tested — Opus [C] — **fixed 523f462**
- [x] P2 — `infra/sandbox/src/worker.ts:71` — the 429 body ("This IP already started a sandbox in the last 10 minutes") is the copy for a limit of 1; the limit is 3, so a judge who trips it reads a message contradicting the README and SECURITY.md — Opus [C] — **fixed 523f462**
- [x] P2 — `docs/PLAN.md:119,189,285` + `SANDBOX-PLAN.md:57` + `FORGE-PLAN.md:485` — the "model-call cap 20/session" abuse control is promised in four places and implemented in none; risk is nil (no key reaches the container) but the claim is unfulfilled — replace with the true, stronger "no API key in the judge container; unseeded tasks are refused" — Opus [C] — **fixed 523f462**
- [x] P2 — `infra/sandbox/src/worker.ts:28` — `ANTHROPIC_API_KEY` is a declared-but-unused `Env` field, so `wrangler secret put ANTHROPIC_API_KEY` (which `PLAN §12.6` instructs) silently does nothing; delete it or comment why it is deliberately unwired — Opus [C] — **fixed 523f462**
- [x] P2 — `evals/cases/gate-a-propose-wait.json:18` — the final "ledger row rendered" step is a bare `eval` with no `equals`/`matches`, so the harness defaults `ok:true`; its value is `null` on both localhost and live prod, i.e. it would fail if made asserting (stale Gate-A placeholder text vs the current pane UI). 1 of 18 steps asserts — sweep all cases for non-asserting `eval` steps — Opus [C] — **fixed 523f462**

## Review findings (open) — Opus 5 reviewer, VERIFY pass, 2026-08-28

Full report: `docs/reviews/2026-08-28-opus-verify.md`. Evidence: `docs/evidence/verify-opus/live-endpoints.txt`.
Cold gate at `6cef16b` hit every expected number: web **114/114** · bridge check pass · bridge units
**7/7** · smoke **36/36 in 2864 ms** + MCP **3/3** · sandbox **12/12** · prompt-line evals **7 cases,
0 failed** · judge-mode evals **8 cases, 0 failed**. Live: page **200 in 196 ms** with nonce CSP +
`strict-dynamic`; Worker health **200 in 58 ms**. Adversarial: trailer attribution **5/5** (3 bypasses
I invented all refused, 2 positive controls still parse), forged sids **403 in 83–125 ms** with no
instance started, cross-origin `POST /api/session` **403** before the Gate, `/tmp/pwned` never created.
All pass-1/2/3 findings verified closed by measurement.

- [x] P1 — `evals/run-all.mjs:38,50,88,140` — the detached `next-server` is only reaped at line 140, **after** two unconditional `process.exit(1)` paths (line 50 "web app did not start", line 88 "bridge did not print a pairing link"), and there is **no** SIGINT/SIGTERM handler (`grep -c "process.on"` = 0), so every early exit or interruption leaks a 54 MB server; measured **16 orphans holding 767 MB**, oldest alive **2 h 33 m** — I reclaimed 767 MB. This is the likely proximate cause of today's laptop crash and it is in the one command every reviewer, the builder and CI run — wrap in try/finally + signal handlers — Opus [C] — **fixed 848ca42 (cleanup on every exit path + signals; evals/test/runner-cleanup.test.mjs)**
- [x] P2 — `evals/run-all.mjs:38` — `pnpm start` serves whatever `.next` exists, so after a `git pull` that touches `apps/web` the suite silently tests a **stale build** and reports eval failures (or "web app did not start") instead of a build problem; both of my first-pass failures were this. Build, or stat `.next` against the working tree and refuse — Opus [C] — **fixed 848ca42 / 6b0d… (runner rebuilds when .next is stale; sleepAfter 10m; row fixed; bare evals must record a value)**
- [x] P2 — `infra/sandbox/wrangler.jsonc` — `wrangler containers list` shows **7 live instances** of 10 (`max_instances: 10`) while idle; with a 30-min TTL, sessions ending only on TTL/idle (J5) and 3 concurrent per IP, **four judge IPs exhaust the pool** and the next judge gets a failed start. J1 says the pile-up is pre-fix residue — re-measure cold before judging day and consider raising `max_instances` — Opus [C] — **fixed 848ca42 / 6b0d… (runner rebuilds when .next is stale; sleepAfter 10m; row fixed; bare evals must record a value)**
- [x] P2 — `docs/FORGE-PLAN.md:485` — still states "1 session/IP/10 min" (now 3) and "model-call cap" (deliberately not implemented); PLAN, SANDBOX-PLAN and SECURITY.md were all corrected, this judge-analysis row was missed — Opus [C] — **fixed 848ca42 / 6b0d… (runner rebuilds when .next is stale; sleepAfter 10m; row fixed; bare evals must record a value)**
- [x] P2 — `evals/cases/forge-birth.json`, `evals/cases/gate-a-propose-wait.json` — 2 of 141 eval steps still assert nothing (bare `eval`, no `equals`/`matches`); down from pass 3, not gone — Opus [C] — **fixed 848ca42 / 6b0d… (runner rebuilds when .next is stale; sleepAfter 10m; row fixed; bare evals must record a value)**

## Review findings (open) — Fable 5, verify pass (2026-08-28 night)

Full report + 8 screenshots: `docs/reviews/2026-08-28-fable-verify.md`, `docs/evidence/verify-fable/`. Cold gate: web 114/114, bridge 7/7 + smoke 36/36 (3016 ms), sandbox 12/12, evals 7/7 + 8/8 + judge-mode 8/8 (544 steps, 0 failed). Live judge session from real Chrome 152: 429 then paired (cold 4480 ms, pair 217 ms), propose 6 ms, Enter → exit 0 · 7 ms, redaction 1/1 + 3/3 (value never present), Forge this → `forged_seq_50` (toolchange 5 ms, listed in 630 ms, tools · 7), invoke → ghost. MCP relay: 6 tools, call 1 ms, `input` refused, reconnect 508 ms. Forged sid → 403 in 136 ms, containers 1→1. Not executed: B7/B8 (no slot/time), 4×POST from a second IP, judge-mode `sudo`/paste (local judge bridge never paired from https — F3).

- [ ] P1 — `apps/web/src/lib/ws/client.ts:135-138` — a WebSocket that never opens is never timed out (the 5 s timer is armed in `onopen`): live judge session dropped at 22:43:24 (container fleet modified 22:43:28) and the page showed `pairing…` for > 4 min with no retry and no message; reproduced locally: `ws://127.0.0.1` link from the https page sits in `connecting` > 6 s with no open/close event — Fable [C]
- [ ] P1 — `apps/web/src/lib/terminal/session.ts` — reload mid judge-session → `unpaired` (`reconnects 0`, forged tools gone, button again); checklist expects takeover ≤ 2 s; persist `{ws, token, expires_at}` in sessionStorage and `startWith()` on load — Fable [C]
- [ ] P2 — docs (`ENV-ARAV.md`, `HANDOFF.md`, README "Run it yourself") + pairing card — a `--no-tunnel` `ws://127.0.0.1` link opened from the https live page never pairs and never says why (bridge saw no connection; Node probes with the browser Origin get `hello`); state that local `ws://` links work only from a localhost page — Fable [C]
- [ ] P2 — `components/Terminal.tsx` — pane forced to 105 px renders blank while the shell keeps running (read_screen still redacted 22 lines / 3); clamp min height or show "terminal too small" — Fable [C]
- [ ] P2 — `apps/web/src/lib/webmcp/redact.ts` — value pattern `\S+` swallows the `;` after a secret (`…KEY=[redacted] echo ok`), so the agent's view differs from what the human typed; stop at `[;&|)]` — Fable [C]

## Review findings (open) — Codex (gpt-5.5 via MCP), browser-side pass, 2026-08-28 night

Prompted by C on the diff since `7a32314` (apps/web/src/lib + components), read-only sandbox. Verdict "not judge-ready, 0.96" — every finding was reproduced by C before fixing; all fixed in `b45db33` with a regression test each.

- [x] P1 — `redact.ts` entropy rule reported a redaction it did not make (match without change) — **fixed b45db33**
- [x] P2 — `redact.ts` `key` keyword over-redacted `keyboard=`, `monkey=` — **fixed b45db33** (identifier-boundary lookarounds)
- [x] P2 — `redact.ts` entropy rule hid `build_id=…` — **fixed b45db33** (plain-name deny-list: id/sha/hash/commit/build/version/…)
- [x] P1 — `schemas.ts` judge sudo missed `VAR=1 sudo …` — **fixed b45db33**
- [x] P1 — `forge.ts` forged invocation used mode-less isDangerous → judge sudo step not flagged — **fixed b45db33**
- [x] P1 — `adapter.ts` Enter on a ghost while connecting queued the command into the next hello — **fixed b45db33** (refused until paired)
- [x] P1 — `linebuffer.ts` one-character paste/IME slipped the dirty gate — **fixed b45db33** (keyed vs unkeyed data)
- [x] P1 — `linebuffer.ts` Enter reset the line before the prompt returned (fast second Enter) — **fixed b45db33** (awaitPrompt with integration)
- [x] P1 — `adapter.ts` no-integration quiet fallback let the next proposal be typed into a still-running program — **mitigated b45db33**: an unmeasured completion marks the line unknown until the human clears/submits it (SECURITY §1 already scopes the guard to zsh integration)
- [x] P1 — `forge.ts` unforge after Enter aborted the wait; running step never recorded — **fixed b45db33** (stopAfterCurrent)
- [x] P2 — `client.ts` half-open socket never detected — **fixed b45db33** (3 unanswered pings → close → reconnect)
- [x] (evidence, not a finding) MCP parity executed with a real Codex session (`mcp_servers.rokan` → `rokan-terminal mcp`): 7 tools listed (six fixed + `forged_count_to` born in the page), `forged_count_to {n:"3"}` → ghost `seq 1 3` → human Enter → `terminal_wait` `executed exit 0 · 3 ms`, `forge_list runs:1`; bridge killed + restarted with the same token → page re-paired in 5 ms, Codex lists 7 tools and `terminal_status` answers ≈16 s after the kill — Fable (`docs/evidence/verify-fable/C-codex-mcp-forged-count_to-ghost.jpg`)
