# TERMINAL-PLAN — the vehicle: live terminal, ghost text, real adapter, card UX (Rokan Terminal)

> **Historical — pre-pivot.** This document describes *Rokan Terminal*, which now lives at
> `/terminal` and is not the submitted product. The submission is **The Drop** — start at
> [`docs/README.md`](README.md).

Status: written 2026-08-28 06:10 PT by C after the Forge plan's prompt-line half went green
(`docs/FORGE-PLAN.md` §7.6; evidence `docs/evidence/gate-c/`). Same discipline: Handset-scoped,
every external fact verified (xterm 6.0.0 typings read from `node_modules` on this machine), test
every baby step (§16 of FORGE-PLAN applies verbatim), measured numbers only. Arav is asleep;
executed continuously; PROGRESS "Now / In flight" is the hand-off.

---

## 0. Context — what this plan delivers and why it is next

- The forge (the story) is proven on the prompt-line page. The **terminal is the vehicle** that
  makes a birth *real*: the forged tool's command runs on the human's machine, exit codes and
  durations are measured by the shell, `rokan do` can be forged from a real run. Gate B (Sat
  22:00 PT: propose → Enter → runs on Arav's Mac → agent reads the redacted screen) and the
  live-terminal half of Gate C both need it.
- Already green and reused: `packages/bridge` (PTY, token, tunnel, honest `status` frames, HMAC
  ledger, respawn, Origin check), `protocol.ts` v1 (+ `consumePairingHash`, host allowlist),
  `adapter.ts` seam, `proposals` store (queued/promote/reasons), `forge.ts`, `redact.ts`,
  `ledger.ts` (countersign), test hooks, the CDP harness. Nothing in the tool layer changes.
- What does not exist yet: a WebSocket client, an xterm pane, ghost text on a real prompt line,
  the real `TerminalAdapter`, the layout/UX judges will see, "Forge this" from history, the
  card's editable fields, empty/error/reconnect states, and headless E2E against a real PTY.

## 1. Hackathon truth this plan serves (see FORGE-PLAN §1 for the full table)

- **Execution (25%, tiebreak #2)** is mostly earned here: opens cold, every state handled, no
  dead buttons, design that is not AI-generic, judge completes the hero in < 60 s.
- **Leverage** keeps its proof: the same seven fixed + forged tools now act on a real shell;
  `terminal_read_screen` returns real, redacted output; `terminal_wait` returns real exit codes.
- **Impact**: the audience (developers whose ChatGPT/Codex must act on *their* machine) sees their
  own shell, their own `~`, their own commands.
- Judge lenses honoured: Roberts (agent as an extension of a real user; recovery), Nahas (writes
  human-approved, untrusted content marked), Drasner (tools not DOM; observability), Galloni
  (judge mode comes next — this plan keeps a clean seam for the Sandbox WS), Rushing (works in the
  ChatGPT in-app browser: xterm + WS are plain web platform), Gao (tests + evals), Grigorik
  (reusable client + adapter, not a page).

## 2. Product specification (feature level)

### 2.1 Modes and states (one client)
| state | trigger | what the human sees | tools |
| --- | --- | --- | --- |
| **unpaired** | no `#ws=…&t=…` in the URL (or refused by allowlist) | left: a pairing card — `npx rokan-terminal` (copy button), "paste the link it prints", plus "or try the prompt line" (Gate A prompt-line pane still works); right: Tools / Forged / Ledger | all six tools work against the prompt-line adapter (no shell) |
| **connecting** | hash consumed (token removed from the address bar) | spinner in the status bar: "pairing with `wss://…trycloudflare.com`" (host only, never the token) | tools work; `terminal_status.paired=false` |
| **paired** | `hello` received | xterm pane live; status bar: shell name, cwd (only if Share is on), last exit · ms, "measured" badge when `integration:true` | full |
| **busy** | bridge `error busy` | card: "Another tab is already paired with this bridge. Close it, or start a new bridge." | prompt-line fallback |
| **unauthorized** | `error unauthorized` / `timeout` | card: "This pairing link is not valid. Start `npx rokan-terminal` again and use the new link." | prompt-line fallback |
| **disconnected** | socket close (not busy/unauthorized) | banner: "bridge disconnected — reconnecting in N s" with backoff 1·2·4·8·15 s (cap), up to 10 min; "Reconnect now" button; scrollback stays | `terminal_status.paired=false`; pending proposal stays pending; active forged invocation is cancelled with reason `invocation_cancelled` |
| **shell exited** | `exit` frame | line in the terminal: "shell exited N; started a new one" (bridge respawns) | unchanged |
| **unsupported browser** | no `document.modelContext` | Tools pane note: "Agent tools need ChatGPT desktop (GPT-5.6 Sol/Terra) or Chrome 149+ with WebMCP. The terminal still works." | none |
| **mobile** | viewport < 720 px | one card: "Open on a desktop browser" + the one-liner | none |

### 2.2 Layout (desktop ≥ 720 px)
- Top status bar (40 px): wordmark "Rokan Terminal" (Instrument Serif), state chip, host chip,
  `cwd` (if shared), `exit 0 · 41 ms` (measured), "Share screen with agent" toggle, "Reconnect".
- Left 70%: xterm pane (fills height; scrollback 5 000 lines; Rokan light theme: bg `#fafaf6`,
  fg `#18181b`, cursor/accent `#d97706`; Geist Mono 13 px; WebGL renderer with DOM fallback).
- Right 30%, three stacked panes with fixed headers and their own scroll: **Tools** (count,
  fixed six, forged list with kind badge · hash · stats · pin/restore/unforge), **Forge**
  (pending card(s) or "Select lines and press Forge this"), **Ledger** (rows, newest first, with
  ms/calls, "Export JSON" (countersigned count shown), "verified by bridge: N/M").
- A Forge card that is pending is also announced with a subtle accent border on the Forge pane
  header; it never covers the terminal.
- Keyboard: focus lives in the terminal by default; `Esc` dismisses a proposal; `Tab` inserts;
  `Enter` runs; `Cmd/Ctrl+K` toggles the Share-screen; the card's Approve is a real button.

### 2.3 Ghost text (the human's trust boundary, on a real prompt)
- Rendered as an xterm **decoration** (`term.registerMarker(0)` at the cursor line +
  `term.registerDecoration({marker, x: cursorX, layer:'top'})`; text set in `onRender`), never
  written to the PTY. Colour: accent at 70%; dangerous: red + banner. The `why` (sanitised) shows
  as a second line under the prompt: `← forged_status_of · step 1/1 · Tab insert · Enter run · Esc dismiss`.
- Shown only while the **local line buffer is empty** (typed printable chars since the last prompt
  marker, minus backspaces; reset on Enter, Ctrl-C, Ctrl-U, and on OSC 133;A). If the human is
  mid-typing, the ghost hides (proposal stays pending; Esc still dismisses).
- **Enter** with empty line: the client sends exactly `command + "\r"` as `input` (the bytes the
  human saw — `validateProposedCommand` guarantees no control chars) and resolves the proposal
  `accepted`; `dangerous` proposals need Enter twice (first arms, banner says so).
- **Tab**: sends `command` without `\r` — the shell now holds the text; the human edits; the
  proposal is resolved `accepted` with `edited:true` when they eventually press Enter (line buffer
  non-empty → ordinary Enter). Ledger notes `edited`.
- **Esc**: `dismissed_by_human`.
- Forged multi-step: step k+1 is promoted only after step k's `status` end arrives (exit code
  known) — never types over streaming output.

### 2.4 Real `TerminalAdapter`
- `shareScreen()` = toggle state (default off; persisted per session in memory only).
- `screenLines(n)` = last `n` lines of `term.buffer.active` (`getLine(i).translateToString(true)`,
  trailing empty lines dropped) — plain text; redaction happens in `register.ts`.
- `status()` = last `status` frame + `integration` from `hello`; `null` when not paired.
- `ghostType(command, why, opts)` = `proposals.propose(...)` (the overlay reacts to the store).
- `waitProposal(id, ms, signal)`: resolves on dismiss; on accept waits for the **end marker** of
  the command that ran (next `status` with `running:false` after the Enter) up to `ms`, returns
  `exit_code`, `ms` (bridge-measured), `tail` (raw lines captured from `data` frames between the
  Enter and the end marker, ANSI-stripped, ≤ 200 lines; redacted by the caller). If the bridge
  disconnects mid-wait → resolves with `exit_code:null`, `tail` so far, `interrupted:true`.
- `mode`: `'builder'` (judge mode swaps the WS target only — next plan).

### 2.5 "Forge this" (human-initiated birth)
- Select text in the terminal (1–5 lines) → floating "Forge this" button near the selection (and
  a Forge-pane button) → `forge.openCard({name: <first word of first command, sanitised to the
  regex>, description: '', commands: <selected lines with prompt prefixes stripped>, params: [],
  kind: auto}, {origin:'human'})` → the card opens with the description field focused.
- Prompt-prefix stripping: leading `~ $ `, `$ `, `% `, `❯ ` and the shell's own prompt captured
  from the last OSC 133;A line are removed; lines that were output (not commands) are dropped when
  the bridge's ledger `executed` rows can identify command lines (fallback: keep as-is, human edits).

### 2.6 Forge card (final UX; engine unchanged)
- Editable: name (live regex hint), description, each command (monospace, `{{param}}`
  highlighted), params table (name · description · example; add/remove), kind toggle (read/write;
  override reason shown). Validation messages from `validateForgeSpec` inline, Approve disabled
  until valid; dangerous → red border + "Approve anyway" second click.
- Shows `forged_<name>`, hash (12 hex), "replaces <old hash>" when re-forging, "The agent can call
  this. Each command still needs your Enter."
- **Try as agent** button: calls the spec's own `document.modelContext.executeTool(tool,
  JSON.stringify(exampleInput))` for the just-forged tool (FIELD-NOTES #6: string input) → the
  ghost text appears exactly as if the agent had called it. (Leverage evidence, 10 lines.)

### 2.7 Ledger column
- Row = kind badge · summary · `ms` / `calls` when present · ✓ when countersigned by the bridge.
- Export → downloads `rokan-ledger-<session>.json` (rows + countersigned count, **no key**).
- "calls" appears only when a `rokan do` trailer / `--json` result was parsed (D3) — until then
  the column shows `–`, never a made-up number.

### 2.8 Limits
xterm scrollback 5 000 · `screenLines` ≤ 200 · tail ≤ 200 lines · reconnect backoff cap 15 s,
give up 10 min · ping every 20 s (bridge idle 30 min) · one tab per bridge (bridge enforces).

## 3. Contracts touched (`contract:` commits)

- `protocol.ts` / `protocol.js`: no frame changes. Client sends `ping` every 20 s. Document that
  `hello.integration=false` means `status` fields are null (bash etc.).
- `adapter.ts`: `ResolvedProposal` gains `interrupted?: boolean`, `edited?: boolean`.
- `proposals.ts`: `resolve(id, 'accepted', undefined, {edited?: boolean})` → store `edited`.
- `schemas.ts`: `TerminalWaitResult.executed` gains `edited?: boolean`, `interrupted?: boolean`.
- Ledger kinds: `paired`, `disconnected`, `reconnected` (client side).

## 4. Technical specification

### 4.1 `apps/web/src/lib/ws/client.ts` — `BridgeClient`
```ts
type ClientState = 'idle'|'connecting'|'paired'|'busy'|'unauthorized'|'disconnected'|'closed';
class BridgeClient extends EventTarget {
  constructor(opts: { ws: string; token: string; cols: number; rows: number; makeSocket?: (url) => WebSocket })
  connect(): void            // opens socket, sends auth as first frame, arms 5 s auth timer
  sendInput(data: string): void
  resize(cols, rows): void
  forwardLedger(row: LedgerRow): void       // {type:'ledger', row}; ack → ledger.countersign
  close(): void
  readonly state: ClientState; readonly hello: HelloFrame|null; readonly lastStatus: BridgeStatus|null
  on('data'|'status'|'exit'|'state'|'error', fn)
}
```
- Backoff: 1, 2, 4, 8, 15, 15… s; stop after 10 min; `busy`/`unauthorized` never auto-retry.
- Serialises outgoing frames while connecting (queue ≤ 100 input frames; dropped beyond, noted).
- Pure logic (state machine, backoff, frame parsing) is unit-tested with a fake `WebSocket`.

### 4.2 `apps/web/src/lib/terminal/osc.ts` — tiny client-side OSC 133 detector
`promptMarkers(chunk): { promptStarted: boolean; commandStarted: boolean; commandEnded: {code}|null }`
with a carry for split sequences (port of the bridge parser's essentials; unit-tested).

### 4.3 `apps/web/src/lib/terminal/linebuffer.ts` — local typed-line tracker
`class LineBuffer { feedKey(ev: KeyboardEvent|{key,ctrlKey}): void; reset(): void; get length }`
— printable → +1; Backspace → −1 (min 0); Enter/Ctrl-C/Ctrl-U/Ctrl-D → reset; ignores
modifiers/arrows. Unit-tested. (An approximation — documented — good enough to decide "is the
human mid-typing?"; the shell's own line is never parsed.)

### 4.4 `apps/web/src/lib/terminal/adapter.ts` — `createTerminalAdapter({term, client, share})`
Implements §2.4. `waitProposal` uses a per-proposal `Promise` resolved by the Enter handler and the
`status` stream; captures `data` between Enter and end marker into `tail` (ANSI stripped with
`stripAnsi` from `redact.ts`).

### 4.5 `apps/web/src/components/Terminal.tsx`
- `new Terminal({ cursorBlink: true, scrollback: 5000, fontFamily: 'var(--font-mono)', fontSize: 13, theme: {...} , allowProposedApi: false })`; `FitAddon`; `WebglAddon` in try/catch, `onContextLoss → dispose`; `ResizeObserver` → `fit()` → `client.resize`.
- `term.onData(d => client.sendInput(d))` — the only path to the PTY.
- `attachCustomKeyEventHandler`: intercepts Enter/Tab/Esc only when a proposal is pending and
  (for Enter/Tab) the line buffer is empty; otherwise returns true (xterm handles the key).
- Ghost decoration lifecycle: create on pending; update `x` on `onRender`/`onLineFeed`; dispose on
  resolve; hidden while line buffer > 0.
- Selection → "Forge this" button; `term.getSelection()`.

### 4.6 `apps/web/src/components/{StatusBar,ToolsPane,ForgePane,ForgeCard,LedgerPane,PairingCard,MobileCard}.tsx` + `App.tsx`
Composition per §2.2; all state from the stores (`proposals`, `forge`, `ledger`, client) via
`useSyncExternalStore`; no prop drilling; each ≤ 250 lines.

### 4.7 `apps/web/src/app/page.tsx`
Renders `App`; consumes the hash on mount (`consumePairingHash`) → `BridgeClient` or unpaired.
Feature-detects WebMCP once; registers tools once (`registerTerminalTools`).

### 4.8 Design tokens (`globals.css`)
Palette from BRAND: `--bg #fafaf6 --ink #18181b --accent #d97706`, `--muted #71717a`,
`--line #e4e4e0`, `--ok #047857`, `--danger #b91c1c`. Fonts: Instrument Serif (wordmark/h1 via
`next/font/google`), Geist Sans, Geist Mono. No purple, no gradients, no card stacks; one accent.
Focus rings visible; reduced-motion respected; contrast ≥ 4.5:1 on text.

