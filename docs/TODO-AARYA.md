# TODO — Aarya's lane (kept current by Aarya's Claude; claim overlaps in PROGRESS before starting)

> **Tracked as a wayfinder map on GitHub Issues: [Map: Frontend redesign + full-surface WebMCP #1](https://github.com/Aarya2004/webmcp-private/issues/1)** — tickets #2–#9, native blocked-by edges render the frontier in the issues UI. This file stays as the low-res mirror.

Decisions behind this list: Aarya 2026-08-29/30 chat (grill round 1) — full redesign scope now
("don't worry about the freeze"), push to main continuously, terminal-first dark workspace,
light/dark user toggle (terminal canvas always dark), history as browser-native blocks (explicitly
NOT a Warp copy), Aarya's Claude also owns the MCP-relay resources/prompts work with a no-clash
rule vs C/Arav.

## Active (this weekend)
- [ ] **Frontend redesign** — terminal-first dark workspace; light/dark toggle on the chrome;
      hero collapses after first interaction. frontend-design skill drives the aesthetic.
- [ ] **Run feed (history blocks)** — per-command records for human-typed + agent commands
      (extend the existing client OSC-133 state machine in `lib/terminal/adapter.ts`; add client
      OSC-7331 parsing — markers already reach the tab verbatim). Format: round-2 decision.
- [ ] **Artifacts pane** — round-2 decision on v1 scope (JSON/table/markdown/URL detection from
      output vs. design-the-slot-only). v2 (files/images via a bridge read frame) needs a
      `contract:` ping — post-freeze.
- [ ] **`terminal_history` WebMCP tool** — Share-screen-gated, through `redactForAgent`, block
      records not raw buffer. Takes the visible-tool budget to exactly 12 (6 fixed + 5 forged + 1).
      Overlaps `register.ts` (C's wiring) — ALIGNMENT ping + PROGRESS claim before touching.
- [ ] **MCP relay resources + prompts** (`packages/bridge`) — official SDK low-level `Server`,
      add `setRequestHandler` for ListResources/ReadResource/ListPrompts/GetPrompt in a new file
      (`mcp-resources.js`) to avoid clashing with C in `mcp.js`. Catalog: round-2 decision.
      Honest framing everywhere: WebMCP standard = tools only; resources/prompts are the MCP-stdio
      half (Codex / Claude Code), never claimed as browser WebMCP.

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
