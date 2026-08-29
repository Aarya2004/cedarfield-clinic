# Security model — Rokan Terminal

> WebMCP tool descriptions are hints to a cooperative agent, never a security boundary.
> **Our boundary is the keyboard.** Nothing an agent can call executes; the only path to the
> shell is bytes typed in the human's browser tab.

Everything below is implemented and covered by a test that fails when it regresses
(`pnpm gate`: unit tests, real-PTY smoke, headless WebMCP cases). Two independent reviews on
2026-08-28 (Opus 5, Fable 5) found 36 issues; all P0/P1 are fixed and listed with their tests.

## 1. Execution boundary

| claim | mechanism | test |
| --- | --- | --- |
| No tool executes | `terminal_propose` and every `forged_*` tool only create a proposal (ghost text). The client sends bytes to the PTY only from (a) keystrokes in the xterm pane, (b) Enter on a ghost text (sends exactly the validated `command + "\r"`), (c) Tab-insert (sends `command` without `\r`). | `forge.test.ts`, `terminal-adapter.test.ts`, `terminal-propose-enter.json`, `terminal-forge-live.json` |
| What you see is what runs | `validateProposedCommand` rejects CR/LF, C0/C1 controls (incl. ESC) and Unicode format chars (bidi overrides) in `command`; `why` is stripped of the same and rendered in a bidi-isolated element. | `forge-spec.test.ts`, `gate-a-propose-wait.json` (ESC/RLO cases) |
| Ghost text never touches the PTY parser | drawn as a DOM overlay positioned from the cursor cell; the terminal buffer is untouched until Enter. | `terminal-ghost-ux.json` |
| Enter never sends a proposal over partial input | the client's `LineBuffer` must be empty: printable keys are counted since the last prompt marker, and history recall (↑ ↓ PgUp PgDn, Ctrl-R/P/N/Y, Alt-.) or any pasted / IME payload marks the line *dirty* until Enter, Ctrl-C/U/D or the next prompt marker; while the bridge reports `running:true` the ghost is hidden and Enter is an ordinary key — **with zsh shell integration only**: on bash/sh/fish `running` is unknown, the ghost bar says "no shell integration", and the 750 ms quiet fallback only decides completion (a silent long command counts as done); it is not a guard. The shell's real line is never parsed — when in doubt the estimate says "not empty". | `terminal-libs.test.ts`, `terminal-adapter.test.ts`, `terminal-ghost-ux.json` |
| Hard-blocked patterns need two Enters | `isDangerous` (`rm -rf /`, `/*`, `~`, `$HOME`, fork bomb, `mkfs`, `dd if=`, `> /dev/sd*`, `curl|sh`) → red banner, first Enter arms. | `forge-injection.json`, `terminal-ghost-ux.json` |
| One ghost text at a time | a new proposal supersedes a pending one (`reason:"superseded"`, its `terminal_wait` resolves); `terminal_propose` is refused while a forged invocation is active. | `forge-queue.json` |

## 2. Forge (tools born at runtime)

| threat | mitigation | test |
| --- | --- | --- |
| Injected screen text asks the agent to forge `rm -rf` as a "read" tool | `forge_create` never registers — a card + human approval; `kind` forced to `write` on mutating verbs; dangerous commands need "Approve anyway". | `forge.test.ts`, `forge-injection.json` |
| Param value smuggles shell syntax | values are validated (no control/format chars, ≤ 200), rendered bare only when `^[A-Za-z0-9_./:@%+=,-]{1,80}$`, else POSIX single-quoted; inside `"…"` the region is spliced (`"a "'$(x)'" b"`); inside `'…'` → `'\''`; inside ANSI-C `$'…'` → `\\` / `\'`. The final line is re-validated. **Known non-goal:** option injection (`dir="-rf"`) — the human sees the substituted span before Enter. | `forge-spec.test.ts` (incl. `$'…'` breakout from the Fable review) |
| Tool framing / hijack (arXiv 2606.06387): a re-forge softens the description or flips read→write | content hash (SHA-256, 12 hex) over name + description + params + commands + kind; a changed hash requires a fresh approval; hash on the card and in every `forged`/`invoked`/`executed` ledger row. | `forge.test.ts` |
| Registration races / AbortSignal abuse | one `AbortController` per forged tool, aborted before any re-register; `execute` refuses after abort; Chrome 152 removes the tool (`toolsRemoved`) — measured. | `forge-budget.json` |
| Picker noise / runaway tools | 6 fixed + ≤ 5 forged visible; oldest unpinned evicts; `forge_list` still lists evicted. | `forge-budget.json` |
| Agent floods cards | ≤ 5 pending cards. | `forge.test.ts` |
| `readOnlyHint` is agent-declared elsewhere | here it is derived only from the human-approved `kind`; writes carry `CONSEQUENTIAL:`. | `forge-injection.json` |

