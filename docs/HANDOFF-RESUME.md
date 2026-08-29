# HANDOFF — resume point (2026-08-29 ~18:40 local, Engineer #4 / Fable)

**Read this + `docs/PROGRESS.md` (top block) + `~/.claude/plans/optimized-mapping-tarjan.md` (the bible) first.**
Everything below is pushed to `main` (entry repo `github.com/Aarya2004/webmcp-private`) unless noted.

## RESOLVED (2026-08-29 ~18:40 local) — the live-judge failure
`terminal-insert-cancel` on the live judge sandbox was a **one-off container stall, not a timing bug**.
Measured with the new `--trace=<dir>` flag: 5 live sessions (2 full **12/12**, 2 isolated, 1 probe), 0 failures;
every wait ≤ 6 % of budget (worst 259 ms / 4000). Budgets unchanged. Judge mode now retries a failed case once,
labelled, and the final line counts retries. Details: FIELD-NOTES J15, PROGRESS top block. Plan §10 reconciled
to 12/12. **The judge sandbox may be called green** ("nothing a judge touches breaks", #5) — re-run
`node evals/run-all.mjs --judge=https://rokan-sandbox.rokan-sandbox.workers.dev --trace=/tmp/t` before freeze.

## WHAT I SHIPPED THIS SESSION (all pushed, all verified by me)
Commits on `main` (newest first): `d310e24 29119ca 0e8b1b4 59bcd8d 21170f0 20f0f45 55b32c4 f0f2c60 3c82bc8 a04ae96 8b5e611 2a2cca3 7b8d017`.
1. **A/B Impact harness — DONE & measured** (`evals/ab/`, `docs/measurements/2026-08-30-ab.md`, raw output `docs/evidence/ab/arm-c.json`+`arm-agents.json`). Three arms: Rokan vs Codex CLI vs Claude Code.
   - compiled ("status.python.org operational"): **Rokan warm 0 calls / 79 ms** vs Codex ~23 s / Claude ~16 s (~200–290×), agents re-plan EVERY run.
   - native ("wool runners at allbirds.com", **builder-mode**): Rokan warm 0 calls / ~1.45 s vs Codex ~10 s / Claude ~77 s. arm-c.json proves `speeds:["native"]`, `model_calls:[0,0,0,0,0]`, `answers_ok:true` (the site's OWN WebMCP tool).
   - N=5 warm / N=3 agents; variance stated; native-warm re-drives a live browser (honest).
2. **Drift test** (`evals/ab/drift/`): naive cached script returns **$75** for a **$140** price — reproduced LIVE (silently wrong). Rokan arm rests on Rokan's built-in `recheck` (planning forbidden → retire the op that no longer verifies); gated behind `ANTHROPIC_API_KEY`, prints `{skip}` without it.
3. **kept.ts** (`apps/web/src/lib/webmcp/kept.ts` + `kept.test.ts`, 18 tests) — deliverable 3, forged tools survive reload, re-approved by hash, **never auto-registers**. Security-hardened after review (bounded load, range guard, fail-safe parse, length bounds). **Unblocks Aarya's RestoreCard** — wiring recipe is in `docs/ALIGNMENT.md` (my ~10:30 note).
4. **Docs spine** reframed around measured numbers + honesty-audited: `SUBMISSION.md` (Impact section), `SECURITY.md` §8 (Tier 0 read-only gate) + §9 (caps table), `README.md` callout, `DEMO.md` v3 beats.
5. **CI** (`.github/workflows/ci.yml`): trailer + MCP + eval-cleanup tests now run on push.
6. **npm pack --dry-run**: clean 10-file tarball, deps declared, no secrets — publish-ready.
7. **Two adversarial reviews CLOSED** (security on kept.ts; honesty audit on all claims) — every finding fixed & re-verified. See PROGRESS "review round 4".
8. **Rokan repo** (`~/dev/Rokan`, branch `feat/tier0-native`, committed NOT pushed): `native.py` docstring "NOT yet wired"→wired fix; native tests 37/37; full pre-commit gate passed.

## VERIFICATION TALLY (re-run by me, not just subagents)
web **202/202** + typecheck clean · bridge **11/11** · Tier 0 native **37/37** · prompt-line evals **9/9** · real-PTY evals **12/12** · sandbox gate **15/15** · live web **200** · worker health `{ok,mode:judge}` · error hygiene clean (generic 404/426).
Eval counts: VERIFIED **22 cases (9 prompt-line, 12 real-PTY, +1 judge-only)**.

## BLOCKED — NEEDS ARAV (on the #1 critical path)
- **ChatGPT Sol/Terra run** — needs Arav OFF screen-share + switched to Sol/Terra (GPT-5.6). Then Engineer #4 drives via AppleScript+screencapture. This is §15 #1 (the birth live in ChatGPT's Site tools) — the single biggest lever.
- **`npm login && npm publish`** — package is publish-ready; only login remains.
- **Live cold-compile A/B & drift Rokan rows** — need `ANTHROPIC_API_KEY` in the Bash env (it is NOT set in the tool shell; was exported in the prior session that ran arm-c). The drift Rokan arm and any cold rokan-do run skip without it.

## AARYA'S LANE (recipe delivered in ALIGNMENT, don't wire it yourself — collision risk in her App.tsx)
- RestoreCard.tsx + the `persistKept(keptFromTools(forge.tools()))` write-path subscriber (on approve/pin/unforge/restore) + restore-on-load. `kept.ts` API: `loadKept`/`persistKept`/`verifyKeptHashes`/`keptFromTools`/`clearKept`. `restored` ledger kind already exists both sides.
- Failure-state UI screens (429, expired link, unauthorized, refused, restore-mismatch).

## UNBLOCKED-BUT-LOWER-LEVERAGE (mine, if you want more)
- ~~Resolve the insert-cancel judge failure~~ — DONE (see RESOLVED at top).
- README thesis-headline reframe (COMPOSE thesis as lead) — held during review; low churn-risk gain, current "Do it once. Now it's a tool." is already a decent thesis.
- Chrome evals-cli format (`evals/chrome-format/*.json`) — DEFERRED: needs the authoritative external Chrome evals-cli schema (not in-repo); don't fabricate a format.

## RULES THAT BIND (from CLAUDE.md + memory)
- Honest numbers only — every ms/count traces to committed evidence or a re-run suite. Never round up.
- One browser/bridge/eval/container at a time; kill by PID same step; 3-strike stop. Don't spam Arav's browser or spin many containers.
- Judges USE a prod/public-ready product, they don't watch a demo (memory: `judges-use-not-watch`).
- Subagent green ≠ verification — re-run the integration suites yourself (memory: `subagent-verification`).
- Ownership: `apps/web/**` layout/UI = Aarya; bridge/infra/evals/`webmcp/{redact,ledger,kept}.ts`/docs = Engineer #4. `schemas.ts`/`protocol.ts` = shared, `contract:` prefix + ping.
- Update `docs/PROGRESS.md` before stopping; Aarya reads the repo, not chat.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01961oaibaGyDXBGyDECQ75T`.
