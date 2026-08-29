# SUBMISSION.md — Devpost text (draft 2026-08-29; final on Sep 2 with the live URL + video link)

**Project name:** Rokan Terminal
**Tagline:** Do it once. Now it's a tool.
**Live URL:** https://rokan-terminal.vercel.app (test in ChatGPT desktop on GPT-5.6 Sol/Terra, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`)
**Repo:** https://github.com/Aarya2004/webmcp-private (Apache-2.0) · **Video:** <YouTube URL, < 3:00>

## Why WebMCP fits (and what we did with it)

A terminal already has a human on one side. WebMCP is the first standard that puts the agent on
the *same page*, in the *same session* — not in a sandbox on someone else's machine. So we built a
terminal you and your agent share, where the page's tools are the trust boundary made explicit:

- **Tools are born at runtime.** `forge_create` opens a card; when the human approves it, the page
  calls `document.modelContext.registerTool()` for `forged_<name>` with its own `AbortSignal`, and
  the agent's tool list changes while the page is open (`toolchange`). A judge can watch a tool
  appear in ChatGPT's Site tools list — or in DevTools → Application → WebMCP — seconds after the
  human did something once. Six fixed tools plus up to five forged (the ≤ 12 picker budget), each
  with `readOnlyHint` / `untrustedContentHint` derived from a human-approved `kind`, writes prefixed
  `CONSEQUENTIAL:`, `additionalProperties:false` schemas with examples, outputs ≤ 1.5 K chars.
- **Nothing a tool does executes.** `terminal_propose` and every `forged_*` tool ghost-type; the
  human's Enter runs the command. That threads the consumer's per-call safety review honestly: the
  tools are inert by construction, not by description.
- **Second protocol, same tools.** `npx rokan-terminal mcp` **[Sep 2: only if published to npm — else `node packages/bridge/bin/rokan-terminal.js mcp`]** serves the identical tool list over MCP — measured with Codex CLI as the agent: it proposed, forged a tool, and called it from a new session, each step gated by the human's Enter (FIELD-NOTES C1–C6) —
  stdio to Claude Code / Cursor / Codex CLI; the page stays the single source of truth and the MCP
  process can never type. One library, two protocols.
- **Measured, not claimed.** `docs/FIELD-NOTES.md` records what Chrome 152's WebMCP actually does
  (no `{signal}` passed to `execute`, `executeTool` wants a JSON string, `toolsRemoved` on abort,
  decorations need `allowProposedApi`) — measured by our headless harness that drives the CDP
  `WebMCP` domain with no consumer in the loop. 15 cases, 300+ steps (7 on the prompt line, 8 on a real PTY), run on every commit.

## The better experience

For the human: a co-pilot that *proposes* instead of acting, reads only what you share (with
secrets redacted before anything leaves the tab), and turns the commands you repeat into buttons
and tools. For the agent: typed tools instead of guessing at a screen, `terminal_wait` to block on
the human instead of polling, and real exit codes measured by the shell.

## What humans and agents accomplish together that was difficult or impossible before

The agent gets hands on a real shell without ever getting execution. The human gets to *teach by
doing*: anything done once can be forged into a tool the agent calls next time — including
`rokan do`, our browsing engine, which acts behind the user's own logins and replays its seeded
operations at zero model calls — the ledger row shows `calls:0 ⚡` parsed from rokan-do's own result
line (measured 312 ms on the demo machine). Neither side could grow that library alone, and the
library is portable: it is WebMCP.

## Potential impact — the number, measured (not claimed)

The audience is every developer whose agent redoes the web from scratch each session and whose
learned workflows do not survive a reload or transfer between vendors. The claim is falsifiable and
we measured it live (`docs/measurements/2026-08-30-ab.md`, harness in `evals/ab/`), same questions,
headless, three arms — Rokan, Codex CLI, Claude Code:

| task (live web) | Rokan (warm) | Codex CLI | Claude Code |
| --- | --- | --- | --- |
| "is status.python.org all systems operational" | **0 model calls · 79 ms** | 1 turn · ~23 s | 3 turns · ~16 s |
| "how much are Wool Runners at allbirds.com" (builder mode) | **0 model calls · ~1.45 s** | 1 turn · ~10 s | 22 turns · ~77 s |

The point is not "our web fetch beats theirs." It is that **the agents re-enter the model on every
run and Rokan does not** — a compiled operation replays with the model out of the loop. On the
compiled task that is ~200–290× faster at zero model calls, and the agent pays that cost again every
single time. N = 5 warm / N = 3 agents; small, so we report variance and never round up. Honest
distinctions we state on camera: the compiled replay (79 ms) is browserless; the native replay
(~1.45 s) re-drives a live browser to call the site's own WebMCP tool and is builder-mode only — the
judge sandbox has no model or browser, so there it replays compiled operations and forged tools, not
native consumption.

The other half is trust. When a page changes, a cached scrape a coding agent wrote keeps running and
**returns a confident wrong number** — we reproduce this live: after a storefront "redesign" the
stale selector reads `$75` (a shipping line) as the price when the truth is `$140`. Rokan's
`recheck` replays every learned operation with planning forbidden and **retires the one that no
longer verifies** — verified, or refused. A tool that lies quietly is worse than no tool; ours
refuses out loud.

## Implementation

Next.js 15 on Vercel; xterm.js 6 with ghost text drawn as an overlay (never through the PTY
parser); a Node bridge (`node-pty` + WebSocket + Cloudflare quick tunnel + 128-bit pairing token in
the URL fragment) with zsh shell integration (OSC 133/7) so `running`, exit codes and durations
are measured, not inferred (bash/sh without integration resolve honestly as `measured:false`); judge mode = the same bridge inside a Cloudflare Sandbox container
(non-root, HMAC-signed session ids, no API key or secret in the container, ephemeral disk, 3 sessions/IP/10 min, 30-min TTL) — deployed and driven end to end by the headless harness (8/8 real-PTY cases against the live container, cold start ≈ 5 s); an append-only ledger HMAC-chained
in the tab and countersigned by the bridge; a single redaction choke point; forged tools carry a
content hash (a changed hash requires a new approval — the "bind tool identity" mitigation from
arXiv 2606.06387). Four adversarial review passes by two independent reviewers (54 findings) — every one fixed with a regression test in the same commit.

WebMCP tool descriptions are hints to a cooperative agent, never a security boundary. **Our
boundary is the keyboard.**

## Facts to keep straight
WebMCP is authored by Microsoft + Google in the W3C WebML CG; Alex Nahas (MCP-B) is credited for
implementation experience; Shopify is an origin-trial participant. We do not claim "the strongest
reading of criterion #1" — we show registrations happening and let the judge decide.