## 5. External software (delta from FORGE-PLAN §5)

| component | version (verified) | facts relied on |
| --- | --- | --- |
| `@xterm/xterm` | 6.0.0 | **`allowProposedApi: true` is required for `registerDecoration` (measured)**; `registerMarker(cursorYOffset)`, `registerDecoration({marker, x, width, height, layer, anchor})` + `IDecoration.onRender(HTMLElement)`, `buffer.active.{cursorX,cursorY,baseY,length,getLine(y)?.translateToString(trimRight)}`, `onData`, `onResize`, `onLineFeed`, `onRender`, `attachCustomKeyEventHandler(ev => boolean)`, `write`, `scrollToBottom`, `loadAddon` |
| `@xterm/addon-fit` | 0.11.0 | `fit()`, `proposeDimensions()` |
| `@xterm/addon-webgl` | 0.19.0 | `new WebglAddon()`, `onContextLoss`, `dispose()`; throws if WebGL2 unavailable → catch → DOM renderer |
| `next/font/google` | Next 15.5 | Instrument Serif + Geist self-hosted (CSP `font-src 'self'` stays) |
| bridge | this repo | frames v1; `status` after every OSC 133 D; `data` replay on reconnect; Origin allowlist = the app origin (`--app`) + localhost |

## 6. Security (delta)
- Token: consumed from the hash and removed from the address bar before the first paint of the
  paired state; kept in a closure, never in storage or the ledger; the status bar shows host only.
