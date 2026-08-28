# AGENTS.md — for coding agents working in this repo

**What this is.** Rokan Terminal: a web terminal where anything the human approves becomes a live
WebMCP tool (`document.modelContext.registerTool`) the agent can call. Nothing a tool does executes;
the human's Enter runs commands. Read `docs/PROGRESS.md` first, then `docs/PLAN.md` §0.

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
