# Reviewer prompt — pass 4 (judge mode went live; paste to Opus 5 and Fable 5)

Pull `main` first. Read `docs/PROGRESS.md` (all pass-3 findings ticked with hashes), `docs/FIELD-NOTES.md` J1–J6 (the judge sandbox measurements), `docs/SECURITY.md`, and your own pass-3 report.

**What changed since pass 3 — all live, all with tests:**
- Judge sandbox deployed: `https://rokan-sandbox.rokan-sandbox.workers.dev`, wired into the live page (`NEXT_PUBLIC_SANDBOX_URL` + `NEXT_PUBLIC_BRIDGE_HOSTS`, CSP `connect-src`). Root cause of every failed start was the missing `export { ContainerProxy } from '@cloudflare/sandbox'` (J1). Cold start 4.0–5.3 s (J2, J6).
- Gate rows are provisional (180 s) until the bridge answers, then confirmed to the TTL; failed starts destroy the instance; 429 copy states the real limits (`937c712`, J3/J4).
- Signed sids carry their expiry inside the HMAC; `/ws` verifies signature + expiry before `getSandbox` and passes `sleepAfter` (`c243090`… see PROGRESS pass-3 ticks).
- `isAllowedBridgeUrl` accepts `/ws/<signed sid>` only on the configured judge host (`c541b4d`, J5) — found the first time the live sandbox was driven from the page.
- Judge-mode tab takeover: a newer tab with the valid token replaces a stale one (`error:replaced`, close 4410) instead of `busy`; builder mode unchanged (`87bf205`, J6: re-pair 662 ms through the DO proxy).
- rokan-do trailer attributed only to `rokan`/`rokan-do` command lines (your pass-3 P1); `rokan` shim on the PTY PATH; seed README says rokan-do is not in the image yet.

**Scope for this pass — new findings only, P0/P1 first, each with a repro:**
1. Judge mode end to end from a *different network than the builder's* (the builder's IP is at the 3-concurrent cap for most of this evening): open https://rokan-terminal.vercel.app → "Try it now — judge sandbox" → pair → propose → Enter → forge → ledger. Measure cold start and note anything a stranger would trip on. Reload the page mid-session: you should be re-paired, not `busy`.
2. Worker abuse surface after the changes: sid expiry vs TTL, provisional rows vs the 10-min rate window, takeover semantics (can a second stranger with a guessed sid pair? — they cannot without the token; confirm), `sleepAfter`, instance accounting (`wrangler containers list`).
3. The bridge inside the container: `--host 0.0.0.0`, Origin check with `--app`, idle/TTL exits, ledger under `/home/judge`.
4. Anything in README / SUBMISSION / SECURITY that the live judge path does not do.

Gate to reproduce cold (once): `pnpm install` → `cd apps/web && pnpm typecheck && pnpm lint && pnpm build && pnpm test` → `cd ../../packages/bridge && pnpm check && node --test test/*.test.mjs && pnpm smoke` → `cd ../../infra/sandbox && pnpm check` → `cd ../.. && node evals/run-all.mjs && node evals/run-all.mjs --bridge`. Do **not** run `--judge` from the builder's network before 18:30 PT (cap), and never more than once (each run is a 30-min session slot).

Write `docs/reviews/2026-08-28-<opus|fable>-4.md` and append findings under `## Review findings (open) — <you>, pass 4` in `docs/PROGRESS.md`. Do not fix; C fixes. Touch nothing else.
