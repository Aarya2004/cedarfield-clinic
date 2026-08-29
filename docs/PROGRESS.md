# PROGRESS — verified state (update before you stop; Aarya's Claude reads this, not chat)

Last update: **2026-08-29 ~18:40 local (Engineer #4, Fable 5 — heads engineering; owns the whole tree)** Branch `main`, all pushed.

## Build log — Engineer #4 (2026-08-29 ~20:10 local, drift beat measured)
**Drift Rokan arm is LIVE and measured (N=2, `6c7f964`, raw `docs/evidence/ab/drift-run-{1,2}.txt`):** naive cached
script `$98 → $75` (true `$140`, `refused:false`); Rokan compiles v1 in 1 call (~2.4 s, verified `Wander Boot $98`) →
`recheck` after the redesign → **`DEAD · drift_detected`** (op retired) → re-ask **refuses**, no stale `$98`, no guess.
Honest scope in the docs: refusal, not recovery. Two harness bugs fixed (the arm had never run with a key):
`localhost` → `127.0.0.1` (`vault.normalize_host` rejects a dotless host → `INVALID_URL`, terminal in the cascade) and an
isolated `ROKAN_MCP_HOME`. Fixture v1 = product tile, v2 = redesign. SUBMISSION/README/measurements now state the
measured result. Key is read from `~/dev/Rokan/.env` by grepping the one variable (never `source` it — a malformed
line in that file executes).

## Build log — Engineer #4 (2026-08-29 ~19:50 local, judge image + hero)
- **Judge image rebuilt + rolled out** (manifest `sha256:808fe11…`, version `1aae9c30`, fleet `active`): the rokan-do
  first-run disclosure is pre-accepted for the judge user. Proven live with a NEW regression case
  `terminal-rokan-no-disclosure.json` (judge-only): fresh session (cold 6718 ms), first `rokan do` → `executed, exit 0,
  calls 0`, ⚡ on screen, no disclosure/API-key text. **Judge suite is now 13 cases.**
- **Hero example fixed** (`d3ad06a`, crossed into the web lane surgically, pinged in ALIGNMENT): `hn_top` → `status_of`
  (`rokan do "what is the current status at {{site}}"`). 202/202 · lint 0 errors · build clean. DEMO.md swapped too.
  **Needs `vercel --prod` (Arav) to reach judges.**
- Key for the cold/drift rows is in `~/dev/Rokan/.env` (sourced into the harness env at run time, never printed).

## Build log — Engineer #4 (2026-08-29 ~19:15 local, prod redeployed → regime re-run on the LIVE build)
Arav ran `vercel --prod` (deployment `EJcniHTebPRLmDXstNotBjVRJd7t`, 44 s, aliased to rokan-terminal.vercel.app).
Verified the alias serves HEAD by observable diff (Site tools · 7 with `terminal_history`, Runs panel, new hero).
**§16 manual regime, real Chrome, clean tab, on the deployed build — evidence `docs/evidence/stranger/`:**
1 web 200 / worker `{ok,mode:judge}` ✓ · 2 cold load, no console errors ✓ · 3 Try it now → **paired 239 ms** →
`ls` → `Runs · 1 · exit 0 · 8 ms` ✓ · 6 `rokan do "what is the current status at www.vercel-status.com"` →
`All Systems Operational 1184ms ⚡` → run row chip **`⚡ compiled · 1184 ms · 0 calls`** ✓ · 5 expand the run →
**Forge this** → card `forged_rokan_70` (hash `4bfdbeaff4d5`, from human) → **Approve** → **Site tools 7 → 8**, Ledger · 4
`forged … read ✓`, First-60 step 3 struck through ✓. Finding B from the previous run (no Runs row) is closed — it was
only the stale deploy. Not exercised here (needs a WebMCP consumer or Aarya's screens): 4 read_screen, 7 restore,
8 Codex relay, 9 failure states — the judge evals cover 4 (12/12 ×2 today).
**Rule that now binds (memory + PROGRESS):** after any `apps/web` merge, prod is stale until `cd apps/web && vercel --prod --yes`
runs — Vercel has no git auto-deploy here. Add it to the merge checklist; it's a one-line judge-visible failure otherwise.

## Build log — Engineer #4 (2026-08-29 ~19:00 local, manual regime after merge — live stranger run)
Ran the §16 regime on the LIVE URL in a real Chrome tab (clean, no flags). Green: web 200 (1.6 s) · worker `{ok,mode:judge}`
· cold load: hero, Site tools · 6, terminal, Ledger · 1, no console errors · Try it now → paired **824 ms** · `ls` → `exit 0 · 5 ms`
· seeded `rokan do "what is the current status at githubstatus.com"` → **All Systems Operational 799ms ⚡** (0 calls, live).
**Three findings, ranked:**
1. **PROD IS 22 h BEHIND HEAD.** `vercel ls`: last Production deploy 22 h ago; no git auto-deploy. The live bundle has no
   RunFeed (committed 12:07 today), no kept.ts hardening, no provenance chip — judges would use yesterday's build. The
   classifier blocks the deploy from my shell → **Arav: `cd apps/web && vercel --prod --yes`**, then I re-run the regime.
   (This is also why the human-typed `ls` shows no Runs row / ledger row on prod — RunFeed isn't deployed.)
2. **Hero example can't work in the judge sandbox**: `rokan do "top 5 HN titles"` → `abstained_planner_unavailable` (~15 s).
   HN is not seeded; sandbox has no key/browser. Recipe for Aarya in ALIGNMENT (swap to the seeded status-page phrasing —
   24 status pages incl. vercel/netlify/shopify/anthropic seeded, all 0-call). Evals can't catch it (they only ghost-type).
3. **First `rokan do` in the sandbox prints Rokan's 12-line first-run disclosure** before the ⚡ line (marker
   `~/.do-disclosed`, `rokan_do/cli.py:69`). In the judge image no key exists, so nothing can leave the machine — pre-touch
   the marker in `container/seed/` at the next image rebuild (mine; batch with other container changes, rebuild ≈ 10–20 min).

## Build log — Engineer #4 (2026-08-29, judge gate closed)
**Judge sandbox is GREEN: 12/12 twice, live, measured (`evals/run-all.mjs --judge`).** The open item from the
handoff — `terminal-insert-cancel` failing once on the live judge — is resolved with data, not a guess
(FIELD-NOTES J15): added `--trace=<dir>` (per-step `ms` for every case); 5 live sessions, 0 failures; every
wait finishes within **6 %** of its budget (worst 259 ms / 4000). So the one miss was a ~15× stall on the
`basic` ¼-vCPU container, not a timing assumption — budgets unchanged. Judge mode now retries a failed case
once, labelled (`RETRY` → `(attempt 2)`), and the final line counts retries (`0 failed of 12` = no retry
happened; `…, 1 retried` = a stall was seen). Retry path proven with a synthetic always-fail probe. Plan §10's
"`--judge` 11/11" predates the 12th case (`terminal-rokan-trailer`) — reconciled to **12/12**. The 9
`docs/evidence/demo/beat*.png` are regenerated by `terminal-demo-dryrun` on every full run (that's why they
were dirty) — committed fresh from this run (judge sandbox · zsh, dark theme). Evals unit tests 2/2.
**Still blocked (Arav):** ChatGPT Sol/Terra run · `npm publish` · `ANTHROPIC_API_KEY` for cold A/B + drift rows.

## Build log — Engineer #4 (2026-08-29, review round 4)
**P0.4c two adversarial reviews closed (entry `29119ca`+, Rokan `feat/tier0-native`).** I dispatched
two subagents on this session's work; both found real issues; all actioned:
- **kept.ts security review** — core property held (no auto-register, fail-closed verify). Fixed:
  MODERATE bounded-load (MAX_SCAN + early break vs whole-array validation DoS), LOW range-guard on
  keptFromTools (RangeError on out-of-range forgedAt), LOW parseEntry try/catch (no-throw no longer
  depends on validateForgeSpec being total), length bounds, and the over-claim comment (hash is a
  DRIFT SIGNAL not a tamper boundary — approval card is the guarantee). +4 regression tests; 18/18.
- **honesty audit** of every Impact/security claim vs code. Fixed: committed the raw harness output
  to `docs/evidence/ab/` (native row now backed in-repo — warm speeds==["native"], calls all 0,
  answers_ok); corrected eval counts to VERIFIED 21 (9 prompt + 12 PTY, re-ran 9/9 & 12/12);
  softened "Rokan refuses" to its recheck-with-key scoping; killed stale caps ("3/IP", "8/8",
  "120 tests") + orphan "312 ms"; SECURITY §8 +payment/consequential, §9 kept-store-landed;
  native.py docstring "NOT yet wired"→wired; wrangler caps comment aligned to §9 (judging=10/5).
  Non-issue: native.py's tier0 measurements ref DOES exist (in Rokan, auditor checked entry repo).
**Re-verified myself (subagent green ≠ verification):** web 202/202, typecheck clean; prompt-line
evals 9/9, real-PTY 12/12; Rokan native 37/37 + full pre-commit gate; sandbox check clean. All pushed.
**Every public number now traces to committed evidence or a re-run suite.**

## Build log — Engineer #4 (2026-08-29, cont.)
**P0.4b kept.ts + SECURITY §8/§9 + README/SUBMISSION Impact + npm-pack verified (entry `55b32c4`+, pushed).**
- **`kept.ts`** (deliverable 3, engine side — my lane per ALIGNMENT L136): pure per-viewer store
  (`rokan.kept.v1`), `loadKept`/`persistKept`/`verifyKeptHashes`/`keptFromTools`/`clearKept`; never
  auto-registers (restore re-opens the approval card), hash-mismatch → `changed`, throwing storage →
  nothing kept, cap 20. `kept.test.ts` 14/14; web suite **197/197**; typecheck clean. **Aarya's
  RestoreCard (her item 2) is unblocked** — wiring recipe in ALIGNMENT. (Write-path subscriber is in
  App.tsx = her lane; I left it to her to avoid a collision.)
- **SECURITY.md** §8 (Tier 0 read-only gate — grep-confirmed in `native.py`: `_is_write_name`,
  `_OUTPUT_BUDGET=1500`, separate `native_op` table) + §9 (caps table; deployed testing row 50/20/30min/10
  verified vs `wrangler.jsonc`); fixed §6's stale "3/10min, 3 concurrent"; kept tools marked PLANNED (no
  over-claim — `kept.ts` store shipped, the App wiring not yet).
- **SUBMISSION.md + README.md**: measured Impact section/callout (compiled replay 0 calls/79ms vs Codex
  ~23s / Claude ~16s; native ~1.45s builder-mode; drift refusal), sourced to the measurements file.
- **npm pack --dry-run**: clean 10-file tarball (bin/src/shims, no secrets), deps declared (node-pty/ws/
  MCP SDK/zod), engines ≥20 — `npx rokan-terminal` publish-ready; only `npm login && npm publish` (Arav) remains.
**Still blocked (Arav/key):** ChatGPT Sol/Terra run; npm publish; live cold-compile A/B & drift rows.
**Next (unblocked, mine):** README headline thesis reframe; DEMO v3 shot list with measured ms; Chrome
evals-cli format (§5, feeds Jude/Vercel). **Aarya:** RestoreCard + write-path wiring (recipe in ALIGNMENT).

## Build log — Engineer #4 (2026-08-29)
**P0.4 A/B Impact harness measured + drift test + SUBMISSION Impact + CI hardening (entry `a04ae96`, pushed).**
The Impact number is measured, live, three arms (`evals/ab/`, `docs/measurements/2026-08-30-ab.md`):
- **compiled** ("status.python.org operational?"): Rokan warm **0 calls / 79 ms** vs Codex ~23 s / Claude ~16 s → ~200–290× at 0 model calls, and the agents pay it *every* run.
- **native** ("wool runners price", builder mode): Rokan warm **0 calls / ~1.45 s** vs Codex ~10 s / Claude ~77 s.
- N=5 warm / N=3 agents; variance flagged; native-warm re-drives a live browser (honest, stated).
**Drift test** (`evals/ab/drift/`): a static page swaps v1→v2; a naive cached script returns **$75** (a shipping
line) when the true price is **$140** — reproduced live, silently wrong. Rokan arm rests on the built-in
`recheck` (planning forbidden → retire the op that no longer verifies); gated behind `ANTHROPIC_API_KEY` like
the agents arm, prints `{skip,reason}` without it — never a fabricated verdict.
**SUBMISSION.md** gains a measured Potential-impact section (the table above, honesty distinctions explicit).
**CI**: trailer parser (native ⚙ marker) + MCP relay + eval runner-cleanup now run on push (reviewer P2).
**Verification this session:** web typecheck clean + 184/184 tests; bridge check clean + 11/11; Tier 0 native
37/37 (via PYTHONPATH — the `.venv` doesn't editable-install rokan_do/rokan_agent, uv/UF_HIDDEN bug); live
health: web 200, worker `{ok:true,mode:judge}`. Graph nodes touched: `rokan-trailer.parseRokanTrailer`,
`recheck` (Rokan). **Blocked (need Arav/key):** ChatGPT Sol/Terra run (off screen-share + switch to Sol/Terra);
`npm login` to publish; live cold-compile Rokan drift/A/B rows (API key not in Bash env). **Next (unblocked):**
`npm pack` dry-run; README headline + DEMO v3 measured ms; SECURITY §9 (Tier 0 gate, kept-hash, caps rationale);
Chrome evals-cli format.

## Build log — Engineer #4 (2026-08-29)
**P0.7 Tier 0 LIVE end-to-end + entry bridge trailer + review round 3 closed (Rokan `feat/tier0-native`
`7e0a27d`; entry `be94d37`).** Review round 3 (Opus + Fable): Fable found a real P1 Opus missed — a
URL-path key collision (a question with a different URL path could replay another's answer at 0 calls);
root-caused (fold `_path` into the native key + keep URL paths) + regression-tested; phantom-call, forget_native,
isolation test also fixed. Both cleared it demo-safe, no P0. Gate 8/8. Then: render marks a 0-call native
replay with ⚡ (`⚙ native:site:tool` after the ms tail); **bridge trailer parses it** → `rokan_site`/`rokan_tool`
in the ledger (rsplit for host-ports, spoof-resistant, ANSI-stripped; smoke 40/40); Aarya pinged the chip
mapping. **Installed rokan-do reinstalled editable from the Tier 0 branch** — the LIVE tool now prints
`⚙ native:allbirds.com:search_catalog`, so terminal → rokan do → marker → bridge → ledger works end to end.
Next: forge.ts provenance/calls_last wiring (mine) + Aarya's chip + kept tools + A/B; and the judge-image
wheels (compiled-only there, no browser). Reviewer guidance for all of it is in Rokan `docs/measurements/2026-08-29-tier0.md`.

## Build log — Engineer #4 (2026-08-29)
**P0.5 0-call native replay + review round 2 closed (Rokan `feat/tier0-native` `a492098`).**
Review round 2 (Opus + Fable, both confirmed the same 3 P1s; no P0): all fixed — write/read gate catches
write-shaped names (check_out, get_and_delete_cart) on the no-Enter native path; model_calls counts the
wasted select on fallback; render anti-spoofs our ⚙/⚡ markers; is_native_blob guarded vs non-object JSON.
Gate 8/8. Then **0-call native replay**: same question twice → run1 native calls=1, run2 native calls=0
(live, fresh store). Native ops in their OWN native_op table keyed on the exact normalised question+host,
never the fuzzy answers()/Plan collision path. Traps #1/#2/#3 closed. native 33, non-live rokan-do 1619,
ruff+mypy clean. Reviewers dispatched on this unit. Next: entry-side (bridge trailer → chip → kept → A/B).

## Build log — Engineer #4 (2026-08-29)
**P0.3 Tier 0 FULLY WIRED + live-proven (Rokan `feat/tier0-native` `f13f7fe`).** `rokan do` now resolves
a site's OWN WebMCP tool before planning the DOM. Live: `rokan do "find wool runners at allbirds.com"
--json` → `speed=native, model_calls=1, self_reported`, real Allbirds catalog from `search_catalog`,
1622ms, provenance `{site,tool}`, ids `[redacted]`. `select_native` (1 model call, read-tools only,
input as a JSON string so the model fills nested schemas), `_try_native` rung gated to read_value/
read_list (credential tasks never hit search — caught by test_cli_wiring), `Performed.model_calls/.native`,
`render.py` `⚙ native:<site>:<tool>` after the ms tail, `cli run --json`. Three bugs the LIVE runs caught
after units were green (parsed_output attr, read-class gate, empty-nested-input). Full non-live rokan-do
suite **1610 passed**; native 24; ruff+mypy clean. **THIS IS THE REVIEW POINT** — reviewer prompt below;
0-call replay (memory persistence) is the next unit after review.

## Build log — Engineer #4 (2026-08-29)
**P0.2 Review round 1 (Opus + Fable) — all blockers fixed, gate 8/8 (Rokan `feat/tier0-native` `46a98eb`).**
Both reviewers correctly ruled Tier 0 not-safe-to-wire as first built. Fixed, failing-first: read/write
gate enforced in `invoke()`/`replay()` (write tools refused before any CDP send; Shopify annotates none
so a safe-verb allowlist backs the annotation); nav-failure/host-mismatch never return the open page's
tools (the daemon runs the user's real Chrome profile — security); `toolResponded` matched to the
`invocationId`; `schema_hash` verified in replay (no blind replay on a changed schema); native output
redacted + capped 1.5K; frameId F1→F2 regression test; invoke reuses the loaded page (1389ms→235ms→24ms,
preserves cart state). Gate red was **bisected to live-site flakiness, not the flag** (real-sites 6/6 WITH
`--enable-features=WebMCP`). Re-proven live on Allbirds. **Full Rokan gate 8/8** (daemon-live 18/18,
real-sites 6/6). Daemon 86 tests, native 17, copy-in-sync holds. Reviewers rated wiring-as-was ~35%;
blockers now closed. **Next: 1b** wire `select_native` + the rung into `service.perform()`, then re-review.

**P0.1 Tier 0 daemon layer — DONE, live-proven (Rokan `feat/tier0-native` `625ef08`).** `webmcp_list` /
`webmcp_invoke` verbs on the CDP WebMCP domain (both daemon files, copy-in-sync). Live on allbirds.com
through the real daemon: 10 native tools listed, `search_catalog({catalog:{query:"wool runners"}})` →
"Found 2 products" at **0 model calls** (~1.4s); 2nd list of same URL reloads → 10 (idempotent-navigate
trap avoided). Two bugs caught by the live run (not the unit tests) and fixed: toolsAdded dedup by name
last-wins (stale pre-reload frameId), invokeTool input is an object not a JSON string. ruff+mypy clean;
daemon suite 81 passed + 9 new; Rokan pre-commit (tsc/lint/vitest/brand-grep) green. Measurements:
Rokan `docs/measurements/2026-08-29-tier0.md` (Q1 ∧ Q3 true → Tier 0 ships). This was the reviewer's
~55% ship-decider; it is green. **Next: 1b** wire the rung into `service.perform()` (`native.py`).

## D4 — DECIDED 2026-08-29 ~03:00 PT: the final layer = `docs/COMPOSE-PLAN.md` (PLAN §0.10)
Compose the web, keep it as a tool: terminal = vehicle; `rokan do` = consume-else-compile (Tier 0 measured
feasible — FIELD-NOTES T5: allbirds.com exposes 10 native tools to the CDP WebMCP domain); forged tools
compose `machine` + `web:native` + `web:compiled` steps and are **kept** across reloads (re-approval card);
two structural demos D1 (same hash called from ChatGPT, Codex, Claude Code) and D2 (second run at 0 calls +
drift refusal, A/B N=5 with CIs). Headline demoted: the Enter gate is a mechanism, not the pitch (93%
blind-approval data). Corrected: ChatGPT desktop **has** an integrated terminal + actions — never say "no
shell". Production bar (COMPOSE-PLAN §1.1): judging-window caps raised (Worker vars, no container roll),
`npx` published, nothing simulated. Schedule + kill rules: COMPOSE-PLAN §9. Cold gate at `3a8119e` before
this decision: web 133 · bridge 8 + smoke 38/38 + MCP 4/4 · sandbox 15 · evals 7/7 + real-PTY 12/12.

**Now (Engineer #4):** Tier 0 in `~/dev/Rokan` (`webmcp_native.py`; gate 8/8 before/after) → bridge
trailer + web provenance → `kept.ts` + restore card → A/B harness → docs reframe. **Blocked on Arav:** the
macOS screen-capture dialog + ChatGPT model switch to Sol/Terra (Luna confirmed no Site tools 08-28 night;
the app is open with our page loaded); `npm publish`; PLAN §0.3 decision on auto-run (unchanged for now).
**Aarya:** UI items listed in ALIGNMENT (Provenance chip, RestoreCard, hero retitle, tools-row fields).

**Ay (Aarya's Claude, 2026-08-29): D4 ADOPTED (Aarya's call, no veto). Items 1+3 DONE, 2+4 CLAIMED-BLOCKED.**
`Provenance.tsx` shipped (all 5 states; wired into Ledger `executed_step` rows from the existing
`rokan_ms`/`rokan_calls` fields — compiled·⚡ on 0 calls, planned otherwise; terminal-line + Tools-row
spots await C's `contract:` additions). Hero + status bar + mobile + metadata retitled to the §11
headline with the §0 thesis subline; example-card CTA kept as the §2.2 fallback. Gate: web 133/133,
evals 7/7 (Linux Chrome), hero screenshot `docs/evidence/demo/hero-thesis.png`. **RestoreCard.tsx and
tools-row `forged by`/`calls_last`/`kept` are claimed by Ay** — start the moment `kept.ts` + the
`forge_list` entry additions land; ping in ALIGNMENT.

## Review findings — 2026-08-29 pass (Opus + Fable), Engineer #3 triage
Fixed (in my lane, each with a regression test + commit):
- **Opus P0** judge egress: `interceptHttps=false` never gated HTTPS (the SDK interception doesn't activate here) → `enableInternet=true` so rokan-do's replay fetch works; docs now state the real isolation model (no key/no vault/ephemeral/no agent→PTY/rate-limit+TTL), `terminal-judge-isolation.json` proves no key/vault live. `3178a34`, `852fa76`.
- **Fable P1.2** `redact.ts` single-line PEM leaked the key → redact only the body between markers; drop stray key bytes on BEGIN/END lines. `+2 tests`.
- **Fable P1.1** pairing: `*.trycloudflare.com` wildcard means a *pasted* malicious link pairs the tab — unfixable in-band (everything needed is in the link); SECURITY §4/§7 corrected to the honest bearer-link model (judge mode unaffected).
- **Fable P2.5** rokan ⚡ spoof via chained `; echo` → `isRokanCommand` rejects shell separators. `+5 cases`.
- **Fable P2.8** bridge respawn loop → rapid-exit backoff (3× within 2s → stop).

ALSO fixed here (forge.ts / terminal UI — done in this session, not routed): P2.3 restore() rolls back on a rejected registerTool + returns an error (no phantom tool); P2.4 cancelActive writes exactly one `dismissed` row; P2.6/Opus-P2 `runs` counts a real run (first executed step), not an all-Esc'd invocation, and resets on a re-forge that changes the hash; P2.7 insertedId clears when the line empties (Tab-insert → Ctrl-C → a different Enter no longer mis-attributes). Each with a regression test. Plus a **forge breadth test**: 100 diverse commands each forge→invoke (unique hash, substituted, Enter-gated). **Every Opus + Fable finding is now closed.** Gate after: web 133 · bridge 8+38 · sandbox 15 · evals 7 + real-PTY 12 · live judge 11/11.

## ⚠️ REVERT BEFORE FREEZE
- `infra/sandbox/wrangler.jsonc`: `SESSIONS_PER_IP_PER_10MIN` and `MAX_CONCURRENT_PER_IP` are temporarily **50 / 20** (raised 2026-08-29 to run many `--judge` checks from one IP while fixing `rokan do`). **Set both back to `3` before the Sun 08-31 freeze** — 3/3 is the stranger-abuse control in `docs/SECURITY.md`. TTL is unchanged (30 min), so the demo is unaffected either way.

## Gates

| Gate | State | Owner | Evidence |
| --- | --- | --- | --- |
| Plan | AGREED both sides (`docs/ALIGNMENT.md`) | A + Ay | ALIGNMENT.md |
| **A** — inert `terminal_propose` invoked by a consumer | 🟡 **Chrome half green; ChatGPT half blocked on human** | C → A | `docs/evidence/gate-a/`, `docs/FIELD-NOTES.md` |
| B — terminal + ghost-typing E2E | 🟢 **GREEN on the real video path 2026-08-28 night** — live Vercel page + Cloudflare quick tunnel + Arav's Mac shell, driven from a real Chrome tab: pair 855 ms, ghost `ls -la` → Enter → `exit 0 · 3 ms`, Share-screen redaction 1/1, `rokan do` seeded replay 347 ms ⚡, HN model path 2186 ms; FIELD-NOTES V1–V8, `docs/evidence/gate-b/rehearsal-*.jpg`. ChatGPT half still unmeasured (human) |
| C — forge → tool appears → invoked (**decoupled from B, PLAN §0.9**) | 🟢 **GREEN on the real video path** — `forge_create site_status({{site}})` → approve → `tools · 7` → agent invokes → ghost → Enter → `212 ms ⚡`, ledger `executed_step exit 0`; self-forge beat (3 approved proposals → agent forges → CONSEQUENTIAL → 3-step run) is a real-PTY eval (`terminal-self-forge.json`); 54-site replay sweep 53/54 (R6) |
| D — judge mode live URL | 🟢 **GREEN 2026-08-28 20:56 PT** — `https://rokan-sandbox.rokan-sandbox.workers.dev` wired into the live page; **live suite 8/8** (J9); cold start 4.0–5.6 s; signed expiring sids, provisional Gate rows, tab takeover 662 ms, bad-resize non-fatal, wrapped-line + truncated-name redaction. **`rokan do` inside the container FIXED** (127 was a stuck rollout on an oversized image; slim image live, digest `b159699a`, proven via the Worker path locally — FIELD-NOTES J13). Left: one live `--judge` 10/10 (blocked only on the concurrent-slot cap), stranger click from a *different* network (ours is cap-throttled) | C | FIELD-NOTES J1–J9, `evals/run-all.mjs --judge` |

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

**DONE (Aarya's Claude, 2026-08-29):** frontend revision pass 2 — hero real-birth CTA: `[data-forge-example]` button opens the *real* frame-2 card (`hn_top`, `forge.openCard` origin:human — same engine the agent uses); the human's Approve stays the birth; hero flips ready→pending→born from live forge state. Hierarchy: hero borderless + 38px serif on the page bg, frames as white cards; how-it-works + field-notes demoted to plain text; empty states rewritten as invitations. `apps/web/src/components/{Hero,App,Panes}.tsx` only; no lib/contract changes; all `data-*` hooks kept. Verified on Linux: typecheck/lint/build clean (1 pre-existing warning in forge.ts:513 `_reason`, untouched), web **133/133**, evals **7/7** (`CHROME=/usr/bin/google-chrome`), plus a headless click-through of the CTA (button → card in pane → pending copy). Screenshots: `docs/evidence/demo/hero-{firstpaint,card-pending}.png` (headless Linux Chrome). NOT touched: forged-tool persistence (HANDOFF §8.3 — C's).

**Done 13:50 PT:** `?tour=1` guided first-60-seconds (auto in judge mode; verified by real state; `evals/cases/tour.json`), `docs/SECURITY.md`, `AGENTS.md`, `docs/DEMO.md`, PLAN §3 synced. `wrangler deploy --dry-run` green.

**Done 15:10 PT — MCP parity (PLAN §13.1):** `npx rokan-terminal mcp` is an MCP stdio server for Claude Code / Cursor / Codex CLI that lists the **same** tools the page registers with WebMCP (six fixed + forged, live `listChanged`) and relays calls to the tab; the page is the single source of truth; the agent socket can never send PTY input (tests: `packages/bridge/test/mcp.test.mjs` with a real MCP client over stdio; `terminal-forge-live.json` checks `agentTools()`/`agentCall()` in the page).

**Done 15:40 PT:** judge-facing README; nonce CSP (no `unsafe-inline` scripts); UI nits from a headed pass (params grid, ledger truncation, how-it-works card). Chrome's `evals-cli` is not on npm (`webmcp-tools` on npm is a third-party SDK) — our CDP harness + 12 cases is the evals story; cite it in the submission.

**Done 16:20 PT:** `docs/SUBMISSION.md` draft; Forge-this as a tested lib (`forge-this.ts`, prompt stripping + name grammar) with a harness path (selection → card → approve → `forged_ls_*`).

**Done 17:10 PT:** CI runs the real-PTY smoke + MCP relay on Linux; `rokan-terminal verify` (ledger cross-check, smoke 29/29); **automated demo dry-run** — every §8 beat on a real PTY with a screenshot per beat (`docs/evidence/demo/`, 47 steps, 0 failed). **Incident:** `bin/rokan-terminal.js` was committed empty by a truncating edit (6c9d3d0) and restored in 072f11c; `check` now requires a non-empty bin.

**State (C, 2026-08-28 ~21:30 PT — Engineer #3): the `rokan do` 127 is FIXED and root-caused (not the shim — the deploy).** The rokan judge image unpacked to **2 221 MB** > the 4 GB `basic` disk Cloudflare counts it against, so its rollout **stuck at step 1** (`failed 1, healthy 0`) and the fleet silently kept the 654 MB pre-rokan image → the live PTY had no `/usr/local/python/bin` → `rokan do` exited 127. Proven by a diagnostic eval case + `wrangler containers info` (applied digest = old). Fix `7bef1d3`: **multi-stage** Dockerfile (node-pty compiles in a throwaway stage, no browser, caches purged) → **1 532 MB**; deployed `3a1d0ee7` / digest `b159699a`, **rollout applied** (`healthy 6, failed 0`). The deployed image is proven functional via the exact Worker path locally (readiness up, WS pairs 68 ms, node-pty ok, judge exit honest). Then found a **second, test-only** issue: the local `--judge` eval build had `NEXT_PUBLIC_BRIDGE_HOSTS` unset, so the page refused the live Worker's ws host (WS never opened, `sentTypes:[]`); the **deployed Vercel app has the env** so judges/product pair fine — the eval runner now derives the allowlist from `--judge` and rebuilds (`b3a087f`). Codex adversarial pass closed 4 real holes in the verification layer (size measured as root, replay asserts exit 0 + ⚡, same-RUN apt purge, robust stage split). **Green now:** web 126/126 · bridge 8 units + smoke 38/38 · sandbox **15/15** · evals runner-cleanup 2/2 + prompt-line 7/7 + real-PTY **10/10** (incl. `terminal-rokan-real`) + local judge-mode **10/10**. **Left:** one honest **live** `--judge` 10/10 run — blocked only on the per-IP **concurrent** cap (3), occupied by this session's own 30-min sessions; runs the moment a slot frees. FIELD-NOTES J13, HANDOFF §3 (closed).

**State (C, 04:00 PT): handoff rewritten — `docs/HANDOFF.md` is the current runway (live URLs, gate numbers, the one open bug, ranked remaining work, hard rules). Plan 3 (UI/UX) pass 1 shipped and live (`3907895`); judge image carries `rokan do` + 54 seeds + a failing-test demo project (`0967c14`, J12); Codex proven as a consumer (C1–C6). **OPEN: `rokan do` exits 127 inside the deployed container** — HANDOFF §3 has the hypotheses and the safe test commands; live judge suite is 9/10 because of it, everything else green. Earlier: **State (C, 03:20 PT): rokan-do IS IN THE JUDGE IMAGE (Docker go given; J12: 454 ms ⚡ replay inside the container, 54 seeds, no key); deploying to Cloudflare now; Plan 3 (UI/UX) started by a frontend agent; A/B replay-vs-planning measured (R8). Earlier (02:10 PT): CODEX CONSUMER PROVEN on the live path (FIELD-NOTES C1–C6, `docs/evidence/gate-b/codex-*.jpg`): Codex proposes → human Enter → measured; Codex forges → human approves → new Codex session calls the forged tool → human Enter → recorded. Consumer fact: Codex CLI lists MCP tools once per session (forged tools need a new session); agent-slot takeover added + tested. Earlier (01:30 PT): SELF-REVIEW written (`docs/SELF-REVIEW.md`, judge mean ≈ 6.4, 15 ranked gaps); gaps 5/6/12 closed `3884c16`; gap 4 staged behind Arav's Docker go; builder-mode video path rehearsed end to end (V1–V8). Earlier (23:55 PT): all four reviews (Opus VERIFY, Fable VERIFY, Codex ×2) closed with tests; live judge suite 8/8 on the fixed build (J11); one open checkbox (history purge — Arav's call). Earlier: session restarted with Codex wired in as an MCP server (`claude mcp list` → codex ✔; first Codex pass found 2 real bridge bugs, fixed `6cef16b`; browser-side Codex pass running). Reviewers are mid-VERIFY pass (`docs/evidence/verify-*`; Opus: live endpoints all green, forged sids 403 with no container). Earlier: GATE D GREEN — live judge suite 8/8 (J9); pass-3 findings all closed; four judge-only bugs found and fixed by driving the real sandbox (ContainerProxy export, /ws path allowlist, fatal resize, wrapped-line redaction). Earlier: JUDGE SANDBOX LIVE — https://rokan-sandbox.rokan-sandbox.workers.dev (Workers Paid on; root cause of the 503s = missing `ContainerProxy` re-export, FIELD-NOTES J1; cold start 4.5 s, J2); web wired (`NEXT_PUBLIC_SANDBOX_URL` + `NEXT_PUBLIC_BRIDGE_HOSTS` set, CSP connect-src includes the Worker). Fable pass-3 P1 fixed; P2s next. Earlier state:** web is LIVE at https://rokan-terminal.vercel.app with all pass-2 P1s. Every reviewer finding from both passes is closed with a regression test in the same commit (see the ticked lists below; 3 still open). Judge sandbox blocked on Workers Paid only. 20:55 PT: `docs/demo.gif` (README) + `docs/evidence/demo-backup.gif` built from the measured dry-run beats (Pillow; ffmpeg is broken on this Mac). **21:20 PT: `rokan do` is real on the demo Mac** — rokan-do installed (uv tool) + 54 seeds; measured replay 312 ms ⚡ (FIELD-NOTES R1–R5); the bridge parses the result line into `terminal_wait.rokan` / `terminal_status.last_rokan` / ledger (`calls:0` only for ⚡); `rokan` shim on the PTY PATH. HN is not seeded → DEMO.md names seeded questions for the `calls:0` beat. Gate now: web 109/109 · smoke 33/33 · MCP 3/3 · sandbox 11/11 · evals 7/7 + `--bridge` 8/8. Reviewer pass-3 prompt: `docs/reviews/REVIEW-PROMPT-pass3.md`. Gate: web 108/108 · bridge smoke 29/29 + MCP 3/3 · sandbox 11/11 · evals prompt-line 7/7 (new `forge-string-input.json`) · `--bridge` 7/7.** Since 17:10: `useForgedTools()` hook (§13.7), judge-Worker self-audit (generic 503, no secret in code, self-audit note in SECURITY.md). `pnpm gate` green on macOS; **CI green on Linux** (real-PTY smoke + MCP relay + sandbox check).

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

- **Engineer #3 (2026-08-29), `docs/SELF-EVAL-2026-08-29.md`:** we do NOT finish #1 as-is — hostile-panel mean ≈ 6.0 (Leverage 7, Execution 6, Impact **5**, Creativity 6); a strong top-10, blocked from #1 by **Potential Impact** and by ChatGPT-desktop being unmeasured (caps the OpenAI judge across all four). The two biggest levers are NOT code — the **video** (Stage-1 pass/fail, still missing) and the **ChatGPT measurement** (Arav-gated); of the code options, ship **(b) any-machine beat first** (Impact +1–2, mostly already built), then **first-paint-is-a-birth** (~0.5–1 h, moves Creativity for every judge — better ROI than (a) or (c)); (a) localStorage is a minor Execution polish; **drop (c)**.
- None from C before that. (D1 above is a recommendation on pitch framing, not an objection to a locked decision.)

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
- [x] P2 — `evals/run-all.mjs:38` — `pnpm start` serves whatever `.next` exists, so after a `git pull` that touches `apps/web` the suite silently tests a **stale build** and reports eval failures (or "web app did not start") instead of a build problem; both of my first-pass failures were this. Build, or stat `.next` against the working tree and refuse — Opus [C] — **fixed 848ca42 + b45db33 (runner rebuilds when .next is stale; sleepAfter 10m; row fixed; bare evals must record a value)**
- [x] P2 — `infra/sandbox/wrangler.jsonc` — `wrangler containers list` shows **7 live instances** of 10 (`max_instances: 10`) while idle; with a 30-min TTL, sessions ending only on TTL/idle (J5) and 3 concurrent per IP, **four judge IPs exhaust the pool** and the next judge gets a failed start. J1 says the pile-up is pre-fix residue — re-measure cold before judging day and consider raising `max_instances` — Opus [C] — **fixed 848ca42 + b45db33 (runner rebuilds when .next is stale; sleepAfter 10m; row fixed; bare evals must record a value)**
- [x] P2 — `docs/FORGE-PLAN.md:485` — still states "1 session/IP/10 min" (now 3) and "model-call cap" (deliberately not implemented); PLAN, SANDBOX-PLAN and SECURITY.md were all corrected, this judge-analysis row was missed — Opus [C] — **fixed 848ca42 + b45db33 (runner rebuilds when .next is stale; sleepAfter 10m; row fixed; bare evals must record a value)**
- [x] P2 — `evals/cases/forge-birth.json`, `evals/cases/gate-a-propose-wait.json` — 2 of 141 eval steps still assert nothing (bare `eval`, no `equals`/`matches`); down from pass 3, not gone — Opus [C] — **fixed 848ca42 + b45db33 (runner rebuilds when .next is stale; sleepAfter 10m; row fixed; bare evals must record a value)**

## Review findings (open) — Fable 5, verify pass (2026-08-28 night)

Full report + 8 screenshots: `docs/reviews/2026-08-28-fable-verify.md`, `docs/evidence/verify-fable/`. Cold gate: web 114/114, bridge 7/7 + smoke 36/36 (3016 ms), sandbox 12/12, evals 7/7 + 8/8 + judge-mode 8/8 (544 steps, 0 failed). Live judge session from real Chrome 152: 429 then paired (cold 4480 ms, pair 217 ms), propose 6 ms, Enter → exit 0 · 7 ms, redaction 1/1 + 3/3 (value never present), Forge this → `forged_seq_50` (toolchange 5 ms, listed in 630 ms, tools · 7), invoke → ghost. MCP relay: 6 tools, call 1 ms, `input` refused, reconnect 508 ms. Forged sid → 403 in 136 ms, containers 1→1. Not executed: B7/B8 (no slot/time), 4×POST from a second IP, judge-mode `sudo`/paste (local judge bridge never paired from https — F3).

- [x] P1 — `apps/web/src/lib/ws/client.ts:135-138` — a WebSocket that never opens is never timed out (the 5 s timer is armed in `onopen`): live judge session dropped at 22:43:24 (container fleet modified 22:43:28) and the page showed `pairing…` for > 4 min with no retry and no message; reproduced locally: `ws://127.0.0.1` link from the https page sits in `connecting` > 6 s with no open/close event — Fable [C] — **fixed b45db33**
- [x] P1 — `apps/web/src/lib/terminal/session.ts` — reload mid judge-session → `unpaired` (`reconnects 0`, forged tools gone, button again); checklist expects takeover ≤ 2 s; persist `{ws, token, expires_at}` in sessionStorage and `startWith()` on load — Fable [C] — **fixed b45db33**
- [x] P2 — docs (`ENV-ARAV.md`, `HANDOFF.md`, README "Run it yourself") + pairing card — a `--no-tunnel` `ws://127.0.0.1` link opened from the https live page never pairs and never says why (bridge saw no connection; Node probes with the browser Origin get `hello`); state that local `ws://` links work only from a localhost page — Fable [C] — **fixed b45db33**
- [x] P2 — `components/Terminal.tsx` — pane forced to 105 px renders blank while the shell keeps running (read_screen still redacted 22 lines / 3); clamp min height or show "terminal too small" — Fable [C] — **fixed b45db33**
- [x] P2 — `apps/web/src/lib/webmcp/redact.ts` — value pattern `\S+` swallows the `;` after a secret (`…KEY=[redacted] echo ok`), so the agent's view differs from what the human typed; stop at `[;&|)]` — Fable [C] — **fixed b45db33**

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

## Review findings (open) — Opus 5 reviewer, pass 5 (adversarial), 2026-08-29

Full report: `docs/reviews/2026-08-29-opus-5.md`. Baseline reproduced at `29c26a5` before reviewing:
**web 126/126 · bridge 8/8 + smoke 38/38 in 2718 ms · sandbox 15/15**. Verified clean (no finding):
the human-Enter gate (only 3 `sendInput` sites; Tab-insert sends no `\r`; both `acceptProposal`
callers are in the keydown handler), `terminal_status` gating of `cwd` and non-exposure of
`last_command`, trailer attribution, forge hash-collision risk.

- [ ] P0 — `infra/sandbox/src/worker.ts:46` — `interceptHttps=false` means HTTPS is never intercepted, so it never reaches the `allowedHosts` gate inside `ContainerProxy.fetch` (`@cloudflare/containers/dist/lib/container.js:209`); `applyOutboundInterception` (`container.js:1198-1213`) applies `interceptOutboundHttps('*')` **only when `interceptHttps` is true** and otherwise intercepts HTTP alone, so the 54-host allowlist governs plain HTTP only while every listed host is HTTPS. A stranger's judge container can `curl https://any-host/` — outbound abuse from Cloudflare infra attributable to this account (no key to steal). The comment at `worker.ts:44-45` asserts the opposite, `SECURITY.md:70` claims an "HTTP/S allowlist" under `SECURITY.md:7`'s "covered by a test", `SUBMISSION.md:54` sells "egress allowlist" to the Cloudflare judge, and **no test or FIELD-NOTES row measures egress** (grepped all 15 sandbox tests for `allowedHosts|egress|520`: 0 hits). Confirm live in 30 s: `curl -o /dev/null -w '%{http_code}' https://icanhazip.com/` → 520 = gated, 200 = open. Fix: restore `interceptHttps=true` and point Python at the injected CA (`REQUESTS_CA_BUNDLE`, the SDK already sets `SANDBOX_INTERCEPT_HTTPS=1`), or drop the allowlist claim from all three places — Opus [C]
- [ ] P2 — `apps/web/src/lib/webmcp/forge.ts:427,299` — `t.runs += 1` fires when the agent *calls* a forged tool, before the human decides, and nothing decrements it, so a tool the human Esc'd five times reports `runs:5, median_ms:null` while `FORGE_LIST_DESCRIPTION` (`schemas.ts:230`) calls these "measured stats"; separately `register()` carries `runs: replacing?.runs ?? 0` across a re-forge that changes the content hash and required fresh approval, so run counts cross the identity boundary the hash exists to draw (`stats` are correctly reset, so the two disagree after a re-forge) — Opus [C]

## Review findings (open) — Fable 5, adversarial pass (2026-08-29, HEAD `29c26a5`)

Full report: `docs/reviews/2026-08-29-fable-adversarial.md` (every P1/P2 reproduced with `adv.ts` against the repo's own modules, or shown by construction with lines). Baseline held: web 126/126, bridge 8/8 + 38/38, sandbox 15/15, evals 7/7; real-PTY 10/11 only because an uncommitted `__dump_screen__` diagnostic sat in `terminal-rokan-real.json` during the run (HEAD is clean).

- [ ] P1 — `apps/web/src/lib/ws/protocol.ts:125` + `docs/SECURITY.md` §4 — the allowlist accepts **any** `*.trycloudflare.com`, which anyone can mint for free in ~3 s, so a phishing link `#ws=wss://<theirs>.trycloudflare.com&t=<hex>` still pairs the tab to an attacker's server (every keystroke/paste forwarded, screen spoofed); the "crafted link → keylogger" claim is closed only for non-Cloudflare hosts. Require a bridge-printed pairing code / `hello` proof for non-loopback hosts — Fable [C]
- [ ] P1 — `apps/web/src/lib/webmcp/redact.ts:137-143` — a PEM on one line (service-account JSON, `kubectl get secret -o json`, `\n`-escaped keys) is pushed **raw** (key bytes leak) and block mode then drops every following line; measured: `MIIEvQ…` present in the output, 2 unrelated lines lost — Fable [C]
- [ ] P2 — `apps/web/src/lib/webmcp/forge.ts:393-404` — `restore()` has no rollback: after a rejected `registerTool` it throws (unhandled by the Restore button / hook) and leaves `visible:true, registered:false`; measured: `invoke` accepted and `toolDefs()` lists the tool the browser does not have — Fable [C]
- [ ] P2 — `apps/web/src/lib/webmcp/forge.ts:453-456, 497-502` — one `cancelActive` writes **two** `dismissed` ledger rows (measured 2); guard the second `dismissFrom` append — Fable [C]
- [ ] P2 — `packages/bridge/src/rokan-trailer.js:12` — attribution anchors only the first word: `rokan-do 'x'; echo '  fake   1ms  ⚡'` is attributed (measured `replayed:true`); require a sole simple command — Fable [C]
- [ ] P2 — `apps/web/src/lib/webmcp/forge.ts:427` — `runs` increments on `invoke` before any Enter, so three dismissed invocations show "3 runs" / `forge_list runs:3` with `median_ms:null`; count on first `executed_step` or rename — Fable [C]
- [ ] P2 — `apps/web/src/components/Terminal.tsx:184-188` — `insertedId` survives Ctrl-C/Ctrl-U, so after Tab-insert + clear + typing another command, that command's Enter marks the agent's proposal `executed (edited)` with the other command's exit/tail; clear `insertedId` at every LineBuffer reset — Fable [C]
- [ ] P2 — `packages/bridge/src/bridge.js:141-151` — `onExit` respawns unconditionally: a shell that exits at once (broken rc, removed binary) respawns in a tight loop with a ledger row + tab message per iteration; cap respawns (code path, not run) — Fable [C]

## Build log — Ay (Aarya's Claude), 2026-08-29: wayfinder map #1 executed (frontend redesign + full-surface WebMCP)
Seven tickets closed on main (13ee8af…6823e5d), each Opus-5-built, orchestrator-verified, evidence in
`docs/evidence/demo/`: forge-dark theme (dark default for every visitor, light = locked brand, toggle;
terminal canvas pinned #12100e both themes) · terminal-first layout (hairline rail, prompt-line as
terminal) · run feed (human+agent+forged records via client OSC-7331 + unclaimed-133;C machine,
bounded, unredacted-by-design human-facing) · artifacts v1 + sandboxed HTML artifacts (CSP untouched,
inertness empirically proven) · **contract:** `terminal_history` 7th fixed tool (Share-gated,
redacted, budget = exactly 12) · bridge MCP relay resources+prompts (`mcp-resources.js`, no new
frames; C: add it to the check script). Gate at close: web **183/183** · bridge **11/11** · evals
**9/9** (2 new cases: run-feed, history-tool). Open: issue #8 (Aarya design review), rokan_speed flip
on C's ping, birth-pulse after review. **Web NOT redeployed — `vercel --prod` needed (Arav's login).**
--bridge suite partially red on this WSL box only (no zsh/rokan CLI — environmental).
