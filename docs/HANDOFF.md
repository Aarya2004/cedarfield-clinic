# HANDOFF — Rokan Terminal (rewritten 2026-08-29 by Fable 5, "Engineer #3")

**This supersedes the prior runway.** Read this first, then `docs/PROGRESS.md`, then
`docs/SELF-EVAL-2026-08-29.md` (the strategy call). Everything below was verified by the session that
wrote it. The mission: **submit by Mon 09-01 EOD; freeze Sun 08-31 evening; Devpost hard close Wed
09-03 13:00 PT — do not use it as the plan.** Quality bar: production-usable, measured, honest.

---

## 0. 60-second brief

**Product (the locked pitch, PLAN §0.9 + confirmed against the theme this session):**
> **Do it once. Now it's a tool.** A terminal in a browser tab that a human and an agent share. Anything
> you approve becomes a live **WebMCP tool** born at runtime (`forged_<name>`, content-hashed), that your
> agent (ChatGPT / Codex / Claude Code) can call — run only by **your Enter**. The same tools are served
> over MCP stdio too (one registry, two protocols).

**The official theme (got the exact words this session):** *"Build a WebMCP-powered web app that imagines
and explores the future of the open web — where humans and agents can interact, collaborate, and **create
together**."* The **forge is co-creation** — it maps almost word-for-word. This is why forge leads.

**No tool ever executes.** `terminal_propose` and every `forged_*` tool only ghost-type at the prompt;
the human's Enter runs the command. That is the trust boundary — the *second* sentence, never the headline.

---

## 1. THE STRATEGY DECISION (this session's main output — read before touching the pitch)

We spent this session pressure-testing the whole idea against the rubric and the field. Conclusions,
all defended in `docs/SELF-EVAL-2026-08-29.md` and the PROGRESS `## Objections` block:

1. **Ship rokan-terminal + forge. Do NOT pivot, do NOT build a "synthetic-WebMCP-for-any-site" generator.**
   Reasons (grounded, not vibes):
   - **Theme:** forge = "create together" (on-theme). "Give agents tools for sites lacking WebMCP" = an
     agent capability that *argues against the hackathon's premise* (off-theme) and one judge (Sean
     Roberts, Netlify) publicly calls browser-driving "the wrong way"; OpenAI's own framing is anti-DOM.
   - **Field:** the ONLY two repos in the field with real stars — `alpic-ai/webmcp` (15★, site-owner SDK)
     and `pauloportella/auto-webmcp-chrome` (12★, scrapes current-page forms) — are BOTH in that
     "turn-a-site-into-tools" lane. Both do **static form→tool**; **neither records+replays an operation,
     neither does runtime tool-birth from your actions.** So our forge is genuinely different, but leading
     with "any-site tools" files us #3 in a contested, off-thesis lane. (Details: `docs/WEBMCP-RESEARCH.md`
     §6b — we verified these against the GitHub API on 08-28.)
   - **The forge is the empty lane:** ~48% of entries gate a *fixed* tool list; almost none do runtime
     `registerTool` of a *user-made* tool. That is the strongest reading of **WebMCP Leverage** (tiebreak #1).

2. **rokan-do is ONE demo beat, never the thesis.** "You ran a web op once → forged it into a tool → the
   agent calls it → it replays at `calls:0`" is on-theme ("look what we made together"), and it's now
   demoable **hands-on** in the judge sandbox (the 54 seeds replay with no key — I fixed the container this
   session). Never pitch it as "a better browser."

3. **Lead with the HUMAN-INITIATED forge** ("Forge this" from your own history), not the agent-initiated
   one. Agent-proposes-you-approve reads as *supervision*; you-did-it-and-shaped-it-into-a-tool reads as
   *co-creation*. This is the sharpest on-theme framing and it also answers "why not just my terminal?":
   **you don't replace your terminal — rokan-terminal is where you and your agent build your shared toolkit.**

4. **Honest score (pessimistic, hostile judge):** Leverage 7→8, Execution 6→7.5, **Impact 5→~7** (the
   ceiling: our artifact is a *tool*/dev-flavored vs OpenAI's *content* demos; the judge's hands-on is
   seed-only), Creativity 7→8. Mean ≈ **7.5–7.75. Real #1 contention, not a lock.** The two biggest levers
   are NOT code: the **video** (missing → Stage-1 pass/fail) and the **ChatGPT-desktop measurement**
   (Arav-gated). **The Devpost gallery is sealed (3,577 participants) — every "we beat the field" number,
   ours included, is an estimate.**

**Saturday plan (agreed): framing + persistence + seeded ops. NOT a new engine.**
- (1) Headline + first-20-seconds script leading with human-initiated forge.
- (2) **Persist forged tools** to localStorage, restore-on-load **with human re-approval (no auto-register**,
  so the session-TTL trust story survives) — kills the "PoC not product" objection.
- (3) **Seed 3–4 recognizable operations** into the judge image so a judge hits `calls:0` themselves.
- Then: the "any-machine" beat (b) is optional upside for Impact; export/import (c) is dropped.

---

## 2. LIVE right now (verified 2026-08-29)

| thing | state |
| --- | --- |
| Web | **200** `https://rokan-terminal.vercel.app` (nonce CSP, HSTS, X-Frame-Options DENY). Deploy: `cd apps/web && vercel --prod --yes`. |
| Judge sandbox | **200** `https://rokan-sandbox.rokan-sandbox.workers.dev/api/health`. Worker version `9fba0038`+; image = `Dockerfile.rokan` (multi-stage, 1 532 MB, **no browser**). |
| **`rokan do` LIVE** | **Fixed this session.** Judge suite **11/11** incl. `terminal-rokan-real` (⚡ replay) + `terminal-judge-isolation` (no key/no vault). |
| Caps | `SESSIONS_PER_IP_PER_10MIN=50`, `MAX_CONCURRENT_PER_IP=20` — **kept high for testing on Arav's explicit instruction (do NOT revert now)**. The 3/3 stranger-abuse story is the pre-freeze value; decision to lower is Arav's, later. TTL unchanged (30 min). |
| Green gate (this session) | web **133** · bridge **8 units + smoke 38/38** · sandbox **15** · evals runner 2 + prompt-line 7 + **real-PTY 12** · **live judge 11/11**. |
| Git | HEAD `c6a5b0a`, `main`, clean (except demo-evidence PNGs). Aarya pushes demo docs; **you share this checkout — never `git add -A`, add only your files.** |

---

## 3. What was BUILT this session (all pushed to `main`)

1. **`rokan do` 127 → root-caused & fixed (3-layer bug):**
   - Oversized image (2 221 MB) → **stuck Cloudflare rollout** → fleet served a stale image → no
     `/usr/local/python/bin` → exit 127. Fixed: **multi-stage `Dockerfile.rokan`** (node-pty compiled in a
     throwaway stage, no browser, caches purged) → 1 532 MB. FIELD-NOTES J13.
   - Eval-runner bug: local `--judge` build lacked `NEXT_PUBLIC_BRIDGE_HOSTS` → page refused the ws host →
     0/10 pairing. Fixed: runner always rebuilds with the allowlist from `--judge`.
   - **The real one — egress:** rokan-do's seeded replay does a stdlib-`urllib` HTTPS fetch; the SDK's
     HTTPS interception never activates here (no CA), so `allowedHosts` gated nothing and `enableInternet=false`
     timed out even allowlisted hosts (measured, curl 28). Fix: **`enableInternet=true`**. FIELD-NOTES J14.
     Egress is now **open** (measured: allowed 301, non-allowed 200) — documented **honestly** in
     `docs/SECURITY.md`/`SUBMISSION.md` (isolation = no key + no vault + ephemeral disk + no agent→PTY +
     rate-limit/TTL, NOT an egress allowlist). This was Opus's P0; addressed by making egress work + honest docs.

2. **Every Opus + Fable reviewer finding closed here (none routed to Aarya, per Arav):**
   - redact.ts single-line PEM key leak → redact body only (+2 tests).
   - pairing bearer-link (any `*.trycloudflare.com`) → can't be fixed in-band (everything's in the link);
     `docs/SECURITY.md §4/§7` corrected honestly (judge mode unaffected).
   - rokan ⚡ spoof via `; echo` → `isRokanCommand` chain guard (+5 cases).
   - bridge respawn loop → rapid-exit backoff.
   - forge: `runs` counted before Enter → now counts a real run; re-forge stats reset on hash change;
     `cancelActive` double dismissed-row → single; `restore()` rollback + typed error (no phantom tool).
   - `insertedId` mis-attribution (Tab-insert → Ctrl-C → different Enter) → cleared on empty line; E2E
     `terminal-insert-cancel.json` on a real shell; harness gained ctrl-modifier keys.

