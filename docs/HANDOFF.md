# HANDOFF — Rokan Terminal, engineering sprint (rewritten 2026-08-29 ~04:00 PT)

**Read this first, then `docs/PROGRESS.md`, then `docs/SELF-REVIEW.md`.** This file is the current
runway: what is true, what is measured, what is broken, and what to do next, in order. Everything
below was verified by the session that wrote it; every number is measured by the code or command
named beside it.

---

## 0. The 60-second brief

**Product.** *Do it once. Now it's a tool.* A terminal in a browser tab that a human and an agent
share. The agent gets WebMCP tools; **no tool ever executes** — they ghost-type at the prompt and
the **human's Enter** runs the command. Anything the human approved can be **forged** into a live
WebMCP tool (`forged_<name>`, registered at runtime, content-hashed) that the agent can then call,
still gated by Enter. Same tools are served over MCP stdio (Codex CLI / Claude Code). `rokan do`
(Rokan's browsing engine, in the shell) is the star command: seeded operations replay with **0
model calls**.

**Deadlines (PT).** Arav's target: **submit Mon 09-01 end of day**. Freeze Sun **08-31 evening**.
Devpost hard deadline Sep 3 13:00; do not use it.

**Three plans** (`docs/FORGE-PLAN.md`, `docs/TERMINAL-PLAN.md`, then UI/UX): forge ✅, terminal ✅,
UI/UX pass 1 ✅ (`3907895`). Each plan's §16-style discipline: test every baby step, one batched
gate per change, honest numbers.

---

## 1. Live right now

| thing | state | how |
| --- | --- | --- |
| Web app | **LIVE** `https://rokan-terminal.vercel.app` — 200, nonce CSP, HSTS, `X-Frame-Options: DENY`; first screen shows the birth hero | `cd apps/web && vercel --prod --yes` |
| Judge sandbox | **LIVE** `https://rokan-sandbox.rokan-sandbox.workers.dev` — `/api/health` 200; image = `Dockerfile.rokan` (rokan-do + Chromium + 54 seeds + pytest demo project, 1.31 GB) | `cd infra/sandbox && pnpm deploy` |
| Env wiring | `NEXT_PUBLIC_SANDBOX_URL` + `NEXT_PUBLIC_BRIDGE_HOSTS` set in Vercel production (build-time; redeploy web after changing) | `vercel env ls production` |
| Vercel | logged in `medportgeneral-7293`, project `rokan-terminal` linked from `apps/web` | — |
| Cloudflare | Workers **Paid** (upgraded 2026-08-28), wrangler logged in, `SID_SECRET` secret set | — |
| Codex | registered as an MCP server for Claude Code (`claude mcp add --scope user codex -- codex mcp-server`) → tools `mcp__codex__codex` / `codex-reply` | ChatGPT-plan account: `gpt-5.3-codex` is refused; use the default model |
| Anthropic key | **live key = Keychain service `rokan-anthropic-key`, account `rokan`** (`security find-generic-password -s rokan-anthropic-key -a rokan -w`). The `ANTHROPIC_API_KEY` Keychain entry is **dead (401)** | never print it; never inject it into the container |
| GitHub | `Aarya2004/webmcp-private`, **private**, Apache-2.0; CI green on `main` | — |

---

## 2. The gate (all green at `b10edfd` unless noted)

```
pnpm install
cd apps/web && pnpm typecheck && pnpm lint && pnpm build && pnpm test     # 126/126
cd ../../packages/bridge && pnpm check && node --test test/*.test.mjs && pnpm smoke   # units 8, smoke 38/38
cd ../../infra/sandbox && pnpm check                                     # 12/12
cd ../.. && node --test evals/test/*.test.mjs                            # runner-cleanup 2/2
node evals/run-all.mjs                                                   # prompt-line 7/7
node evals/run-all.mjs --bridge                                          # real PTY 10/10
node evals/run-all.mjs --judge=https://rokan-sandbox.rokan-sandbox.workers.dev   # live 9/10 (see §3)
```

Extras: `node evals/run-all.mjs --bridge --mode=judge` (local bridge in judge mode),
`--only=<substr>`, `ROKAN_EVAL_WEB_PORT` / `ROKAN_EVAL_BRIDGE_PORT` to pin ports.
`cd infra/sandbox && pnpm smoke:image:rokan` smokes the judge image locally (`LIMITS="--cpus 0.25
--memory 1g"` reproduces the judge instance but starves node-pty under amd64 emulation — leave it
unset locally).

---

## 3. THE ONE OPEN BUG — `rokan do` exits 127 inside the deployed judge container

**Symptom (measured twice, after the fix + redeploy):** `evals/cases/terminal-rokan-real.json`
against the live sandbox returns `["executed", 127, "no-rokan", null]` — the proposal runs, the
shell answers **exit 127** (command not found), so there is no `⚡` trailer and no `rokan` field.
Everything else in that suite passes (9/10).

**What is already proven true:**
- The image contains it: local `pnpm smoke:image:rokan` → `/usr/local/python/bin/rokan-do`,
  `54 learned`, seeded replay **`All Systems Operational   454ms ⚡`** (wall 975 ms, emulated amd64),
  `/opt/bridge/shims/rokan` exists, no `ANTHROPIC_API_KEY` in the container (FIELD-NOTES J12).
- With an explicit `PATH=/opt/bridge/shims:$PATH`, `rokan` resolves and prints usage.
- Fix already committed (`fbb824a`): the shim resolves `rokan-do` from `/usr/local/python/bin`,
  `$HOME/.local/bin`, `/usr/local/bin`; `prepareShellEnv` prepends the shims dir **and** those
  install dirs when they exist. Image rebuilt and Worker redeployed **after** that commit — the
  live case still 127s.

**Untested hypotheses, in the order to test them:**
1. **The PTY's PATH inside the deployed container genuinely lacks both dirs.** The Worker starts the
   bridge via `startProcess`, whose env may be minimal; `baseEnv.PATH` may be undefined so the
   fallback string is used, and `existsSync('/usr/local/python/bin')` should then add it — verify
   that code actually shipped in the image.
2. **The built image did not include the new `shell-integration.js`.** `pnpm deploy` runs
   `scripts/sync-bridge.sh` first; confirm `infra/sandbox/container/bridge/src/shell-integration.js`
   contains the `existsSync` extras block **before** the build, and that the build did not reuse a
   cached layer.
3. **A warm container from the previous image served the session** (cold_ms 6817 suggests a fresh
   one, so this is least likely).

**How to test safely (this matters — see §7):** use the existing smoke script and plain
`docker exec`. Do **not** write ad-hoc WebSocket probe scripts that drive a container; that phrasing
tripped a `[cyber]` safeguard and force-switched the model mid-sprint.

```
cd infra/sandbox && sh scripts/sync-bridge.sh
grep -n existsSync container/bridge/src/shell-integration.js        # hypothesis 2
docker build --platform linux/amd64 -f Dockerfile.rokan -t rokan-sandbox:rokan .
docker run -d --name rk --platform linux/amd64 rokan-sandbox:rokan node /opt/bridge/bin/rokan-terminal.js --no-tunnel --mode judge --host 0.0.0.0 --port 7331 --token deadbeef --ttl-ms 60000 --app http://localhost:3311
docker exec rk sh -lc 'cat /proc/1/environ | tr "\0" "\n" | grep ^PATH'   # what the bridge process has
docker exec -u judge rk zsh -lc 'echo $PATH; command -v rokan; command -v rokan-do'
docker rm -f rk
```
A ready-made **safe** PTY probe for exactly this lives at `evals/diagnostics/judge-path.json` (it
asks the shell itself for `$PATH`, `command -v rokan`, `command -v rokan-do`, the shim dir and the
exit code). It is kept out of `evals/cases/` so it never changes sweep counts — run it with:

```
cp evals/diagnostics/judge-path.json evals/cases/terminal-judge-path.json
node evals/run-all.mjs --judge=https://rokan-sandbox.rokan-sandbox.workers.dev --only=judge-path
rm evals/cases/terminal-judge-path.json
```

Then the honest end-to-end check is `pnpm smoke:image:rokan` (extend it with a `rokan do` case run
**through the PTY**, not through `docker exec`), rebuild, `pnpm deploy`, and
`node evals/run-all.mjs --judge=<worker> --only=terminal-rokan-real`.

**If it cannot be fixed by the freeze:** the judge sandbox is still fully green without it (9/10);
delete `terminal-rokan-real.json` from the judge run, say plainly in the seed README and the
submission that `rokan do` runs in **builder mode** (measured: V5 347 ms ⚡, V7 HN 2186 ms), and keep
the container's `rokan-do` install as a bonus. **Never** claim the container replays if it does not.

---

## 4. What is measured (FIELD-NOTES index — read `docs/FIELD-NOTES.md` for the rows)

- **R1–R8** `rokan do` on the Mac: install/seeds; **54-site sweep 53/54 replayed at 0 calls, mean
  1 232 ms** (R6); HN is a model path, not seedable (R7); **A/B replay vs forced planning: 4.8×
  wall / ~17× on the operation, 0 vs 1 model call, 53 vs 46 answered** (R8); result-line grammar (R5).
- **J1–J12** judge sandbox: `ContainerProxy` re-export was the root cause of every failed start
  (J1); cold start 4.0–6.8 s (J2/J11); provisional Gate rows (J3); shared-IP lockout (J4); `/ws`
  path allowlist (J5); tab takeover 662 ms (J6); fatal-resize root cause (J7); wrapped-line
  redaction leak (J8); **live suite 8/8 then 9/10** (J9/J11); real-Chrome stranger run (J10);
  image with rokan-do smoked (J12).
- **V1–V8** builder-mode rehearsal on the real video path (live page + quick tunnel + Arav's shell,
  driven from a real Chrome tab): tunnel 19 s, pair 855 ms, ghost→Enter `exit 0 · 3 ms`, redaction
  1/1, seeded replay 347 ms ⚡, forge→invoke→Enter 212 ms ⚡, HN 2186 ms.
- **C1–C6** Codex CLI as the consumer: proposes → Enter → `executed`; forges → human approves →
  **a new Codex session** calls the forged tool → Enter → recorded. **Codex reads MCP tool lists
  once per session** and ignores `listChanged` (C3); identical spec ⇒ identical hash across sessions
  (C4); agent-slot takeover (C5).
- Evidence: `docs/evidence/gate-a|b|c|d/`, `docs/evidence/demo/`, `docs/evidence/verify-{opus,fable}/`.

---

## 5. Reviews — all closed

Four reviewer passes (Opus 5 ×3 + VERIFY, Fable 5 ×3 + VERIFY) and two Codex passes. **Every
finding is fixed with a regression test in the same commit** and ticked in `docs/PROGRESS.md`.
Highlights of what those passes caught (do not regress them): recursive ledger digest, pairing-host
allowlist, `$'…'` injection, redaction `\b` bug + wrapped lines + unknown key names, judge-mode
`sudo`, fatal resize frame, replaced-tab writes, trailer attribution (`isRokanCommand`), eval-runner
process leak (16 stale `next start`, 767 MB), stale `.next` builds, bare eval steps asserting
nothing, unquoted test glob silently running one file.

`docs/SELF-REVIEW.md` holds the spec-by-spec audit, judge-by-judge scores (mean ≈ 6.4 before the
last two nights of work), criterion-by-criterion gaps and the ranked gap list; gaps 4/5/6/12/14/15
are done, 1/2/3/7/9/10/11 are human- or money-gated.

---

## 6. What is left, in order

**C (Claude) can do now**
1. §3 bug: `rokan do` in the container → fix or honestly descope, then rerun the live suite (10/10).
2. Re-run the **full gate** cold and update `docs/PROGRESS.md` numbers.
3. Second UX pass items deliberately skipped: substituted-span colouring in the live ghost overlay;
   `?tour=1` copy re-read after the hero landed; Safari/no-WebMCP screenshot.
4. `docs/SUBMISSION.md` final pass once the ChatGPT measurement exists (or the kill rule fires).
5. Keep `docs/PROGRESS.md` + `docs/FIELD-NOTES.md` current before every stop.

**Only Arav**
1. **ChatGPT desktop on GPT-5.6 Sol/Terra** — open the live URL, count Site tools (expect 6), ask it
   to `propose ls`, forge a tool, and record **whether the Site-tools list refreshes on
   `toolchange` without a reload**. Screenshots → `docs/evidence/gate-a|b/`. This single fact
   decides the hero shot (PLAN §0.9 / §10 kill rule #1). Chrome 152 refreshes live (measured).
2. Video (< 3:00) + 5 logged rehearsals + a camera-recorded `demo-backup.mp4`
   (`docs/evidence/demo-backup.gif` is the current fallback).
3. Repo **public** + Devpost submission + YouTube public (Sep 1 EOD target).
4. `npm publish rokan-terminal` if `npx rokan-terminal` should be true (README currently says
   clone + `node packages/bridge/bin/rokan-terminal.js` — honest as-is).
5. **History-purge decision** — the only open checkbox in PROGRESS: commit `0bb4cba` contains a
   screenshot showing a listing of Arav's home directory (folder names only, no secrets). Removing
   it means rewriting `main` (force-push). Leave it, or purge before the repo goes public.
6. Optional beats needing accounts/money: Netlify/Render consequential write, a Linux VM for the
   "any machine" beat.

---

## 7. HARD rules (violating these has already cost this project time)

1. **Resource discipline.** One process/tab at a time, killed in the same step. Close every Chrome
   tab you open. No persistent monitors or poll loops. 3-strike stop: if something fails 3× and is
   not working, STOP and write the state into PROGRESS.
2. **Kill only by PID / your own children** — never `pkill -f rokan-terminal.js` or `pkill -f next`:
   reviewers run the same suites in this checkout.
3. **Reviewers get their own `git worktree`.** Three agents in one tree made a green run and a red
   run differ by who else was typing.
4. **Safeguard note (new).** Ad-hoc scripts that open WebSockets into running containers read as
   `[cyber]` to the model-level safeguards and can force a model switch mid-sprint. Use
   `pnpm smoke:image:rokan`, `docker exec` with plain commands, and the eval harness instead.
5. **Freeze rule.** A `wrangler deploy` of `infra/sandbox` **replaces the container fleet and drops
   every live judge session** (measured). No sandbox deploys from the Sun 08-31 evening freeze
   through judging, and never during a rehearsal or the demo. Vercel web redeploys are safe.
6. **Per-IP cap.** 3 sessions/IP/10 min, 3 concurrent, 30-min TTL. The builder's network and the
   judge share one IP: never burn slots before a rehearsal; a `--judge` run costs one slot.
7. **Honest numbers only.** Every ms / call count on screen is produced by the code that shows it.
   If something is unmeasured, the docs say unmeasured.
8. **Verify before "done":** one batched gate run per change, never a loop.

---

## 8. Map of the repo (what to read when)

- `CLAUDE.md` — constitution, lanes, non-negotiables.
- `docs/PROGRESS.md` — standup: gates, state, every reviewer finding with fix hashes.
- `docs/SELF-REVIEW.md` — spec-by-spec + judge-by-judge audit and the ranked gap list.
- `docs/PLAN.md` §0 (locked decisions, §0.9 "forge leads"), §3 (tool contracts), §4 (security),
  §8 (video shot list), §10 (kill rules), §13 (judges), §17 (criterion by criterion).
- `docs/FORGE-PLAN.md` §2 (product spec), §7 (verification), §13 (judge personas), §17.
- `docs/TERMINAL-PLAN.md`, `docs/SANDBOX-PLAN.md`, `docs/SECURITY.md`, `docs/FIELD-NOTES.md`,
  `docs/DEMO.md` (beats + backup trigger + the demo-shell key export line), `docs/SUBMISSION.md`,
  `docs/ENV-ARAV.md` (machine facts), `docs/WEBMCP-RESEARCH.md` (§6b competition analysis).
- Code: `apps/web/src/lib/webmcp/*` (tools, forge, redact, ledger, schemas),
  `apps/web/src/lib/terminal/*` (adapter, session, linebuffer, osc),
  `apps/web/src/lib/ws/*` (client, protocol), `apps/web/src/components/*` (UI),
  `packages/bridge/src/*` (PTY, WS, MCP relay, trailer), `infra/sandbox/src/*` (Worker, Gate, sid,
  origin), `evals/` (harness + 17 cases + runner tests).

---

## 9. Commands cheat-sheet

```
# demo shell (builder mode, with the live key so `rokan do` can plan)
export ANTHROPIC_API_KEY="$(security find-generic-password -s rokan-anthropic-key -a rokan -w)"
node packages/bridge/bin/rokan-terminal.js            # prints ONE pairing link; open it in Chrome

# deploys
cd apps/web && vercel --prod --yes
cd infra/sandbox && pnpm deploy                        # rebuilds the image; NOT during the freeze

# judge sandbox
curl -sS https://rokan-sandbox.rokan-sandbox.workers.dev/api/health
node evals/run-all.mjs --judge=https://rokan-sandbox.rokan-sandbox.workers.dev

# Codex as the consumer (MCP relay against a running bridge)
#   mcp_servers.rokan = node packages/bridge/bin/rokan-terminal.js mcp --ws ws://127.0.0.1:7331 --token <token>
#   forged tools need a NEW Codex session (C3)
```