## 3. What leaves the tab

| claim | mechanism | test |
| --- | --- | --- |
| Screen text is off by default | `terminal_read_screen` and `terminal_wait.tail` return nothing until the human turns on "Share screen"; `terminal_status.cwd` is gated the same way. | `terminal-read-screen.json` |
| Secrets are redacted before any agent sees them | single choke point `redactForAgent()`: AWS keys, `sk-`/`sk_live`/`rk_`, GitHub, Slack, Google `AIza`, npm, JWTs, PEM/PGP blocks, `PREFIX_TOKEN=` / `"password": "…"` / URL credentials / CLI `--password` flags, 32+ hex runs (also hides git SHAs — deliberate). Lines are ANSI-stripped first. | `redact.test.ts` (31 cases incl. the 18 that leaked in review), `terminal-read-screen.json` (real `AWS_SECRET_ACCESS_KEY` on a real screen → `[redacted]`) |
| Output size is bounded | ≤ 1 500 chars per tool result (`truncated` flag). | `register.ts` `fitBudget` |
| Untrusted content is marked | `terminal_read_screen` sets `untrustedContentHint`. | `gate-a-propose-wait.json` (`list`) |

## 4. Pairing and transport (builder mode)

| claim | mechanism | test |
| --- | --- | --- |
| Random tunnel + 128-bit token | `cloudflared` quick tunnel; token in the URL **fragment** (never sent to Vercel); consumed from the address bar on load (`history.replaceState`). | `protocol.test.ts`, `terminal-pair.json` (`location.hash === ''`) |
| Cross-origin pairing is blocked | `isAllowedBridgeUrl` + CSP `connect-src`: a third-party page cannot open our tab's socket to an arbitrary server — only `ws://127.0.0.1\|localhost`, `wss://*.trycloudflare.com`, and deployment-configured hosts (judge Worker, `/ws/<signed sid>` path only); no query/userinfo, no path elsewhere. **This is not a defense against a user pasting a maliciously-crafted pairing link — see §7.** | `protocol.test.ts` (9 hostile URLs) |
| Bridge accepts one tab, token first | auth must be the first frame within 5 s, compared with `timingSafeEqual`; second tab → `busy` in builder mode (judge mode: the newest tab with the token takes over and the old one is told `replaced`); Origin allowlist (app origin + localhost). | `packages/bridge/test/smoke.mjs` |
| `calls:0` is never inferred or forged by output | The bridge parses rokan-do's printed result line (`  <answer>   <ms>ms[  ⚡]`) from the last command's output **only when the command line that ran is `rokan` / `rokan-do`** (`isRokanCommand`, env-assignment and path prefixes allowed) — an `echo` of the same line, or any other program printing it, is never attributed (negative tests in smoke + E2E). `calls:0` only when the ⚡ (replay) mark is present, `calls:null` otherwise — model-call counts are not printed and are not guessed. | `trailer.test.mjs`, smoke ×3, `terminal-rokan-trailer.json` |
| Bridge binds loopback in builder mode; tunnel dies with it | `127.0.0.1` on the builder's machine; idle 30 min → process exit kills the tunnel. In judge mode the bridge binds `0.0.0.0` *inside the container* (no public address) and is reachable only through the Worker's WebSocket proxy at `/ws/<signed sid>` — the sid is HMAC-signed with a Worker secret, carries the session's expiry, and is verified (constant-time, unexpired) before any sandbox is touched — a stale tab cannot restart a container after the TTL. | smoke, `sid.test.mjs` |
| Bridge survives hostile input | OSC 7 with stray `%`, shell exit → respawn, dead-PTY writes guarded. | smoke (F2/F3) |

## 5. Ledger — tamper-evident, countersigned by the bridge

- Client rows are HMAC-chained with a per-tab key held in memory only (never persisted, never
  exported by default). That is **tamper-evident within the tab**, not proof to a third party.
