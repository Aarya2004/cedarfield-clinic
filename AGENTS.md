# AGENTS.md — for coding agents working in this repo

**What this is.** Cedarfield Clinic: a public booking page that gives a visitor's own agent safe, live
WebMCP tools (`document.modelContext.registerTool`) and never lets it commit — the booking tool is born
from the person's press, palm or spoken word and dies on use. Read `README.md`, then `docs/DROP-STATUS.md`
(newest row first), then `docs/SECURITY.md`. The terminal under `packages/bridge` / `infra/sandbox` is an
earlier experiment in this repository and is not the entry.

**Layout.** `apps/web` (Next 15, tools + UI) · `packages/bridge` (node-pty + ws + tunnel) ·
`infra/sandbox` (judge mode on Cloudflare) · `evals/` (headless WebMCP harness + cases) · `docs/`.

**Contracts (change only with a `contract:` commit):** `apps/web/src/lib/webmcp/schemas.ts`,
`apps/web/src/lib/webmcp/forge-spec.ts`, `apps/web/src/lib/ws/protocol.ts` ⇄
`packages/bridge/src/protocol.js`.

**Verify before saying done:** `pnpm gate` at the root — typecheck, lint, 93 unit tests, real-PTY
bridge smoke, headless WebMCP cases (prompt line and real PTY). Add a test for every change; never
`|| true` an install step; every number shown on screen must be measured by the code that shows it.

**Rules:** no tool ever executes a command; imperative WebMCP only, top-level document, ≤ 12
tools visible; secrets never leave the tab unredacted (`redact.ts` is the single choke point);
say the true thing in code comments and docs. Working style: `docs/FORGE-PLAN.md` §16.
