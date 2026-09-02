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
egress allowlist** — and since 2026-08-29 evening open egress is the product: a judge runs `rokan do` on any
site on the open web from inside the sandbox. The isolation that actually holds and is tested:

- **No real secret in the container.** The Worker starts the bridge with `ANTHROPIC_BASE_URL=https://<worker>/api/model/<sid>`
  and the literal `ANTHROPIC_API_KEY=judge-sandbox-proxy` (`infra/sandbox/src/worker.ts`, `startProcess` env).
  The real key is a Worker secret that never leaves the Worker. The judge's shell inherits the bridge env
  (`packages/bridge/src/shell-integration.js`), so anything in it is one `echo` away — which is why nothing
  secret is in it. `terminal-judge-isolation.json` verifies in a live session: key == the dummy, base URL is the
  proxy, no `~/.rokan/vault.json`, and `sk-ant-` appears in no process environment.
- **The model proxy is sid-authenticated and capped, and the caps — not secrecy — bound the spend** (the sid
  is readable from the judge's own shell). `src/model-proxy.ts` + `src/gate-logic.ts`: exactly one upstream
  path (`/v1/messages`; no `count_tokens`), `POST` only, body ≤ 256 KB, model must be on rokan-do's shipped
  ladder (`claude-haiku-4-5-20251001`, `claude-sonnet-5`; anything else → 400, never rewritten), `max_tokens`
  clamped to 8192, no streaming, no tools, text blocks only; request headers allow-listed (`content-type`,
  `anthropic-version`; the client's `x-api-key`/`authorization`/`anthropic-beta` are dropped); upstream
  401/402/403/5xx are never relayed. Every call is **reserved before it is forwarded** at a pessimistic
  estimate and settled from `usage` after (§9 table). Log lines carry an 8-char sid prefix, model, status,
  token counts — never a body.
- **Read-only for strangers — enforced against accidents, stated against intent.** rokan-do's task classes
  are `read_value | read_list | get_api_key` plus a write-shaped `general`; an empty vault is *not* a guard
  in rokan-do's policy (a public-host click on a label outside its deny list is allowed). The image bakes
  `ROKAN_TASK_CLASSES=read_value,read_list` (other classes and the `general` route are refused before any
  browser action) and `ROKAN_GUARD_ALL_HOSTS=1` (every non-navigation click/Enter needs a persisted grant, and
  there are none); native WebMCP writes are refused by name (§8); `rokan-do run` has no `--allow-write` flag.
  The judge owns the shell env, so a hostile judge can unset those — what bounds them then is the model cap
  plus attribution (the Worker logs `session sid= ip=`), and they could already do the same with `curl`.
  `terminal-rokan-readonly.json` proves a write-shaped task is refused in a live session.
- **Headless Chromium runs as the non-root `judge` user with `--no-sandbox`** (Cloudflare's container runtime
  does not expose the setuid/userns sandbox to uid 1000). Honest consequence: a renderer exploit is code
  execution as `judge` — the user the judge already is through the PTY; no new privilege. The container's disk
  is **ephemeral**, **no agent path can write to the PTY** (only a human keypress runs a command), and sessions
  are **per-IP (per IPv6 /64) rate-limited and TTL-capped**; the Gate destroys a session's sandbox at its TTL.
- Minting a sandbox needs a browser on **our** page (`Origin === APP_ORIGIN`) or the eval harness's secret
  header — a header-less `curl` or a page on the judge's own localhost cannot spawn containers (review P0,
  fixed 2026-08-29).

The values the Worker enforces are in §9 (single source of truth).
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
- CSP: per-request nonce + `'strict-dynamic'` for scripts (no `unsafe-inline`); `style-src` still allows inline styles (Tailwind).
  With the live board on (the submitted default) `connect-src` also carries exactly the one Supabase project origin and
  its `wss://` twin — never a wildcard over `*.supabase.co`.
  With the gesture build flag on (the submitted default) the script-src additionally carries `'wasm-unsafe-eval'` — wasm
  compilation only, it does not restore JS `eval` — and Permissions-Policy grants `camera=(self)`; with the flag off both
  headers are byte-identical to the pre-gesture build (asserted by the middleware's own branch); `connect-src` is the WebSocket allowlist.
- **Judge-container egress is open by design** (`enableInternet=true`): a stranger's session can make outbound HTTP/S requests — and drive a headless browser — from Cloudflare infrastructure. Bounded by the per-IP session caps, the 30-min TTL, the model-call caps and ephemeral disk; attribution is the `session sid= ip=` log line. Rokan's own HTTP path refuses private/link-local/metadata targets; the shell does not (a judge can `curl` them regardless).
- **The model proxy's sid is a bearer credential inside the sandbox** (readable via `echo $ANTHROPIC_BASE_URL`). It expires with the session and spends at most the §9 per-session cap; `redactForAgent` redacts the sid shape so a shared screen never hands it to an agent.

## 8. Tier 0 — consuming a site's own WebMCP tools (builder mode)

`rokan do` can call a site's **own** declared WebMCP tools (via the CDP `WebMCP` domain from
rokan-do's Chromium) before it ever plans against the DOM. The boundary is read-only by construction:

- **Read-only gate (`rokan_do/native.py`).** A native tool is auto-invokable only when it is a
  read — either annotated `readOnly`, or its name is a known safe verb (get/list/search/read/…).
  `_is_write_name` rejects anything whose name segments include a write verb *or* the substrings
  `checkout`/`purchase`/`payment`, so `check_out`, `get_and_delete_cart`, `submit_order` never auto-fire;
  a tool annotated `consequential` is never auto-invokable either.
  Anything not proven read-only is skipped unless `allow_write=True` — which the terminal never sets.
- **Nothing executes.** A native call reads; it does not spend or submit. A consequential step still
  goes through ghost-type + the human's Enter, exactly like every other step.
- **Untrusted tool output.** A site's tool output is untrusted content: it is redacted through the
  single choke point and capped at 1.5 K chars (`_clean_output`) before the agent sees it, and the
  `⚙ native:` / `⚡` provenance markers are **stripped from the answer text** and re-parsed only after
  the ms tail in the bridge (`rokan-trailer.js`), so a site cannot spoof its own provenance.
- **No cross-question replay.** Native operations live in a **separate `native_op` table keyed on the
  exact normalized question + host** (never the fuzzy answer-match path), so one question can never
  replay another's answer at 0 calls. (Review round 3 found and fixed a URL-path collision here;
  regression-tested.)
- **In the judge sandbox too (since 2026-08-29 evening).** The image carries headless Chromium and the
  capped model proxy, so unseeded questions plan for real against read classes only (`ROKAN_TASK_CLASSES`,
  `ROKAN_GUARD_ALL_HOSTS` — §6), and a site's own WebMCP tools can be consumed there as in builder mode.
  `terminal-rokan-open-net.json` proves a never-seen site answers on the first run and replays at ⚡ 0 calls
  on the second.
- Tests: `packages/rokan-do/tests/test_native.py` (37) — read/write gate, 0-call replay, schema-hash
  re-select, isolation; bridge `trailer.test.mjs` (marker parse) + smoke (`⚙`/`⚡` on an `echo` not attributed).

## 9. Judging-window caps

**Judging-window caps (single source of truth; Arav signs off before the tightening deploy).** The
Worker vars are the enforcement; this table supersedes any number quoted elsewhere in the docs:

| phase | `SESSION_TTL_MS` | `SESSIONS_PER_IP_PER_10MIN` | `MAX_CONCURRENT_PER_IP` | `max_instances` (`standard-3`, 2 vCPU) | model calls / session (`MODEL_CALLS_PER_SID`) | / sid / min | / IP / 10 min | / day | all-time USD (`MODEL_USD_TOTAL_MAX`) |
|---|---|---|---|---|---|---|---|---|---|
| now (open-net, **deployed 2026-08-29 evening**) | 1 800 000 (30 min) | 10 | 5 | 20 | 120 weighted (a Sonnet call weighs 3; one cold `rokan do` ≈ 6–10) | 40 | 240 | 2 000 | 40 |
| judging window (freeze → results) | 3 600 000 (60 min) | 10 | 5 | 20 | 120 | 40 | 240 | 2 000 | 40 (+ the key's own console limit) |
| after results | 1 800 000 | 3 | 3 | 10 | 60 | 40 | 120 | 600 | 40 |

Per-IP model caps use the IP recorded at `/api/session` (proxy traffic itself leaves through Cloudflare's
shared egress, so its source address identifies no one). Reservation precedence usd → day → ip → sid →
burst → in-flight; a trip is a 429 with `x-should-retry: false`, which rokan-do renders as its
"model provider is rate-limiting" abstention — never a hang. The key itself is a dedicated one with a
spend limit set in the Anthropic console, the guard that survives a bug in ours.

The judging-window row raises the TTL so a judge's session is never cut mid-use and lowers per-IP so
one abuser cannot starve the fleet. It is applied by editing the Worker vars (not code) and verified
with `wrangler containers info` showing the image digest unchanged. Tests: `infra/sandbox/test/gate.test.mjs`.

*Planned (not yet in the build): kept tools.* When a viewer keeps a forged tool it will be stored
per-viewer in `localStorage` and, on restore, re-validated with its content hash recomputed — a
mismatch re-opens the approval card and never auto-registers. That path is a design commitment, not a
shipped mechanism. The store (`kept.ts`) and its 18 unit tests have landed; the part not yet wired is the
  App-level write-path (persist on approve/pin) and the RestoreCard UI — this document will describe kept
  tools as shipped only once that wiring lands.

## §10 — The Drop (the submitted product): trust boundaries, stated plainly

- **The consequential act is not in the API.** There is no `confirm_booking` tool; the tool surface cannot
  express booking (`apps/web/src/lib/drop/clinic-tools.test.ts` asserts the absence by name, in the defs and in the
  descriptions, and the test fakes throw if any tool reaches `driver.book()` or `driver.confirm()`). Booking runs only from an event the browser itself marked
  `isTrusted` (`confirm-logic.ts`) — which no tool call, no console `.click()` and no extension can
  produce. Every synthetic attempt is counted and shown on screen rather than silently dropped.
- **Residual boundary, honestly (rewritten for the live board, SPEC-V3):** the trusted-event gate
  lives in the page. The database (below) enforces *fairness between visitors* — one hold each,
  hold-before-book, only-your-booking cancels and moves, an atomic move — and it **cannot and does
  not** enforce that a human pressed anything: a script holding the publishable key (public, in
  the bundle by design) can create an anonymous session and call `clinic_hold` then `clinic_book`
  directly, for a slot of its own. What the design forecloses is the case that matters: the
  **agent's** API — the WebMCP surface — cannot express booking, cancelling or moving, an agent
  that tries is counted on screen, and no actor of any kind can take another visitor's hold or
  booking. This is the same honest shape as every real booking system: the server guarantees
  integrity, the client guarantees intent.
- **The live board (SPEC-V3):** every visitor shares one inventory in a Supabase Postgres project.
  Identity is an anonymous session per browser (`signInAnonymously`; no sign-up, no credentials,
  no email — an `auth.users` row exists so RLS has a subject). RLS is on; the only policy is SELECT
  for `authenticated`; there are no INSERT/UPDATE/DELETE policies — every write goes through six
  `SECURITY DEFINER` functions (`clinic_board/hold/release/book/cancel/move`, `search_path`
  pinned) whose checks are the invariants above plus a three-active-bookings cap per visitor. The
  publishable key ships in the bundle and is public by design; secrecy authorises nothing. The
  schema is committed at `supabase/migrations/*.sql`. Realtime is a `postgres_changes`
  subscription on the one table, with a 2.5 s poll fallback; other visitors' UUIDs are not exposed
  (`clinic_board` returns booleans `yours_held`/`yours_booked`, never the holder). The booking
  form's fields (name, date of birth, phone, reason) are transmitted nowhere: every function takes
  only a slot id. `?test=1` or `NEXT_PUBLIC_LIVE_BOARD=0` pins the seeded in-page board, which is
  what every eval drives — nothing in CI mutates the shared inventory.
- **The waitlist cascade (SPEC-V5):** `clinic_join_waitlist` / `clinic_leave_waitlist` are
  reversible agent verbs (a place in line, never an appointment), capped at three lines per
  visitor and three waiters per slot, current-wave only, refused for rival-taken slots (that line
  never moves), registered only on the shared board. The hand-over happens inside `clinic_sweep`
  in each slot's queue order (`joined_at`, then visitor id for ties), under a row lock with a
  re-check that the slot is still open: a lost race keeps the waiter's place, a unique/deadlock
  collision skips that waiter rather than failing anyone's board read, and a raw Postgres error
  never reaches a client. One hold per visitor always — a waiter's other hold is given back only
  when the grant actually lands. The simulated rival never takes a queued slot. A cascade grant
  lands at a moment nobody at the keyboard chose, so the dock treats it exactly like an
  agent-timed arm: it is a fresh dock keyed by slot and start time (never a relabelled one under
  a finger in flight), it takes no focus, the 500 ms dead zone applies, and the origin is derived
  in render so the mount-time focus rule can never read a previous origin. A hold this tab asked
  for and was refused is forgotten at once (and any request after 15 s), so a later grant is never
  mislabelled as your own hold. It is announced — the strip above the board and its live region
  say "It came back to you from the line — nobody raced you." Booking still requires the trusted
  press; the queue changes who gets the chance, never who can act. Residual, stated: idle waiters
  cost a slot at most 3 × 45 s per wave; anonymous identities are rate-limited by the auth
  provider, not by us.
- **The declarative form (SPEC-V6):** the details form carries `toolname`/`tooldescription`/
  `toolparamdescription` and NO `toolautosubmit`. Filling is the browser's; submitting is the
  person's: the submit handler refuses any event the browser attributes to an agent
  (`SubmitEvent.agentInvoked`) or that is not `isTrusted`, and counts it on the form. An
  agent-filled form is labelled as such before the person reviews it. Nothing the form holds
  leaves the page (the live board takes slot ids only).
- **Spec primitives, used or deliberately not (WebMCP CG issues cited):**
  `execute(input, {signal})` — every tool honours the platform's AbortSignal: a cancelled call stops
  waiting on the board and answers with what is true at that instant (the verb it already sent is
  not un-sent; the agent can release). Idempotency (issue #267, Google: "the same non-idempotent
  tool called twice") — every write verb is safe to repeat: re-holding your own slot is refused
  with `already_held_by_you` rather than creating a second hold, arming is idempotent by design,
  joining a line twice is a no-op (`on conflict do nothing`), and the database's one-hold-per-visitor
  index makes a double hold impossible at commit. `untrustedContentHint` — deliberately NOT set:
  no tool result carries text authored by anyone other than the caller (slot times, clinicians
  and kinds are server-generated; other visitors appear only as states and counts); the day a
  result carries another person's words, that tool gets the hint. Headers — `Permissions-Policy:
  tools=(self)` (only this origin may register tools; an embedded third party never can) and
  `Origin-Agent-Cluster: ?1` (Chrome disables WebMCP under `?0`). Chrome's size guidance (30-char
  names, 500-char descriptions, 150-char params, 1.5 KB outputs) is asserted by unit tests, not
  promised. The page shows two tool counts side by side — what it registered and what the browser
  itself reports (`getTools`) — so the leverage claim is the platform's, not ours.
- **Injection surface:** slot inventory, clinicians and wave copy are server-generated
  deterministically from the wave index (`clinic_sweep`) or page-authored; no tool echoes
  text authored by anyone other than its own caller (refusals may quote the caller's slot id or
  time string back to the same agent, length-capped and JSON-escaped), so nothing an outsider
  writes can reach a tool description or a tool result.
- **The arming attack class (SPEC-V2, closed 2026-09-01):** `clinic_prepare_cancel` /
  `clinic_prepare_move` let the AGENT choose the moment a destructive dock appears — so a
  prompt-injected agent could try to put a cancel key under a finger already in flight. Three
  defenses, each tested: destructive docks **never take keyboard focus** (only the book dock does);
  a trusted press within **500 ms of arming is ignored** as agent-timed (`ARM_DEAD_ZONE_MS`; a
  synthetic press in that window is still counted as blocked); and a re-arm with a different
  target is a **fresh dock** (keyed remount, fresh announcement, fresh counters). Arming is also
  refused outright while a hold on a different slot is live — the dock's meaning is never swapped
  while a person may be mid-press (`hold_in_progress`, both prepare tools).
- **Camera:** the gesture path is **on in the submitted build** (`NEXT_PUBLIC_DROP_GESTURE` defaults
  to 1 in the build script; `=0` is the kill switch) and **strictly opt-in at runtime** — nothing
  loads and no lens opens until the person has clicked "Enable camera" on an armed dock. Once they
  have, and the browser holds a standing camera grant, the lens DOES reopen on later armed docks in
  later sessions until they switch it off — the pref is persisted, the reopening is double-gated on
  that prior opt-in plus the browser's own grant, and the OS camera light is the indicator. Frames never
  leave the page and the runtime loads from `/models/mediapipe/` on our own origin — never a Google
  CDN — because the weights carry Google's MediaPipe model terms. Those ~42 MB are **provisioned at
  build time, not committed** (`apps/web/scripts/fetch-gesture-model.sh`, sha256-pinned;
  `public/models/` is gitignored): a clone that builds runs the fetch itself, and a missing model is
  an honest on-screen failure plus the keyboard path. Keyboard/switch stays primary, and the dwell absorbs sub-250ms flicker
  without progressing (the grace window) and resets when the gesture is lost beyond it — so a
  tremor can neither fire it nor be punished by it.
- **The gesture's trust root, stated exactly.** The keyboard confirm is gated on `isTrusted`, which
  no script, extension `.click()`, or tool call can forge. A completed camera dwell is a different,
  weaker root: **physical presence** — it requires a person's hand in front of a lens they opted
  into. What it defends against: every remote and same-page actor (a tool call, console script, or
  injected code cannot conjure a hand). What it does not defend against: software with power over
  the camera itself — an extension or OS-level actor substituting a fake video stream — which is
  the same actor class that could already forge trusted input via the debugger API. Voice is
  refused as a confirm channel for a sharper reason: the agent HAS a voice, and in a speakers+mic
  live showing could utter the confirmation itself. It does not have a hand.
- **No model call, no PII:** the product makes no LLM call of its own — the reasoning is the
  visitor's own agent in their own client — and stores no personal data: the form is transmitted
  nowhere and the database holds slot states and anonymous session ids only. Every number on
  screen is measured by the code that shows it; the counter counts only trusted events.
- **Fairness:** one live hold per visitor (server-enforced), at most three active bookings per
  visitor (server-enforced). The labelled simulated rival takes exactly three of six slots per
  wave at +6/+20/+34 s, only slots still open, and never the last open one — so someone arriving
  late can always still book. Other visitors can take the last open one; that is the point.
- **Accessibility:** axe-core reports 0 violations on all three routes (WCAG 2.0/2.1/2.2 A + AA), gated by
  `node evals/a11y.mjs`. The camera gesture is opt-in per person, always beside a keyboard path.

