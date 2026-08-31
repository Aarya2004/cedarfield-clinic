# COMPOSE-PLAN — "compose the web, keep it as a tool" (the final layer; approved for build by Arav 2026-08-29 ~03:00 PT)

> **Historical — pre-pivot.** This document describes *Rokan Terminal*, which now lives at
> `/terminal` and is not the submitted product. The submission is **The Drop** — start at
> [`docs/README.md`](README.md).

> Written by Engineer #4 (Fable 5) after seven research lanes on 2026-08-29 (judges, sponsor
> visions, WebMCP origins, developer demands, terminals-as-agent-surfaces, the live field, and an
> adversarial "is this a solution without a problem" pass) plus Rokan `IDEA-LEDGER §S` (the original
> decision trail). This plan **extends** `docs/FORGE-PLAN.md` and `docs/TERMINAL-PLAN.md`; it does
> not replace them. Same discipline (§16 of FORGE-PLAN, restated in §16 here). Same lanes.
> Owner of the whole tree for this sprint: Engineer #4 (Arav's instruction: do not route to Aarya;
> Aarya's Claude takes unstarted items by claiming them in `docs/PROGRESS.md`).

---

## 0. Context — why this, why now (the decision, with the evidence)

**What the research established (all sourced in the session notes; key facts repeated here so no
session re-derives them):**