- The proof is the **bridge countersignature**: every client row is forwarded, the bridge stores
  it verbatim under `client{…}` and signs it with a key in `~/.rokan-terminal/keys/` that the
  page never sees; the ack's `sig` is stored on the row (`✓` in the UI). `verifyLedger()`
  detects any nested-field tamper (recursive canonical JSON — the first review found the flat
  version missed nested keys).
- Clients cannot forge bridge-only kinds (`executed`, `paired`, `shell_exited`) or override
  `seq/t/session/origin`. Say "tamper-evident, countersigned by the bridge" — never "tamper-proof".
- `npx rokan-terminal verify rokan-ledger-<session>.json` cross-checks a page export against the bridge ledger on that machine: every countersigned row must match the client signature the bridge stored and the bridge chain must verify (smoke: "crossVerify").
- Tests: `ledger.test.ts`, smoke checks "nested tamper", "F7 reserved fields", "bridge-only kinds", "crossVerify".

## 6. Judge mode (Cloudflare Sandbox)

Non-root `judge` user, no sudo; **outbound internet is on** (`enableInternet=true`). We tried to lock
egress to a demo-host allowlist (`allowedHosts`), but measured live (2026-08-29) that the SDK's HTTPS
interception never activates in this deployment — the ephemeral CA is never created and, with
`enableInternet=false`, egress to an allowlisted host times out — so `allowedHosts` gated nothing for
HTTPS. rokan-do's seeded replay needs a real HTTPS fetch, so egress must work. **We do not claim an
egress allowlist.** The isolation that actually holds and is tested: the container carries **no model
API key and no secret vault** (`terminal-judge-isolation.json` verifies `ANTHROPIC_API_KEY` unset and
no `~/.rokan/vault.json` in a live session), its disk is **ephemeral** (reset every start), **no agent
path can write to the PTY** (only a human keypress runs a command), and sessions are **per-IP
rate-limited (3/10 min, 3 concurrent) and 30-min TTL-capped** (a Gate row is provisional for 180 s
until the bridge answers, so an aborted start cannot lock an IP for the TTL). An open-egress container
with nothing to steal and nothing to spend is the control — not a filter the SDK didn't enforce.
No persistent volume; the same token-gated bridge runs inside the container; the Worker never stores
tokens; a failed session start returns a generic 503 and logs internals server-side (no stack/SDK
detail to the client). Tests: `infra/sandbox/test/gate.test.mjs`,
image smoke. (The judge Worker was written after the two external reviews; C self-audited it against
the same P0/P1 bar — CORS allowlist, per-IP rate limit on the one write endpoint, no secret in code,
generic errors.)

## 7. Known gaps (honest)

- Option injection through params (see §2). Human-visible before Enter.
- **Builder-mode pairing link is a bearer credential.** The link the bridge prints (`#ws=wss://<random>.trycloudflare.com&t=<token>`) is all that is needed to pair; the `*.trycloudflare.com` allowlist is a wildcard (quick-tunnel hostnames are random), so a user who pastes a *maliciously-crafted* pairing link would pair their tab to an attacker's bridge — keystrokes forwarded, screen spoofed. The token does not help (the attacker's bridge accepts any token), and no in-band check can, since everything needed is in the link. Treat a pairing link like any URL you paste: only use the one your own `rokan-terminal` prints. Judge mode is **not** affected — the host is our fixed Worker and only the HMAC-signed `/ws/<sid>` path is accepted. A future builder-mode hardening would show the target host for out-of-band confirmation before connecting.
- Tool descriptions can still be ignored by a non-cooperative agent — by design nothing depends on them.
- `hex_run` redaction hides git SHAs from the agent (not from the human).
- CSP: per-request nonce + `'strict-dynamic'` for scripts (no `unsafe-inline`); `style-src` still allows inline styles (Tailwind); `connect-src` is the WebSocket allowlist.
- **Judge-container egress is open** (`enableInternet=true`): a stranger's session can make outbound HTTP/S requests from Cloudflare infrastructure. Bounded by the per-IP rate limit + 30-min TTL + ephemeral disk; the container holds no key and no secret, so there is nothing to exfiltrate or spend. The `allowedHosts` list is retained as documentation only — the SDK's interception did not activate here to enforce it (measured). Raw TCP/UDP is likewise unfiltered.
