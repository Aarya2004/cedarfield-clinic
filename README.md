# Rokan Terminal

**Do it once. Now it's a tool. Now every agent can call it.**

A web terminal where anything you and your agent do once becomes a live WebMCP tool — registered at
runtime with `document.modelContext.registerTool()`, absent at page load, kept after it, callable by
any agent. Sites that already ship WebMCP get called **natively**. Sites that don't get **compiled**
by the people who use them — and the compiled version is retired when the site ships its own.
Compile once; every replay after that runs with **the model out of the loop**.

**Live:** [`https://rokan-terminal.vercel.app`](https://rokan-terminal.vercel.app) — open it in
**ChatGPT desktop (GPT-5.6 Sol/Terra)** or **Chrome 149+** with `chrome://flags/#enable-webmcp-testing`.
<!-- TODO(Sep 2): confirm the alias serves HEAD — Vercel has no git auto-deploy on this project;
     run `cd apps/web && vercel --prod --yes` and verify the header reads "Site tools · 7". -->
**Video:** _TODO — unlisted YouTube link, ≤ 3:00, paste here and in `docs/SUBMISSION.md` on Sep 2._
Entry for the **OpenAI WebMCP Challenge** (Devpost, deadline 2026-09-03 13:00 PT). Apache-2.0.

**The measured claim.** A compiled operation replays at **0 model calls in 546 ms wall-clock** on a
live status question where Codex CLI takes **23 164 ms** and Claude Code **15 780 ms** — **28.9×–42.4×**,
wall clock against wall clock, and the agents pay that cost *every* run because they re-plan every
run (`docs/measurements/2026-08-29-ab.md`, raw output in `docs/evidence/ab/`; N = 5 warm / N = 3 agents).

*Mechanism, stated once: no tool here ever executes. Every tool ghost-types at your prompt and your
Enter runs it.*

![Rokan Terminal — forge a tool, invoke it, Enter runs it; frames from the automated real-PTY dry-run](docs/demo.gif)

## For judges — 60 seconds

1. Open the live URL above in ChatGPT desktop (Luna has site tools disabled) or in Chrome 149+ with
   the WebMCP flag (DevTools → Application → WebMCP shows every registration and call).
2. Click **“Try it now — judge sandbox”** — a throttled 30-minute non-root Linux container on
   Cloudflare, nothing to install, first boot takes a few seconds (cold start measured 4.0–6.5 s on
   the pre-Chromium image, `docs/FIELD-NOTES.md` J2/J11). Or clone this repo and run
   `node packages/bridge/bin/rokan-terminal.js` (Node 20+) on your own machine and open the link it
   prints. <!-- TODO: `npx rokan-terminal` is not on npm yet (checked 2026-08-30, 404). Publish before
   submitting or leave every invocation as the `node …/bin/rokan-terminal.js` form. -->
   A `--no-tunnel` `ws://127.0.0.1` link only opens from `http://localhost:3000`, never from the
   https page — browsers block mixed content, and the page says so.
3. Ask the agent: **“propose `ls`”** → ghost text appears at your prompt → press **Enter**.
4. Select that line → **Forge this** → Approve → the site-tools list gains `forged_<name>` with no
   reload (measured in Chrome 152; in ChatGPT desktop the Site-tools refresh is **unverified** —
   PLAN §0.9 — reload if it does not) → ask the agent to call it → your Enter runs it → the ledger
   row shows the measured `exit · ms` and a provenance chip.
   <!-- TODO: ChatGPT-desktop evidence (Site tools 7 → 8 inside the consumer) is unmeasured as of
   2026-08-30 and blocked on Arav. Until a screenshot lands in docs/evidence/, this README claims
   the registration only in Chrome's WebMCP panel and in our own header counter. -->

Add `?tour=1` for a three-step guide that verifies each step against real state.

## Why it matters, measured

**Compile once, replay free.** In the judge sandbox, a page nobody seeded
(`www.postgresql.org/docs/current/runtime-config-connection.html`) answers on the first run at
`planned · 9 019 ms`, one model call; the identical question then replays at
`⚡ compiled · 783 ms · 0 calls` — `docs/evidence/stranger/2026-08-29-prod-open-net-cold-then-replay.jpg`.
Against vanilla coding agents on a live status question that is **546 ms wall / 0 calls** vs Codex CLI
**23 164 ms** and Claude Code **15 780 ms** = **28.9×–42.4×** (23 164 ÷ 546 = 42.4; 15 780 ÷ 546 = 28.9,
truncated). `rokan do`'s own internal clock for that replay is 79 ms; we quote the **546 ms wall**
because that is how the agent arms are timed, so the comparison is like with like. Full table, every
min/max and the arithmetic: `docs/measurements/2026-08-29-ab.md`; three-arm harness in `evals/ab/`.

**Native first, compiled only where there is nothing to call.** `allbirds.com` declares **10** of its
own WebMCP tools; we list them over the CDP `WebMCP` domain and invoke `search_catalog` directly —
**469 ms** of tool time inside a 1 300 ms wall run, **0 model calls**, real catalog result, no DOM and
no re-registration (`docs/evidence/probe/2026-08-30-native-invoke-local-image.jsonl`; the live
`standard-3` sandbox probe lists the same 10 tools, `…-live-sandbox-standard-3.jsonl`). A native
replay costs **2 983 ms wall** in the A/B — slower than a compiled replay, because it re-drives a live
browser; that is the honest price of native and we print it.

**Verified, or refused.** When a page changes, the cached scrape a coding agent wrote keeps running and
returns a confident wrong number. We reproduce it live: after a storefront redesign the stale selector
reads `$75` (a shipping line) as the price when the truth is `$140`. Rokan's `recheck` replays every
learned operation with planning forbidden, marks the one that no longer verifies
`DEAD · drift_detected`, and the re-ask **refuses** — no stale `$98`, no guessed `$140`. Measured twice:
`docs/evidence/ab/drift-run-1.txt` and `-2.txt`. Refusal, not recovery — it does not find the new price.

## What is on the page (seven fixed tools + up to five forged)

Seven fixed plus at most five forged = 12 visible tools. The cap is **our own discipline** against
picker noise; no vendor documents one.

| tool | what it does | never |
| --- | --- | --- |
| `terminal_propose` | ghost-types one command at your prompt | executes |
| `terminal_read_screen` | last N lines, **only if you turned on Share screen**, secrets `[redacted]` | leaks a key |
| `terminal_status` | cwd (if shared), running, last exit code + ms **measured by the shell** | guesses |
| `terminal_wait` | blocks until your Enter/Esc, returns the real exit code and redacted tail | runs anything |
| `terminal_history` | the runs recorded this session, oldest first — command, exit code, ms, cwd, who started it (human / agent / forged) and a redacted tail; **only if you turned on Share screen** (`readOnlyHint`, `untrustedContentHint`) | executes or proposes |
| `forge_create` | opens a card you edit and approve → `forged_<name>` is registered live | registers without you |
| `forge_list` | every forged tool: content hash, pin state, **who forged it** (you or the agent), what its last run cost, and whether it is kept | — |
| `forged_<name>` | substitutes params (shell-safe), ghost-types each step; each step needs your Enter | executes |

**Provenance is on every row.** Ledger rows and the run feed carry a chip that says how the answer was
produced: `machine` (your shell, your Enter) · `⚙ native` (the site's own WebMCP tool, with site and
tool name) · `⚡ compiled` (a replayed operation, retired when the site ships native tools) · `planned`
(the model planned this run; the next one replays it) · `refused` (the page drifted from the compiled
operation and Rokan refused instead of guessing).

**Kept tools.** Forged tools you keep are stored per-viewer in `localStorage` (`rokan.kept.v1`, capped)
and their content hash is recomputed on load. They are kept across reloads
and restored only through the same approval card — a hash mismatch re-opens that card and never
auto-registers. On load, a quiet card in the right rail offers "N kept tools — restore?"; Restore
walks each through the normal approval path (a `restored` row lands in the countersigned ledger),
Dismiss hides the card and keeps the store.

## Second protocol, same tools — and what WebMCP does *not* do

`node packages/bridge/bin/rokan-terminal.js mcp` serves the identical tool list over **MCP stdio** to
Claude Code, Cursor and **Codex CLI (measured end to end — FIELD-NOTES C1–C6: Codex proposes, forges,
and calls its own forged tool from a new session; Codex reads MCP tool lists once per session)**. The
page stays the single source of truth; the MCP process can never type.

Tools act, resources inform, prompts orchestrate — but **only tools are WebMCP**. The browser WebMCP
standard is tools-only, so the page exposes nothing else and claims nothing else. The **stdio relay**
additionally offers three resources and three prompts, and that surface exists on the relay alone:
`terminal://history` and `forge://tools` are read live by relaying to the page tools `terminal_history`
/ `forge_list`, so Share-screen gating and redaction apply unchanged (with sharing off you get the
page's `{"shared":false}` back, verbatim); `terminal://ledger` serves the bridge's own HMAC-chained
JSONL for the current session, last 500 rows, byte-identical to what was signed. The prompts
(`debug-last-failure`, `forge-from-history`, `session-report`) are instruction templates that execute
nothing and each state that every command is a proposal your Enter runs. All of it read-only.

## Security in one paragraph

WebMCP tool descriptions are hints to a cooperative agent, never a security boundary. **Our boundary is
the keyboard.** Control/bidi characters are rejected so what you see is what would run; hard-blocked
patterns need Enter twice; the screen leaves the tab only when you share it and only after a single
redaction choke point; a site's own tool output is untrusted content, redacted and capped before the
agent sees it; forged tools carry a content hash (a changed hash needs a new approval) and one
`AbortSignal` each; the ledger is HMAC-chained in the tab and countersigned by the bridge. The judge
container is non-root, holds no API key (the model proxy lives in the Worker), and is TTL- and
rate-capped. Full model with tests: [`docs/SECURITY.md`](docs/SECURITY.md) (§8 native consumption, §9
the caps table).

## Run it yourself

```
pnpm install
pnpm gate                  # typecheck · lint · web unit suite · bridge check + real-PTY smoke · sandbox check · headless WebMCP cases
cd apps/web && pnpm dev    # http://localhost:3000
node packages/bridge/bin/rokan-terminal.js --no-tunnel --app http://localhost:3000   # prints the pairing link
```

Verify a ledger export from the page against your bridge:
`node packages/bridge/bin/rokan-terminal.js verify rokan-ledger-<session>.json`.

Headless WebMCP evals (Chrome 152 via the CDP `WebMCP` domain, no consumer needed):
`node evals/run-all.mjs` (prompt line) · `node evals/run-all.mjs --bridge` (real PTY).
The full judge-mode suite last ran **15/15, 0 retries, 96 s** against the live container
(`docs/evidence/sandbox/2026-08-29-judge-suite-15-of-15.txt`).

## Repo

- `apps/web` — Next.js 15 client: tools, xterm pane with ghost text, forge card, run feed, ledger.
- `packages/bridge` — the terminal bridge: node-pty + WebSocket + Cloudflare quick tunnel + pairing
  token; `mcp` subcommand for the stdio relay.
- `infra/sandbox` — judge mode: Cloudflare Worker + Sandbox container running the same bridge, with
  headless Chromium and a capped, sid-bound model proxy (no key in the container).
- `evals/` — headless harness and **24** cases in `evals/cases/` (9 on the prompt line, 15 on a real
  PTY — 4 of those judge-only, so a builder-mode `--bridge` run executes 11 and skips 4; the terminal
  cases also run against the live judge sandbox). `evals/ab/` — the three-arm impact harness and the
  drift beat.
- `docs/` — `PLAN.md`, `COMPOSE-PLAN.md`, `FORGE-PLAN.md`, `TERMINAL-PLAN.md`, `SANDBOX-PLAN.md`,
  `SECURITY.md`, `FIELD-NOTES.md` (measured consumer behaviour), `measurements/` (the A/B),
  `evidence/` (raw output and screenshots), `PROGRESS.md` (what is green right now).

Every millisecond and call count shown on screen is measured by the code that shows it.
