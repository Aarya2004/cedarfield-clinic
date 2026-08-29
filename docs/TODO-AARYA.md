# TODO — Aarya's lane (kept current by Aarya's Claude; claim overlaps in PROGRESS before starting)

> **Tracked as a wayfinder map on GitHub Issues: [Map: Frontend redesign + full-surface WebMCP #1](https://github.com/Aarya2004/webmcp-private/issues/1)** — tickets #2–#9, native blocked-by edges render the frontier in the issues UI. This file stays as the low-res mirror.

Decisions behind this list: Aarya 2026-08-29/30 chat (grill round 1) — full redesign scope now
("don't worry about the freeze"), push to main continuously, terminal-first dark workspace,
light/dark user toggle (terminal canvas always dark), history as browser-native blocks (explicitly
NOT a Warp copy), Aarya's Claude also owns the MCP-relay resources/prompts work with a no-clash
rule vs C/Arav.

## Done (map executed 2026-08-29, commits 13ee8af…6823e5d — see issues #2–#7, #9, all closed)
- [x] Theme foundation (forge-dark default + light brand toggle; first paint dark for everyone).
- [x] Terminal-first layout (main column + hairline rail; prompt line reads as terminal canvas).
- [x] Run feed (human+agent+forged records, OSC-7331 client parse, filters/actions).
- [x] Artifacts pane v1 (JSON/CSV/markdown/URLs/rokan cards) + HTML artifacts in an inert sandbox (CSP unchanged, proven).
- [x] `terminal_history` — 7th fixed tool, contract: commit, budget now exactly 12.
- [x] MCP relay resources (history/forge relayed, ledger raw-bytes) + 3 prompts.
Gate at close: web **183/183** · bridge **11/11** · evals **9/9**. NOT yet deployed — needs `vercel --prod` from the logged-in machine.

## Awaiting
- [ ] **Aarya's design review** — issue #8, staged with evidence. Go/adjust.
- [ ] **rokan_speed/site/tools_used flip** in Panes.tsx + RunFeed.tsx when C's contract fields land (C pings; agreed in ALIGNMENT).
- [ ] **Birth-pulse signature** (DESIGN-BRIEF) — after the #8 verdict.

## Active (this weekend)
## Blocked
- [ ] **RestoreCard.tsx** — waits on C's `kept.ts` (COMPOSE-PLAN §2.2.5). Claimed in PROGRESS.
- [ ] **Tools-row `forged by` / `calls_last` / `kept`** — waits on C's `forge_list` contract
      additions. Claimed in PROGRESS.
- [ ] **Any-machine beat staging** — waits on Arav's target box / deploy-target decision.

## Post-submission
- [ ] MCP-B polyfill on the page (second registration path; Nahas-adjacent experiment).
- [ ] Session sharing (DO-per-session design sketch exists in chat 08-29) — roadmap only.
- [ ] Mobile first-paint with a demo GIF instead of the "too narrow" card.

## Facts that gate this list (verified 2026-08-29/30)
- WebMCP standard (`document.modelContext`) is tools-only (WEBMCP-RESEARCH:14); webmcp.dev
  documents MCP-B (polyfill, extension path).
- Client already segments commands (OSC 133 A/C/D + quiet fallback) but discards human-typed
  records; bridge splits data frames on marker boundaries; no serialize addon; xterm scrollback
  5000; proposal results keep a 200-line redacted-at-read tail.
- Bridge MCP server: official SDK 1.30.0, `Server` (low-level), capabilities `tools` only today.