- The ghost text is a DOM decoration; the PTY parser never sees proposal bytes until Enter, and the
  bytes sent are exactly the validated `command`.
- Enter never sends a proposal when the human has typed anything on the line.
- `screenLines`/`tail` are raw here and redacted in `register.ts` (single choke point unchanged);
  `cwd` only when shared.
- Reconnect replays bridge scrollback — same trust level as the original data; nothing leaves the
  tab without the tools' gates.
- CSP `connect-src` already limits WS targets; the pairing allowlist limits the page side.

## 7. Verification (every level; gate before every commit)
- **L1 unit**: `client.test.ts` (fake WebSocket: auth-first, hello → paired, busy/unauthorized
  terminal states, backoff schedule 1·2·4·8·15, queue while connecting, ping cadence, ack →
  countersign), `osc.test.ts` (split sequences), `linebuffer.test.ts`, `terminal-adapter.test.ts`
  (fake term + fake client: screenLines trimming, waitProposal → exit code from status, tail
  capture, interrupted on disconnect, Tab → edited).
- **L4 headless E2E with a real PTY** — `evals/run-all.mjs` gains `--bridge`: starts
  `packages/bridge` with `--no-tunnel --port 7345`, builds the page URL with the pairing hash, runs
  cases: `terminal-pair.json` (hello, prompt marker visible in the xterm buffer, status bar shows
  shell), `terminal-propose-enter.json` (propose `echo hi_from_pty; false` → ghost visible → Enter
  → `terminal_wait` executed with `exit_code:1`, `tail` contains `hi_from_pty`), `terminal-read-screen.json`
  (share off → refused; share on → lines include the echo; type `export AWS_SECRET_ACCESS_KEY=…`
  → `[redacted]`), `terminal-forge-live.json` (forge `hn_top`-style tool with `echo top {{n}}` →
  invoke → Enter → `exit_code 0`, `forge_list median_ms` numeric), `terminal-tab-insert.json`,
  `terminal-dangerous.json` (Enter twice), `terminal-typing-hides-ghost.json`, `terminal-busy.json`
  (second harness page → busy card). Harness gains `{"type": "text"}` (Input.insertText) and
  `{"waitFor": "<expr>", "timeout"}` steps.
