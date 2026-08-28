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
| Enter never sends a proposal over partial input | the client's `LineBuffer` must be empty; otherwise Enter is an ordinary key. | `terminal-libs.test.ts`, `terminal-ghost-ux.json` |
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
| Only allowed bridge hosts | `isAllowedBridgeUrl`: `ws://127.0.0.1|localhost`, `wss://*.trycloudflare.com`, plus deployment-configured hosts (judge Worker); no path/query/userinfo. CSP `connect-src` mirrors it. | `protocol.test.ts` (9 hostile URLs) |
| Bridge accepts one tab, token first | auth must be the first frame within 5 s, compared with `timingSafeEqual`; second tab → `busy`; Origin allowlist (app origin + localhost). | `packages/bridge/test/smoke.mjs` |
| Bridge binds loopback only; tunnel dies with it | `127.0.0.1`; idle 30 min → process exit kills the tunnel. | smoke |
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
- Tests: `ledger.test.ts`, smoke checks "nested tamper", "F7 reserved fields", "bridge-only kinds".

## 6. Judge mode (Cloudflare Sandbox)

Non-root `judge` user, no sudo; `enableInternet=false` with an HTTP/S allowlist (the SDK cannot
filter raw TCP/UDP — stated, not hidden); 1 new session per IP per 10 min, 3 concurrent; 30-min
TTL ends the session; no persistent volume; the same token-gated bridge runs inside the
container; the Worker never stores tokens. Tests: `infra/sandbox/test/gate.test.mjs`, image smoke.

## 7. Known gaps (honest)

- Option injection through params (see §2). Human-visible before Enter.
- Tool descriptions can still be ignored by a non-cooperative agent — by design nothing depends on them.
- `hex_run` redaction hides git SHAs from the agent (not from the human).
- No CSP nonces yet (`script-src 'unsafe-inline'` for Next hydration); `connect-src` is the enforced part.
- Raw TCP/UDP egress from the judge sandbox is not filtered by the SDK.
