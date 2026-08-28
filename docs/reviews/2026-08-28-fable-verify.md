# VERIFY pass — Fable 5 — 2026-08-28 (22:05–23:00 PT)

Executed, not read. Repo at `ce5776d` (→ `848ca42` by the end). Every line is a measurement, a
screenshot under `docs/evidence/verify-fable/`, or a reproduced failure. Resource rules kept: one
tab (closed), one local bridge (killed), no Docker, no loops; the single judge-mode eval ran as part
of the gate; one manual judge session from this (the builder's) IP.

## Verdict

**Everything a judge does in the first three minutes works and is fast** — cold sandbox 4.5 s,
propose → ghost 6 ms, Enter → measured `exit 0 · 7 ms`, redaction holds, Forge-this → new WebMCP tool
in 630 ms with `toolchange` in 5 ms. **Then my judge session dropped and never came back**
(`pairing…` for 4+ minutes, no message, no recovery), and a page reload does not re-pair. Those two are
the findings that matter; both are in the client's connection handling, not in the tools.

## A. Cold gate (one run)

| step | result |
| --- | --- |
| `pnpm typecheck` / `pnpm lint` | clean |
| `pnpm build` | **first run printed `> Build error occurred`** while another session was building in the same checkout; immediate rerun clean (`BUILD_ID doii8WYBu9iOobWgNW4Vh`) — shared-tree collision, not the product |
| `pnpm test` (web) | **114/114** in 644 ms |
| bridge `check` · `node --test` · `smoke` | clean · **7/7** (MCP 3 + trailer 4) · **36/36 in 3016 ms** |
| sandbox `pnpm check` | **12/12** |
| `evals/run-all.mjs` | **7/7**, 0 failed |
| `--bridge` | **8/8**, bridge up in 231 ms |
| `--bridge --mode=judge` | **8/8**, bridge up in 201 ms |
| total | 23 cases, **544 steps, 0 failed** |

## B. Live URL as a stranger (real Chrome 152.0.0.0, WebMCP flag on)

| # | what | measured | evidence |
| --- | --- | --- | --- |
| 1 | cold open, `document.modelContext.getTools()` | **6 tools**: forge_create, forge_list, terminal_propose, terminal_read_screen, terminal_status, terminal_wait; CSP nonce + HSTS + DENY headers | `B1-live-url-6-tools.jpg` |
| 2 | **Try it now** | first click → **429 "This IP already has 3 active sandboxes (limit 3) (retry in 44 s)"** at 1.3 s (this IP had sessions from 22:17/22:32/22:39 — field notes); after the wait, second click → **`judge sandbox · zsh · expires in 29:58`**, `cold_ms 4480` (worker 4266), xterm opened 31 ms (webgl 124×36), `bridge.paired pair_ms 217` | `B2-judge-paired-cold-4480ms.jpg` |
| 3 | `seq 1 3` ⏎; spec-level `executeTool(terminal_propose, '{"command":"ls -la"}')` | `executeTool` **6 ms** → ghost `ls -la` at the prompt, bar "← verify pass B3 · Tab insert · Enter run · Esc dismiss"; Enter → `terminal_wait` → **`executed, exit_code 0, ms 7, tail [], shared false`** (3 ms) | `B3-ghost-ls-la-judge.jpg` |
| 4 | Share screen ON, `export AWS_SECRET_ACCESS_KEY=…; echo ok` ⏎, `terminal_read_screen {lines:30}` | `shared:true, redactions:1`, line = `export AWS_SECRET_ACCESS_KEY=[redacted] echo ok`, value **absent** from the whole result | `B4-share-on-redacted-1.jpg` |
| 4b | shrunk terminal: `resize_window` to 1000×330 did **not** shrink the pane (screenshot still 1456×829, pane 585 px); forced the pane to **105 px** via style instead → typed the export again | `read_screen` → 22 lines, **redactions 3, value absent**; but the pane **rendered blank** at 105 px while the shell kept working (UI note, artificial condition) | `B4b-pane-105px-blank-still-redacted.jpg` |
| 5 | triple-click `seq 1 3` → **Forge this (1 line)** → card `forged_seq_50` (commands `seq 1 3`) → Approve | `toolchange` fired in **5 ms**; `getTools()` grew 6 → **7** in **630 ms**, chip `tools · 7`, card gone; invoke `forged_seq_50` → `{invocation_id, proposal_ids:[…], queued:0, hash 6874d8c735af}` in 901 ms → ghost `seq 1 3` shown | `B5-forged-seq_50-then-pairing-stuck.jpg` |
| 5→ | Enter on that ghost | **refused** (`ghost.enter_refused`): the session had already dropped — `bridge.disconnected` at **22:43:24** (≈25 s after the pane shrink/restore in 4b), again at 22:45:01 and 22:46:38; header **`pairing…`** with no message for **>4 min**; Cloudflare `wrangler containers list` LAST MODIFIED **22:43:28**, 7 live instances; `terminal_wait` on the step → `still_waiting 45 876 ms` | same |
| 6 | reload mid-session | page comes back **`unpaired`** (`mode: unpaired`, `reconnects 0`, forged tools gone, "Try it now" button again) — no takeover, no re-pair | — |
| 7 | `rokan do …` in the sandbox | **not executed** — no paired session left and this IP's slots were used; the seed README's "not installed" sentence is verified in the repo (`container/seed/README`) | — |
| 8 | 31-minute TTL | not executed (time) | — |

## C. MCP parity (relay measured with a real `AgentLink` + an inline tab; page registry is covered by the gate's `mcp.test.mjs` 3/3 + `terminal-forge-live.json`)

- agent `hello` in **304 ms**; tool list relayed: **6** (the fixed set); `terminal_status` round-trip **1 ms**.
- agent socket sending `input` → bridge answers **"agents may not send input"**, socket stays open.
- bridge killed and restarted with the same token → **MCP link reconnected in 508 ms**, all 6 tools back at 508 ms.
- `claude mcp add` itself was **not** run: it writes a persistent MCP entry into your Claude Code config (permission-class change); the relay path it exercises is measured above.

## D. Adversarial

| check | measured |
| --- | --- |
| `echo "  the answer   7ms  ⚡"` on a real PTY | `terminal_wait` → `exit 0`, **`rokan` field absent** (attribution holds) |
| `cat` running, then propose | `lastStatus.running=true` → `acceptProposal` → **false** (Enter stays ordinary) |
| forged `{{x}}` with `x = "a'; touch /tmp/pwned #"` | line `echo 'a'\''; touch /tmp/pwned #'` (single-quoted, `dangerous:false`); `/tmp/pwned` **does not exist** |
| forged sid `wss://…/ws/<24hex>.<future>.<random16>` (real WS handshake) | **HTTP 403 `unknown or expired session` in 136 ms**; `wrangler containers list` 1 → 1 (no container started) |
| `POST /api/session` with `Origin: https://evil.example` / `OPTIONS` from the app origin / `/api/health` | **403** / **204** / **200 `{ok:true,mode:"judge"}`** |
| 4 × POST from a second IP | **not executed** — I only have this IP and it is the builder's capped one |
| propose `rm -rf /` | live adapter: ghost class `ghost-danger`, bar **"hard-blocked pattern: Enter twice · Esc dismiss"**, first Enter leaves it `awaiting_human` (prompt-line path too: `D-prompt-line-rm-rf-two-enters.jpg`) |
| propose `sudo ls` in **judge** mode | **not validly measured**: the local judge-mode bridge (`--no-tunnel`, `ws://127.0.0.1:7399`) never paired from the https page (see F3); in builder mode `sudo ls` is correctly *not* flagged |
| paste a blob, then propose | **not validly measured** for the same reason (the one reading I have was taken unpaired) — unit-tested in `terminal-libs.test.ts` |

---

## Findings

### F1 — P1 — judge session drops mid-session and the page shows `pairing…` forever: a WebSocket that never opens is never timed out
`apps/web/src/lib/ws/client.ts:135-138` (the 5 s `authTimer` is armed inside `onopen`) · `session.ts` (no user-facing state after repeated failures) — lane C.

Measured on the live sandbox: paired 22:40:31 → `bridge.disconnected` 22:43:24 / 22:45:01 / 22:46:38 → header `pairing…` for > 4 min, `reconnectAt null`, no `bridge.reconnected`, no message; Enter refused; Cloudflare container fleet LAST MODIFIED 22:43:28 (the sandbox appears to have restarted; a restarted container has no bridge on :7331, so the proxy's upgrade hangs while the SDK waits for the port). Reproduced locally in a different way: a fresh load of a `ws://127.0.0.1:7399` link from the https page sits in `state: connecting` for **> 6 s with no open/close event** — nothing ever fires the timer, so no retry and no message (`D-local-no-tunnel-link-pairing-forever.jpg`). The trigger of the sandbox drop is not established (it followed my pane shrink/restore by ~25 s; J7 says impossible-dimension resizes are no longer sent).

Fix: arm a connect timeout when the socket is *created* (close with `NO_HELLO_CLOSE_CODE` if neither `open` nor `close` arrives in ~8 s) so backoff/retry and the disconnected UI engage; after N consecutive failures in judge mode show "session lost — start a new sandbox" (and stop retrying a dead sid, which restarts empty containers — pass-3 F7). Add a `terminal-*.json` case with a socket that never opens.

### F2 — P1 — reloading the page loses the judge session (no takeover, no re-pair)
`apps/web/src/lib/terminal/session.ts` (`startJudge` stores nothing; `start()` only reads the hash) — lane C.

Measured: reload during a live judge session → `mode: unpaired`, `reconnects: 0`, forged tools gone, "Try it now" again. The checklist expects re-pair within ~2 s via takeover (J6 measured takeover works when a second tab holds the token). A judge who reloads must click again and, with 3 concurrent per IP, may get a 429.

Fix: persist `{ws, token, expires_at, sid}` in `sessionStorage` when a judge session starts; on load, if unexpired, `startWith()` it (the takeover path already exists); clear on TTL end.

### F3 — P2 — a `--no-tunnel` (`ws://127.0.0.1`) link opened from the https live page never pairs and never says why
Same client gap as F1, plus docs: the pairing card's copy command is tunnel-first (fine), but `docs/ENV-ARAV.md`, `HANDOFF.md` and the README "Run it yourself" use `--no-tunnel` against `http://localhost:3000` only — say explicitly that a local `ws://` link works only from a localhost page (Chrome blocks/permission-gates loopback WebSockets from a public https origin). Measured: bridge got no connection at all (Node probes with the browser's `Origin` → `hello judge`). — lane C

### F4 — P2 — pane forced to ~6 rows renders blank while the shell keeps running
`components/Terminal.tsx` ResizeObserver/fit at 105 px pane height → no visible rows (screenshot), commands still executed and `read_screen` still redacted (22 lines, 3 redactions). Clamp the pane to a minimum height or show "terminal too small". — lane C

### F5 — P2 — redaction swallows the `;` after a secret value
`redact.ts` value pattern `\S+` consumed `wJalr…KEY;` → line reads `AWS_SECRET_ACCESS_KEY=[redacted] echo ok` (the `;` is gone). Cosmetic, but a judge reading the agent's view sees a different command than the human typed. Stop the value at `[;&|)]`. — lane C

## What works, with numbers (evidence too)

6 tools on cold load · sandbox cold start 4.48 s (worker 4.27 s) · pair 217 ms · `executeTool` propose 6 ms · Enter → `exit 0 · 7 ms` · redaction 1/1 and 3/3, value never present · Forge this → card → Approve → `toolchange` 5 ms, tool listed in 630 ms, chip 7 · invoke 901 ms → ghost · MCP relay hello 304 ms, call 1 ms, reconnect 508 ms, `input` refused · forged sid 403 in 136 ms with zero containers started · evil-origin POST 403 · trailer attribution holds on a real PTY · `cat` gate holds · `{{x}}` quoting holds · `rm -rf /` needs two Enters · gate 544/544.
