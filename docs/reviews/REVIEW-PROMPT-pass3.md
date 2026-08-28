# Reviewer prompt — pass 3 (paste to Opus 5 and Fable 5 reviewers)

You are reviewing **Rokan Terminal** (`~/dev/webmcp-private`, branch `main`, pull first) for the OpenAI WebMCP Challenge. Read `CLAUDE.md`, `docs/HANDOFF.md`, `docs/PROGRESS.md` (state + every prior finding, all ticked with fix hashes), `docs/SECURITY.md`, `docs/FIELD-NOTES.md`, then your own earlier reports in `docs/reviews/`.

**What changed since your pass 2 (all on `main`, each with a regression test in the same commit):**
- Terminal completion: bridge sends the `133;D` data frame *before* the end status; adapter finishes on marker **and** status (either order) → complete tails; `running:true` gates Enter; bash/sh (no integration) resolve unmeasured, never wedge; prompt-without-`133;C` = nothing ran; LineBuffer is paste/history-aware (`e34c0c4`, `60999c8`).
- Judge Worker: 403 on a disallowed Origin before the Gate; HMAC-signed sids verified before any `getSandbox`; DELETE removed; 3 sessions/IP/10 min (`abe7be1`, `439cf19`). **Not deployed yet — the account needs Workers Paid; review the code path.**
- WS client: hello timeout retries (no false "unauthorized"), no ping doubling, no keystroke replay across a re-pair; MCP relay dedupes `listChanged`; `AgentLink` reconnects with backoff; `close()` on the bridge never respawns a shell (`84759c8`, `6bf9a76`).
- Contracts (additive): `terminal_wait` → `measured:false` + `rokan:{ms,replayed,calls}`; `terminal_status.last_rokan`; `executed_step` is the client step-row kind; `isDangerousIn(cmd, mode)` hard-blocks `sudo` in judge mode; `BridgeStatus.last_rokan` (`c243090` + the rokan-trailer commit).
- New: the bridge parses `rokan-do`'s result line (`  <answer>   <ms>ms[  ⚡]`) into status + ledger (`calls:0` only for ⚡ replays — model-call counts are never printed, so anything else is `null`, not inferred); a `rokan` shim on the PTY PATH makes `rokan do "…"` real (`rokan-do` is Rokan's console script; `which rokan` shows the shim). `rokan-do` is installed on Arav's Mac (`uv tool`), 54 seeds installed; **HN is not seeded** (status pages / docs / pypi / wikipedia are) — see FIELD-NOTES.
- Evals runner takes free ports (never kills :3311); new cases `forge-string-input.json` (spec-level `executeTool(tool, '<json string>')`), `terminal-rokan-trailer.json`.

**Gate you should reproduce cold** (one run each; do not loop; kill everything you start):
`pnpm install` → `cd apps/web && pnpm typecheck && pnpm lint && pnpm build && pnpm test` → `cd ../../packages/bridge && pnpm check && node --test test/*.test.mjs && pnpm smoke` → `cd ../../infra/sandbox && pnpm check` → `cd ../.. && node evals/run-all.mjs && node evals/run-all.mjs --bridge`.

**Scope for this pass — new findings only, P0/P1 first, each with a repro:**
1. Anything that makes the live URL (https://rokan-terminal.vercel.app) or the demo (`docs/DEMO.md`) fail or lie on camera — measured, not inferred.
2. The `rokan-do` trailer path: can a command's *output* forge a `calls:0` row (an `echo` of the trailer does — the ledger says what the PTY printed; is that stated honestly enough, or must the bridge attribute it to a `rokan` command line)?
3. Judge Worker code (`infra/sandbox/src/*.ts`) before it is deployed: sid signing, Gate, egress allowlist, secrets, error bodies.
4. Contract drift between `schemas.ts` / `protocol.ts` / `protocol.js` / `ledger.ts` / `docs/PLAN.md` §3.
5. Anything in `docs/SUBMISSION.md` / `README.md` that the code does not do.

Write your report to `docs/reviews/2026-08-2X-<opus|fable>-3.md` and append your findings as `- [ ] P<n> — <file:line> — <one line> — <reviewer> [C]` under a new `## Review findings (open) — <you>, pass 3` heading in `docs/PROGRESS.md`. Do **not** fix; C fixes. Do not edit files outside `docs/reviews/` and PROGRESS.