- **L5**: `pnpm smoke` (bridge) stays 24/24.
- **L6 headed**: Chrome extension screenshots of paired state, ghost text, card, DevTools WebMCP
  panel → `docs/evidence/gate-b/`.
- **L7 consumer**: Gate B protocol in ChatGPT desktop once Arav confirms Sol/Terra + Vercel prod.
- Gate B green iff L1–L5 green + L6 screenshots + a recording of propose → Enter → runs on
  Arav's Mac → agent reads the redacted screen (can be recorded by C headless + headed; the ChatGPT
  take needs Arav).

## 8. Files (C)
`apps/web/src/lib/ws/client.ts` (+test) · `apps/web/src/lib/terminal/{osc,linebuffer,adapter}.ts`
(+tests) · `apps/web/src/components/{App,Terminal,StatusBar,ToolsPane,ForgePane,ForgeCard,LedgerPane,PairingCard,MobileCard,PromptLine}.tsx`
(PromptLine = today's no-shell prompt) · `apps/web/src/app/{page.tsx,layout.tsx,globals.css}` ·
`apps/web/src/lib/webmcp/{adapter,proposals,schemas}.ts` (contract deltas) · `evals/run-all.mjs`,
`evals/harness/webmcp-cdp.mjs`, `evals/cases/terminal-*.json` · `docs/PROGRESS.md`, `FIELD-NOTES.md`.
Commits in order: `contract: adapter/proposals/wait deltas` → `feat(web): BridgeClient + tests`
→ `feat(web): terminal libs (osc, linebuffer, adapter) + tests` → `feat(web): xterm pane + ghost
decoration` → `feat(web): layout + panes + card UX` → `feat(evals): real-PTY terminal cases` →
`docs: Gate B evidence`.

## 9. Schedule (PT) + kill rules
06:30 contracts + client + libs green (L1) · 08:30 xterm pane + ghost + adapter wired; first
real-PTY headless case green · 10:30 layout/panes/card UX; all `terminal-*` cases green · 12:00
headed screenshots, PROGRESS, FIELD-NOTES; then judge sandbox plan. If xterm decorations misbehave
> 1 h → fall back to an absolutely-positioned overlay measured from `.xterm-rows` cell size (same
semantics). If WebGL fails anywhere → DOM renderer, no time spent. Vendor yak > 2 h → drop it.

## 10. Out of scope here (next plans)
Judge sandbox (`infra/sandbox`, Sandbox WS, `sandbox_status`), `rokan do` seeding/`--json`
parsing/`calls` column, MCP parity, remote-box beat, `?tour=1`, video/README/GIF polish, multi-tab.

## 11. What comes after
**Sandbox plan** (judge mode: Worker + `@cloudflare/sandbox`, Dockerfile, `/api/session`, TTL,
rate limits, egress allowlist, seeded `rokan do`, `--json` trailer parsing in the bridge → `calls`
column) → **Polish + submission plan** (tour, README/GIF, §13 upgrades, test protocol, 5
rehearsals, backup video, Devpost text, publish).
