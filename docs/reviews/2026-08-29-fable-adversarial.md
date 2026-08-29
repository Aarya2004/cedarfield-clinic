# Adversarial review — Fable 5 — 2026-08-29 — HEAD `29c26a5`

Real defects only, each reproduced (script: `scratchpad/adv.ts`, pure Node against the repo's own
modules) or shown by construction with the exact lines. Nothing from the other reviewer's passes is
repeated. Baseline preserved on this machine: web **126/126** · bridge **8/8 + 38/38 (2744 ms)** ·
sandbox **15/15** · evals **7/7**; real-PTY ran **10/11** during my run because
`terminal-rokan-real.json` briefly carried an uncommitted `"equals":"__dump_screen__"` diagnostic in
the shared tree — HEAD's copy is clean (the screen showed `All Systems Operational   225ms  ⚡`).

## P1

### F1 — Trust boundary: any `*.trycloudflare.com` host is an allowed bridge — a phishing link still turns the tab into a keylogger with a spoofed screen
`apps/web/src/lib/ws/protocol.ts:125` (`/^[a-z0-9-]+\.trycloudflare\.com$/` → allowed) · `docs/SECURITY.md` §4 "Only allowed bridge hosts … a crafted link would otherwise turn the tab into a keylogger" — lane C.

Quick tunnels are free and anonymous: `cloudflared tunnel --url` gives *anyone* a fresh
`https://<random>.trycloudflare.com` in ~3 s (FIELD-NOTES tunnel #1). The pairing allowlist therefore
binds the tab to "some Cloudflare quick tunnel", not to *the user's* bridge. Failure scenario: an
attacker runs a WebSocket server behind their own quick tunnel that answers any `auth` with a valid
`hello` frame, sends the victim `https://rokan-terminal.vercel.app/#ws=wss%3A%2F%2F<theirs>.trycloudflare.com&t=<32 hex>`
("open this to pair your terminal"). `parsePairingHash` passes (host regex + token shape), `session.startWith`
pairs, the page renders the attacker's `data` frames as the terminal and forwards **every keystroke
and paste** (`Terminal.tsx:130-131`, `client.sendInput`) — passwords the victim types into what looks
like their own shell — plus every ledger row. The token check is client-side shape only
(`/^[a-f0-9]{16,64}$/`); the attacker's server never has to know a real token. SECURITY §4 claims this
class is closed; it is closed only for non-Cloudflare hosts.

Fix (small): pairing must prove the *bridge* is yours, not the host family. Cheapest honest option:
the bridge prints a 6-char pairing code beside the link (`hello` carries a hash of it); on a
non-loopback host the page shows a card "Pair with `<host>`? Code: `____`" and only pairs when the
human types the code the bridge printed. Alternative: the token doubles as the code — the page never
auto-pairs a `wss://` link, it shows the host and requires one click, and the bridge's `hello` must
echo `HMAC(token, session_id)` which the page verifies before rendering any `data`. Either way, update
SECURITY §4 to what the allowlist actually proves.

### F2 — Redaction bypass: a PEM key on a single line (service-account JSON, `kubectl get secret -o json`, `.pem` with `\n` escapes) leaves the tab intact — and two later lines vanish
`apps/web/src/lib/webmcp/redact.ts:137-143` — lane C.

`redactForAgent` checks `KEY_BLOCK_BEGIN` on each line **before** `redactLine`, and on a hit it
`out.push(raw)` — the whole raw line — then enters block mode and drops every following line until an
`END` marker appears on a *later* line. When BEGIN and END are on the same line (the overwhelmingly
common JSON/`\n`-escaped form), the key body is emitted verbatim and the block never closes.

Measured (`adv.ts` P1): input `['$ cat sa.json', '{"type":"service_account","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQ…SECRET…\n-----END PRIVATE KEY-----\n",…}', '$ echo after', 'after']`
→ output contains `MIIEvQIBADANBg…` **(key bytes leaked)**, and only 3 lines come back: `$ echo after` and
`after` are dropped as "block body". A judge who types `cat ~/.config/gcloud/…/adc.json`, `cat sa.json`
or `kubectl get secret x -o json` with Share screen on hands the agent the private key.

Fix: when a line contains BEGIN, redact from the BEGIN marker through END-on-the-same-line (or to
end of line if no END), emit that, and enter block mode **only** if no END was on the line; then run
`redactLine` on the remainder. Add the JSON case to `redact.test.ts`.

## P2

### F3 — Forge: `restore()` after a rejected `registerTool` leaves a phantom "visible" tool that `invoke` accepts and the MCP relay advertises
`apps/web/src/lib/webmcp/forge.ts:393-404` (no try/catch; `registerWithBrowser` sets `visible=true` at 316-321 before awaiting) — lane C.

`approve()` got a rollback for this in pass 2; `restore()` did not. Measured (`adv.ts` P2): evict `tool_a`,
make `registerTool` reject (`InvalidStateError: Duplicate tool name` — Chrome's real error when an old
signal was not aborted), `restore('tool_a')` → **throws** (unhandled by callers: `testhooks`, `useForgedTools().restore`, the Restore button), and afterwards `tool('tool_a')` is `visible:true, registered:false`,
`invoke('tool_a')` **is accepted** (ghost-types, counts a run) and `toolDefs()` lists `forged_tool_a` to
MCP clients — a tool the browser does not have. Mirror the `register()` rollback and return a typed error.

### F4 — Ledger honesty: one cancellation writes two `dismissed` rows
`apps/web/src/lib/webmcp/forge.ts:497-502` (`cancelActive` → `dismissFrom` + abort) and `:453-456` (the aborted `run()` loop calls `dismissFrom` again) — lane C.

Measured: after a single `cancelActive('invocation_cancelled')` the ledger holds **2** `dismissed` rows
for the same invocation (the second `dismissFrom` finds nothing to resolve but `from < length` is
still true, so it appends). Any judge scrolling the ledger after a disconnect sees a double
cancellation; the bridge countersigns both. Guard the second append (`if (dismissedAny)`).

### F5 — Trailer attribution: a compound command line starting with `rokan-do` attributes an `echo`'d ⚡ to Rokan
`packages/bridge/src/rokan-trailer.js:12` (`ROKAN_CMD_RE` anchors only the first word) + `bridge.js:123` — lane C.

Measured: `isRokanCommand("rokan-do 'x'; echo '  fake answer   1ms  ⚡'")` → **true**, and the parser
(last matching line wins) returns `{ms:1, replayed:true}` → `calls:0` in `terminal_wait.rokan`, the
status bar and the ledger. The human sees the compound line before Enter, so it is not a silent exploit,
but the SECURITY §4 sentence "attributed only to a rokan/rokan-do command line" is stronger than the
check. Require a single simple command (refuse attribution when `;`, `&&`, `||`, `|` or `$(` appear
outside quotes) or parse the trailer only from output before the next prompt of a sole command.

### F6 — Honesty: `runs` counts invocations, including ones nothing ran
`apps/web/src/lib/webmcp/forge.ts:427` (`t.runs += 1` in `invoke`, before any Enter) · shown as "N runs" in the Forged-tools pane and `forge_list.runs` — lane C.

Failure scenario: the agent calls `forged_deploy` three times, the human presses Esc each time →
the pane says `3 runs`, `forge_list` says `runs:3`, `median_ms:null`. §0.6 says every number is
measured; "runs" here measures *attempts*. Count `runs` on the first `executed_step` (or rename to
`invocations` and add `runs`).

### F7 — Honesty: after a Tab-insert, an unrelated later Enter is recorded as the proposal "executed (edited)"
`apps/web/src/components/Terminal.tsx:184-188` — lane C.

`insertedId` is only cleared on that Enter. Scenario: agent proposes `ls -la` → human presses Tab
(inserted) → Ctrl-C (line gone; `insertedId` still set) → types `rm -rf build` → Enter. The branch
`ev.key === 'Enter' && insertedRef.current === p.id` fires `acceptProposal(p.id, {edited:true, alreadySent:true})`:
the proposal `ls -la` becomes `accepted/edited`, `terminal_wait` returns `executed` with the exit
code and tail of `rm -rf build`, the ledger says the agent's proposal ran. Clear `insertedId` on
Ctrl-C/Ctrl-U/Esc/new prompt (the `LineBuffer` reset points), and only treat Enter as "edited accept"
while the line is non-empty since the insert.

### F8 — Bridge: a shell that exits immediately respawns in a tight loop
`packages/bridge/src/bridge.js:141-151` (`onExit` → `spawnShell` unconditionally) — lane C, code path (not run: it would pin the CPU).

Scenario: `$SHELL`/`--shell` resolves to a shell that starts and exits at once (a broken `.zshrc`
with `exit`, a `chsh` to a removed binary that `exec`s and fails, a judge image where zsh cannot read
its rc). Each exit respawns immediately, appends a `shell_restarted` ledger row and sends
`[rokan-terminal] shell exited …` to the tab — hundreds of times per second until Ctrl-C. Cap it
(e.g. 3 respawns per 10 s, then send `exit` once, stop, and let `onIdle` end the process).

## Checked — not defects (with the evidence)

- **Human-Enter gate.** The only writers to `client.sendInput` are `term.onData` (keys/paste, `Terminal.tsx:131`),
  the Enter branch via `acceptProposal` (`:174`), and Tab-insert (`:178`) — all inside the xterm key/data
  handlers. `callAgentTool`/WebMCP `execute` paths end at `ghostType`/`store.propose`; `testhooks`
  exposes `proposals.resolve` (store only, no bytes). No agent path reaches the PTY without a keypress.
- **Buffer-derived data leaving the tab.** `screenLines` (Share-gated, wrapped rows joined), `terminal_wait.tail`
  (Share-gated, `redactForAgent`), `terminal_status.cwd` (Share-gated); `last_command` is never returned to
  an agent; `forge_list` returns param names/descriptions only. F2 is the one hole found in the choke point itself.
- **Ledger chains.** Client: HMAC over canonical `{seq,t,session,kind,fields,prev}` with the key never
  exported; bridge: recursive canonical JSON, reserved keys set last, `client:<kind>` allowlist; cross-verify
  by `client_sig`/`client_seq`. `~/.rokan-terminal/ledger.jsonl` is 0644 but its directory is 0700 (checked).
- **Judge egress (`@cloudflare/containers` `ContainerProxy.fetch`, lines 196-262, read today):** with
  `allowedHosts` set the proxy is a whitelist — non-matching hosts get `520 Origin is disallowed` before any
  handler; `enableInternet=false` only matters as the fallback, and `interceptHttps=false` removes the MITM CA
  without changing the host gate, so HTTP/S egress stays deny-by-default to the 55 listed hosts. No model
  key is injected (`Env` has none; `startProcess` passes none). Raw TCP/UDP is outside this proxy — SECURITY
  §6/§7 already say so. Exfiltration surface with no key: HTTP requests to the allowed doc/status hosts only.
- **Forge identity.** `contentHash` covers name+description+params+commands+kind; the hash is a 12-hex
  (48-bit) prefix — fine as a display identity since approval is required for every registration regardless
  of hash; the ledger stores the same prefix (consider storing the full digest there).
- **One active invocation / chaining.** `invoke` refuses while `activeInv` is set; `next_proposal_id` is
  derived from the store by `(invocation_id, step+1)`; `stopAfterCurrent` on unforge lets a running step finish.
- **OSC parsing / attribution split.** Chunks are split at OSC 133 markers so `cmdOut` holds one command's
  output; a lone trailing ESC is carried; `%` in `$PWD` is safe.
- **Tab/agent takeover.** Judge-mode replacement closes the old socket with 4410 and the `ws !== client` guard
  drops anything a replaced tab still sends; builder mode stays `busy`.
