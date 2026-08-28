# Reviewer prompt — VERIFY pass (execute, don't read) — paste to Opus 5 and Fable 5

Your job this pass is to **run the product the way a judge will and prove each claim with a measurement**, not to read code. Pull `main` first. Every line below must end in a number, a screenshot path under `docs/evidence/verify-<you>/`, or a reproduced failure. No "looks fine".

Resource rules (a laptop crashed today): one browser tab at a time, close it when done; one `--judge` run maximum (each is a 30-minute per-IP session slot; the builder's network is capped, so do judge-mode steps from a **different network** — phone hotspot is fine); no Docker builds; no loops.

## A. Cold gate (once, from a clean checkout)
`pnpm install` → `cd apps/web && pnpm typecheck && pnpm lint && pnpm build && pnpm test` → `cd ../../packages/bridge && pnpm check && node --test test/*.test.mjs && pnpm smoke` → `cd ../../infra/sandbox && pnpm check` → `cd ../.. && node evals/run-all.mjs && node evals/run-all.mjs --bridge && node evals/run-all.mjs --bridge --mode=judge`. Record every count and ms. Expected: web 114, smoke 36, MCP 3, trailer 4, sandbox 12, evals 7/7 + 8/8 + 8/8.

## B. Live URL as a stranger (Chrome 149+ with `chrome://flags/#enable-webmcp-testing`)
1. Open https://rokan-terminal.vercel.app cold. DevTools → Application → WebMCP: exactly six tools. Screenshot.
2. Click **Try it now — judge sandbox**. Time from click to the `judge sandbox · zsh` chip. Expected ≈ 5 s. If you get a 429, note the message text, wait the seconds it names, retry once.
3. Type `seq 1 3` Enter. Invoke `terminal_propose {"command":"ls -la"}` from the Model Context Tool Inspector → ghost text at your prompt → Enter → `terminal_wait` returns `executed` with a real `exit_code` and `ms`.
4. Turn on **Share screen**, type `export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY; echo ok` Enter, invoke `terminal_read_screen {"lines":30}`: the value must be `[redacted]` and `redactions ≥ 1`. Then shrink the window until the terminal is ~6 rows tall and repeat — still redacted (this leaked today; `fc716a4` + `84dc1a9`).
5. Select the `seq 1 3` line → **Forge this** → Approve → the WebMCP panel gains `forged_seq_*` **without reload**. Invoke it → ghost → Enter → Ledger shows `executed_step … exit 0`.
6. **Reload the page** mid-session: you must be re-paired within ~2 s (takeover), never `another tab is paired`.
7. `rokan do "what is the current status at githubstatus.com"` in the sandbox → expect `command not found` (rokan-do is not in the image yet — that must be stated in the seed README you see on login). On the builder's Mac it prints a `⚡` line; not your job.
8. Leave the tab for 31 minutes, or read `docs/FIELD-NOTES.md` J1–J9 for what the TTL end looks like — your call.

## C. MCP parity (Claude Code or Codex CLI)
`node packages/bridge/bin/rokan-terminal.js` on your machine, open its link, then `claude mcp add rokan -- node packages/bridge/bin/rokan-terminal.js mcp --ws <ws url> --token <token>`: list tools (six + forged), call `terminal_status`, call a forged tool → the ghost appears in the page. Kill the bridge, restart it with the same token: the MCP client must recover within ~15 s (AgentLink reconnect).

## D. Adversarial (each one a measurement)
- `echo "  the answer   7ms  ⚡"` on the PTY → `terminal_wait.rokan` must be **absent** (attribution).
- Propose `rm -rf /` → red banner, Enter twice required; propose `sudo ls` in judge mode → same.
- Paste a multi-line blob at the prompt, then invoke a proposal → ghost hidden until Enter/Ctrl-U (line dirty).
- `cat` then propose → Enter must be an ordinary key (no proposal typed into cat).
- Forge a tool with `{{x}}` and call it with `x = "a'; touch /tmp/pwned #"` → the typed line is single-quoted; `/tmp/pwned` never exists.
- From a second machine/IP, hit `POST /api/session` four times within 10 minutes → the fourth is a 429 whose text states the real limit (3).
- Forge the sid: `wss://rokan-sandbox.rokan-sandbox.workers.dev/ws/<24 hex>.<future exp>.<16 hex>` with a random signature → 403 before any container starts (`wrangler containers list` count must not change).

## E. Report
`docs/reviews/2026-08-2X-<opus|fable>-verify.md` + findings appended under `## Review findings (open) — <you>, verify pass` in `docs/PROGRESS.md`, format `- [ ] P<n> — <file:line or URL> — <what you measured> — <you> [C]`. Do not fix anything; do not touch other files. If something works, say so with the number — that is evidence too.
