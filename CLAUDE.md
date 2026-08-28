# CLAUDE.md — Rokan Terminal (OpenAI WebMCP Challenge entry)

> **This is a hackathon.** We are competing in the OpenAI WebMCP Challenge — a 10-day, online, Devpost-run hackathon (Aug 25 → **Sep 3 13:00 PT**), $35K cash, top-10 prizes only, seven judges (OpenAI, Chrome, Cloudflare, Shopify, Vercel, Netlify, MCP-B), ~3,000 registrants. We submit by Sep 2 18:00 PT. Operate in **hackathon mode**: one feature polished, working demo > clean code > tests > docs, recorded backup one keypress away, rehearse 5×, E2E smoke before judging. If a `hackathon-sprint` skill exists in this environment, invoke it at session start.
> Read on every session in this folder.

## Read first, in this order
1. `docs/PROGRESS.md` — what is green *right now*. Update it before you stop.
2. `docs/PLAN.md` — the plan. §0 locked decisions · §3 tool contracts · §4 security · §6 schedule + gates · §10 kill rules · §11 rules.
3. `docs/WEBMCP-RESEARCH.md` — only when you need a fact about the spec, the consumer (ChatGPT desktop), or a judge.
4. `graphify-out/GRAPH_REPORT.md` — before reading raw files. `graphify update .` after code changes.

## The product, one line
**Do it once. Now it's a tool.** A terminal where anything you approve becomes a live WebMCP tool your agent can call — born at runtime, run only by your Enter. The terminal is the vehicle; the forge is the story (PLAN §0.9). `rokan do` is the star command.

## Non-negotiables (from PLAN §0 — edit there, not here)
- No tool ever executes a command. `terminal_propose` and every `forged_*` tool ghost-type; the human's Enter runs it.
- Imperative WebMCP, top-level document, ≤ 12 tools visible. No declarative forms, no iframes (ChatGPT ignores both).
- Two modes, one client: builder (own machine, local bridge + Cloudflare quick tunnel) and judge (Cloudflare Sandbox container). No Durable Object relay in v1.
- Nothing from Rokan except three wheels in `vendor/`, seeded operations, and `SKILL.md`. Rokan source stays in Rokan.
- Honest numbers only: every ms / call count on screen is measured by the code that shows it.
- Out of scope, always: acquisition, voice, channels, mascot, Shopify re-registration, chat-style `ask`/`do` tools, writes that spend money.

## Ownership (never edit outside your lane without a message)
- **Aarya + his Claude:** `apps/web/**` — layout, xterm.js, ghost text, Forge card, Tools pane, Ledger column, `forge_create` / `forged_*` / `forge_list` registration, polish, empty/error states.
- **Arav's Claude:** `packages/bridge/**`, `infra/sandbox/**`, `evals/**`, `apps/web/src/lib/webmcp/{redact,ledger}.ts`, `terminal_propose` / `terminal_read_screen` / `terminal_status` / `terminal_wait` wiring, `docs/SECURITY.md`.
- Shared contract files: `apps/web/src/lib/webmcp/schemas.ts` and `apps/web/src/lib/ws/protocol.ts` — change only with a commit message that starts `contract:` and a ping to the other side.

## Gates (binary, dated PT; a red gate triggers its kill rule in PLAN §10 the same hour)
- **A** Fri 08-28 23:59 — ChatGPT desktop invokes an inert `terminal_propose` on our page.
- **B** Sat 08-29 22:00 — propose → Enter → runs on Arav's Mac → agent reads redacted screen. Recorded.
- **C** Sun 08-30 22:00 — forge → tool appears in site tools → agent invokes → Enter → ledger row.
- **D** Mon 08-31 22:00 — judge-mode live URL, stranger-proof, `rokan do` seeded, `calls:0` on replay.
- Freeze Tue 09-01 12:00. Submit Wed 09-02 by 18:00.

## Verify before "done"
`pnpm typecheck && pnpm lint && pnpm build` in `apps/web`; `node --check` + a real PTY smoke in `packages/bridge`; `wrangler deploy --dry-run` in `infra/sandbox`; then open the *deployed* URL in ChatGPT desktop (GPT-5.6 Sol/Terra) and in Chrome 149 with `chrome://flags/#enable-webmcp-testing` + the Model Context Tool Inspector. Screenshot into `docs/evidence/`. The April 23 hackathon was lost because the app didn't open at demo. Zero tolerance.

## Stack
Next.js 15 (App Router, TS strict, Tailwind, shadcn) on Vercel · xterm.js (+fit, +webgl) · Node 20 + node-pty + ws · cloudflared · Cloudflare Workers Paid + `@cloudflare/sandbox` · Python 3.11 + uv in the container · Rokan palette (`--bg #fafaf6 --ink #18181b --accent #d97706`), Instrument Serif / Geist Sans / Geist Mono.

## Working style
- Small commits, conventional prefixes, one lane per commit. Push often — the other founder reads the repo, not your chat.
- Every 30 minutes ask: does this demo well? If not, the next 30 minutes go to the demo.
- No vendor yak > 2 h. Drop the vendor.
- Say the true thing in code comments, README, and the submission.
