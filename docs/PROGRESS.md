# PROGRESS — verified state (update before you stop; Aarya's Claude reads this, not chat)

Last update: **2026-08-28 01:20 PT** by C (Arav's Claude). Branch `main`, all pushed.

## Gates

| Gate | State | Owner | Evidence |
| --- | --- | --- | --- |
| Plan | AGREED both sides (`docs/ALIGNMENT.md`) | A + Ay | ALIGNMENT.md |
| **A** — inert `terminal_propose` invoked by a consumer | 🟡 **Chrome half green; ChatGPT half blocked on human** | C → A | `docs/evidence/gate-a/`, `docs/FIELD-NOTES.md` |
| B — terminal + ghost-typing E2E | ⬜ | Ay + C | — |
| C — forge → tool appears → invoked | ⬜ | Ay | — |
| D — judge mode live URL | ⬜ | C | — |

## What is green right now (all measured — see FIELD-NOTES)

- `apps/web` scaffolded: Next 15.5.24 · TS strict · Tailwind 4 · `pnpm typecheck && pnpm lint && pnpm build` green · CI at `.github/workflows/ci.yml`.
- Page registers `terminal_propose` (inert; description says NEVER executes) + `terminal_wait` (45 s, `still_waiting`, honours `signal` when given) under one `AbortController`; feature-detects `document.modelContext ?? navigator.modelContext`; page works without WebMCP.
- Chrome 152 + `--enable-features=WebMCP`: `toolsAdded` fires per registration; CDP `WebMCP.invokeTool` → ghost text on the prompt → Enter → `terminal_wait` returns `executed` (705 ms) → ledger row with measured decision latency. ESC / bidi-override injections rejected with reasons (T2.2 half green).
- Quick tunnel passes WebSocket upgrades: open 197 ms, echo 216 ms. PLAN §10 risk #2 closed.
- Shared contract v0: `apps/web/src/lib/webmcp/schemas.ts` (`terminal_propose` schema + `validateProposedCommand`, the row-1 printable allowlist). `protocol.ts` lands Sat 10:00 as `contract:`.

## Blocked on Arav (do these first — Gate A deadline Fri 23:59 PT)

1. **Install the ChatGPT desktop app on this Mac; confirm GPT-5.6 Sol or Terra is available** (Luna has site tools disabled; Enterprise/Edu excluded). Nothing else can measure the ChatGPT consumer.
2. **`vercel login`** in a terminal (device-code flow). The Vercel MCP account returned 403 "can't create a project". After login: `cd apps/web && vercel link --project rokan-terminal && vercel --prod`. Then open the URL in ChatGPT desktop → Site tools arrow → "propose ls" → screenshot into `docs/evidence/gate-a/`.
3. Claude's Chrome extension wasn't connected, so no *headed* Chrome screenshot yet. Optional: open `http://localhost:3311` (`cd apps/web && pnpm start -p 3311`) in Chrome with `chrome://flags/#enable-webmcp-testing` on, DevTools → Application → WebMCP, screenshot.
4. Kill-rule watch: if #1 can't happen by Fri 23:59 PT, PLAN §10 #1 applies — Chrome + Inspector becomes the primary demo browser and README says so. The Chrome half is already green, so the entry does not die on this.

## Decisions needed (Arav + Aarya; C keeps building either way)

**D1 — Pitch framing (outside reviewer, 2026-08-28):** "Forge as pitched loses the WebMCP-Leverage tiebreak — 'works where WebMCP isn't' reads as routing around the API." C's position: **accept the framing flip, reject the product rewrite.**
- The forge already *is* `registerTool` at runtime (dynamic tools, `toolchange`, `AbortController` lifecycle). The fix is wording + shot order, not code: lead with "every approved command becomes a `registerTool` call — counted on screen"; move the forge beat from 1:20 to the cold open; show DevTools' WebMCP panel filling up.
- The reviewer's literal version ("Rokan writes a site a WebMCP tool surface") has prior art from a sponsor-judge — Cloudflare's edge bridge adds tools to any site it fronts (RESEARCH §0) — plus MCP-B / polyfill, and walks into the four-judge DOM-driving kill-shot (PLAN §0.1). Novelty of that framing ≈ 4/10. Ours stays: human-gated shell + forged-from-doing + signed ledger.
- Concrete adds if you agree (≈ 0.5 h, Ay): "tools registered this session: N" (measured) in the Tools pane; a "Try as agent" button on the Forge card that calls the spec's own `executeTool` (string input — FIELD-NOTES #6).
- On "five ways you lose": #2 ("zero WebMCP experience") is false as of tonight — tools registered, enumerated, invoked in Chrome 152, measured. #3 is Gate D; per-user sessions fall out of one-WS-per-tab. #4 is exactly why kill rule #4 exists — the demo never depends on rokan-do. #5 is the verify discipline in CLAUDE.md.

**D2 — Aarya's questions 2–6 in ALIGNMENT.md** (product name, repo rename, Vercel owner + code redemption, Netlify/Render account + credits form before Sep 1 12:00 PT, Anthropic spend cap, Rokan STATUS.md launch note). Unanswered.

## Contract pings (for Aarya's Claude)

- `schemas.ts` v0 exists (commit `ba2eb64`). The row-1 sanitizer is `validateProposedCommand()` — import it, don't re-implement.
- Chrome 152 calls `execute(input)` with **no** `{signal}`; every `execute` handler must treat options as optional (`types.ts` already types it so). Chrome's `executeTool` wants a JSON **string** input. Details in FIELD-NOTES.
- `TerminalTools.tsx` and `page.tsx` are placeholders in your lane — replace freely; keep the registration shape in `register.ts`.
- Local run: `pnpm install` at root (pnpm 11 needs `allowBuilds` — already in `pnpm-workspace.yaml`), then `cd apps/web && pnpm dev`.

## Next (C, Sat 08-29 PT)

- 10:00 `packages/bridge` — node-pty + ws + token + cloudflared spawn (poll 1.1.1.1 before printing the link) + `protocol.ts` (`contract:`).
- 14:00 `redact.ts` + tests; `terminal_read_screen`, `terminal_status` wired.
- 18:00 `terminal_wait` on real PTY exit codes; `ledger.ts` + HMAC; bridge `ledger.jsonl`.
- 20:00 joint E2E from the deployed URL. 22:00 Gate B.

## Objections

- None from C yet. (D1 above is a recommendation on pitch framing, not an objection to a locked decision.)
