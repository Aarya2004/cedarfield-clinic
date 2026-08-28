# HANDOFF — everything the building session needs to continue alone

Written 2026-08-28 18:45 PT by C (the session that built forge + terminal + sandbox + MCP parity).
**C is standing down.** The session doing the review fixes owns the whole tree from here. Nothing in
this file needs a human unless it says so explicitly.

## 1. Infrastructure is READY — nothing is blocked on a login

| thing | state (verified 18:40 PT) | how to use it |
| --- | --- | --- |
| **Live URL** | **UP**: `https://rokan-terminal.vercel.app` → 200, serves the app, nonce CSP + `x-frame-options: DENY` present | already public; redeploy after your fixes |
| Vercel auth | token present, **expires 2026-08-28 22:23 PT** — an OAuth `refreshToken` is stored, so the CLI should renew silently. **If it ever prints a device-code URL, that is the one moment a human is needed** (`vercel login`). | `cd apps/web && vercel --prod` |
| Vercel project | linked: `rokan-terminal` (`prj_t1EeVQv2omNViz2RRtDGN1SAtRzJ`, team `team_zFUXxKJdD4R9mCPNEYCKVZhj`), framework nextjs, node 24.x, last production deploy READY | `apps/web/.vercel/project.json` |
| Wrangler auth | logged in (OAuth, medportgeneral@gmail.com) | `cd infra/sandbox && pnpm deploy` |
| Docker | **running** (v29.3.1, started 18:47 PT) and **all images cached** — `cloudflare/sandbox:0.12.9-python` (1.48 GB base, no pull needed), `rokan-sandbox-rokansandbox:worker`, `rokan-sandbox:local` | nothing to do; the sandbox build is warm. If the daemon is ever down: `open -a Docker`, wait for `docker info` to succeed (~3–30 s). |
| GitHub / CI | push works; CI green on `main` (typecheck, lint, web tests, real-PTY smoke, MCP relay, sandbox check) | `.github/workflows/ci.yml` |

## 2. Deploying (exact commands)

**Web (works today):**
```
cd apps/web && vercel --prod
```

**Judge sandbox (Docker is already running and warm):**
```
cd infra/sandbox && pnpm deploy      # syncs packages/bridge into the image, builds, deploys
```
C deliberately did **not** deploy this yet: the Worker still has open P1s (a cross-origin POST burns
a visitor's Gate quota; `/ws/:sid` and `DELETE` spin up a container for any well-formed sid). Land
your `origin.ts` / sid-guard fixes first — deploying before that puts a real abuse surface on Arav's
Cloudflare account.
Then wire the two together (both are read at build time, so redeploy the web app after setting them):
```
cd apps/web
vercel env add NEXT_PUBLIC_SANDBOX_URL production      # https://<worker>.workers.dev
vercel env add NEXT_PUBLIC_BRIDGE_HOSTS production     # <worker>.workers.dev   (host only, comma-separated)
vercel --prod
```
`NEXT_PUBLIC_BRIDGE_HOSTS` feeds both the pairing-URL allowlist (`isAllowedBridgeUrl`) and the CSP
`connect-src` in `src/middleware.ts` — without it the page will refuse to open the judge WebSocket.
Verify end to end: `node evals/run-all.mjs --judge=<worker-url>` (runs the real terminal cases
against the deployed sandbox). Record `cold_ms` in `docs/FIELD-NOTES.md`.

**If a deploy fails 3 times, stop and write the error into PROGRESS instead of retrying** (see §5).

**A Worker deploy modifies the container fleet and drops every live judge session** (measured by Fable's VERIFY pass: session dropped at 22:43:24, fleet modified 22:43:28). Never `pnpm deploy` in `infra/sandbox` during a rehearsal, the demo, or the judging window (Sep 2 18:00 PT → results). Freeze the Worker at Tue 09-01 12:00 PT with the rest.

## 3. Where the work stands

- `docs/PROGRESS.md` is the standup: what is green, gates, and `## Review findings (open)` —
  **32 open findings from the two reviewers' pass #2**, ~8 of them P1 and judge-visible. The
  biggest: the terminal only completes commands under **zsh** (bash/sh/fish hang `terminal_wait`),
  Enter ignores `running:true`, end-`status` beats the final data chunk (truncated `tail`), the
  line-gate is blind to paste and ↑ history, and the Worker burns a visitor's Gate quota on a
  cross-origin POST / spins containers for any well-formed sid.
- Reviewer reports: `docs/reviews/2026-08-28-{opus,fable}-{1,2}.md`. Pass #1 is fully fixed; pass #2 is not.
- Uncommitted in this tree when C stood down: your own in-flight fixes (11 files + new
  `infra/sandbox/src/origin.ts` and its test). C did **not** touch them; they typecheck clean.
- Plans, all still accurate: `docs/FORGE-PLAN.md` (incl. §13 judge psychology, §16 test discipline,
  §17 criterion-by-criterion), `docs/TERMINAL-PLAN.md`, `docs/SANDBOX-PLAN.md`, `docs/PLAN.md` §0
  (locked decisions; §0.9 = forge leads), `docs/SECURITY.md`, `docs/SUBMISSION.md`, `docs/DEMO.md`.

## 4. Verify before "done" (one gate, don't loop)

```
pnpm install
cd apps/web && pnpm typecheck && pnpm lint && pnpm build && pnpm test
cd ../../packages/bridge && pnpm check && pnpm smoke
cd ../.. && node evals/run-all.mjs                 # prompt-line WebMCP cases
node evals/run-all.mjs --bridge                    # real-PTY terminal cases (run once)
```
Every finding you fix gets a regression test in the same commit. Honest numbers only: every ms and
call count on screen must be produced by the code that shows it.

## 5. HARD resource rules (C crashed Arav's laptop on 2026-08-28 — do not repeat)

1. **3-strike stop.** If a tab, spawn, deploy or command fails 3× and is not working, STOP and write
   the state into PROGRESS. No 4th attempt, no rabbit hole.
2. **One process at a time, killed in the same step** — never leave a `next start`, bridge, headless
   Chrome, tunnel or Docker build alive "for later".
3. **Close every browser tab you open.** Automation tabs left open (1 s timers + WebSocket retries)
   are what pinned the CPU.
4. **No persistent monitors / poll loops.**
5. `graphify update .`, Docker builds and full eval sweeps are minutes of pinned CPU — run them
   deliberately, once, not on a loop.
6. **Kill only by PID** (`process.kill(pid)` / the runner's own children) — never `pkill -f rokan-terminal.js`
   or `pkill -f next`: reviewers run the same suites in this checkout and a global pkill kills their
   bridge mid-case (measured). Reviewers get their own `git worktree`; the freeze verification is run
   by one agent on a quiet machine.

## 6. What is still genuinely blocked on a human (only one thing)

**ChatGPT desktop must be on GPT-5.6 Sol or Terra** (Luna has site tools disabled) to measure the
ChatGPT half of Gates A/B — specifically whether the Site-tools list picks up a runtime
`registerTool` without a page reload. Everything else can be done autonomously. If that stays
unmeasured, PLAN §10 kill rule #1 applies: Chrome 149+ becomes the primary demo browser and the
README says so (Chrome 152 is already measured and green).

## 7. Next, in order (from FORGE-PLAN §15)

Fix the pass-#2 P1s (with tests) → redeploy web → Docker + deploy sandbox → wire env vars → judge
evals + cold-start numbers → `rokan do` seeding and `--json` (`calls` column) → rehearsals +
`demo-backup.mp4` → README GIF, LICENSE in GitHub About, repo public → Devpost by Sep 2 18:00 PT.
