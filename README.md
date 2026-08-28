# Rokan Terminal (working name)

**Do it once. Now it's a tool.** A web terminal where anything you approve becomes a live WebMCP
tool your agent can call — registered at runtime with `document.modelContext.registerTool`, run
only by your Enter. The terminal is the vehicle; the forge is the story.

Hackathon entry — the OpenAI WebMCP Challenge (Devpost, 10 days, top-10 prizes, 7 judges).
Deadline **2026-09-03 13:00 PT**.

## How to test (judges)

- **ChatGPT desktop** on GPT-5.6 Sol or Terra: open the live URL, click the Site tools arrow,
  ask "propose `ls`". Luna has site tools disabled.
- **Chrome 149+**: `chrome://flags/#enable-webmcp-testing`, then DevTools → Application → WebMCP
  shows every registration and invocation. Headless: `node evals/harness/webmcp-cdp.mjs <url> evals/cases/gate-a-propose-wait.json`.
- No tool on this page executes anything. `terminal_propose` and every `forged_*` tool ghost-type;
  the human's Enter runs it. Tool descriptions are hints to a cooperative agent, never a security
  boundary — the boundary is the keyboard.

## Repo

- `apps/web` — Next.js client: tools, ghost text, forge card, ledger. `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
- `packages/bridge` — `npx rokan-terminal`: node-pty + WebSocket + Cloudflare quick tunnel + pairing token. `pnpm smoke` runs a real PTY.
- `infra/sandbox` — judge mode (Cloudflare Sandbox container). **Not built yet** (D2).
- `evals/` — headless WebMCP harness + cases.
- `vendor/` — rokan-do wheels. **Empty until D3.**
- `docs/PLAN.md` (locked decisions §0, contracts §3, security §4) · `docs/FORGE-PLAN.md` · `docs/PROGRESS.md` (what is green *right now*) · `docs/FIELD-NOTES.md` (measured consumer behaviour) · `docs/WEBMCP-RESEARCH.md`.

Every millisecond and call count shown on screen is measured by the code that shows it.
