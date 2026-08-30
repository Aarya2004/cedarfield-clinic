# SUBMISSION.md — Devpost description (paste-ready; draft 2026-08-30, final on Sep 2 with the video link)

> Everything below the rule is the Devpost text, ready to paste. HTML comments are notes to us and
> must be stripped before pasting. Every number traces to the ledger in `docs/VIDEO-SCRIPT.md` §5.

**Project name:** Rokan Terminal
**Tagline:** Do it once. Now it's a tool. Now every agent can call it.
**Live URL:** https://rokan-terminal.vercel.app (open in ChatGPT desktop on GPT-5.6 Sol/Terra, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`)
<!-- TODO(Sep 2): the alias is live but Vercel has no git auto-deploy on this project — run
     `cd apps/web && vercel --prod --yes` and confirm the header reads "Site tools · 7" before submitting. -->
**Repo:** https://github.com/Aarya2004/webmcp-private (Apache-2.0)
**Video:** _TODO — unlisted YouTube URL, < 3:00. Shoot per `docs/VIDEO-SCRIPT.md`, paste here and in `README.md`._

---

## The one-line thesis

The future of the open web is every site callable by agents. **Sites that ship WebMCP get called
natively. Sites that don't get compiled by the people and agents who use them — and the compiled
version is retired when native arrives.** And what you and your agent compose across sites and your
own machine becomes a new tool of your own, in the web's format, callable by any agent, run only with
your approval.

Rokan Terminal is that idea with a substrate you can press Enter on: a terminal you and your agent
share, where a thing you did once becomes a live WebMCP tool. **Compile once; every replay after that
runs with the model out of the loop** — measured at 0 model calls and 28.9×–42.4× faster end to end
than two vanilla coding agents answering the same live question.

## Why WebMCP fits (and what we did with it)

A terminal already has a human on one side. WebMCP is the first standard that puts the agent on the
*same page*, in the *same session* — not in a sandbox on someone else's machine. So the page's tools
become the trust boundary, made explicit:

- **Tools are born at runtime.** `forge_create` opens a card; when the human approves it, the page
  calls `document.modelContext.registerTool()` for `forged_<name>` with its own `AbortSignal`, and the
  agent's tool list changes while the page is open (`toolchange`). A judge can watch a tool appear in
  ChatGPT's Site tools list — or in DevTools → Application → WebMCP — seconds after the human did
  something once. Seven fixed tools plus up to five forged (7 + 5 = 12; the cap is **our own
  discipline** against picker noise, not vendor guidance — no vendor documents one), each with
  `readOnlyHint` / `untrustedContentHint` derived from a human-approved `kind`, writes prefixed
  `CONSEQUENTIAL:`, `additionalProperties:false` schemas with examples, outputs ≤ 1.5 K chars.
  <!-- TODO: ChatGPT-desktop footage of Site tools 7 → 8 is unmeasured as of 2026-08-30 (blocked on a
  teammate's machine). Until it exists, claim the registration in Chrome's WebMCP panel only. -->
- **Tools act, resources inform, prompts orchestrate — and only tools are WebMCP.** The browser WebMCP
  standard is tools-only, so the page exposes nothing else and claims nothing else. Our **MCP stdio
  relay** additionally serves three resources and three prompts; that surface exists on the relay
  alone. `terminal://history` and `forge://tools` are read live by relaying to the page tools
  `terminal_history` / `forge_list`, so Share-screen gating and redaction apply unchanged;
  `terminal://ledger` serves the bridge's HMAC-chained JSONL byte-identical to what was signed. The
  prompts (`debug-last-failure`, `forge-from-history`, `session-report`) are instruction templates that
  execute nothing. All read-only.
- **Native first, compiled only where there is nothing to call.** Before it ever plans against the DOM,
  our engine lists a site's **own** WebMCP tools over the CDP `WebMCP` domain and calls them. Measured:
  `allbirds.com` declares **10** native tools; we invoke `search_catalog` directly in **469 ms** of tool
  time (1 300 ms wall) at **0 model calls**, with a real catalog result and no re-registration
  (`docs/evidence/probe/2026-08-30-native-invoke-local-image.jsonl`). Read-only by construction: a
  native tool auto-fires only when it is provably a read; anything consequential still goes through
  ghost-type and a human Enter (`docs/SECURITY.md` §8).
- **Second protocol, same tools.** `node packages/bridge/bin/rokan-terminal.js mcp` serves the identical
  tool list over MCP stdio to Claude Code / Cursor / Codex CLI — measured with Codex CLI as the agent:
  it proposed, forged a tool, and called that tool from a *new* session, each step gated by the human's
  Enter (FIELD-NOTES C1–C6). The page stays the single source of truth; the MCP process can never type.
  One library, two protocols.
  <!-- TODO: `npx rokan-terminal` is not published (npm 404, checked 2026-08-30). Either publish before
  Sep 2 and switch these to `npx rokan-terminal mcp`, or leave the `node …/bin` form everywhere. -->
- **Nothing a tool does executes.** `terminal_propose` and every `forged_*` tool ghost-type; the human's
  Enter runs the command. That threads a consumer's per-call safety review honestly: the tools are
  inert by construction, not by description.
- **Measured, not claimed.** `docs/FIELD-NOTES.md` records what Chrome 152's WebMCP actually does (no
  `{signal}` passed to `execute`, `executeTool` wants a JSON string, `toolsRemoved` on abort, decorations
  need `allowProposedApi`) — found by our own headless harness driving the CDP `WebMCP` domain with no
  consumer in the loop. **24 cases** (9 on the prompt line, 15 on a real PTY, 4 of those judge-only —
  9/9 and 11/11 green in builder mode, and **15/15 with 0 retries in 96 s** against the live judge
  container: `docs/evidence/sandbox/2026-08-29-judge-suite-15-of-15.txt`), run on every commit.

