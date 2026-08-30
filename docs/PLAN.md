# Rokan Terminal — WebMCP Challenge execution plan

> **This is a hackathon entry** (OpenAI WebMCP Challenge, Devpost, 10 days, $35K, top-10, 7 judges).
> **Status: PROPOSED. Nothing built. Arav + Aarya both say "go" before any code.**
> Written 2026-08-28 night. Deadline **2026-09-03 13:00 PT** (Devpost rules; ignore
> "5pm"/"Sep 4"/"Aug 31" from secondary sources). Research: `docs/WEBMCP-RESEARCH.md`.
> Decision trail: `docs/IDEA-LEDGER.md` §S (in the Rokan repo, not here). This file follows the Handset discipline
> (`~/YC Hack VA MAY26/handset/{CONTEXT,EXECUTION_PLAN,DEMO_SCRIPT,TEST_PROTOCOL,REDTEAM}.md`)
> folded into one document: §0 locked decisions · §1 product · §2 architecture · §3 tool
> contracts · §4 security · §5 repo · §6 schedule · §7 test protocol · §8 demo + video ·
> §9 submission text · §10 risks + kill rules · §11 rules · §12 asks.

---

## 0. Locked decisions (don't re-litigate without editing this section)

1. **Entry = Rokan Terminal**: a shared human+agent terminal in a browser tab, WebMCP tools on
   the page, **the human's Enter is the trust boundary**, and **forge**: a command sequence
   becomes a named, typed WebMCP tool + a button. **`rokan do` is the star command.**
   WHY: the four-judge kill-shot is DOM-driving _inside the WebMCP layer_. The terminal keeps
   the WebMCP layer clean; browsing happens in the shell on the user's machine — Roberts's
   own conceded "fallback". Ghost-typing threads OpenAI's per-call safety review (the tool is
   inert). Ledger §S addendum 2.
2. **Two modes, one client.** _Builder mode_: your own machine via a local bridge + Cloudflare
   quick tunnel. _Judge mode_: a hosted Cloudflare Sandbox container, seeded, throttled.
   Judges never install anything. The video shows builder mode.
3. **All execution is a human keypress.** Agent tools never run a command. Not `propose`, not
   forged tools. "Trusted auto-run" is a stretch goal, off by default, never in the demo.