1. **Three of our premises were stale.** (a) *"ChatGPT has no shell"* — false: the ChatGPT desktop
   app has an integrated terminal (Ctrl+`), reads its output, and ships user-defined "actions"
   (`learn.chatgpt.com/docs/integrated-terminal`). (b) *"Your Enter is the safety story"* — the
   control the labs measured and moved away from: Anthropic's own post says users approve **93%**
   of prompts and names "approval fatigue"; Codex ships prefix rules + an auto-reviewer; top devs
   (Cherny, Karpathy, Steinberger) run 10–20 agents in auto. (c) *"Typed shell output"* — the 2026
   consensus is CLI > MCP for exploration (Thariq removed typed tools for bash). None of these are
   headlines any more. The Enter gate stays as a **mechanism**, never as the pitch.
2. **What nobody has (verified against 507 challenge-window repos and every sponsor product):**
   a WebMCP tool **born at runtime from what a human did**; **one hashed procedure callable from
   ChatGPT, Codex and Claude Code** with one countersigned ledger; **a real execution substrate with
   measured numbers**; and — the piece this plan adds — **user-side composition of the web's tools**:
   a person and an agent chaining native WebMCP tools, compiled operations and machine steps into
   one new tool they keep. ChatGPT composes sites *once*, ephemerally; nobody lets you keep it.
3. **The field.** ~48% governance/approval consoles; games and creative co-creation are the polished
   cluster (VibeFarmer, MCPencil, VibeTide); form→tool wrappers are the starred cluster (alpic 15★,
   auto-webmcp 15★); **zero terminal entries; zero "compose and keep" entries.** Understudy owns our
   old sentence ("show it once, it becomes a tool") as a concept with no substrate; Anvil's *why*
   ("procedural drift: prose re-interprets, tools freeze") is sharper than ours and we adopt it.
4. **The decision trail.** Rokan `IDEA-LEDGER §S` had two finals: *Rokan Forge on the page*
   (consume published tools first, compile where none exist; killed by the DOM kill-shot) and
   *the terminal* (killed first at ~10% for "Codex ships a terminal / theme miss", then reversed
   because it keeps browsing out of the WebMCP layer). **This plan merges the two finals**: the
   terminal stays the vehicle and the substrate; `rokan do` becomes *consume-else-compile* on
   camera; the forge composes all three step kinds into one kept tool.
5. **Tier 0 is feasible, measured 2026-08-29 02:20 PT** (`docs/FIELD-NOTES.md` T0): via Playwright
   CDP session + `WebMCP.enable`, **allbirds.com (Shopify Liquid) exposes 10 native tools**
   (`search_catalog`, `browse_store`, `get_product`, `show_variant`, `get_cart`, `update_cart`,
   `cancel_cart`, `proceed_to_checkout`, `manage_orders`, `search_shop_policies_and_faqs`);
   Cloudflare's coffee demo 4; our page 6; from Playwright's bundled Chromium 151.0.7922.34 and
   system Chrome 152.0.7977.65. gymshark.com and template.vercel.shop home pages: 0 tools
   (register elsewhere or lazily — not our problem, use Allbirds).

**The one-line thesis (the BIBLE for every sentence we write from here):**
> *The future of the open web is every site callable by agents. Sites that ship WebMCP get called
> natively. Sites that don't get compiled by the people and agents who use them — and retired when
> native arrives. And what you and your agent compose across sites and your machine becomes a new
> tool of your own, in the web's format, callable by any agent, run only with your approval.*

Pessimistic placement with this plan executed (hostile panel): Leverage 8.5 · Execution 7 ·
Impact 7.5 · Creativity 8 → mean ≈ 7.75; **#1 ≈ 15–20%, top-3 ≈ 30%, top-10 ≈ 65%.** Stated
plainly: a bet, the best available, and it is Rokan's launch narrative verbatim.

---

## 1. The hackathon truth this must satisfy (Devpost rules, read 2026-08-29)

- Theme: *"Build a WebMCP-powered web app that imagines and explores the future of the open web —
  where humans and agents can interact, collaborate, and create together."*
- Stage 1 pass/fail: fits the theme, applies WebMCP. Stage 2, **equal weight**, tiebreak in order:
  1. **WebMCP Leverage** — "thoroughly and skillfully… genuine effort and a working, non-trivial
     implementation."
  2. **Execution** — "a complete, coherent product experience — **not just a technical proof of
     concept**."
  3. **Potential Impact** — "a credible, specific case for solving a real problem for a real
     audience — **and does the solution actually address that problem based on what's
     demonstrated?**"
  4. **Creativity & Ambition** — "differ from existing concepts."
- Submit: live URL usable from ChatGPT's in-app browser or Chrome; text; **< 3:00 public YouTube
  video with audio**; public repo with an OSS license. Deadline Thu 09-03 13:00 PT; **our target
  Tue 09-01**, hard fallback Wed 09-02 evening PT.
- Judges (7): Rushing (OpenAI browser platform), Drasner (Chrome), Galloni (Cloudflare), Gao
  (Vercel), Roberts (Netlify), Grigorik (Shopify), Nahas (MCP-B). Per-judge answers in FORGE-PLAN
  §13; the sentences each one must hear are in §11 below.
- **"Full product, not PoC" is a criterion, verbatim.** A judge must be able to open the live URL
  with no script and use it freely; every limit is stated, none hidden. Pessimistic use estimate:
  ~65% click the URL, ~25% use it > 3 min, < 5% install locally. The video and README carry the
  score; the live URL decides ties and credibility. Both must be real.

### 1.1 The production bar (Arav, 2026-08-29: "built for full public use; judges must be able to use it extensively and excessively")
Binding definition of "production" for this entry — each line is a test in §7, not a sentence:
1. **Free use, no script.** A stranger opens the live URL, clicks Try it now, and can do *anything a
   shell allows* for the whole session: any command, any forge, any number of forged tools (budget
   5 visible + pin/evict as today), reload and restore. The tour is optional and dismissible.
2. **Extensive use is not throttled during judging.** Today's stranger-abuse caps (3 sessions/IP/
   10 min, 3 concurrent, 30-min TTL, `max_instances: 10`) would throttle a judge who uses it hard.
   For the judging window (public → results): `SESSION_TTL_MS` 30 → **60 min**, sessions/IP
   **10/10 min**, concurrent **5**, `max_instances` **20** (Worker-vars + config change; **does not
   roll containers**; cost bounded by TTL × instances; revert after results). SECURITY.md states
   the judging-window values and the reason. The judge never sees a 429 for normal use.
3. **Their own machine works.** `npx rokan-terminal` is true (published), one command, Node 20+,
   any shell (zsh honest numbers; bash/sh `measured:false`, stated). Builder mode = the full
   ladder including Tier 0 (needs Chrome/Chromium on their machine — detected, stated).
4. **Every consumer works.** ChatGPT desktop (Sol/Terra), Chrome 149+ with the flag, Codex CLI and
   Claude Code over `rokan-terminal mcp`, Safari/Firefox render the page and say WebMCP is absent.
5. **Nothing simulated.** No seeded "demo project" the judge is steered through; the sandbox has a
   real shell, real seeds that replay, real Python/git/curl. `rokan do` says `refused (no browser
   in judge mode)` for native steps instead of pretending.
6. **Failure states are product.** 429/TTL/replaced-tab/unauthorized/disconnected each have a
   screen and a next step (existing), plus new ones for `refused` and restore-hash-mismatch.
7. **It survives us.** The live URL, the sandbox, and the npm package stay up through results with
   no one at the keyboard; a cron-less health check is the judge opening it — so the stranger test
   (§7.7) runs daily from Sunday and once on Tue morning.

---

## 2. Product specification — Compose (feature level)

### 2.1 Vocabulary
- **Step** — one unit the agent proposes and the human approves. Three kinds, one surface:
  - `machine` — a shell command on the paired machine (`pytest -q`, `pip index versions x`).
  - `web:native` — `rokan do "<goal> at <site>"` that resolved to the site's **own WebMCP tools**
    (Tier 0). Provenance carries `site`, `tools_used[]`.
  - `web:compiled` — `rokan do "<goal> at <site>"` that resolved to a **compiled operation**
    (Rokan's verified shadow-API replay; 0 model calls; browserless). Provenance carries `site`,
    `speed: replayed|compiled`, `calls: 0`.
  - (`web:planned` — first-time planning, 1 model call; `refused` — verified-or-refused. Both are
    honest states the ladder reports; neither is a demo beat.)
- **Provenance** — the chip on every step, card row and ledger row: `machine` · `native · <site>`
  · `compiled · <site> · ⚡` · `planned · 1 call` · `refused`.
- **Composed tool** — a forged tool whose `commands[]` mix step kinds. Unchanged forge contract;
  the substitution, hash, budget, queue, stats, pin/evict all apply as today.
- **Kept** — a forged tool persists across reloads (localStorage), restored only via the human's
  re-approval card (never auto-registered). "Do it once, keep it" must be literally true.
- **The ladder** — `rokan do`'s resolution order, stated on every result line:
  `native → compiled/replayed → planned → refused`.

### 2.2 What the human sees (one page, ChatGPT's browser)
1. First paint: the birth hero (existing) — retitled to the thesis (§11), one real kept tool above
   the fold if any exists in this browser, else the example card.
2. Terminal pane: every step runs here and is visible with its provenance chip inline after the
   result line (`⚡ compiled · pypi.org · 312 ms · 0 calls`, `⚙ native · allbirds.com · search_catalog
   · 640 ms`).
3. Tools pane: seven fixed + forged; each forged row shows `provenance[]` (the kinds its steps
   resolved to on the last run), `runs`, `median_ms`, `calls` (sum of model calls on last run —
   0 is the number we want on screen), `forged by <identity>`, `hash`.
4. Forge card: unchanged fields + a per-command provenance preview (`machine` / `web`), and the
   **Keep** state (kept tools show a pin + "restored N times").
5. Restore card on load: "3 kept tools from 2026-08-29 — restore?" with hashes; Approve registers
   them (same path as forge approve); Dismiss forgets nothing.
6. Ledger: `executed_step` rows carry `rokan{speed, site, tools_used, ms, calls}`.

### 2.2a Vocabulary the whole team uses the same way (say these words, not others)
- **Native WebMCP tool** — a tool a *site* declared (`document.modelContext`), consumed over the CDP
  WebMCP domain. Tier 0. E.g. Allbirds' own `search_catalog`. (Built + live-proven, FIELD-NOTES T5.)
- **Synthetic WebMCP tool** — a **compiled operation Rokan mints for a site that ships NO native
  tools**: a verified shadow-API replay (`rokan do`'s compiled/replayed path) surfaced *through the
  forge* as a WebMCP tool. This is what "gives the agent every site" means — the long tail the spec
  admits never ships tools (RESEARCH §7 #8). Verified-or-refused; 0 model calls on replay.
- **Composed tool** — a forged `forged_<name>` whose `commands[]` chain **native + synthetic +
  machine** steps across *different sites and your machine* into one tool call. E.g.
  `deal_hunt({{product}})` = `rokan do "search allbirds.com for {{product}}"` (native) → `rokan do
  "price at <a site with no tools>"` (synthetic) → `jq` compare (machine).

### 2.2b The Impact thesis, stated so the number on screen is honest (read before writing any speed copy)
Claim: **a composed cross-site tool runs significantly faster than a single agent driving each
site's tools individually — because the orchestration is compiled once and replays with the model
out of the loop.** The honest mechanism, and the three traps:
- **Where the speedup is NOT.** Not "our native call beats their native call" — the same site tool
  is the same speed for anyone. Never imply Rokan makes a site's tool faster.
- **Where the speedup IS.** A vanilla agent (ChatGPT/Codex) orchestrating N sites pays, **every
  run**, a model round-trip *per step* — decide which tool, read the result, decide the next,
  compare — so N sites ≈ N–2N model calls and N inference latencies (seconds each). Rokan forges
  that orchestration into a tool **once** (first run ≈ 1 model call per new site to select the tool
  + fill its schema, same order as the agent's first run); on **every subsequent run the composed
  tool replays at 0 model calls** — each step a native invoke (~1 s) or a synthetic replay (~0.3 s),
  the model never re-entered. The win is *amortized on repeat* and is dominated by **eliminated
  model round-trips**, not by the tool calls. This is head-to-head-ten (0 vs 39 warm model calls,
  13.9× median — Rokan `docs/measurements/2026-08-27-head-to-head-ten.md`) extended to native
  cross-site tools.
- **Why an agent can't just cache it.** It could script one, but not as a **portable WebMCP tool
  callable by any agent** with a content hash and a countersigned ledger — and by default it
  re-plans the whole workflow every session (the config-drift + re-discovery complaints, demand
  research #5/#6). That portability + provenance is the differentiator, not raw speed alone.
- **The rule:** the number on screen is measured wall-clock with N and a CI (§4 A/B), the model-call
  counts are the code's own (0 on replay), and the first-run cost is stated, never hidden.

### 2.3 The two structural demos (things Codex / Claude Code / Gemini CLI cannot do)
- **D1 — Called from ChatGPT, then Codex, then Claude Code.** Forge `release_check` in ChatGPT's
  Site tools; a new Codex session calls `forged_release_check` (MCP relay) → same hash → ghost →
  Enter; Claude Code calls it too. One ledger. *No harness can be a tool for another vendor's
  agent.*
- **D2 — The cross-site second run (the Impact number; §2.2b is the honesty spine).** A **multi-site**
  task — "get the price of `{{product}}` at allbirds.com **and** at `webmcp-coffee.jilles.fyi`, and
  say which is cheaper" (2 native sites; a 3rd, tool-less site makes it native+synthetic if time).
  - **Arm A (vanilla agent, native tools):** ChatGPT/Codex in a WebMCP browser, cold each run — it
    round-trips the model to pick+call site A's tool, read, pick+call site B's tool, read, compare.
    Measure wall ms, **model calls**, tokens, success.
  - **Arm C (Rokan composed tool):** forge `deal_hunt({{product}})` once (first run ≈ 1 call/site to
    select+fill), then **replay ×5** — the composed tool runs both `rokan do` steps at **0 model
    calls** and the machine compare step. Measure the same.
  - N=5 per arm, Wilson CIs, in `docs/measurements/2026-08-29-ab.md`. The headline is **0 vs N model
    calls on repeat and the measured × on wall-clock**, with the first-run parity stated. Plus the
    **drift test**: change a page → Arm A answers wrong silently, Rokan **refuses** (verified-or-
    refused). *They re-plan the whole cross-site workflow every run; ours replays it at 0 calls.*
- **D3 (if Tier 0 lands) — native, not DOM.** `rokan do "search allbirds.com for wool runners"`
  resolves to `search_catalog` via the site's own tools; Arm A clicks the DOM. Measured ms/calls.
  *No harness speaks WebMCP.*

### 2.4 The demo workflows (both real, both free-use; chosen from what actually compiles today)
- **Dev (judge hands-on, works in the sandbox — no browser needed):** `release_check({{pkg}})`
  = `pip index versions {{pkg}} | head -1` (machine) → `rokan do "latest {{pkg}} version at
  pypi.org"` (compiled ⚡) → `rokan do "is status.python.org all systems operational"` (compiled ⚡)
  → `echo` comparison (machine). Kind `read`. This is the tool the judge can forge and call in the
  sandbox with no script.
- **Web (video, builder mode):** `deal_hunt({{product}})` = `rokan do "search allbirds.com for
  {{product}}"` (native `search_catalog`) → `rokan do "price of the first result"` (native
  `get_product`) → `rokan do "is www.vercel-status.com all systems operational"` (compiled ⚡, the
  "and my deploy target is up" beat) → `jq`/`echo` report (machine). Kind `read`; **no cart, no
  checkout, no writes** (PLAN §0.5 — writes that spend money stay out).
- Pinterest, merchant APIs, and any bot-challenged site are **out** (Rokan graveyard: pngtree,
  temu, apa.org). If Allbirds ever shows 0 tools, fall back to `webmcp-coffee.jilles.fyi`
  (`filter_coffees_by_roast`) — measured 4 tools.

### 2.5 Limits (numbers; enforced in code)
> **Superseded detail (2026-08-29, approved execution plan `docs/EXECUTION-PLAN.md` §1):** daemon verbs live in `packages/rokan-mcp/src/rokan_mcp/_daemon.py` + its byte-identical script copy (not a rokan-do Playwright module); the rung is wired in `service.perform()` (not `fastpath.py`); the result-line grammar is `rokan-agent/adapters/cli/render.py` with the marker *after* the ms tail; module name `native.py`; judge mode prints Rokan's real `abstained_planner_unavailable`, never a string no code path emits.

- Tier 0 invokes only tools whose annotations say `readOnly` unless the forged tool is
  `kind:'write'` **and** the step is CONSEQUENTIAL-confirmed by Enter (never in the demo).
- Tier 0 per-call timeout 15 s; page load 30 s; one browser job at a time (Rokan H12).
- Native results are capped at `OUTPUT_BUDGET_CHARS` (1.5 K) after redaction, like everything.
- Kept tools: max 20 per origin in localStorage; restore card lists at most 5 (the visible budget).
- Judge sandbox: **no browser** → `web:native` steps return `refused (no browser in judge mode)`
  with the honest reason; compiled steps replay as today.

---

## 3. Contracts — exact (`contract:` commits; ping Aarya in ALIGNMENT)

### 3.1 `terminal_wait` → `executed.rokan` (additive)
```
rokan?: { ms: number; replayed: boolean; calls: 0 | null;
          speed?: 'native' | 'compiled' | 'replayed' | 'planned' | 'refused';
          site?: string; tools_used?: string[] }
```
Same on `terminal_status.last_rokan`. Parsed by the bridge from rokan-do's result line only when
`isRokanCommand(last_command)` (unchanged attribution guard).

### 3.2 rokan-do result-line grammar (Rokan repo, `render_do.py`)
Today: `  <answer>   <ms>ms[  ⚡]`. Adds one trailer token: `⚙ native:<site>:<tool[,tool]>` for
Tier 0 answers; `⚡` stays for replay. `rokan-do run --json` gains `speed` and `native{site,tools}`.
Regex in `packages/bridge/src/rokan-trailer.js` extended with tests (negative: an `echo` of the
line is never attributed; chained commands rejected — existing guards).

### 3.3 `forge_list` entry (additive)
`provenance: ('machine'|'native'|'compiled'|'planned'|'refused')[]` from the last invocation,
`calls_last: number | null`, `kept: boolean`, `forged_by: string`.

### 3.4 Ledger kinds (both sides, same set — ENGINEERING-NOTES trap #3)
No new kinds. `executed_step` and `executed` rows gain the `rokan` object above. `forged` rows gain
`forged_by`. New client row `restored {hashes[]}` on a restore approval — **add to
`CLIENT_LEDGER_KINDS` on both sides in the same commit.**

### 3.5 Persistence (client only, no contract)
`localStorage['rokan.kept.v1']` = `{ v:1, tools:[{spec, hash, pinned, forgedAt, forged_by}] }`.
Written on approve/unforge/pin; read on load → restore card. Never registers without the card.

---

## 4. Engine technical specification

### 4.1 Rokan side
> **Superseded detail (2026-08-29, approved execution plan `docs/EXECUTION-PLAN.md` §1):** daemon verbs live in `packages/rokan-mcp/src/rokan_mcp/_daemon.py` + its byte-identical script copy (not a rokan-do Playwright module); the rung is wired in `service.perform()` (not `fastpath.py`); the result-line grammar is `rokan-agent/adapters/cli/render.py` with the marker *after* the ms tail; module name `native.py`; judge mode prints Rokan's real `abstained_planner_unavailable`, never a string no code path emits.
 — `packages/rokan-do/src/rokan_do/webmcp_native.py` (new)
- `async def list_native_tools(url, *, channel='chrome'|None) -> list[Tool]`: Playwright launch
  with `--enable-features=WebMCP` (bundled Chromium 151 works; prefer system Chrome 152 when
  present), `new_cdp_session(page)`, `WebMCP.enable`, collect `toolsAdded` until 3 s of quiet or
  a tool appears; return `{name, description, inputSchema, annotations, frameId}`.
- `async def invoke_native(url, tool, input) -> {status, output, ms}`: `WebMCP.invokeTool(frameId,
  toolName, input)`, await `toolResponded`; `Canceled|Error` → typed failure.
- **Selection** (`fastpath.py`): on `rokan do "<goal> at <site>"`, if a **native operation record**
  exists for `(site, goal-shape)` → replay it at 0 calls (`speed:'native'`, `calls:0`); else if the
  site lists native tools → one planning call chooses `{tool, args}` from the tool list (never from
  the DOM), verifies the response is non-empty and on-topic via the existing judge, records the
  operation (`kind:'native'`) → `speed:'native'`, `calls:1`; else fall through to today's ladder.
- **Refusal**: `annotations.readOnly !== true` → refuse unless the caller passed `--allow-write`
  (the terminal never passes it; forged `write` steps rely on Enter, not on this flag).
- `op_use` row per invocation (Rokan's existing ledger), `Reason` codes for every refusal.
- **Rules that bind (Rokan `HANDOFF-TO-FABLE`):** `regression_gate.py` **PASS 8/8 before and
  after**; `_daemon.py` and `scripts/rokan_browser_daemon.py` stay byte-identical; one browser job
  at a time, reap before/after; no model-driven run without a pre-registered question
  (`docs/measurements/2026-08-29-tier0.md` holds the questions and the numbers); mutation-test
  every guard added (readOnly gate, attribution regex).
- Wheels rebuilt from a scratch copy into `vendor/` (never edit Rokan's tree from this repo).

### 4.2 Bridge — `packages/bridge/src/rokan-trailer.js`
Parse `⚙ native:<site>:<tools>`; emit `rokan.speed/site/tools_used`; keep `isRokanCommand`
attribution; unit tests + smoke case (positive via the shim with a fake `rokan-do` on PATH that
prints the new grammar; negative via `echo`).

### 4.3 Web — `apps/web/src/lib/webmcp/forge.ts`, `ledger.ts`, `register.ts`, `Panes.tsx`,
`ForgeCard.tsx`, `Terminal.tsx`, new `kept.ts`
- `kept.ts`: pure serialize/deserialize + validation (`validateForgeSpec` on load; unknown fields
  dropped; corrupted store ignored, never thrown); `restore(hashes)` calls `forge.approve(spec)`
  per tool (existing rollback semantics).
- `forge.ts`: after each invocation, record `provenance[]` and `calls_last` from the step results'
  `rokan` objects; expose in `forge_list`; `forged_by` from the session's agent identity when the
  forge came via `forge_create` (agent) vs the card (human) — string, ≤ 40 chars, sanitised.
- UI: provenance chip component (one), used in the terminal result line, tools rows, ledger rows;
  restore card; hero retitle. Rokan palette; no new fonts.

### 4.4 Evals — `evals/ab/` (new) and `evals/cases/terminal-compose.json`
- `evals/ab/run.mjs`: drives Arm C through the existing real-PTY harness (forge `release_check`,
  invoke ×5, read `rokan.ms/calls`), and records Arm A/B from **scripted Codex CLI / Claude Code
  sessions** (`codex exec` / `claude -p` with Playwright / DevTools MCP configured) with wall time
  and model calls taken from their own transcripts/usage output — never estimated. Output:
  `docs/measurements/2026-08-29-ab.md` with N, means, Wilson CIs, and the drift test.
- `terminal-compose.json`: forge a 3-step mixed tool → invoke → three Enters → ledger rows carry
  `rokan.speed` per step → `forge_list.provenance` = `['machine','compiled','compiled']`.
- Chrome evals-cli format: mirror our cases as `evals/chrome-format/*.json` (`messages` →
  `expectedCall` ordered/unordered) so Gao/Drasner find their own format in the repo.

---

## 5. External software and services — exactly
- Chrome 152.0.7977.65 (system) and Playwright Chromium 151.0.7922.34 (bundled, `chromium-1234`):
  both answer `WebMCP.enable` (measured). Flag `--enable-features=WebMCP` set at launch.
- Native tool sources for the demo: `https://www.allbirds.com/` (10 tools, measured),
  `https://webmcp-coffee.jilles.fyi/` (4, measured). Re-probe both before every rehearsal
  (`scratchpad/tier0_probe.py` → move to `evals/diagnostics/tier0-probe.py`).
- Model: Anthropic key from Keychain `rokan-anthropic-key` (planned path only, builder mode).
  **Wallet:** one planning call per new (site, goal-shape); budget for this sprint ≤ 60 planning
  calls (~$3–5); every model-driven run has a pre-registered question in the measurements file;
  no sweeps. The judge container has no key (unchanged).
- Codex CLI (ChatGPT-plan account; default model) + Playwright MCP for Arm A; Claude Code +
  Chrome DevTools MCP for Arm B. Both already installed on this Mac (Codex proven C1–C6).
- Cloudflare judge sandbox: unchanged image (no browser; `rokan do` compiled replays 11/11 live).
  **No sandbox deploy is required by this plan.** Caps 50/20 → 3/3 is a Worker-vars change (does
  not roll containers) at freeze.
- Vercel prod: web-only redeploys, safe for live judge sessions.

---

## 6. Security specification (extends `docs/SECURITY.md`; add §9 there)
- Tier 0 invokes read-only tools only by default; write tools need both `kind:'write'` on the
  forged tool (CONSEQUENTIAL description) and the human's Enter on that step. The terminal never
  passes `--allow-write`.
- Native tool **outputs are untrusted content**: through `redactForAgent` like screen text; capped;
  `untrustedContentHint` already on reads.
- Tool-framing defence (arXiv 2606.06387): the native operation record stores the tool's
  `name + inputSchema hash + frameId origin`; a changed schema ⇒ re-plan (1 call) not blind replay;
  the ledger shows which.
- Kept tools: restored only via the card; specs re-validated on load; hash recomputed and compared
  — mismatch ⇒ shown as "changed, needs approval", never registered silently.
- No credential ever in a task (`accept.py` refuses pasted secrets — unchanged); no key in the
  container; egress model as documented (SECURITY §7).
- Threat added to SECURITY: a malicious site could register tools with misleading descriptions;
  mitigation = readOnly gate + judge verification of the response + provenance on screen.

---

## 7. Verification protocol (binary, evidence paths; nothing is "done" without these)

### 7.1 Rokan (in `~/dev/Rokan`)
- `uv run pytest packages/rokan-do -q` green; `python scripts/regression_gate.py` **PASS 8/8**
  before the first edit and after the last.
- `tests/test_webmcp_native.py` (≥ 10): fake CDP session (tools listed / none / late-arriving /
  `Error` response / `Canceled`); readOnly gate refuses write tools; selection replays a recorded
  native op at 0 calls; schema-hash change triggers re-plan; result-line grammar renders and
  parses round-trip; `--json` carries `speed`/`native`.
- Live probe: `evals/diagnostics/tier0-probe.py` against Allbirds + coffee → numbers into
  `docs/measurements/2026-08-29-tier0.md` (pre-registered questions: *does `search_catalog` return
  ≥ 1 product for "wool runners"? ms? does replay hit 0 calls on the 2nd run?*).

### 7.2 Bridge
`node --test test/*.test.mjs` + `pnpm smoke` with the new trailer cases (positive shim, negative
echo, chained-command spoof still rejected).

### 7.3 Web
`pnpm typecheck && pnpm lint && pnpm build && pnpm test` — new: `kept.test.ts` (≥ 8: round-trip,
corrupt store ignored, hash mismatch flagged, restore = approve path, cap 20), `forge.test.ts`
provenance/calls_last cases, provenance chip render test.

### 7.4 Headless (evals)
`node evals/run-all.mjs` (prompt-line 7 → 8 with `forge-kept.json`: forge → reload → restore
card → approve → tool back with same hash) and `--bridge` (real PTY 12 → 13 with
`terminal-compose.json`). `--judge` live: 11/11 unchanged + `terminal-compose` in compiled-only form.

### 7.5 A/B (`evals/ab/run.mjs`)
N=5 per arm, numbers in `docs/measurements/2026-08-29-ab.md`, screenshots of each arm's transcript
in `docs/evidence/ab/`. The drift test recorded once with before/after.

### 7.6 Consumer (Arav + Engineer #4)
ChatGPT desktop on **Sol/Terra** (Luna confirmed useless 2026-08-28 night): Site tools = 7 →
`propose ls` → Enter → forge `release_check` → does the list gain `forged_release_check` without
reload? → call it → three ghosts/Enters → ledger. Screens → `docs/evidence/gate-a|b/`. Then the
Codex session calling the same hash (C1–C6 path). **This is still the single highest-leverage
hour of the sprint and it is human-gated (dialog + model switch).**

### 7.7 Stranger-proof (daily from Sun)
A clean browser profile opens the live URL cold, Try-it-now, forges `release_check`, calls it, sees
`compiled ⚡ 0 calls` in the ledger, reloads, restores — in < 3 min, no script.

### 7.8 Done means
7.1–7.5 green with numbers in PROGRESS; 7.6 measured (or the kill rule fired and the README says
Chrome + Inspector is primary); 7.7 passed once; every claim in README/SUBMISSION traces to a test
name, an eval case, or a FIELD-NOTES/measurements row.

---

## 8. Files touched — summary
> **Superseded detail (2026-08-29, approved execution plan `docs/EXECUTION-PLAN.md` §1):** daemon verbs live in `packages/rokan-mcp/src/rokan_mcp/_daemon.py` + its byte-identical script copy (not a rokan-do Playwright module); the rung is wired in `service.perform()` (not `fastpath.py`); the result-line grammar is `rokan-agent/adapters/cli/render.py` with the marker *after* the ms tail; module name `native.py`; judge mode prints Rokan's real `abstained_planner_unavailable`, never a string no code path emits.

- Rokan: `packages/rokan-do/src/rokan_do/{webmcp_native.py (new), fastpath.py, render_do.py,
  cli.py (--json), mcp.py (speed field)}`, `tests/test_webmcp_native.py`, `docs/measurements/2026-08-29-tier0.md`,
  wheels → `webmcp-private/vendor/`.
- Bridge: `src/rokan-trailer.js`, `src/protocol.js` (restored kind), `test/smoke.mjs`, `test/*.test.mjs`.
- Web: `lib/webmcp/{kept.ts (new), forge.ts, ledger.ts, register.ts, schemas.ts (types only), fieldnotes.ts}`,
  `lib/ws/protocol.ts` (restored kind), `components/{Panes.tsx, ForgeCard.tsx, Terminal.tsx, Hero.tsx,
  Provenance.tsx (new), RestoreCard.tsx (new)}`, tests.
- Evals: `evals/ab/run.mjs` (new), `evals/cases/{terminal-compose,forge-kept}.json`,
  `evals/chrome-format/*.json`, `evals/diagnostics/tier0-probe.py`.
- Docs: this file; `PLAN.md` §0.10; `PROGRESS.md`; `ALIGNMENT.md` (Aarya ping); `HANDOFF.md` §1/§8
  pointers; `FIELD-NOTES.md` T0 row; `SECURITY.md` §9; `README.md`/`SUBMISSION.md` rewrite (§11);
  `DEMO.md` shot list v3.

---

## 9. Schedule (PT) and kill rules

Now = Sat 08-29 ~03:00 PT. Target submit **Tue 09-01**; fallback Wed 09-02 evening; Devpost close
Thu 09-03 13:00 (never planned for).

| when | what | green iff | kill rule |
| --- | --- | --- | --- |
| Sat 03:00–05:00 | Docs reframe (this plan, PLAN §0.10, README spine, scrub "no shell"/"Enter is safety"); PROGRESS/ALIGNMENT/HANDOFF pushed | pushed; Aarya can read the why | — |
| Sat 05:00–09:00 | **Tier 0 in rokan-do** (list/invoke/select/refuse/grammar/json), unit tests, live probe measured | 7.1 green; `docs/measurements/…tier0.md` has the numbers | **If no native answer at 0 calls on the 2nd run by Sat 22:00 → cut Tier 0**; D3 dropped; D1/D2 unchanged |
| Sat 09:00–12:00 | Bridge trailer + web provenance + `forge_list` fields + `terminal-compose.json` | 7.2, 7.3 (forge part), 7.4 bridge green | — |
| Sat 12:00–15:00 | **Persistence**: `kept.ts`, restore card, `forge-kept.json` | 7.3, 7.4 green | If red by Sat 22:00, ship without restore card (kept list read-only) |
| Sat 15:00–18:00 | **A/B harness** + first measured run (Arm C + Arm A) | measurements file with N | If Codex/Claude arms can't be scripted honestly by Sun 12:00, report Arm C vs R8 planning-only, say so |
| Sat 18:00–20:00 | ChatGPT Sol/Terra protocol (Arav unblocks) + Codex D1 recording | evidence in `gate-a|b/` | Kill rule PLAN §10 #1 if not by Sun 12:00 |
| Sun | Full gate cold; stranger-proof; DEMO.md v3 + `demo:stage`; rehearsals 1–3; SUBMISSION/README final; `npm publish` (Arav) | numbers in PROGRESS | — |
| Mon | Rehearsals 4–5; record video + backup; caps → 3/3; repo public; freeze **Mon 09-01 12:00 PT** | — | — |
| Tue | Submit. | — | Wed evening fallback |

**Freeze rules unchanged:** no sandbox image deploys after freeze (drops live judge sessions);
Vercel web redeploys are safe.

---

## 10. Explicitly out of scope for this plan
Writes that spend money (cart/checkout/merchant APIs) · Pinterest and any bot-challenged site ·
tool pages / share-by-URL · typed output parsers on machine steps · "self-healing" as a thesis
(health chip stays a later property) · trusted auto-run / graduation (PLAN §0.3 unchanged unless
Arav edits it) · app diagnostics injection · a browser in the judge image · any Rokan source in
this repo beyond the three wheels + seeds + SKILL.md.

---

## 11. Submission sentences this plan earns (the spine; every doc uses these words)
- Headline: **Do it once. Now it's a tool. Now every agent can call it.**
- Thesis: the §0 sentence (sites callable natively; compiled where missing; retired when native
  arrives; composed and kept by the people who use them).
- Rushing: *"It runs in your Site tools list. Then Codex and Claude Code call the same hash. No
  harness can be a tool for another vendor's agent."*
- Drasner: *"Tools, not DOM: Rokan calls a site's own WebMCP tools first — measured — and every
  registration is visible in your DevTools panel."*
- Roberts: *"The human view of the web stays the fallback; we compile it into a tool and retire
  the tool when the site ships its own."*
- Nahas: *"Every tool has a content hash, a maker, an approval, and a countersigned row."*
- Galloni: *"Judge mode is a throttled Cloudflare Sandbox with no key and no browser; compiled ops
  still replay at zero calls."*
- Gao: *"Seventeen headless cases on the CDP WebMCP domain, plus your evals-cli format, plus an
  A/B with N and confidence intervals."*
- Grigorik: *"Your storefront's own tools, called natively from a workflow the shopper composed."*
- Honesty lines (always present): *ChatGPT Site-tools refresh on runtime registration: measured /
  unmeasured (state which). Judge mode has no browser. `npx` true only once published.*

---

## 12. Demo — shot list v3 (≤ 2:50; every number the measured one)
| t | shot | say |
| --- | --- | --- |
| 0:00–0:12 | Flash-forward: ChatGPT Site tools **7 → 8**, `forged_release_check` appearing | "This tool didn't exist a minute ago. I made it by pressing Enter. Watch." |
| 0:12–0:40 | "Why is CI red?" → `pytest -q` ghost → Enter → agent reads (Share screen, a key renders `[redacted]`) → proposes the fix → Enter → green | "Every command is a proposal. It can't type Enter. It reads what I let it read." |
| 0:40–1:05 | `rokan do "latest pydantic version at pypi.org"` → `⚡ compiled · 0 calls · 312 ms`; `rokan do "search allbirds.com for wool runners"` → `⚙ native · search_catalog · 640 ms` | "The web, two ways: the site's own WebMCP tools when it ships them — compiled when it doesn't. Zero model calls on replay." |
| 1:05–1:30 | Select the steps → **Forge this** → `release_check({{pkg}})` → Approve → tools 6→7 **no reload** | "I did this once. Now it's a tool — born at runtime, in WebMCP's own format." |
| 1:30–1:55 | **D1**: new Codex session lists 7 tools, calls `forged_release_check {pkg:"httpx"}` → ghost → Enter; Claude Code same hash | "Same tool, any agent. No harness can be a tool for another vendor's agent. One ledger." |
| 1:55–2:20 | **D2** on screen: Arm A Codex cold 31 s · 6 calls vs Arm C replay 0.9 s · 0 calls (N=5); the drift test: page changed → Codex script wrong, Rokan **refused** | "Second time costs nothing — and when the page changes, it refuses instead of guessing." |
| 2:20–2:35 | Second laptop: live URL → Try it now → sandbox ~5 s → forge `release_check` → `⚡ 0 calls` | "Nothing to install. Try it yourself." |
| 2:35–2:50 | Ledger scroll with provenance chips · `countersigned N/N` · reload → restore card → tools back | "Every tool: who made it, what it called, what it cost — kept. Do it once. Now it's a tool. Now every agent can call it." |

Rehearsal log and backup trigger as in DEMO.md; backup = QuickTime recording of rehearsal 3.

---

## 13. Judges — one addition per row to FORGE-PLAN §13
Rushing: the D1 frame answers "Codex does this" and the Atlas guardrail ("can't execute on the
user's computer") by showing the human executes. Drasner: Tier 0 measured = "tools not DOM" in our
own engine. Roberts: retire-on-native = the migration path he conceded. Nahas: rook-integrations is
adjacent — cite it, differentiate on composition + human approval. Galloni: Browser Run can consume
our page's tools (his docs) — one measured run if access exists, optional. Gao: evals-cli format in
repo. Grigorik: his storefronts' tools called natively — say "Allbirds" on camera.

---

## 14. Mistakes and ideas we never repeat (append to FORGE-PLAN §14)
- Claiming "ChatGPT has no shell" (it has an integrated terminal + actions since May 2026).
- Leading with "your Enter is the trust boundary" (93% blind approval; labs moved on).
- Proposing "eyes" (app diagnostics), self-eval-until-spec loops, tool pages, typed shell outputs,
  self-healing as thesis — each tested on 2026-08-29 and each collapses into Codex/ChatGPT/Claude
  in Chrome/Replit or the crowded co-create-an-app lane. Recorded so no session re-proposes them.
- Doc timestamps labelled "PT" that were EDT; weekdays wrong in HANDOFF. Git commit times are truth.

---

## 15. What comes after (post-submission, Rokan launch)
Tier 0 becomes rokan-do's default first rung; kept tools sync via Quorus capabilities
(`publish_capability`/`search_capabilities`, already in Quorus) so a team's agents share one
library; graduation (auto-run of hash-verified read tools) behind a toggle; health/repair on cards.

---

## 16. HARD RULE — the etiquette (FORGE-PLAN §16 applies verbatim; additions for this plan)
1. **Test every baby step**; one batched gate per change; numbers in the commit message.
2. **Rokan repo rules bind** (§4.1): gate 8/8 before/after; identical daemon files; one browser job;
   reap daemons; pre-registered questions before any model call; mutation-test guards.
3. **Graphify first**: `graphify query` before reading raw files in either repo; `graphify update .`
   after a code change lands (not during).
4. **Wallet**: model calls only on pre-registered questions; ≤ 60 planning calls this sprint; the
   key is never printed, never enters the container; `security find-generic-password` only inside
   the demo shell.
5. **Load/memory**: one Chrome, one bridge, one eval runner at a time, killed by PID in the same
   command; no persistent monitors; `pgrep … && echo LEFTOVER || echo clean` at the end of every
   command that spawns; per-IP judge slots are shared with the demo — a `--judge` run costs one.
6. **Security**: every new surface (Tier 0, kept store, trailer grammar) ships with its negative
   tests and a SECURITY.md paragraph in the same commit; redaction choke point untouched.
7. **Notes**: `PROGRESS.md` + `FIELD-NOTES.md` (+ Rokan `docs/measurements/`) before every stop.
8. **Honest numbers only.** A claim without the command and its output is not a claim.
9. **3-strike stop.** Three failures on the same thing → write the state into PROGRESS and move on.

---

## 17. Criterion by criterion — what this plan earns and what it can't
- **Leverage (tiebreak #1):** consumer *and* producer of WebMCP; runtime birth; CDP-domain evals;
  DevTools-visible registrations. Ceiling 9 if ChatGPT shows the birth live; 8 otherwise.
- **Execution:** live URL, three consumers, kept tools, honest limits; ceiling 7.5 (dev-flavored,
  judge mode browserless).
- **Impact:** demonstrated, not narrated — D1 and D2 are numbers and vendors on screen; ceiling 7.5–8
  (a generalist still asks "who is blocked today"; the answer is the dev whose agents redo the web
  every session and whose tools don't transfer between vendors).
- **Creativity:** compose-and-keep across native/compiled/machine is not in the field; Understudy
  has the sentence, we have the substrate; ceiling 8–8.5.
- **Stage 1 hygiene:** OSS license ✓, public repo (Arav flips), video (Mon), live URL ✓.