## The better experience

For the human: a co-pilot that *proposes* instead of acting, reads only what you share (secrets
redacted before anything leaves the tab), and turns the commands you repeat into tools. For the agent:
typed tools instead of guessing at a screen, `terminal_wait` to block on the human instead of polling,
and real exit codes measured by the shell.

Every row in the ledger and the run feed carries **provenance**: `machine` (your shell, your Enter),
`⚙ native` (the site's own WebMCP tool, named), `⚡ compiled` (a replayed operation — retired when the
site ships native tools), `planned` (the model planned this run; the next replays it), and `refused`
(the page drifted and we refused rather than guess). Tools rows say **who forged it** — you or the
agent — and what its last run cost. Tools you keep survive a reload: they
are stored per-viewer with their content hash and **restored only through the same approval card**, so
a hash mismatch re-opens that card and never auto-registers.

## What humans and agents accomplish together that was difficult or impossible before

The agent gets hands on a real shell without ever getting execution. The human gets to *teach by
doing*: anything done once can be forged into a tool the agent calls next time — including `rokan do`,
our browsing engine, which acts behind the user's own logins and replays its learned operations at zero
model calls (the ledger row shows `calls:0 ⚡`, parsed from the engine's own result line). Neither side
could grow that library alone, and the library is portable: it is WebMCP. A tool you compose today is
callable tomorrow from ChatGPT, Codex CLI and Claude Code, against the same content hash.

## Potential impact — the number, measured (not claimed)

The audience is every developer whose agent redoes the web from scratch each session and whose learned
workflows do not survive a reload or transfer between vendors. The claim is falsifiable and we measured
it live (`docs/measurements/2026-08-29-ab.md`, harness in `evals/ab/`): same questions, headless, three
arms — Rokan, Codex CLI, Claude Code.

Every arm is timed the same way — **wall clock around the whole process** — so the multipliers are
wall-vs-wall. Rokan's own internal clock is shown beside it, never in place of it.

| task (live web) | Rokan warm ×5 (internal / **wall**) | Codex CLI ×3 (wall) | Claude Code ×3 (wall) | Rokan advantage (wall) |
| --- | --- | --- | --- | --- |
| "is status.python.org all systems operational" | **0 model calls** · 79 ms / **546 ms** | 1 turn · 23 164 ms | 3 turns · 15 780 ms | **42.4× / 28.9×** |
| "how much are Wool Runners at allbirds.com" (builder mode) | **0 model calls** · 1 451 ms / **2 983 ms** | 1 turn · 10 059 ms | 22 turns · 77 421 ms | **3.3× / 25.9×** |

The point is not "our web fetch beats theirs." It is that **the agents re-enter the model on every run
and Rokan does not** — a compiled operation replays with the model out of the loop. On the compiled task
that is **28.9×–42.4× faster in wall clock at zero model calls** (23 164 ÷ 546 = 42.4; 15 780 ÷ 546 =
28.9, truncated), and the agent pays that cost again every single time. N = 5 warm / N = 3 agents;
small, so we report min/max in `docs/measurements/2026-08-29-ab.md` and never round up.

It also works on pages nobody seeded. In the judge sandbox, an unseeded PostgreSQL docs page answers on
the first run at `planned · 9 019 ms` (one model call) and replays at `⚡ compiled · 783 ms · 0 calls`
(`docs/evidence/stranger/2026-08-29-prod-open-net-cold-then-replay.jpg`).

Honest distinctions we also state on camera: the compiled replay is **browserless**; the native replay
re-drives a live browser to call the site's own WebMCP tool, which is why it costs 2 983 ms; and against
Codex on that native task the margin is only **3.3×** — we say so rather than lean on it.

The other half is trust. When a page changes, a cached scrape a coding agent wrote keeps running and
**returns a confident wrong number** — we reproduce this live: after a storefront "redesign" the stale
selector reads `$75` (a shipping line) as the price when the truth is `$140`. Rokan's `recheck` replays
every learned operation with planning forbidden and **retires the one that no longer verifies** —
verified, or refused. Measured live, twice (`docs/evidence/ab/drift-run-{1,2}.txt`): Rokan compiles v1
in one model call (`Wander Boot $98`, verified, 2 483 ms); after the redesign `recheck` marks the
operation **DEAD · drift_detected** and retires it, and the re-ask **refuses** — it does not return `$98`,
and it does not guess `$140` either. Refusal, not recovery — and that is the claim we make. A tool that
lies quietly is worse than no tool; ours refuses out loud.

## Implementation

Next.js 15 on Vercel; xterm.js 6 with ghost text drawn as an overlay (never through the PTY parser); a
Node bridge (`node-pty` + WebSocket + Cloudflare quick tunnel + 128-bit pairing token in the URL
fragment, stripped after parse) with zsh shell integration (OSC 133/7) so `running`, exit codes and
durations are **measured, not inferred** (bash/sh without integration resolve honestly as
`measured:false`). Judge mode is the same bridge inside a Cloudflare Sandbox container: non-root,
HMAC-signed session ids, ephemeral disk, **no API key or secret in the container** — the model proxy
lives in the Worker with a reserve-before-forward budget — plus headless Chromium so a stranger can
drive any site on the open web there; per-IP rate limits and a 30-minute TTL, caps table in
`docs/SECURITY.md` §9. An append-only ledger HMAC-chained in the tab and countersigned by the bridge; a
single redaction choke point; forged tools carry a content hash, and a changed hash requires a new
approval — the "bind tool identity" mitigation from arXiv 2606.06387. Every finding from the adversarial
review passes logged in `docs/PROGRESS.md` (two independent model reviewers plus Codex as a third) was
fixed with a regression test in the same commit.

WebMCP tool descriptions are hints to a cooperative agent, never a security boundary. **Our boundary is
the keyboard.**

## Facts to keep straight

WebMCP is authored by Microsoft + Google in the W3C WebML CG; Alex Nahas (MCP-B) is credited for
implementation experience; Shopify is an origin-trial participant. We do not claim "the strongest
reading of criterion #1" — we show registrations happening and let the judge decide. Two limits we
state plainly: ChatGPT desktop's Site-tools refresh on a runtime registration is **unverified** by us
(measured in Chrome 152 only), and the drift beat ends in a refusal, not a recovery.
