# PROGRESS — verified state (update before you stop; Aarya's Claude reads this, not chat)

Last update: **2026-08-28 02:45 PT** by C (Arav's Claude). Branch `main`, all pushed.

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
- **`packages/bridge` green (commit `7a3f88c`)**: `node bin/rokan-terminal.js` → node-pty zsh + ws on 127.0.0.1 + 128-bit token (first-frame auth, timing-safe) + one tab at a time (second gets `busy`) + cloudflared quick tunnel + DNS-over-HTTPS wait + one pairing link. zsh shell integration (OSC 133 / OSC 7 / private OSC 7331) gives **honest** `running / last_exit_code / last_command_ms / last_command / cwd`. `~/.rokan-terminal/ledger.jsonl` rows are HMAC-chained per session; `verifyLedger()` detects tampering. Real-PTY smoke `pnpm smoke`: **14/14 in 331 ms**. Through a real tunnel: hello 367 ms, status 411 ms.
- **All four `terminal_*` tools registered and invoked in Chrome 152** (`register.ts`): `terminal_propose` · `terminal_read_screen` (Share-screen gate → `{shared:false}` when OFF, `redactForAgent()` choke point, 1.5 K output budget with `truncated`) · `terminal_status` (honest fields from bridge `status` frames, `measured:true` only with shell integration) · `terminal_wait` (45 s, `still_waiting`, tail through the same redaction + gate). Evidence appended to `docs/evidence/gate-a/2026-08-28-chrome152-cdp.log`.
- `redact.ts` (every PLAN §4 pattern + PEM blocks + ANSI strip; 12 tests) and client `ledger.ts` (append-only, WebCrypto HMAC chain, localStorage mirror, forward-to-bridge hook, `verifyExport`; 2 tests). `pnpm test` in `apps/web` = 14/14.
- Shared contracts under `contract:`: `schemas.ts` v1 (all four fixed tools, `validateProposedCommand`, `DANGEROUS_PATTERNS`/`isDangerous`, `OUTPUT_BUDGET_CHARS`) and `apps/web/src/lib/ws/protocol.ts` v1 (frames + `parsePairingHash`).
- **Seam for Aarya's terminal UI: `apps/web/src/lib/webmcp/adapter.ts`.** Implement `TerminalAdapter` (`shareScreen`, `screenLines(n)` from the xterm buffer, `status()` from the latest `status` frame, `ghostType`, `waitProposal` with `exit_code/ms/tail` after Enter) and call `setTerminalAdapter(...)` once — the tools need no other change. Until then `gateAAdapter` keeps everything working with no shell.

## Blocked on Arav (do these first — Gate A deadline Fri 23:59 PT)

1. **Install the ChatGPT desktop app on this Mac; confirm GPT-5.6 Sol or Terra is available** (Luna has site tools disabled; Enterprise/Edu excluded). Nothing else can measure the ChatGPT consumer.
2. **`vercel login`** in a terminal (device-code flow). The Vercel MCP account returned 403 "can't create a project". After login: `cd apps/web && vercel link --project rokan-terminal && vercel --prod`. Then open the URL in ChatGPT desktop → Site tools arrow → "propose ls" → screenshot into `docs/evidence/gate-a/`.
3. Claude's Chrome extension wasn't connected, so no *headed* Chrome screenshot yet. Optional: open `http://localhost:3311` (`cd apps/web && pnpm start -p 3311`) in Chrome with `chrome://flags/#enable-webmcp-testing` on, DevTools → Application → WebMCP, screenshot.
4. Kill-rule watch: if #1 can't happen by Fri 23:59 PT, PLAN §10 #1 applies — Chrome + Inspector becomes the primary demo browser and README says so. The Chrome half is already green, so the entry does not die on this.

## Decisions (Arav + Aarya veto by editing PLAN §0)

**D1 — DECIDED 02:30 PT, written as PLAN §0.9: forge leads, terminal is the vehicle.** Two outside reviews + RESEARCH §6b (≈48% of live entries are our old sentence) converge. Changes made: §1 one-liner + hero moment, §8 shot list (cold open = a tool being born and called), §10 risk 3 kill rule inverted (Gate B red kills terminal polish, never forge), §11 rule 1 inverted, CLAUDE.md one-liner. **Gate C is decoupled from Gate B:** forge must demo on the prompt line alone (no PTY) by Sat 22:00 with headless-Chrome evidence. The retrofit framing ("write sites a tool surface") stays rejected — contested lane, sponsor prior art (Cloudflare edge bridge), DOM-driving kill-shot.
- **Risk that can still change the shot:** does ChatGPT desktop's Site tools list refresh on a runtime `registerTool` without reload? Unverified. Measure the hour the app exists. Chrome 152 does (measured).
- Keep out of the submission text as fact: "dynamic registerTool is the strongest reading of criterion #1" is our inference, not a judge quote.

**D3 — LANE SWAP PROPOSED (needs Aarya's Claude ACK in ALIGNMENT.md before C touches it):** forge is now the story and the critical path; it should not be one person's Sunday. Proposal: **C takes the forge engine** — `apps/web/src/lib/webmcp/forge.ts`: `forge_create` handler, dynamic `forged_<name>` registration with a per-tool `AbortController`, `toolchange`, pin/evict at 5 visible, content hash (§13.5), `forge_list` with stats from the ledger — all headless-testable with `evals/harness/webmcp-cdp.mjs`. **Aarya keeps** the Forge card UI, "Forge this" selection from history, the ghost-text overlay, xterm + WS client, and the `TerminalAdapter`. Shared seam: the card calls `forge.approve(spec)`; the engine never renders. If Aarya's Claude prefers to keep the whole forge, say so and C builds `evals/` cases + judge sandbox instead.

Notes carried from the first review: adds if agreed (≈ 0.5 h, Ay): "tools registered this session: N" (measured) in the Tools pane; "Try as agent" on the card via the spec's own `executeTool` (string input, FIELD-NOTES #6). On "five ways you lose": #2 is false as of tonight (measured in Chrome 152); #3 is Gate D; #4 is kill rule #4; #5 is the verify discipline.

**D2 — Aarya's questions 2–6 in ALIGNMENT.md** (product name, repo rename, Vercel owner + code redemption, Netlify/Render account + credits form before Sep 1 12:00 PT, Anthropic spend cap, Rokan STATUS.md launch note). Unanswered.

## Contract pings (for Aarya's Claude)

- `schemas.ts` v0 exists (commit `ba2eb64`). The row-1 sanitizer is `validateProposedCommand()` — import it, don't re-implement.
- Chrome 152 calls `execute(input)` with **no** `{signal}`; every `execute` handler must treat options as optional (`types.ts` already types it so). Chrome's `executeTool` wants a JSON **string** input. Details in FIELD-NOTES.
- `TerminalTools.tsx` and `page.tsx` are placeholders in your lane — replace freely; keep the registration shape in `register.ts`.
- Local run: `pnpm install` at root (pnpm 11 needs `allowBuilds` — already in `pnpm-workspace.yaml`), then `cd apps/web && pnpm dev`.

## For Aarya's Claude — how to run against the real bridge (D1 morning)

```
pnpm install                                   # root
node packages/bridge/bin/rokan-terminal.js --no-tunnel --app http://localhost:3000
# prints http://localhost:3000/#ws=ws%3A%2F%2F127.0.0.1%3A7331&t=<token>
# client: parsePairingHash(location.hash) → new WebSocket(ws) → send {type:'auth',token,cols,rows}
# then {type:'input',data} for every keystroke, {type:'resize'} on fit; render {type:'data'} into xterm.
```
Drop `--no-tunnel` to get a `wss://…trycloudflare.com` link (≈ 15–20 s, waits for DNS). Smoke: `cd packages/bridge && pnpm smoke`.

## Next (C) — D1 lane work landed on D0; what remains

- **Sat morning:** ChatGPT-desktop measurements the moment Arav has the app (FIELD-NOTES "ChatGPT" section); Vercel prod deploy once logged in; headed-Chrome screenshot with DevTools → WebMCP panel.
- **Sat:** help Aarya wire `TerminalAdapter` to xterm + the WS client (I'll review, not edit `apps/web/src/components`); bridge `rokan-do` trailer parsing; `docs/SECURITY.md` first draft.
- **Sat 20:00** joint E2E from the deployed URL through a real tunnel. **22:00 Gate B.**
- **Sun:** `infra/sandbox` (Worker + Sandbox SDK + Dockerfile) — judge mode.

## Objections

- None from C yet. (D1 above is a recommendation on pitch framing, not an objection to a locked decision.)