3. **Forge breadth test:** 100 diverse commands each forge→invoke (unique hash, params substituted,
   Enter-gated, write-classified). Proves the forge is command-agnostic. (Answered Arav's "have you tested
   the forge broadly" — yes, 100 commands; the "website" breadth is rokan-do's 54 seeds, R6, not 100.)

4. **`docs/SELF-EVAL-2026-08-29.md`** — the adversarial scoring + the strategy call above.

Commits since the prior handoff: `7bef1d3` (slim image), `699b47e`/`852fa76` (rokan-do fix + honest docs),
`b3a087f`/`3178a34` (eval allowlist + enableInternet), `2c35b33` (rokan spoof), redact/respawn/forge-P2/
insertedId commits, `2b22ffa` (self-eval).

---

## 4. HARD RULES (violating these has cost this project real time)

1. **Resource discipline (non-negotiable — Arav's laptop crashed from this once).** ONE process/tab/
   container at a time, killed in the SAME command. No persistent monitors/poll loops. **3-strike stop.**
   Kill only by PID / your own children — never `pkill -f rokan-terminal.js`/`next` (reviewers share this
   checkout). No `docker build` / `graphify update` / full sweeps unless asked.
2. **Deploys are Arav-gated in TWO ways:** (a) the **auto-mode classifier blocks `wrangler deploy`** (even
   `--dry-run`) intermittently — when it does, ask Arav to run it. (b) **Arav must run deploys WITHOUT the
   `!` prefix** — `!` is the Claude-prompt convention but in his raw zsh it mangles the command (silent
   fails). Give him plain `cd ~/dev/webmcp-private/infra/sandbox && npx wrangler deploy`.
3. **Sandbox deploy = a container rollout that drops every live judge session** IF the image digest
   changes. Worker-code-only changes (vars, worker.ts) do NOT roll containers. Never deploy sandbox during
   the freeze or a rehearsal. Confirm a rollout *applied* with `npx wrangler containers info <app-id>`
   (`configuration.image` = new digest, `health.instances.failed` 0) — a green `wrangler deploy` only means
   it *started*.
4. **NEVER write ad-hoc WebSocket probe scripts against containers** — it trips a `[cyber]` safeguard and
   force-switches the model. Use `pnpm smoke:image:rokan`, plain `docker exec`, and the eval harness.
5. **Verify before "done":** always run **`pnpm typecheck`** after TS changes (this session, `pnpm test`
   passed but a type error broke CI — local `node --test` strips types). One batched gate per change.
6. **Honest numbers only** — every ms/count on screen is produced by the code that shows it.

---

## 5. ENVIRONMENT (verified this session)

- Node 25.9, pnpm 11.1.2, macOS. Vercel logged in (`medportgeneral-7293`, project `rokan-terminal`,
  cwd-deploy from `apps/web`). wrangler logged in (Workers Paid).
- **Anthropic key** = macOS Keychain: `security find-generic-password -s rokan-anthropic-key -a rokan -w`
  (the `ANTHROPIC_API_KEY` Keychain entry is DEAD/401). Never print it; never inject into the container.
- **Codex** wired as MCP (`mcp__codex__codex` / `codex-reply`) — ChatGPT-plan account, no `gpt-5.3-codex`;
  use for adversarial review. It found 4 real verification-layer holes this session (all fixed).
- Gate cheat-sheet:
  ```
  cd apps/web && pnpm typecheck && pnpm lint && pnpm build && pnpm test     # 133
  cd ../../packages/bridge && pnpm check && node --test 'test/*.test.mjs' && pnpm smoke   # 8 + 38/38
  cd ../../infra/sandbox && pnpm check                                      # 15
  cd ../.. && node --test 'evals/test/*.test.mjs'; node evals/run-all.mjs; node evals/run-all.mjs --bridge
  node evals/run-all.mjs --judge=https://rokan-sandbox.rokan-sandbox.workers.dev   # 11/11 (needs a slot)
  ```
- Eval gotchas: `--judge` rebuilds web with the allowlist automatically; `judgeOnly` cases skip `--bridge`;
  each `--judge` run costs a per-IP session slot (caps now 50/20). `--only=<substr>` filters by filename.

---

## 6. ONLY ARAV can do (ask once, don't block)
1. **ChatGPT desktop measurement** (GPT-5.6 Sol/Terra): open the live URL, count Site tools, `propose ls`,
   forge a tool, record whether the Site-tools list refreshes on `toolchange` without reload. Screens →
   `docs/evidence/gate-a|b/`. **Single highest-leverage hour left** (moves the OpenAI judge + every
   criterion's "works in the named consumer" clause). Chrome 152 refreshes live (measured).
2. **Video < 3:00** + 5 logged rehearsals + a camera backup. Stage-1 pass/fail. Lead with human-initiated forge.
3. Repo **public** + OSS license in the About section + Devpost + YouTube public.
4. `npm publish rokan-terminal` if `npx rokan-terminal` should be true (README currently says clone + node — honest).
5. History-purge decision (commit `0bb4cba` has a home-dir listing screenshot; folder names only).

---

## 7. Map of the repo (read what you need)
- `CLAUDE.md` — constitution, lanes (Arav's lane = `packages/bridge`, `infra/sandbox`, `evals`,
  `apps/web/src/lib/webmcp/{redact,ledger}.ts`, `terminal_*` wiring, `docs/SECURITY.md`; Aarya = `apps/web/**`
  UI/forge — but **Arav said do everything here, don't route to Aarya this sprint**).
- `docs/PROGRESS.md` — standup + `## Objections` (the strategy verdict) + all reviewer findings ticked.
- `docs/SELF-EVAL-2026-08-29.md` — the adversarial scoring + strategy call.
- `docs/PLAN.md` §0 (locked decisions, §0.9 "forge leads"), §8 (video shot list), §10 (kill rules).
- `docs/FORGE-PLAN.md` §2 (forge spec), §13 (judge personas — incl. Roberts anti-DOM, Nahas taxonomy).
- `docs/WEBMCP-RESEARCH.md` §5 (criteria verbatim), §6b (competitor GitHub research — the starred repos).
- `docs/FIELD-NOTES.md` (measurements; J13/J14 = the rokan-do fix; R6/R8 = 54-seed sweep).
- Code: `apps/web/src/lib/webmcp/*` (forge, redact, ledger, register), `apps/web/src/components/Terminal.tsx`,
  `packages/bridge/src/*`, `infra/sandbox/src/worker.ts`.

---

## 8. NEXT ACTIONS (in order, for the incoming session)
1. **Confirm the strategy with Arav** (§1) — he had converged; don't reopen it, execute it.
2. **Write the headline + first-20-seconds script** (no code) leading with human-initiated forge; Arav vetoes words.
3. **Persist forged tools** (localStorage, restore-on-load with human re-approval, NO auto-register) — the
   "PoC→product" fix. `apps/web/src/lib/webmcp/forge.ts` + a load-time restore card + tests. Keep the 133 green.
4. **Seed 3–4 recognizable ops** into `Dockerfile.rokan` seed dir so a judge hits `calls:0` hands-on.
5. Keep `docs/PROGRESS.md` + `docs/FIELD-NOTES.md` current before you stop.