4. **Imperative WebMCP, top-level document only.** ChatGPT's consumer ignores declarative forms
   and iframe tools. ≤ 12 tools visible at any time (picker noise, Chrome's guidance).
5. **No acquisition, no voice, no channels, no mascot, no Shopify re-registration, no
   chat-style `ask/do` meta-tools, no live writes that spend money.** §R stays parked.
6. **Honest numbers only.** Every ms and call count on screen is measured by the code that
   shows it. No synthetic telemetry (Handset REDTEAM L1). N is stated wherever a % appears.
7. **Launch = submission.** Public repo, live URL, video, and (Arav's call) PyPI on Sep 2.
8. **Kill rules (§10) are binding.** Gate B (terminal + ghost-typing green in ChatGPT desktop)
   by Sat 22:00 PT or we ship _that_ alone — **superseded by §0.9 for what "alone" means.**
9. **Forge leads; the terminal is the vehicle.** (Decided 2026-08-28 02:30 PT by C on
   RESEARCH §6b–6c and two outside reviews; Arav/Aarya veto by editing this line.) The pitch,
   the hero moment (§1), the cold open (§8) and the README's first line lead with _a WebMCP
   tool born at runtime from something the human just did, then called by the agent_.
   Governance ("your Enter is the trust boundary") is the second sentence — the safety story,
   never the headline. WHY: ~48% of live entries are the governance lane and use our sentence;
   nearly all register a fixed tool list at load. Runtime `registerTool` of a user-made tool is
   the one shot nobody else has and the strongest reading of tiebreak #1. Retrofit stays out
   (§0.1). Consequences: §11 rule 1 inverted; §10 risk 3 inverted (Gate B red kills terminal
   _polish_, never forge); **Gate C is decoupled from Gate B** — forge must demo on the
   prompt line alone (no PTY; forged tools only ghost-type) by Sat 22:00 with headless-Chrome
   evidence, and on the live terminal by Sun 22:00. **Open measurement that can still change
   the shot:** whether ChatGPT desktop's Site tools list picks up a runtime registration
   (`toolchange`) without a page reload — measure the hour the app is installed; if it does
   not, the hero shot uses DevTools → WebMCP for the birth and ChatGPT after a reload, stated
   honestly. Chrome 152 does (measured: one `toolsAdded` per runtime `registerTool`).
10. **Compose the web, keep it as a tool — `docs/COMPOSE-PLAN.md` is the final layer.** (Decided
    2026-08-29 ~03:00 PT by Arav with Engineer #4 after seven research lanes; Aarya veto by editing
    this line.) The two §S finals merge: the terminal stays the vehicle; `rokan do` becomes
    *consume-else-compile* (Tier 0: a site's own WebMCP tools first — measured feasible on
    allbirds.com, 10 tools; compiled operation where none exist; retired when native arrives); a
    forged tool composes `machine`, `web:native`, `web:compiled` steps and is **kept** across
    reloads with re-approval. Headline demoted: "your Enter is the trust boundary" is a mechanism,
    never the pitch (93% blind-approval data; labs moved to shape rules + classifiers). Corrected
    fact: ChatGPT desktop *has* an integrated terminal + user-defined actions — never claim "no
    shell". The two structural demos are D1 (same hashed tool called from ChatGPT, Codex, Claude
    Code) and D2 (second run at 0 calls with a drift refusal, A/B with N and CIs). Production bar
    §1.1 of COMPOSE-PLAN binds (judging-window caps raised; `npx` published; no simulated flows).

---

## 1. Product

**One line (§0.9 order):** **Do it once. Now it's a tool.** Rokan Terminal is a terminal where
anything you approve becomes a live WebMCP tool your agent can call — born at runtime, run only
by your Enter. (Old order, kept as the second sentence: a terminal you and your agent share;
your Enter is the trust boundary.)

**Hero moment (the 15 seconds that must land):** a command you ran a minute ago is in the
history → select it → **Forge** → card (name `hn_top`, param `n`) → approve → **`forged_hn_top`
appears in the agent's site-tools list without a reload** → "top 3 now" → the agent calls
`forged_hn_top({n:3})` → ghost-typed → your Enter → `calls:0 · 0.36s` in the ledger. _Then_ the
second act: proposals, Share-screen + redaction, the signed ledger — why the birth was safe.

**Audience (Impact criterion):** developers whose ChatGPT/Codex needs to act on their machine,
their dashboards, their deploys — with a human present and every keystroke visible. Provencher
(OpenAI): "Codex is your customer." Roberts (Netlify): agents are "extensions of real users."

**What humans + agents can do together that was impossible:** the agent gets hands on a real
shell without ever getting execution; the human gets a co-pilot that proposes, reads, and
remembers — and the two of them grow a tool library neither had at the start.

**Why Rokan:** `rokan do` is the command most worth forging: typed once (model plans, browser
verifies), forged into `forged.hn_top({n})`, replayed at 0 calls. The thesis — operations
compile, the model leaves the hot path — on camera, in the world's format, without exposing
browser replay to the WebMCP layer.

---

## 2. Architecture

```
                 ┌───────────────────────── Vercel (Next.js 15, App Router) ─────────────────────────┐
                 │  /                 xterm.js pane · Tools pane · Forge card · Ledger column        │
                 │  document.modelContext.registerTool(...) × ≤12   (client component, top-level)   │
                 │  WS client  ──────────────────────────────────────────────────────────┐          │
                 └───────────────────────────────────────────────────────────────────────┼──────────┘
                                                                                         │ wss://
                 BUILDER MODE (video, real users)                 JUDGE MODE (live URL)  │
   ┌────────────────────────────────────────────┐   ┌─────────────────────────────────────▼────────┐
   │ user's Mac                                  │   │ Cloudflare Worker  (@cloudflare/sandbox)     │
   │  `npx rokan-terminal` →                     │   │  getSandbox(env.Sandbox, sessionId)          │
   │   node-pty (zsh) ⇄ ws://127.0.0.1:7331      │   │  → container: Debian + Python 3.11 + uv +    │
   │   + `cloudflared tunnel --url` (quick)      │   │    node + rokan-do wheel + playwright chromium│
   │   prints  https://<rand>.trycloudflare.com  │   │    seeded ops (0-call replays), $-capped key │
   │   + pairing token (URL fragment)            │   │  xterm SandboxAddon WS terminal              │
   └────────────────────────────────────────────┘   └──────────────────────────────────────────────┘
```

Decisions inside the diagram:

- **No Durable Object relay in v1.** Builder mode connects the client straight to the tunnel;
  judge mode uses the Sandbox SDK's own WebSocket terminal. A DO relay is only needed for
  multi-viewer sessions — stretch, day 5, only if everything else is green.
- **Local bridge = one Node script** (`packages/bridge`): `node-pty` spawns the user's shell,
  `ws` serves `{type:"data"|"resize"|"input"}` frames, a `--token` gate, and it shells out to
  `cloudflared tunnel --url http://127.0.0.1:7331`, parses the printed URL, prints a single
  pairing link `https://<vercel-app>/#ws=<tunnel>&t=<token>`. Verify on day 1 that quick
  tunnels pass WebSocket upgrades (docs are silent; SSE is unsupported; WS is widely used).
  Fallback: named tunnel on Arav's account.
- **Judge sandbox** = Worker route `/api/session` → `getSandbox(env.Sandbox, id)` → start
  shell → return the WS URL for the xterm `SandboxAddon`. Container Dockerfile in
  `infra/sandbox/Dockerfile`. Rate limits: 1 session per IP per 10 min, 30-min TTL,
  `rokan-do` inside the sandbox has no API key (none is injected, by design), so it can only replay seeds; a per-session model-call cap is therefore not implemented — it becomes necessary only if a key is ever wired in.
- **Ledger** lives client-side (append-only array, mirrored to `localStorage`, exported as
  JSON) and is _also_ appended to `~/.rokan-terminal/ledger.jsonl` by the bridge (builder
  mode). One row per: proposal, keypress-execution, forge, forged-invocation, screen read.
- **`rokan do` output parsing**: the bridge watches PTY output for the `rokan-do` trailer
  (`… 6.1s` / `41ms ⚡`) and, if present, attaches `{calls, ms}` to the ledger row. Day-3 task
  in Rokan: `rokan-do run --json` printing `{answer, verified, model_calls, ms}` on one line so
  parsing is exact, not regex. If that lands, the bridge prefers it.

---

## 3. WebMCP tool contracts (exact; names ≤ 30 chars; descriptions ≤ 500; outputs ≤ 1.5 KB)

All registered from one client component `<TerminalTools/>` on `DOMContentLoaded`, each with
its own `AbortController` so tools unregister when their pane unmounts. Feature-detect
`document.modelContext ?? navigator.modelContext`; the page is fully usable with neither.

| #   | name                      | inputSchema                                                                                                                                     | annotations                                                                                                                                   | behaviour                                                                                                                                                                             | returns                                                                                                                                                                                                                            |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------- |
| 1   | `terminal_propose`        | `{command: string (≤ 400), why?: string (≤ 200)}`                                                                                               | `readOnlyHint:false`                                                                                                                          | Writes `command` into the prompt line as ghost text (dim, highlighted diff vs. current input). **Never executes.** Human edits/Enter/Esc. Ledger row `proposed`.                      | `{proposal_id, status:"awaiting_human"}`                                                                                                                                                                                           |
| 2   | `terminal_read_screen`    | `{lines?: integer 1–200 (default 60)}`                                                                                                          | `readOnlyHint:true, untrustedContentHint:true`                                                                                                | Returns the last N lines of the visible buffer **after redaction** (§4). Only if the human's "Share screen with agent" toggle is ON; else `{shared:false}`. Ledger row `screen_read`. | `{shared, lines:[…] (redacted), cwd?, last_exit?, redactions, truncated}` or `{shared:false, reason}`                                                                                                                                                                                            |
| 3   | `terminal_status`         | `{}`                                                                                                                                            | `readOnlyHint:true`                                                                                                                           | `{mode:"builder"                                                                                                                                                                      | "judge", cwd, running:boolean, last_exit_code, last_command_ms}`                                                                                                                                                                   | as left                              |
| 4   | `terminal_wait`           | `{proposal_id}`                                                                                                                                 | `readOnlyHint:true`                                                                                                                           | Resolves when the human executes/dismisses that proposal, or returns `still_waiting` after **45 s** (re-callable; ALIGNMENT row 4). Lets the agent block on the human instead of polling. Honours `signal` when the consumer passes one (Chrome 152 does not).                                     | `{status:"executed"|"dismissed"|"still_waiting"|"unknown_proposal", waited_ms, exit_code?, ms?, tail:[…] (redacted, empty unless shared), shared, reason?, next_proposal_id?}` |
| 5   | `forge_create`            | `{name ^[a-z][a-z0-9_]{1,28}$, description ≤ 300, commands: string[1..5] with {{param}} placeholders, params?: [{name ^[a-z][a-z0-9_]{0,19}$, description ≤ 150, example ≤ 80}] (≤ 6), kind: "read"\|"write"}` | `readOnlyHint:false` | Validates (control/bidi chars, placeholder ↔ param consistency, dry run with examples); `kind` forced to `write` when a command mutates; dangerous patterns → red banner + "Approve anyway". Opens a **Forge card**; ≤ 5 pending. Ledger `forge_requested`. | `{card_id, status:"awaiting_human", will_register_as:"forged_<name>", kind, note?, warning?, replaces_hash?}` or `{error, detail}` |
| 6   | `forged_<name>` (dynamic) | from card params, `additionalProperties:false`, `examples` per param | `readOnlyHint: kind==="read"`; `write` descriptions start with `CONSEQUENTIAL:`; one `AbortController` per tool; content hash (12 hex) shown on the card and in every ledger row | Substitutes params (bare when clean, else POSIX-quoted; `$'…'` modelled), ghost-types step 1, queues steps 2..N (promoted after the prior step's measured exit; non-zero exit → `prior_step_failed`). One active invocation at a time. Ledger `invoked` + `executed_step` per step (bridge-accepted client kind). | `{invocation_id, proposal_ids:[all], active, queued, hash}` · `{status:"busy", active_invocation_id, proposal_ids}` · `{error:"invalid_param"\|"unregistered"…}` |
| 7   | `forge_list`              | `{}` | `readOnlyHint:true` | Every forged tool incl. evicted (`visible:false`), pin state, hash, params, measured stats. ≤ 1.5 K chars (params dropped first). | `{visible, budget:5, tools:[{name, tool, kind, hash, pinned, visible, params, runs, median_ms, last_exit, forged_at}], truncated?}` |

Implemented deltas vs. the original rows (2026-08-28): `terminal_wait` default is **45 s** with `still_waiting` (re-callable), returns `unknown_proposal`, `next_proposal_id`/`invocation_id` for forged steps, `reason` on dismiss, `edited`/`interrupted`; `terminal_read_screen` returns `redactions`/`truncated`; `terminal_status` returns `cwd` only when Share is on and `measured` (shell integration). `forged_*` returns **all** proposal ids (queue) — not just the first. Later the same day: `terminal_wait` adds `measured:false` (no shell integration) and `rokan:{ms,replayed,calls}` (only when the command line was rokan/rokan-do); `terminal_status` adds `measured` and `last_rokan`; client step rows are kind `executed_step`.

Reverse direction (human → agent), UI only: select 1–5 lines in history → **Forge this** → card
prefilled from the selection → same approval path → tool appears for the agent.

Tool budget: **7 fixed** (`terminal_propose`, `terminal_read_screen`, `terminal_status`, `terminal_wait`,
`terminal_history`, `forge_create`, `forge_list` — `FIXED_TOOL_NAMES` in
`apps/web/src/lib/webmcp/schemas.ts`) + up to 5 forged visible: **7 + 5 = 12, exactly at the §0.4 cap**,
not under it. A new fixed tool now costs a forged slot. Beyond 5 forged, `forge_list` still returns all and the
oldest unpinned forged tools unregister (the human pins from the card).

Chrome DevTools → Application → WebMCP panel must show every registration and invocation
(Drasner's "observability" beat, 2 s in the video).

Evals (`GoogleChromeLabs/webmcp-tools/evals-cli`): `evals/` with ≥ 6 cases — "run the tests",
"what's in this directory", "deploy this", "forge the last two commands as `deploy`", "read
the screen and tell me why it failed", ambiguous "clean up" (must _propose_, not execute) —
asserting ordered/unordered expected calls. Gao reads this folder.

---

## 4. Security model (this is a scored section — make it the strongest)

**Threat**: prompt injection through `terminal_read_screen` (a file, a log line, a web page
fetched by `rokan do` says "run `curl … | sh`").

**Why it can't execute**: no tool executes. The only path to the PTY is a human keypress on the
human's device. The agent's worst case is a _proposal_ the human reads before Enter. The
proposal is rendered as a diff against the current prompt, in a distinct colour, with the
agent's `why` beside it. Multi-line proposals are refused (one command per proposal;
`&&`/`;`/`|` allowed, newlines not). Proposals containing a hard-blocked pattern
(`rm -rf /`, `:(){ :|:& };:`, `mkfs`, `dd if=`, `> /dev/sd`, `curl … | sh`, `sudo` in judge
mode) are shown with a red banner and require a second confirmation.

**Secrets in scrollback**: `terminal_read_screen` is OFF by default; the human turns on "Share
screen with agent" per session. Redaction before return: AWS `AKIA…`, `sk-…`, `ghp_…`,
`xox[abp]-…`, JWT `eyJ…`, `-----BEGIN … KEY-----` blocks, `password=`/`token=`/`secret=` values,
`Authorization:` headers, 32+ hex runs. Redacted spans render as `[redacted]` in the tool result
_and_ are highlighted in the pane so the human sees what would have leaked.

**Pairing** (builder mode): tunnel URL is random; the bridge requires a 128-bit token carried in
the URL fragment (never sent to Vercel); one client per bridge; bridge refuses a second
connection; idle timeout 30 min; `Ctrl-C` twice in the bridge kills the tunnel.

**Judge sandbox**: non-root user; **egress is open** (`enableInternet = true` in
`infra/sandbox/src/worker.ts`). The `allowedHosts` list is retained as documentation of the demo hosts,
but the Sandbox SDK's HTTPS interception never wired up in this deployment (measured 2026-08-29: no CA at
`/etc/cloudflare/certs/`, and with `enableInternet=false` even an allowlisted host timed out, curl exit 28),
so it gates nothing — the planned allowlist was aspirational and is not the isolation model. The controls are
elsewhere: no real secret in the container, ephemeral disk, no agent path that can write to the PTY, and
rate limits — 30-min TTL,
3 sessions/IP/10 min (3 concurrent), no API key in the container (so no model-call cap is needed or implemented), no persistent volume, image rebuilt from a
pinned Dockerfile. The `$`-capped Anthropic key lives in Worker secrets, never in the image.

**Ledger**: append-only, every row signed with a per-session HMAC so the export can be checked
for tampering (5 lines of code; say it in the text — it's the arXiv 2606.06387 recommendation
"traceable logs of tool registration and invocation").

**`rokan do` writes**: `rokan-do allow` grants are per-site per-action; the demo uses reads
plus one harmless write (a Render restart on a demo service _or_ `netlify deploy` of a static
page). Nothing that spends money. `may_act` bypass (2026-08-27 review) is a known open item in
Rokan; it is outside the WebMCP layer and not on the demo path.

**Say in the submission text**: "WebMCP tool descriptions are hints to a cooperative agent,
never a security boundary. Our boundary is the keyboard."

---

## 5. Repository `Aarya2004/webmcp-private` (empty today) — layout and what moves from Rokan

```
webmcp-private/
  LICENSE                     Apache-2.0 (also set in GitHub → About → license)
  README.md                   judge-facing: what/why/how-to-test (ChatGPT desktop + Chrome 149), GIF
  apps/web/                   Next.js 15 + TS strict + Tailwind + shadcn; xterm.js; tools; card; ledger
    src/app/page.tsx
    src/components/{Terminal,ToolsPane,ForgeCard,Ledger,ShareScreenToggle}.tsx
    src/lib/webmcp/{register.ts,useTool.ts,redact.ts,ledger.ts,schemas.ts}
    src/lib/ws/{client.ts,protocol.ts}
  packages/bridge/            Node 20 · node-pty · ws · cloudflared spawn · pairing token · ledger.jsonl
    bin/rokan-terminal.js     `npx rokan-terminal` (publish to npm on Sep 2, name TBD)
  infra/sandbox/              Cloudflare Worker (wrangler.toml, @cloudflare/sandbox), Dockerfile, seed/
    seed/operations.json      `rokan-do seed export` from Arav's machine: HN, lobste.rs, example ops
  evals/                      Chrome evals-cli cases (§3)
  docs/PLAN.md                this file, copied verbatim
  docs/SECURITY.md            §4, expanded
  docs/DEMO.md                §8
  vendor/                     built wheels: rokan-mcp, rokan-agent, rokan-do (from Rokan main, pinned SHA)
```

**From Rokan, copy only** (Arav's rule: parts we use + safety, not the repo):

- The three wheels (`uv build` in each package) → `vendor/`. Source stays in Rokan.
- `packages/rokan-do/SKILL.md` → `infra/sandbox/seed/SKILL.md` (the container's `rokan do` help).
- Seeded operations (`rokan-do seed export`) for the 4–6 demo sites.
- Redaction patterns — write fresh in TS (`redact.ts`), no Rokan dependency.
- Nothing from `apps/api`, channels, voice, mascot, Forge pipeline, Quorus.

**Changes inside Rokan (separate PRs, tiny):** `rokan-do run --json` (one-line result with
`model_calls` and `ms`); confirm `seed install` works on a fresh machine with no key
(0-call replay path). Both by me, day 2–3, on `feat/rokan-mcp-v1` or a side branch.

---

## 6. Schedule (PT). Owners: **A** = Arav (human), **Ay** = Aarya (+ his Claude), **C** = me (Arav's Claude)

Gates are binary. A gate not green by its time triggers its kill rule (§10) — no discussion.

### D0 — Fri Aug 28 (tonight)

- [ ] A/Ay: **go** on this plan; name chosen; accounts (§12) created; ChatGPT Sol/Terra on one Mac.
- [ ] C: scaffold `webmcp-private` (layout above), CI = `tsc --noEmit` + `next build` + `ruff`.
- [ ] C: **Gate A test page** — a static Next page registering `terminal_propose` (no backend);
      open in ChatGPT desktop built-in browser; confirm the "Site tools" arrow shows it; ask
      ChatGPT to propose `ls`; confirm the tool is invoked and _not_ blocked by safety review.
      Same page in Chrome 149 + Inspector + DevTools WebMCP panel.
- **GATE A (Fri 23:59):** ChatGPT invokes an inert propose tool on our page. ✅/❌ recorded in
  `docs/PROGRESS.md` with a screenshot.

### D1 — Sat Aug 29 — the terminal alone must stand

- Ay: `apps/web` — layout (terminal 70% · right column: Tools / Forge / Ledger), xterm.js with
  fit + webgl addons, WS client, ghost-text rendering in the prompt line (dim + diff), Esc
  dismisses, Enter executes, "Share screen" toggle, dark/light, Rokan palette (`docs/BRAND.md`).
- C: `packages/bridge` — node-pty + ws + token + cloudflared spawn + pairing link + ledger.jsonl;
  `terminal_read_screen` with redaction; `terminal_status`; `terminal_wait`.
- Joint 20:00: builder mode E2E on Arav's Mac from the deployed Vercel URL through the tunnel.
- **GATE B (Sat 22:00):** ChatGPT proposes → Arav presses Enter → command runs on Arav's Mac →
  ChatGPT reads the redacted screen → correct follow-up. Recorded (this recording is already a
  submittable backup).

### D2 — Sun Aug 30 — forge + ledger + judge sandbox scaffold

- Ay: Forge card (edit name/desc/commands/params/kind, approve/reject, pin), dynamic
  `forged_<name>` registration with `AbortController` per tool, button rendering, `forge_list`,
  "Forge this" from selected history lines, ledger column with `calls`/`ms`.
- C: `infra/sandbox` — Worker + Sandbox SDK + Dockerfile (Python 3.11, uv, node, rokan-do
  wheels, playwright chromium), `/api/session`, xterm `SandboxAddon`, TTL, rate limit.
- C: Rokan PR `rokan-do run --json`.
- **GATE C (Sun 22:00):** in ChatGPT desktop: forge from a proposal → tool appears in site tools
  → agent invokes it → ghost-typed → Enter → ledger row. DevTools panel shows registration.

### D3 — Mon Aug 31 — `rokan do` inside; office hours

- 11:00 A + Ay: **challenge office hours** (Netlify/Render pages). Ask: are inert proposal tools
  OK; iframe/decl limits; any tool-count guidance; whether judges test in ChatGPT or Chrome.
- C: seeded ops in the sandbox; `rokan do "top 5 HN titles"` → forge → `forged_hn_top({n})` →
  0-call replay shows `calls:0 ms:<400` in the ledger; no key in the container (no model calls possible); egress allowlist.
- Ay: polish — empty states, error states (bridge down, tunnel died, WS reconnect), keyboard
  focus discipline, the 12-tool budget, mobile = "open on desktop" card.
- C: `evals/` six cases green with the Chrome evals CLI; `docs/SECURITY.md`.
- **GATE D (Mon 22:00):** judge mode live URL: a stranger with ChatGPT desktop can open it, get a
  sandbox, propose, Enter, forge, invoke — with no help. Arav tests from a second account.

### D4 — Tue Sep 1 — freeze, test, record

- 12:00 **feature freeze.** Only bugs after this.
- 13:00–17:00 §7 test protocol, full pass, both modes, both browsers. Fix blockers only.
- 17:00–19:00 README with GIF; LICENSE visible in About; repo public; Vercel prod alias;
  Worker prod; `docs/PLAN.md`, `DEMO.md`, `SECURITY.md` copied.
- 19:00–22:00 **5 rehearsals** of §8 with a stopwatch; record the best full run as
  `demo-backup.mp4`; upload privately to YouTube.
- Netlify credits form closes **Sep 1 12:00 PT** — submit before.

### D5 — Wed Sep 2 — video + submit

- 10:00–14:00 final video (§8 shot list), narration recorded separately, cut to ≤ 2:50.
- 14:00 YouTube public. 15:00 Devpost submission complete (text §9, video, repo, live URL,
  judge instructions incl. "use GPT-5.6 Sol or Terra").
- 16:00 (Arav's call) `uv publish` rokan-do / `npm publish rokan-terminal`; launch post.
- **Submitted by 18:00 PT Sep 2.** The last 19 hours are buffer, not build time.

### D6 — Thu Sep 3

- 09:00 re-open the live URL from a clean machine; re-run one forge; confirm video public.
- 13:00 deadline. Nothing new after 09:00.

---

## 7. Test protocol (run T-4h before submission; each PASS/FAIL, owner, evidence file)

**Golden rule:** demo from the Vercel _production_ alias, bridge from a _fresh clone_ of the
repo, sandbox from the _deployed_ Worker. Never from `localhost` or a dev branch.

L1 — Bridge (C)

- T1.1 `npx rokan-terminal` on a clean Mac prints one pairing link within 10 s. PASS if link opens a live shell.
- T1.2 Second client with the same link is refused. PASS if refused with a visible message.
- T1.3 Kill `cloudflared` → client shows "bridge disconnected" within 5 s, reconnect button works.
- T1.4 `ledger.jsonl` gains one row per proposal/execute/forge; rows carry HMAC.

L2 — Tools (C/Ay)

- T2.1 Page registers 7 tools; DevTools WebMCP panel lists them with descriptions ≤ 500 chars.
- T2.2 `terminal_propose` with a newline → rejected with reason. With `rm -rf /` → red banner + double confirm.
- T2.3 `terminal_read_screen` with toggle OFF → `{shared:false}`. With ON and a fake `AKIA…` on screen → `[redacted]`.
- T2.4 `terminal_wait` resolves on Enter with exit code; resolves `dismissed` on Esc; returns `still_waiting` at 45 s and is re-callable.
- T2.5 `forge_create` → card → approve → new tool visible in ChatGPT site tools **without reload**; reject → nothing registered.
- T2.6 Unpin 6th forged tool → oldest unregisters; `forge_list` still lists it.
- T2.7 Page with WebMCP absent (Safari) → everything but the Tools pane works; no console errors.

L3 — ChatGPT desktop (A)

- T3.1 Sol: propose `ls`, Enter, read screen, correct summary. Repeat on Terra.
- T3.2 Ambiguous "clean up this folder" → agent _proposes_, does not attempt to execute; human dismisses.
- T3.3 Forge from agent; invoke forged tool; ledger row `invoked`, `calls:0` for a seeded `rokan do`.
- T3.4 Luna → tools absent (expected). Documented in README.

L4 — Judge mode (A from a second account, Ay from his machine)

- T4.1 Cold open → sandbox within 15 s; shell responsive.
- T4.2 `rokan do "top 5 HN titles"` seeded → answer + `calls:0`. Unseeded task → answer with `calls:1..3`, or honest refusal.
- T4.3 Model-call cap hit → clear message, shell still works.
- T4.4 Egress: `curl https://example.org` OK; `curl https://evil.example` blocked.
- T4.5 TTL expiry → "session ended" card with a "new session" button.

L5 — Ops (A)

- T5.1 Repo public, LICENSE in About, README renders GIF, judge instructions at top.
- T5.2 Video public, ≤ 3:00, audio audible, URL in submission.
- T5.3 Devpost form complete; live URL opens in ChatGPT desktop _and_ Chrome 149 + flag.

---

## 8. Demo script + video shot list (target 2:40; narration recorded separately)

Pre-stage: fresh macOS user, Dock hidden, 1440×900, ChatGPT desktop on Sol, bridge running,
pairing link opened, tools pane showing 7, ledger empty, `rokan do` seeded for HN. Second
laptop (Aarya) mirrors the setup for a second take. `demo-backup.mp4` one keypress away.

| t         | shot                                                                                                                                                             | narration (short)                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 0:00–0:20 | **Cold open on the birth.** History shows `rokan do "top 5 HN titles"` already run. Select → **Forge** → card `hn_top`, param `n` → approve → cut to the agent's site-tools list: **`forged_hn_top` appears** (DevTools WebMCP panel 2 s) | "I did this once. Now it's a tool. Registered live — it didn't exist when the page loaded." |
| 0:20–0:35 | "top 3 now" → agent calls `forged_hn_top({n:3})` → ghost-typed → Enter → ledger `calls:0 · 0.36s`                                                                | "The agent calls it. My Enter runs it. Zero model calls — the model left the hot path." |
| 0:35–0:55 | Rewind: "how did that command get there?" — ask "what's in this repo, are tests passing?" → `ls` ghost-typed → Enter → `pytest -q` → Enter → agent reads screen → answer | "Every command the agent wants is a proposal. It can't type Enter."                  |
| 0:55–1:10 | Share-screen off → `{shared:false}`; on → a fake key renders `[redacted]`                                                                                          | "It reads what I let it read. Secrets never leave the tab."                           |
| 1:10–1:40 | "get me the top 5 HN titles" → `rokan do …` proposed → Enter → browser does it → terminal shows the answer + `2186ms` (planned: 1 model call, no ⚡; counts are not printed — FIELD-NOTES R5/R7) — _this is the command we forged at 0:00_                | "`rokan do` browses for real — the model plans once, the page verifies."              |
| 1:40–2:05 | Second birth, agent-initiated: three approved commands → agent calls `forge_create` → card → approve → `forged_deploy` (kind: write, **CONSEQUENTIAL** banner) → invoke → Enter | "It forged its own workflow after I approved it three times. Writes are marked. Still my Enter." |
| 2:05–2:25 | Recovery beat: forged tool exits non-zero → agent reads the redacted tail → proposes the fix → Enter → ledger fail→fix                                             | "When it breaks, it reads, proposes, and I decide."                                   |
| 2:25–2:40 | Ledger scroll: registered / proposed / executed / forged / invoked, each with ms and calls; export JSON, HMAC-verified                                            | "Every tool, who made it, who called it, what it cost. Do it once. Now it's a tool."  |

Trigger to switch to backup: tunnel not connected in 10 s, or any tool call not visible in
ChatGPT within 15 s. Say it plainly on camera if live; in the edit, use the backup take.

Sponsor clips (each 10–15 s, same video): OpenAI 0:12–0:35 · Chrome 1:20–1:45 · Netlify
2:05–2:25 · Cloudflare (judge-mode B-roll 3 s at 0:00 showing the sandbox banner) · Vercel
(README badge + "Next.js" in the footer) · Render optional (use Render instead of Netlify for the
write beat if Netlify auth is a hassle).

---

## 9. Submission text (drafts; final on D5)

**Why WebMCP fits.** A terminal already has a human on one side. WebMCP is the first standard
that puts the agent on the _same page_ with the same session — not in a sandbox on someone
else's machine. Tools carry the intent ("propose", "read", "forge") and the page carries the
trust boundary (the keyboard). The dynamic half of the spec — `toolchange`, per-tool
`AbortController`, annotations — is exactly what "a tool library that grows as you work" needs.

**Better experience.** For the human: a co-pilot that proposes instead of acting, reads only
what you share, and turns your repetitive commands into buttons. For the agent: typed tools
instead of guessing at a screen, and a way to wait on the human (`terminal_wait`) instead of
polling.

**Together, newly possible.** The agent gets hands on a real shell without ever getting
execution. The human gets to _teach by doing_: anything done once can be forged into a tool the
agent calls next time — including `rokan do`, which browses the web behind your logins and
replays at zero model calls. Neither could grow that library alone.

**Implementation.** Next.js 15 on Vercel; `document.modelContext.registerTool` × 6 fixed +
dynamic `forged_*` tools, each with an `AbortController`; `readOnlyHint` /
`untrustedContentHint` on reads, "CONSEQUENTIAL:" on writes; redaction before any screen
leaves the tab; xterm.js ↔ WebSocket ↔ `node-pty` on your machine via Cloudflare Tunnel, or a
Cloudflare Sandbox container for judges; HMAC-signed append-only ledger; six Chrome evals-CLI
cases. Tool descriptions are hints to a cooperative agent, never a security boundary — the
boundary is the keyboard.

Facts to keep straight: WebMCP authored by Microsoft + Google; Alex Nahas credited for
implementation experience (MCP-B) — not "originator"; Shopify is an origin-trial participant.

---

## 10. Risk register + kill rules

| #   | Risk                                               | Sev  | Mitigation                                                                    | Kill rule                                                                                                                   |
| --- | -------------------------------------------------- | ---- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | ChatGPT safety review blocks `terminal_propose`    | CRIT | Gate A on D0; name/description make inertness explicit                        | Gate A ❌ → Chrome 149 + Inspector is the primary demo; ChatGPT shown only for tool discovery; say so in README             |
| 2   | Quick tunnel drops WebSocket                       | HIGH | test D1 morning; named tunnel fallback; ngrok as last resort (not in video)   | none — 2 h fix                                                                                                              |
| 3   | Terminal + ghost-typing not E2E by Sat 22:00       | CRIT | bridge already green (D0); risk is the xterm/ghost-text UI; forge decoupled (§0.9) | **Gate B ❌ → cut terminal _polish_ (webgl, theme, reconnect UX, layout); floor = one prompt line + bridge `input`/`status`; forge ships regardless. Never the reverse.** |
| 4   | Sandbox container can't run Chromium / too slow    | HIGH | seeded 0-call ops need no browser at replay; keep Chromium for unseeded       | Gate D ❌ on rokan → judge sandbox ships without `rokan do`; rokan beat in video only                                       |
| 5   | Forge card half-done → "gimmick"                   | HIGH | Aarya owns the card end-to-end D2; design review Sun 18:00                    | card not approvable by Sun 22:00 → cut "Forge this" (reverse) keep `forge_create`                                           |
| 6   | Integration sprawl (Vercel+Workers+Tunnel+Netlify) | HIGH | no DO relay; Netlify only in the video; Render as substitute                  | any vendor > 2 h of yak → drop it                                                                                           |
| 7   | Judges read "terminal" as not-the-web              | MED  | README first line: a web app, WebMCP tools, ChatGPT drives it                 | none                                                                                                                        |
| 8   | Rushing: "Codex does this"                         | MED  | text: browser-platform capability, human-gated, open standard, any machine    | none                                                                                                                        |
| 9   | Live URL dead on Sep 3                             | CRIT | Worker + Vercel prod; uptime check every 5 min; Sep 3 09:00 re-verify         | none                                                                                                                        |
| 10  | Launch week collides                               | HIGH | rokan-do launch = the Sep 2 publish; no rokan-do feature work except `--json` | if rokan-do gate breaks, do not publish; the entry doesn't depend on PyPI                                                   |

---

## 11. Rules (the Handset discipline, adapted — read every morning)

1. **One story.** A tool is born from what you just did, and the agent calls it. Terminal + ghost-typing is the vehicle that makes the birth real and safe. Everything else is cut. (Inverted 2026-08-28, §0.9.)
2. **Verified-state table first.** Every standup starts with "what is green _right now_", not what's planned. `docs/PROGRESS.md` holds it.
3. **Gates are binary and dated.** A red gate triggers its kill rule the same hour. No "one more try".
4. **Never fake a number.** ms and calls come from the code that ran. Label what is measured. State N.
5. **Decouple the unfailable beat from the bonus beat.** The tool appearing in the site-tools list is unfailable; the agent invoking it correctly is the bonus. Rehearse so the words land on the unfailable one.
6. **Recorded backup one keypress away.** Trigger conditions written down. Never debug on stage or in a take.
7. **Golden path only in the video.** One page, one bridge, one URL. Quarantine every alternate client.
8. **Every 30 minutes: does this demo well?** If not, the next 30 minutes go to the demo, not the code.
9. **No vendor yak > 2 h.** Drop the vendor.
10. **Freeze is a freeze.** After Tue 12:00, bugs only.
11. **Two owners per gate, one keyboard.** Aarya's Claude and mine never edit the same file; ownership in §6.
12. **Submit a day early.** The last 19 hours are for re-verification, not building.
13. **Say the true thing.** In the text, in the video, at office hours. Judges have seen the fake ones.

---

## 12. Asks (all independent; answer in one message)

1. Go / no-go from both of you. Product name.
2. ChatGPT plan with GPT-5.6 Sol/Terra on one Mac; latest desktop app installed.
3. Cloudflare account, Workers Paid ($5) for Sandbox SDK; sponsor credits claimed.
4. Vercel account; code `OAIWEBMH-9E2F-MUT4`; project `rokan-terminal`.
5. Netlify (or Render) account for the write beat; Netlify credits form before Sep 1 12:00 PT.
6. Anthropic key with a hard spend cap for the judge sandbox (Worker secret).
7. Aarya: confirm ownership split (§6) or swap it; confirm his Claude works in `apps/web` only.
8. Arav: `rokan-do seed export` on the demo sites once D3 begins.

---

## 13. Score upgrades — from ~7.6 to ~8.4 (D3 stretch, strict priority order, each gated on Gates A–C green)

Simulated judge mean on §1–§9 is ~7.6/10; the winning band is ≥ 8.0. These seven items are the
cheapest +1s per judge. **None enters D1/D2.** Start Mon 08-31 after Gate C; stop at 20:00 for Gate D.

| # | Upgrade | Judge(s) moved | Cost | Owner |
|---|---|---|---|---|
| 1 | **MCP parity.** `rokan-terminal mcp` serves the *same* forged tools over stdio to Claude Code / Cursor / Codex CLI. One library, two protocols: WebMCP for the browser agent, MCP for the terminal agent. README shows both. | Grigorik (generalizes), Nahas (MCP-in-browser thesis), Roberts (AX) | 3 h | C |
| 2 | **Any machine, not just the laptop.** Video beat: pair the same client to a remote Linux box (Render/Fly VM) through the tunnel; ChatGPT desktop operates a server it doesn't own, human-gated. The bridge already runs anywhere Node runs. | Rushing (answers "Codex does this"), Galloni | 1 h | C |
| 3 | **Recovery beat.** A forged tool exits non-zero → agent reads the redacted tail → proposes the fix → Enter → ledger shows fail→fix. Zero build; scripted in §8 at 2:05. | Roberts (his doctrine: recover), Drasner | 0 | A |
| 4 | **Self-forge beat.** Agent proposes three commands, human approves each, agent calls `forge_create` from the `terminal_wait` results — "it forged its own workflow after I approved it three times." Zero build; scripted. | Creativity across the panel | 0 | A |
| 5 | **Tool identity hash.** Every forged tool carries a content hash (name+schema+commands); shown on the card, referenced in each ledger row; a changed hash re-requires approval. Direct implementation of arXiv 2606.06387's "bind tool identity" mitigation — cite it. | Nahas, Drasner, Galloni | 1 h | Ay |
| 6 | **Guided first 60 s in judge mode.** `?tour=1`: three-step overlay ("ask ChatGPT to list files → press Enter → Forge this"), sandbox banner shows egress allowlist and TTL. Judges decide in the first minute. | Execution, all | 2 h | Ay |
| 7 | **Framework surface.** `useForgedTools()` hook documented in 10 lines; `AGENTS.md` at repo root (Gao's own finding: AGENTS.md beats skills in agent evals); `evals/` referenced from README. | Gao | 1.5 h | C |

Projected after 1–7: Rushing 8.5 · Drasner 9 · Nahas 9 · Grigorik 8 · Gao 8.5 · Galloni 8 · Roberts 8.5 → **mean ≈ 8.4**. Chance executed ≈ 30%.

Kill rule: any item over its cost by 50% is dropped, in reverse order (7 first). Items 3–4 are free and always in.
