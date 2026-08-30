# Pivot reuse inventory — what survives a change of product (Explore agent, 2026-08-30 ~08:30 PT)

If the team pivots to a different web app in 3 days, from the current tree (branch `workbench`):

| Module | LOC / tests | Terminal coupling | Verdict |
|---|---|---|---|
| Forge engine `forge.ts` | 592 / 27 | one hard line: `isDangerousIn` (`:17`, used `:235,:263,:463`); adapter injected | **reusable, 1 edit** |
| `forge-spec.ts` | 280 / 16 | ~100 LOC POSIX quoting (`substituteLine :170-206`) | split: ~180 generic + shell dialect |
| `types.ts` (WebMCP detect) · `kept.ts` · `proposals.ts` | 53 · 194/18 · 131/7 | none | **reusable as-is** |
| `adapter.ts` seam | 73 | interface names only | trim to 2 methods (`stage`, `awaitDecision`) |
| `register.ts` · `schemas.ts` | 426/12 · 303/1 | 5 of 7 tools are `terminal_*` | ~200 + ~230 LOC throwaway |
| Ledger `ledger.ts` (+ bridge countersign) | 205/5 (+115) | none | **reusable as-is** |
| Redaction `redact.ts` + `bridge/redact.js` | 167/19 + 100/6 | none | **reusable as-is — best-value asset** |
| Judge sandbox Worker | 827/40 | `worker.ts` (269) PTY-shaped; gate/sid/origin/model-proxy (443, 27 tests) generic | split |
| Container image + `container/` | — | shell container | throwaway |
| Bridge `packages/bridge` | 1503/34 | node-pty, OSC | mostly throwaway; keep protocol/ledger/agent-token/backpressure/mcp relay |
| Web terminal/ws | 1502 + 513 | total | throwaway except `ws/client.ts` (346), `artifacts.ts` (459) |
| Eval harness | 218 + 305 + 25 cases | `run-all` prefix `terminal-` | **harness reusable as-is**; runner ~30 LOC |
| UI | 2359 | `Chip`, `Provenance`, `ForgeCard` (relabel), `Tour` shape, Ledger rail, `ArtifactPanel` reusable (~700); Terminal/Hero/PromptLine/RunFeed throwaway (~1200) | |

**Non-shell action through propose → approve → ledger:** genuinely easy — `ResolvedProposal` already carries
`exit_code | ms | tail`; blockers are `isDangerousIn` injection, a JSON substitution dialect, the 400-char /
no-newline command cap, `forgedDescription`'s terminal prose, and a `contract:` change if countersigned.
**Estimates:** (a) extract `@rokan/forge` for any Next.js page **8–12 h**; (b) one non-shell action end to end
**6–10 h**; together **14–16 h**. Cheapest high-value asset: the capped model proxy + gate (443 LOC, 27 tests) —
any page can call an LLM with no key in the client, per-session/IP/day/all-time caps, ~2–3 h to repoint.
