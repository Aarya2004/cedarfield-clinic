# SELF-REVIEW — the entry against its own plans (read-only audit, 2026-08-28 ~19:30 PT, HEAD `254ad30`)

> **Historical — pre-pivot.** This document describes *Rokan Terminal*, which now lives at
> `/terminal` and is not the submitted product. The submission is **The Drop** — start at
> [`docs/README.md`](README.md).

Method: every doc listed in the brief was read in full; the code the plans name was read to confirm or
refute. No build, server, browser, Docker or eval was run — every number below is quoted from a
measurement someone else recorded (FIELD-NOTES row, PROGRESS line, a VERIFY report) or is a static fact
(a file:line, a `wc`, a `git log`). Where a doc and the code disagree the code is what a judge gets.
Legend: **DONE** = implemented and covered by a named test/case · **PARTIAL** = implemented with a gap
named · **MISSING** = not in the tree · **UNMEASURED** = in the tree, never observed in the consumer the
plan names.

Facts that frame everything: the whole repo is 123 commits, all dated 2026-08-28 (`git log`, 03:36 →
19:20 EDT); the GitHub repo is still **private** (`gh repo view` → `isPrivate:true`, license Apache-2.0
detected); there is **no ChatGPT-desktop measurement anywhere** (FIELD-NOTES "ChatGPT desktop — not yet
measured"); there is **no video and no `.mp4`** (`ls docs/**/*.mp4` = 0) — one builder-mode rehearsal on the
real video path (live page + quick tunnel + Mac shell, real Chrome tab) was captured as six screenshots
(FIELD-NOTES V1–V8, `docs/evidence/gate-b/rehearsal-*.jpg`, commit `fa72e33`) but DEMO.md's rehearsal
log rows 1–5 are still empty; `rokan do` runs on the builder's Mac (FIELD-NOTES R1–R7, V5–V7) and **not** in the judge
container (`infra/sandbox/container/seed/README`: "not installed in this sandbox yet"; the
`Dockerfile.rokan` that adds it was committed 19:18 as *staged, not wired into wrangler.jsonc*).

---

## 1. FORGE-PLAN §2 product spec — item by item

### 2.1 Vocabulary

| item | state | evidence / gap |
| --- | --- | --- |
| Spec `{name, description, commands[1..5], params[0..6], kind}` | DONE | `forge-spec.ts:15-21`; limits `:51-52`; `validateForgeSpec` `:98-138` |
| Card, one visible, FIFO, max 5, 6th → `too_many_pending` | PARTIAL | max 5 + error `forge.ts:205`; **all** pending cards render at once (`App.tsx:138` maps every card), not one-at-a-time; `forge.test.ts` covers the cap |
| Forged tool = `forged_<name>` | DONE | `forge-spec.ts:57`, `forge.ts:286`; `forge-birth.json` step 24 `expect tool forged_hn_top` |
| Visible ≤ 5 forged; "7 fixed + 5 = 12" | PARTIAL | `MAX_FORGED_VISIBLE=5` `forge-spec.ts:53`; fixed tools are **6** not 7 (`schemas.ts:234`); the reserved 7th (`sandbox_status`, §3.5) was never built; `MAX_VISIBLE_TOOLS=12` (`schemas.ts:235`) is exported and imported nowhere |
| Pinned / Evicted / restorable | DONE | `forge.ts:340-348, 359-366, 388-399`; `forge-budget.json` steps 4-27 (evict t1, pin t2 survives, `unpin_one`, restore t1, unforge) |
| Hash = 12-hex SHA-256 over canonical spec | DONE | `forge-spec.ts:235-250`; `forge.test.ts` (hash stable across key order — PROGRESS "Forge engine green") |
| Invocation = 1..5 sequential proposals | DONE | `forge.ts:403-430`; `forge-queue.json` (3 steps), `terminal-self-forge.json` (3 steps on a real PTY) |

### 2.2 Two ways a tool is born

| item | state | evidence / gap |
| --- | --- | --- |
| Agent-initiated `forge_create` → card → approve → registered | DONE | `register.ts:226-250` → `forge.openCard` `:202-224` → `approve` `:235-269`; `forge-birth.json`, `forge-string-input.json` (spec-level `executeTool` with a JSON string), headless screenshot `docs/evidence/gate-c/2026-08-28-forge-birth-chrome152.png` (viewed: page shows "Site tools · 7", `forged_hn_top READ 9b0e0d2b5d96 1 runs`) |
| Human-initiated "Forge this" from 1–5 selected lines | DONE | `Terminal.tsx:145-147` (selection ≤ 5 lines), `:293` button; `forge-this.ts:36-41`; `forge-birth.json` step 40 (`forgeThis([...])` → `origin:'human'`), `terminal-demo-dryrun.json` steps 9-14; Fable VERIFY B5 measured on the live judge sandbox (triple-click → `forged_seq_50`, `getTools` 6→7 in 630 ms) |

### 2.3 Card behaviour

| item | state | evidence / gap |
| --- | --- | --- |
| Editable name / description / commands / params / kind, re-validated on Approve | DONE | `ForgeCard.tsx:60-107`; `forge.approve(card_id, edits)` re-runs `validateForgeSpec` `forge.ts:238-239`; `terminal-demo-dryrun.json` step 12 approves with edits |
| `{{param}}` highlighted; unknown placeholder / unused param blocks Approve with message | PARTIAL | validation message + disabled Approve `ForgeCard.tsx:109-118` (`data-card-error`); **no placeholder highlighting** — commands are plain `<input>`s (`:70`) |
| `kind` default `write` on `isDangerous` or mutating verbs; agent `read` overridden + reason shown; human may flip back | PARTIAL | `MUTATING_RE` `forge-spec.ts:63-64`, override `forge.ts:208-209, 241`; card shows reason `ForgeCard.tsx:56`; **human cannot flip back** — the `read` radio is `disabled={mutating}` (`:102`), stricter than the plan |
| Dangerous → red banner, "Approve anyway" second click | DONE | `forge.ts:243` `needs_confirmation`; `ForgeCard.tsx:55, 117-118`; `forge-injection.json` steps 33-36 |
| Re-forge shows `old hash → new hash`; Approve replaces | PARTIAL | `replaces <old>` shown `ForgeCard.tsx:52`, old controller aborted `forge.ts:280-283`; **new hash is not shown** — it is computed only at approve (`forge.ts:246`) |
| Card shows hash (12 hex), exact `forged_<name>`, JSON-schema preview, the "Each command still needs your Enter" sentence | PARTIAL | name `ForgeCard.tsx:47`, sentence `:108`; **no hash on the card, no schema preview** (hash appears only after approval in the Tools pane, `Panes.tsx:117`) |
| Approve with 5 visible, none unpinned → `unpin_one`; UI says which | PARTIAL | `forge.ts:245, 273-277`; `forge-budget.json` step 19; the UI shows the raw error string (`ForgeCard.tsx:34`), does not point at a tool to unpin |

### 2.4 Forged tool behaviour when called

| item | state | evidence / gap |
| --- | --- | --- |
| Params substituted, step 1 ghost-typed with why `forged_<name> · step 1/N`, steps 2..N queued, promoted after prior step **executed** | DONE | `forge.ts:416-421, 473`; real terminal waits for the end marker (`terminal/adapter.ts:163-168`); `forge-queue.json` steps 8-27; `terminal-self-forge.json` steps 30-42 |
| Esc dismisses the rest (`dismissed_by_human`); non-zero exit → `prior_step_failed` | DONE | `forge.ts:452-455, 468-470`; `forge-queue.json` step 29, `terminal-forge-live.json` steps 27-31 (`false` → step 2 `prior_step_failed`, `never_runs` absent from screen) |
| One active invocation; second call → `{status:'busy', …}` | DONE | `forge.ts:407`; `forge-queue.json` step 13 |
| `terminal_wait` returns `next_proposal_id` on an executed step | DONE | `register.ts:83-88, 221`; `forge-queue.json` step 21 (`outputMatches next_proposal_id`), `terminal-self-forge.json` step 33/42 (`null` on the last) |
| Every step's `exit_code`/`ms` in ledger + stats | DONE | `forge.ts:457-467` (`executed_step`, incl. `rokan_ms`/`rokan_calls`); `terminal-forge-live.json` step 22 (`executed_step` exit codes `[0]`) |

### 2.5 Tools pane

| item | state | evidence |
| --- | --- | --- |
| "Site tools · N" measured from engine state | DONE | `Panes.tsx:95` (`FIXED_TOOL_NAMES.length + visible`); status chip `:58` |
| "Tools registered this session: K" from ledger rows | DONE | `Panes.tsx:92` (`registered`+`forged`+`restored` rows) |
| Forged list: name, kind badge, hash, pin, runs / median ms / last exit, Unforge, Restore | DONE | `Panes.tsx:111-140`; plus "try as agent" (`:131`, `tryAsAgent` → real `executeTool`, `ForgeCard.tsx:129-143`) |

### 2.6 Limits — every row

| limit | plan | code | state |
| --- | --- | --- | --- |
| tool name `^[a-z][a-z0-9_]{1,28}$` | ✓ | `forge-spec.ts:45`, schema `schemas.ts:192` | DONE |
| description ≤ 300, final ≤ 500 | ✓ | `forge-spec.ts:47`, `forgedDescription` `:253-259` truncates to 500 | DONE |
| commands 1–5, each `validateProposedCommand` (≤ 400, no CR/LF/C0/C1/Cf) | ✓ | `forge-spec.ts:104-109`; `schemas.ts:57-65` | DONE (`forge-spec.test.ts`, `gate-a-propose-wait.json` ESC/RLO steps 13-14) |
| params 0–6, name `^[a-z][a-z0-9_]{0,19}$`, desc ≤ 150, example ≤ 80 | ✓ | `forge-spec.ts:46,48,49,52,111-122` | DONE |
| param value at call → string ≤ 200 | ✓ | `coerceParamValue` `:141-152` | DONE (`forge-injection.json` steps 7-19: `; rm -rf /` single-quoted, RLO and `\n` rejected) |
| visible forged 5 (12 total) | 5 / **11** | `MAX_FORGED_VISIBLE=5`; total is 6+5 | PARTIAL (see 2.1) |
| pending cards 5 | ✓ | `MAX_PENDING_CARDS=5` `:54`, `forge.ts:205` | DONE |
| output per tool ≤ 1 500 chars | ✓ | `OUTPUT_BUDGET_CHARS` `schemas.ts:13`; `fitBudget` `register.ts:65-73`; `forge_list` trim `:260-268` | DONE |
| queue step wait 10 min → `step_timeout` | ✓ | `STEP_TIMEOUT_MS` `forge-spec.ts:55`; `forge.ts:441-446` | DONE (unit: `forge.test.ts` per PROGRESS; no harness case waits 10 min) |
| stats window 50 | ✓ | `STATS_WINDOW` `:56`; `forge.ts:458` | DONE |
| "all in `schemas.ts`" | — | forge limits live in `forge-spec.ts:45-57` | doc drift only |

---

## 2. FORGE-PLAN §7 verification protocol — item by item

| § | requirement | exists | does not exist |
| --- | --- | --- | --- |
| 7.1 unit `forge.test.ts` ≥ 14 cases, fake adapter + fake `modelContext` | `forge.test.ts` (376 lines, 19 `test(` calls), `forge-spec.test.ts` (15), `proposals.test.ts` (7); web suite **114/114** (Opus VERIFY §A, Fable VERIFY §A) | — |
| 7.2 `forge-birth.json` (hero, no PTY; approve→`toolsAdded` ms printed; screenshot) | `evals/cases/forge-birth.json` (33 steps); `approve_ms` returned at step 22; FIELD-NOTES Chrome #17 "< 1 ms after approve()"; `docs/evidence/gate-c/2026-08-28-forge-birth-chrome152.png` | — |
| 7.2 `forge-injection.json` | 49 steps: quoted `; rm -rf /`, `$(id)`, RLO, newline, unknown placeholder, kind override, `CONSEQUENTIAL:` + `readOnlyHint:false` read back via `getTools()`, dangerous double-Enter on both paths | the plan's `placeholder_in_quotes` case was dropped by design (FORGE-PLAN §4.3, commit `c243090`) |
| 7.2 `forge-queue.json` | 34 steps: 3-step tool, busy on re-invoke, `terminal_propose` refused mid-queue, `next_proposal_id`, Esc at step 3 | — |
| 7.2 `forge-budget.json` | 25 steps: 6 forged → t1 evicted, `toolsRemoved` observed (FIELD-NOTES Chrome #14), invoke on evicted → `CDP_ERROR`, pin, `unpin_one`, restore, unforge, ledger reasons | — |
| 7.2 harness `equals` / `noTool` / `toolsRemoved` timestamps | `webmcp-cdp.mjs:46, 151`; `equals`, `waitFor`, `type`, `shot`, `diag` present | — |
| 7.2 Gate A case stays green | `gate-a-propose-wait.json` 19 steps, 0 failed (Opus VERIFY: run against the **live prod URL**, `terminal_propose` 21 ms, ESC + RLO rejected) | — |
| 7.3 headed Chrome: **DevTools → Application → WebMCP panel** screenshot showing `forged_hn_top` appear + invocation | headed real-API evidence exists (`docs/evidence/gate-b/2026-08-28-headed-chrome152-ghost-real-api.jpg`, `…after-enter-exit1.jpg`; FIELD-NOTES xterm #8 `executeTool` 1206 ms cold / 12 ms warm) | **no DevTools WebMCP-panel screenshot in `docs/evidence/`** — the gate-c file is a page screenshot; PROGRESS "Blocked on Arav" #3 still lists the panel shot as optional/undone |
| 7.4 ChatGPT desktop: Site tools count = 6; forge → **list refreshes without reload? (yes/no + s)**; agent calls forged tool; `terminal_wait` abort/`still_waiting` budget | — | **nothing**: FIELD-NOTES "ChatGPT desktop (GPT-5.6 Sol/Terra) — not yet measured"; PROGRESS Gate A/B/C rows all say the ChatGPT half is blocked on a human; no `docs/evidence/gate-c/chatgpt-*.png` |
| 7.5 static + regression: typecheck/lint/build/test; bridge check + smoke; all cases exit 0; CI green | Opus VERIFY §A and Fable VERIFY §A both report clean; smoke **36/36**, MCP 3/3, sandbox 12/12, evals 7/7 + `--bridge` 8/8 + `--judge` 8/8; CI (`.github/workflows/ci.yml`) runs web test/build + bridge smoke on Linux (PROGRESS: "CI green on Linux") | CI does **not** run `evals/run-all.mjs` (needs Chrome 152 headless; `ci.yml` steps end at `pnpm --filter rokan-terminal smoke`) |
| 7.6 Gate C prompt-line half green iff 7.1 + 7.2 + 7.3 | 7.1 + 7.2 green; 7.3 half (headed real API yes, DevTools panel no) | live-terminal half: green headless (`terminal-forge-live.json`, `terminal-self-forge.json`, judge-mode 8/8 J9/J11) **and on the real tunnel path** (V6: `forge_create site_status({{site}})` → approve → `tools · 7` → invoke → ghost → Enter → `212ms ⚡`, `docs/evidence/gate-b/rehearsal-4/5-*.jpg`); **ChatGPT `toolchange` refresh unmeasured** (PROGRESS Gate C row, still "ChatGPT half unmeasured (human)") |

---

## 3. TERMINAL-PLAN §2 / §7 and SANDBOX-PLAN scope table

### TERMINAL-PLAN §2.1 states

| state | state | evidence / gap |
| --- | --- | --- |
| unpaired: pairing card (`npx` copy button + "or try the prompt line"), tools work against the prompt-line adapter | DONE, copy honest | `Panes.tsx:216-263` (command is `node packages/bridge/bin/rokan-terminal.js` — "`npx` once published", `:218`); `PromptLine.tsx`; `gateAAdapter` `webmcp/adapter.ts:51-63` |
| connecting: host-only chip, never the token | DONE | `Panes.tsx:44, 51`; `session.ts:100`; `terminal-pair.json` step 2 asserts `location.hash === ''` |
| paired: shell name, cwd (if shared), exit · ms, "measured"/"no shell integration" | DONE | `Panes.tsx:45, 52-56` (`(unmeasured)` suffix without integration); `terminal-pair.json` step 9 |
| busy / unauthorized cards | DONE | `Panes.tsx:237, 249-250`; bridge `busy` `bridge.js:221-224`; smoke "second tab refused (busy)" |
| disconnected: banner "reconnecting in N s", backoff 1·2·4·8·15, give up 10 min, "Reconnect now", scrollback stays, active invocation cancelled | PARTIAL | backoff + 10-min give-up `client.ts:97, 269`; ping 20 s + 3 unanswered = dead `:99, 192`; Reconnect button `Panes.tsx:63-67`; invocation cancelled `session.ts:118`; **chip says `disconnected · retrying` with no countdown** (`Panes.tsx:47`); no test kills a tunnel (PLAN T1.3 unrun) |
| shell exited: line in the terminal, bridge respawns | DONE | `bridge.js:141-151`; smoke "shell respawned after exit" |
| unsupported browser note | DONE (untested in Safari) | `Panes.tsx:97`; PLAN T2.7 (Safari) has no evidence |
| mobile card < 720 px | DONE | `App.tsx:52-62, 92`; `Panes.tsx:265-275` |

### TERMINAL-PLAN §2.2 layout · §2.3 ghost · §2.4 adapter · §2.5 Forge this · §2.6 card · §2.7 ledger · §2.8 limits

| item | state | evidence / gap |
| --- | --- | --- |
| 70/30 layout, three stacked panes, Instrument Serif wordmark, Rokan palette | DONE | `App.tsx:104` (`7fr/3fr`), `Panes.tsx:38` |
| `Cmd/Ctrl+K` toggles Share-screen | MISSING | no `metaKey`/`ctrlKey` + `k` handler in `apps/web/src/components` (grep) |
| Ghost as an xterm **decoration** | changed | overlay positioned from cursor/cell size (`Terminal.tsx:222-263`) because decorations do not paint on a static prompt under WebGL (FIELD-NOTES xterm #6); SECURITY.md §1 says "DOM overlay" (correct); PROGRESS Gate B row and TERMINAL-PLAN still say "decoration" |
| Ghost only while the local line is empty; hides mid-typing | DONE | `Terminal.tsx:226`; `terminal-ghost-ux.json` steps 3-11 ("finish or clear your line") |
| Enter sends exactly `command + "\r"`; dangerous needs Enter twice | DONE | `terminal/adapter.ts:257`; `Terminal.tsx:169-171`; `terminal-ghost-ux.json` steps 21-28, `terminal-propose-enter.json` |
| Tab inserts; later Enter → `edited:true` | DONE | `Terminal.tsx:177-187`; `terminal-ghost-ux.json` steps 13-19 (`"edited":true`) |
| `why` under the prompt, bidi-isolated | DONE | ghost bar `Terminal.tsx:270-281` (`dir="auto"` on the why span; overlay is `dir="ltr"` `:251`) |
| "diff vs current input" (also PLAN §4) | MISSING | no diff rendering — the ghost is hidden whenever the line is non-empty (grep `diff` in `Terminal.tsx` = 0) |
| Substituted spans coloured in the overlay (FORGE-PLAN §4.3; SECURITY §2 relies on the human seeing them) | MISSING | `ghost.textContent = pending.command` `Terminal.tsx:248` — plain text, visible but not marked |
| Multi-step: step k+1 promoted after step k's end marker | DONE | `forge.ts:473` after `adapter.waitProposal` resolves on the end marker (`terminal/adapter.ts:163-168`) |
| Real adapter: `screenLines` (logical lines), `status()`, `waitProposal` with `exit_code/ms/tail/interrupted`, `mode` | DONE | `terminal/adapter.ts:183-203, 204-208, 210-245, 179-181`; `terminal-adapter.test.ts` (16 `test(`); FIELD-NOTES J8 (wrapped-line leak fixed) |
| "Forge this": floating button near the selection; prompt-prefix stripping; drop output lines via the bridge ledger | PARTIAL | button lives in the ghost bar (`Terminal.tsx:293`), not floating; `stripPrompt` `forge-this.ts:10-15` (tested, 3 cases); output lines are **kept** for the human to delete (`forge-this.ts:3-4`; `forge-birth.json` step 40 shows `total 8` kept) |
| Card: editable, inline validation, Approve disabled until valid, dangerous red border + "Approve anyway", `forged_<name>`, hash, "replaces <old>", the sentence, **Try as agent** via `executeTool(tool, JSON.stringify(...))` | PARTIAL | all present except **hash on the card** (see §1 2.3); Try-as-agent is per tool in the Tools pane (`Panes.tsx:131`), FIELD-NOTES xterm #8 measured |
| Ledger: kind badge, ms/calls, ✓ countersigned, export without key, "verified by bridge N/M"; `calls` only from a parsed rokan trailer | DONE | `Panes.tsx:148-186, 198` (`calls:0 ⚡` only when `rokan_calls === 0`); `ledger.ts:140-147` (no key by default); `rokan-terminal verify` cross-check (`ledger.js:80-111`, smoke "crossVerify" ×2) |
| Limits: scrollback 5 000 · `screenLines` ≤ 200 · tail ≤ 200 · backoff cap 15 s / give-up 10 min · ping 20 s · one tab per bridge | DONE (builder) | `Terminal.tsx:99`; `schemas.ts:11`; `terminal/adapter.ts:78`; `client.ts:97-99`; "one tab" holds in builder mode only — judge mode lets the newest tab **replace** the old (`bridge.js:221-234`, smoke "judge mode: a newer tab … takes over") |

### TERMINAL-PLAN §7 verification

| level | exists | does not exist |
| --- | --- | --- |
| L1 unit: `client.test.ts`, `osc`/`linebuffer`, `terminal-adapter.test.ts` | `client.test.ts` (10 `test(`), `terminal-libs.test.ts` (6), `terminal-adapter.test.ts` (16), `judge-resume.test.ts` (1) | — |
| L4 real-PTY cases: pair, propose-enter, read-screen, forge-live, tab-insert, dangerous, typing-hides-ghost, **busy** | `terminal-pair` (10), `terminal-propose-enter` (19), `terminal-read-screen` (13), `terminal-forge-live` (29), `terminal-ghost-ux` (30: tab/dangerous/typing folded in), plus `terminal-demo-dryrun` (49), `terminal-evidence-ghost` (9), `terminal-rokan-trailer` (16), `terminal-self-forge` (37) — `run-all.mjs --bridge` 8/8 | **`terminal-busy.json` absent** (busy is covered only by the bridge smoke, not the page's busy card) |
| L5 bridge smoke | 36/36 (both VERIFY passes); check names in `packages/bridge/test/smoke.mjs:51-249` | — |
| L6 headed screenshots incl. DevTools WebMCP panel | 5 files in `docs/evidence/gate-b/` | no DevTools panel shot (see §2 7.3) |
| L7 ChatGPT desktop (Gate B protocol) | — | nothing (FIELD-NOTES) |
| Gate B "recording of propose → Enter → runs on Arav's Mac → agent reads the redacted screen" | Real path now measured from a real Chrome tab through a live quick tunnel: pair 855 ms, `ls -la` ghost → Enter → `exit 0 · 3 ms`, Share on → 1 redaction, `rokan do` seeded 347 ms ⚡ (V1–V5, `docs/evidence/gate-b/rehearsal-1..3-*.jpg`); `docs/evidence/demo-backup.gif` + `docs/demo.gif` (9 harness frames, Pillow) | no screen **recording** (stills only), no ChatGPT in the loop (tool calls came from the Chrome tab, not a consumer's agent) |

### SANDBOX-PLAN §2 scope table

| row | plan | code / measured | state |
| --- | --- | --- | --- |
| 2.1 "Try it now" → `POST /api/session` → `{ws, token, ttl_ms, mode}`; ≤ 15 s cold, "ready in N s" | `worker.ts:68-112`; `session.ts:136-157`; `Panes.tsx:241-246` (`ready in N ms`) | DONE — cold 4.0–6.5 s (J2, J9, J11); Fable VERIFY B2 4 480 ms |
| 2.1 status bar `judge sandbox · expires in 29:5x`, prompt `judge@rokan:~$`, `~/README` | `Panes.tsx:45-46, 73-85`; `Dockerfile:9, 23`; seed README | DONE — J10 screenshot `docs/evidence/gate-d/live-judge-paired.jpg` (viewed: `judge sandbox · zsh`, `expires in 29:46`, `tools · 6`, ledger `paired … 304 ms ✓`) |
| 2.1 step 5 TTL → "session ended · start a new one" | bridge sends `error timeout` + close (`bridge.js:366-376`); client maps `timeout` → state **`unauthorized`** (`client.ts:223`) → chip "link not valid" + card "This pairing link is not valid" (`Panes.tsx:49, 237`); `sessionStorage` pairing cleared (`session.ts:126`) | **MISSING as specified** — the judge who runs out the 30 min is told the link is invalid; no "session ended"/"new session" string exists in `apps/web/src/components` (grep) |
| 2.2 sessions per IP: "1 new / 10 min; 3 concurrent" | `wrangler.jsonc:25-26` = **3 / 10 min, 3 concurrent**; `gate-logic.ts:19-31`; provisional rows 180 s `worker.ts:46` | DONE; SANDBOX-PLAN row is stale (SECURITY/SUBMISSION/README say 3) |
| 2.2 TTL 30 min via `--ttl-ms`; `sleepAfter '35m'`; `destroy()` on DELETE + bridge exit hook | `--ttl-ms 1800000` `worker.ts:89`; `sleepAfter '10m'` `:87, 121` (Opus VERIFY: 7/10 idle instances); DELETE route **removed** (`worker.ts:9`); destroy only on failed start `:99, 105` | PARTIAL by design — sessions end on TTL/idle, never on tab close (J5) |
| 2.2 instance `basic`, `standard-1` if Chromium | `wrangler.jsonc:11` basic; `max_instances 10` `:12` | DONE; no Chromium in the image (replays are browserless); 1 532 MB unpacked boots on `basic` (HANDOFF §3) |
| 2.2 egress `enableInternet=false` + allowlist HN / lobste.rs / example.org / api.anthropic.com | `worker.ts:37-40` exactly those four | DONE in code; **never exercised** (no `curl example.org` / blocked-host measurement in FIELD-NOTES; PLAN T4.4 unrun); none of the **seeded** hosts DEMO.md names (githubstatus.com, pypi.org, docs.github.com) is allowlisted |
| 2.2 model calls: none possible, no key | `worker.ts:33` comment; no `ANTHROPIC_API_KEY` in `Env` | DONE |
| 2.2 non-root `judge` uid 1000, no sudo; judge-mode `sudo` hard-block | `Dockerfile:8`; `JUDGE_SUDO_RE` `schemas.ts:80`, `isDangerousIn` used on propose (`register.ts:117`), forge card/approve/invoke (`forge.ts:214, 242, 418`) | DONE in code; Fable VERIFY: `sudo ls` in judge mode "not validly measured" |
| 2.2 tools: zsh, git, curl, python3.11 + uv, node 20, rokan-do | `Dockerfile:6` zsh git curl jq; base image `-python` (3.11 per SANDBOX-PLAN §1); node **22** (FIELD-NOTES sandbox #2); **no uv, no rokan-do** in the wired `Dockerfile`; `Dockerfile.rokan` (staged) adds uv + 3 wheels + Playwright Chromium + 54 seeds + `rokan-seed-ops.json` + `SKILL.md` — "not wired into wrangler.jsonc until smoke-tested" (`23e37bd`); `vendor/*.whl` are **untracked** (`git status`: `?? vendor/`) | PARTIAL |
| 2.3 rate-limited → message with N min | 429 body rendered `Panes.tsx:231, 246`; `docs/evidence/gate-d/live-page-cap-429.jpg` | DONE |
| 2.3 cold > 25 s → "still starting… (N s)" then error card + retry | tick counter `Panes.tsx:222-226, 242`; Worker gives up after 80 × 250 ms ≈ 20 s + exec time → generic 503 (`worker.ts:92-100`); button re-enabled on failure | PARTIAL (threshold ≈ 20 s, not 25; retry = click again) |
| 2.3 Worker down → npx path + prompt line | fetch failure → `judgeErr` (`session.ts:153-156`); the `node …` path is always on the card | DONE |
| §3 `hello` gains `mode`, `ttl_ms`, `expires_at`; bridge flags; `startWith`; `NEXT_PUBLIC_BRIDGE_HOSTS`; Worker routes | `bridge.js:255`, `protocol.ts:88-91`; `bin/rokan-terminal.js` header; `session.ts:85`; `protocol.ts:133-136`; routes `worker.ts:66-125` (no DELETE) | DONE |
| §4 signed sid, `SID_SECRET` fail-closed, generic 503, Origin 403 before Gate, `/ws` verifies before `getSandbox` | `sid.ts:19-35`; `worker.ts:69-72, 62, 107-108, 117-120`; `sid.test.mjs` (4), `origin.test.mjs` (3), `gate.test.mjs` (5) = 12/12 | DONE; Opus VERIFY: forged sids 403 in 83–125 ms, cross-origin POST 403 |
| §6 L5' `smoke-image.sh`, deploy, `--judge` suite, cold_ms in FIELD-NOTES, L8 stranger test | script exists; FIELD-NOTES sandbox #6-8 (image smoke: hello 1 079 ms, TTL exit 20 735 ms); J9/J11 live 8/8; J10 real-Chrome stranger path **from the builder's IP** | L8 from a **different network** not done (PROGRESS Gate D row: "Not yet") |

---

## 4. PLAN §1 hero moment and §8 shot list — beat by beat

Hero moment (PLAN §1): history line → Forge → card `hn_top` param `n` → approve → **appears in the agent's site-tools list without reload** → "top 3 now" → `forged_hn_top({n:3})` → ghost → Enter → `calls:0 · 0.36s`.

| beat (PLAN §8 / DEMO.md) | can it be shown today | evidence | missing |
| --- | --- | --- | --- |
| 0:00–0:20 cold open: `rokan do "top 5 HN titles"` already in history → Forge this → card → Approve → site-tools list gains `forged_hn_top` (DevTools panel 2 s) | **Yes with a seeded site, not with HN.** Forge → card → approve → `tools · 7` on the real tunnel path (V6, `forged_site_status READ c5b4e8301a8e`) | `Terminal.tsx:293`; FIELD-NOTES Chrome #17 (< 1 ms), Fable VERIFY B5 (`toolchange` 5 ms, `getTools` 6→7 in 630 ms, live judge sandbox); V6 `docs/evidence/gate-b/rehearsal-4-forged-invoke-ghost.jpg`; `docs/evidence/demo/beat1-card.png`, `beat1-born.png` (`seq 1 5`) | **HN is not seeded** (R2) and cannot be seeded (R7: engine does not persist the op); the history line is a seeded question (V5: githubstatus.com) or `seq`. **"Appears in the agent's site-tools list" is measured only in Chrome's `getTools()`/CDP/status chip, never in ChatGPT's Site-tools UI** (PLAN §0.9 open measurement). No DevTools-panel screenshot exists. |
| 0:20–0:35 "top 3 now" → agent calls `forged_hn_top({n:3})` → ghost → Enter → ledger `calls:0 · 0.36s` | **Yes for a seeded site, driven from the Chrome tab / Codex-MCP, not from ChatGPT** | V6: invoke `forged_site_status` → ghost → Enter → `212ms ⚡`, ledger `executed_step … exit 0 · 430 ms` (`rehearsal-5-forged-ran-replay.jpg`); rendering `Panes.tsx:198` (`⚡ calls:0 · N ms`, moved before the row truncates in `fa72e33`); replay 312 ms (R3), 53/54 seeds at 0 calls, 1.23 s mean (R6); real-agent path proven with **Codex over MCP** (Fable VERIFY §C) | No ChatGPT call of any tool ever observed; `calls:0` requires the demo Mac's rokan-do (not the judge container); the on-screen number is 212–347 ms (V5/V6), not "0.36 s" |
| 0:35–0:55 "what's in this repo, are tests passing?" → `ls` ghost → Enter → `pytest -q` ghost → Enter → agent reads screen → answer | **Mechanically yes; agent narration unproven** | `terminal_propose`→Enter→`terminal_wait` `exit_code` (`terminal-propose-enter.json`); `terminal_read_screen` needs Share ON (`register.ts:132`) — DEMO.md's own next beat turns it on only at 0:55, so at 0:35 the agent reads `{shared:false}` unless the order is changed | An agent that decides to call `terminal_propose` twice then `terminal_read_screen` — only Codex-over-MCP has done anything like it; `pytest` is not in the judge image (`Dockerfile:6`) — builder Mac only |
| 0:55–1:10 Share off → `{shared:false}`; on → fake key → `[redacted]` | **Yes** | `terminal-read-screen.json` steps 3-11 (real `AWS_SECRET_ACCESS_KEY` on a real PTY); `docs/evidence/demo/beat3-share-redacted.png`; Fable VERIFY B4 (live judge, value absent); J8 wrapped-line fix | — |
| 1:10–1:40 (PLAN) "get me the top 5 HN titles" → `rokan do …` → `calls:1 · 4.2s` **or** (DEMO) judge-sandbox beat on a second laptop | **HN model path: runs (V7: 5 real titles, 2 186 ms, no bolt) but the ledger cannot show `calls:1`.** Judge beat: yes | R7 + V7 (`rehearsal-6-hn-model-path.jpg`): needs the Keychain key exported before starting the bridge (FIELD-NOTES "Demo shell"); **model-call counts are not printed by rokan-do (R5)**, so `terminal_wait.rokan.calls` is `null` and the ledger row reads `rokan N ms` with no calls figure (`register.ts:220`, `Panes.tsx:198`). Judge beat: J10 real-Chrome pairing, `docs/evidence/gate-d/live-judge-paired.jpg`, `live-judge-command-ran.jpg` | PLAN §8's on-screen `calls:1` is not producible by the code (only `⚡ calls:0` or nothing); narration must say "one model call" from R7/V7, not read it off the ledger. Judge beat from the **demo network** risks the 3-per-IP cap (J4/J5: aborted or previous sessions lock the IP for up to 30 min) |
| 1:40–2:05 agent-initiated birth after three approvals → `forge_create` → CONSEQUENTIAL card → Approve → invoke → Enter | **Yes on a real PTY, harness-driven** | `terminal-self-forge.json` (37 steps: 3 proposals → `forge_create` with `kind:'read'` overridden to `write`, `CONSEQUENTIAL:` + `readOnlyHint:false` read back, 3-step invoke with `next_proposal_id`); `docs/evidence/demo/beat4-consequential-card.png` | The "agent decides to forge on its own" part needs a live agent; no ChatGPT/Codex run of `forge_create` recorded |
| 2:05–2:25 recovery: forged step exits non-zero → `prior_step_failed` → agent reads redacted tail → proposes the fix → Enter | **First half yes; second half needs an agent** | `terminal-forge-live.json` steps 23-31, `terminal-demo-dryrun.json` steps 40-45, `docs/evidence/demo/beat5-recovery.png`; tail complete since `e34c0c4` (Fable pass-2 F1) | No case or evidence of the follow-up `terminal_propose` of a fix; DEMO.md's pre-stage has no failing command prepared except `false` |
| 2:25–2:40 ledger scroll: kinds with ms/calls, `countersigned by bridge N/N`, export, HMAC-verified | **Yes** | `Panes.tsx:148-186`; `docs/evidence/demo/beat6-ledger.png`; `rokan-terminal verify` (`bin/rokan-terminal.js` `verify`, smoke "crossVerify" ×2, "tampered ledger detected (nested object)") | — |
| Sponsor clips: Netlify/Render consequential write, Cloudflare B-roll, Vercel badge | Cloudflare yes (judge chip); Netlify/Render **no** | `forge-queue.json` step 3 uses `netlify deploy --prod` only as ghost text and dismisses it | No Netlify/Render account (PROGRESS D2 questions 4 unanswered); Netlify credits form closes Sep 1 12:00 PT |
| Pre-stage checklist (DEMO.md): Site tools arrow shows 6 in ChatGPT; DevTools lists 6; `npx rokan-terminal` from a fresh clone; second laptop mirrors; backup one keypress away | ChatGPT ✗ · DevTools count: `getTools()` 6 measured (Fable B1) ✗ panel shot · `npx` ✗ (not on npm, PROGRESS 1a; V1 used `node packages/bridge/bin/rokan-terminal.js`, tunnel link in 19 s) · second laptop ✗ · backup = gif ✓ (`docs/evidence/demo-backup.gif`), no `demo-backup.mp4` | | 0 of 5 rehearsals **logged** (DEMO.md table empty although V1–V8 was a full builder-mode run) |

---

## 5. Judge by judge (FORGE-PLAN §13, RESEARCH §10/§11)

Scores are what each judge would give **today**, from the artefacts that exist, assuming they open the live URL in their own consumer for the first ten seconds.

| judge | first 10 s they see today | today | what makes them say no | cheapest change that moves the score |
| --- | --- | --- | --- | --- |
| **Rushing** (OpenAI) | Opens `rokan-terminal.vercel.app` in ChatGPT desktop. **Unknown outcome** — nobody has opened it there (FIELD-NOTES ChatGPT section empty). If Site tools shows 6 and `terminal_propose` passes safety review, he sees an inert tool + "Try it now" | **4** (unverified in his consumer; 7–8 if it works) | "You never ran it in the product you're submitting to"; "Codex desktop already runs a terminal with approvals" (answer pre-written PLAN §10 #8 / FORGE-PLAN §14 #9 but unsupported by any ChatGPT screenshot) | 1–2 h with a Sol/Terra account: open prod URL, screenshot Site tools = 6, "propose ls" invoked, forge → does the list refresh (yes/no + seconds) → FIELD-NOTES + `docs/evidence/gate-c/chatgpt-*.png`. This single measurement moves Rushing, Leverage and Execution together |
| **Drasner** (Chrome) | In Chrome 152 + flag: 6 tools, `AbortSignal` per forged tool, `toolchange` fires, annotations set (`register.ts:303-312`, `forge.ts:313-335`); FIELD-NOTES Chrome #1–17 (unpublished quirks: no `{signal}` to `execute`, string input to `executeTool`, `toolsRemoved` on abort) | **7** | No DevTools → Application → WebMCP screenshot anywhere; the card has no hash/schema preview so the "observability" beat is the ledger only; `dir="auto"` on the why span (`Terminal.tsx:272`) next to a `dir="ltr"` overlay reads as inconsistent to a browser engineer | 30 min headed: screenshot the DevTools WebMCP panel before/after a birth and after an invocation → `docs/evidence/gate-c/`; cite FIELD-NOTES in the README first screen |
| **Nahas** (MCP-B) | `readOnlyHint` from human-approved `kind` (`forge.ts:328`), `CONSEQUENTIAL:` prefix (`forge-spec.ts:254`), `untrustedContentHint` on reads (`register.ts:128`), content hash in every `forged/invoked/executed_step` row (`forge.ts:255-265, 425`), bridge-countersigned ledger (`bridge.js:301-323`), single redaction choke point (`redact.ts`, 16 `test(`), MCP parity via the bridge relay (`mcp.js`) | **8** | Hash not shown on the card before approval (the "bind identity" beat is invisible at decision time); "second tab → busy" in SECURITY §4 is false in judge mode (`bridge.js:221-234` newest tab wins) — he reads SECURITY.md; option injection stated as a non-goal (fine) | 1 h: compute `contentHash` when the card opens and show `hash · forged_<name> · schema` on the card; one SECURITY §4 sentence for judge-mode takeover |
| **Grigorik** (Shopify) | Six named tools + forged; measured ms everywhere (`Panes.tsx:55, 119, 198`); `useForgedTools()` (`use-forged-tools.ts`, 59 lines, 1 test) | **6** | "Reusable library" is a 59-line hook bound to this page's singleton `forge`; nothing is published (`rokan-terminal` not on npm — PROGRESS 1a; no `@rokan/forge` package); the terminal is the only host; POSIX-only quoting stated | 0.5 h: `npm publish` the bridge (the `npx` claim in README/DEMO/SUBMISSION becomes true); 1 h: move `forge.ts` + `forge-spec.ts` + hook behind a documented import path in README "use it on your site in 10 lines" |
| **Gao** (Vercel/Next) | Next 15.5 App Router, TS strict, nonce CSP middleware (`middleware.ts`), `AGENTS.md` at root, `evals/` with 16 JSON cases + CDP harness, 114 unit tests (VERIFY) | **7** | `AGENTS.md:14` says "93 unit tests", README says 109, VERIFY says 114 — the evals story has stale numbers in the two files he reads first; cases are a custom step DSL, not Chrome's `evals-cli` ordered/unordered assertions (PLAN §3 promised `evals-cli`; PROGRESS 15:40: not on npm); CI never runs the headless cases | 20 min: sync the numbers (AGENTS/README/SUBMISSION); 10 min: one paragraph in `evals/README` (none exists) explaining the step grammar and how it maps to ordered expected calls |
| **Galloni** (Cloudflare) | "Try it now" → real `@cloudflare/sandbox` container in ≈5 s (J9), per-IP Gate DO, HMAC sids with expiry, egress allowlist, generic 503s, `ContainerProxy` root-cause in FIELD-NOTES J1 | **7** | `max_instances: 10` with 30-min sessions that never end on tab close (J5) → four judge IPs can exhaust the pool (Opus VERIFY P2 — `sleepAfter` shortened to 10 m, `max_instances` unchanged); a Worker deploy drops every live session (DEMO.md freeze rule); egress allowlist never exercised; the container has no star command | 15 min: raise `max_instances` (money: containers bill per active instance); 1–2 h: wire `Dockerfile.rokan` after `smoke:image` + one replay measured under ¼ vCPU, add the seeded hosts to `allowedHosts`, redeploy **before** the Tue freeze |
| **Roberts** (Netlify) | Agent as an extension of the human: every command is a proposal, `terminal_wait` blocks on the human; recovery semantics (`prior_step_failed`, redacted tail) exist in code | **6** | The recovery beat is harness-driven — no agent has yet read a failing tail and proposed a fix; no Netlify/Render consequential-write beat (no account, PROGRESS D2 #4); the write beat in `forge-queue.json` is a dismissed ghost | 1 h with any agent (Codex over MCP is already wired — Fable VERIFY §C): record `false` → `prior_step_failed` → agent reads tail → proposes fix → Enter; 30 min: a Netlify site + `netlify deploy` as the CONSEQUENTIAL forged tool |

Panel-wide: mean ≈ **6.4** today (FORGE-PLAN §13 projected 8.4 after upgrades 1–7; upgrades 1, 5, 6, 7 are built, 2 is not, 3–4 are scripted but unrecorded). The single largest swing is the ChatGPT measurement: it moves Rushing by ≈ +3 and every criterion's "working in the named consumer" clause.

---

## 6. Criterion by criterion (FORGE-PLAN §17, RESEARCH §5)

| criterion (25% each) | today | gap to 10 | concrete work |
| --- | --- | --- | --- |
| **WebMCP Leverage** (tiebreak #1) | **7** — runtime `registerTool` per forged tool with its own `AbortSignal` (`forge.ts:313-335`), `toolchange` listener (`register.ts:305-309`), `getTools`/`executeTool` used by the product itself (`ForgeCard.tsx:133-140`), annotations from human-approved `kind`, `additionalProperties:false` + `examples` (`forge-spec.ts:262-266`), output budget, `forge_list` introspection, one registry / two protocols (`register.ts:278-295`, `mcp.js`), FIELD-NOTES Chrome #1–17 | "Working" is proven in Chrome 152 (CDP + headed real API + the real tunnel path V1–V8) and Codex-over-MCP, **not in ChatGPT desktop**; `toolchange` refresh in ChatGPT unknown (PLAN §0.9); no DevTools-panel evidence; `exposedTo`/`title`-level polish unused beyond `title: 'Forged: …'` (`forge.ts:325`) | ChatGPT measurement (1–2 h, human); DevTools panel shots (0.5 h); if ChatGPT does not refresh, state it in README/SUBMISSION and lead the video with DevTools (PLAN §0.9 fallback) |
| **Execution** (tiebreak #2) | **6** — live prod 200 in 196 ms with nonce CSP (Opus VERIFY §B); judge sandbox cold ≈ 5 s; `?tour=1`; busy/unauthorized/mobile/unsupported states; per-pane error boundaries (`App.tsx:23-44`); reload-survives-judge-session (`judge-resume.ts`); 114 unit + 36 smoke + 23 harness cases; 54 reviewer findings closed with tests (PROGRESS) | TTL expiry shows "link not valid" (§3); `disconnected` has no countdown; `npx rokan-terminal` is untrue until published; Cmd/Ctrl+K absent; hash/schema absent from the card; Safari untested (T2.7); no stranger test from another network (L8); no video, 0/5 rehearsals, no `demo-backup.mp4`; README/AGENTS numbers stale; repo private | TTL copy + countdown (1 h, C); npm publish (0.3 h, Arav); card hash/schema (1 h, C); stranger test from a phone hotspot (0.5 h, Arav); rehearsals ×5 + QuickTime backup (3 h, Arav); doc-number sweep (0.5 h, C) |
| **Potential Impact** | **5** — audience named (developers whose ChatGPT/Codex must act on their machine); the mechanism (approve → tool for next time) is real on a real shell; `rokan do` replay 53/54 at 0 calls (R6) makes the "model leaves the hot path" claim measurable | The judge's own experience (sandbox) has **no `rokan do`** (seed README) and no repo/tests to act on — a bare `judge@rokan:~` with `ls`/`seq`; the three concrete workflows FORGE-PLAN §17.3 promises (tests, deploy, data pull) are not staged in the container; `calls:1` is not showable (R5); the "any machine" beat (§13.2) is unbuilt | Wire `Dockerfile.rokan` + seeded hosts (2–4 h, C, Docker CPU + redeploy); seed a small repo with a failing test in `/home/judge` so `pytest -q` → recovery works for a stranger (0.5 h, C); remote-box beat via the tunnel on any Linux VM (1 h, C + a VM) |
| **Creativity & Ambition** | **7** — tools born at runtime from the human's own history, identity-hashed, agent-callable, in the web's standard; agent self-forge after approvals (`terminal-self-forge.json`); countersigned ledger; judge sandbox running the same bridge | Judges will still file the landing page as "terminal + approval" — the unpaired page opens on a pairing card and prompt line (`App.tsx:112-128`), the birth is step 3 of the tour; nothing on screen at t=0 is a born tool; prior-art answer (Warp/Codex) exists only in docs, not on the page | 0.5 h: make the first paint show a birth (pre-forged example tool with hash + "born 0 s ago" from a real `registered` row, or the GIF above the fold); 1 h: one README sentence per prior-art item (Warp workflows, Codex, MCP-B) with the specific difference |

Stage 1 / hygiene (FORGE-PLAN §17.5): on-theme ✓ (README first line); `registerTool` demonstrable ✓; **license in About** ✓ (`gh repo view` licenseInfo Apache-2.0); **repo public ✗** (private, decision 1c pending); **video ✗**; live URL ✓; commits timestamped after 08-25 ✓ (all 08-28); Representative/Devpost form ✗ (not started).

---

## 7. The idea against the research

**The lane.** RESEARCH §6b: ~48% of live entries (±5pp, N≈379 repos classified by description, not re-counted) are "agent proposes, human approves"; ~29% use approval/gating language; ~28% use the shared-surface metaphor incl. *console*. Our second sentence ("your Enter is the trust boundary", PLAN §1) is that lane verbatim. The plan's answer (PLAN §0.9: forge leads) is correct on paper; on the live page the first thing a stranger sees is still the pairing card + prompt line, i.e. the lane. RESEARCH §6b also says nearly all entries register a fixed list at load — runtime, user-made registration is the claimed differentiator; evidence for "no one else does this" is a name/description repo search (RESEARCH §6b caveat: "absence there is weak evidence").

**What is unique (as built, with the file that proves it):**

| claim | proof in tree | how strong |
| --- | --- | --- |
| Tools born at runtime from a human's own command history, with `AbortSignal` lifecycle and `toolchange` observed | `forge.ts:311-338`, `forge-this.ts`, FIELD-NOTES Chrome #14, #17; Fable VERIFY B5 on the live sandbox; V6 on the live page + tunnel + Mac shell (`forged_site_status` born, invoked, replayed at 212 ms ⚡) | strong in Chrome; unmeasured in ChatGPT |
| Tool identity hash (SHA-256/12) on every registration and call row; changed hash → new approval | `forge-spec.ts:235-250`, `forge.ts:216, 246, 255-265, 425` | strong; invisible on the card at decision time |
| Ledger HMAC-chained in the tab **and** countersigned by a key the page never sees; `rokan-terminal verify` cross-checks | `ledger.ts`, `bridge.js:301-323`, `ledger.js:80-111`, smoke "crossVerify" | strong; unique framing ("tamper-evident, countersigned") is honest |
| Judge sandbox that runs the **same bridge** (one protocol, one adapter, real exit codes) behind a Worker WS proxy with signed expiring sids | `worker.ts`, `sid.ts`, J1–J11 | strong; Cloudflare's own SDK terminal would have been the commodity path (SANDBOX-PLAN §0) |
| `rokan do` replay `calls:0 ⚡` attributed only to real rokan invocations, parsed from the program's own output | `rokan-trailer.js:9-15`, `bridge.js:122`, smoke ×4 + `terminal-rokan-trailer.json`; R3/R6 | strong on the builder Mac; **absent from the judge experience** |
| One tool registry, two protocols (WebMCP + MCP stdio relay that can never type) | `register.ts:278-295`, `mcp.js`, `mcp.test.mjs`, Fable VERIFY §C (real Codex) | medium — MCP-B's thesis is MCP-in-browser; ours is the inverse direction (page → MCP) which is genuinely less common |
| Measured consumer field notes nobody has published | `docs/FIELD-NOTES.md` (Chrome 152 ×17, xterm ×8, sandbox ×8, tunnel ×7, rokan ×7, judge ×11) | strong as citation bait; only for Chrome, none for ChatGPT |

**Prior-art table (what a judge will say, and the specific difference):**

| prior art | what it is | specific difference | risk it still lands |
| --- | --- | --- | --- |
| Warp Workflows / `just` / `make` / shell aliases | parameterised saved commands, sometimes with an AI that runs them after a confirm | Ours is registered to a browser-standard tool list the *agent* discovers (`registerTool`), carries a content hash, and the agent's call is inert (ghost text) — the human's keypress is the only execution path (`terminal/adapter.ts:257`). FORGE-PLAN §14 #8 rates the alias framing 5/10 | high unless the page/video *shows* `getTools()` growing |
| Codex desktop / Claude Code / Cursor terminals | agent runs commands in a sandbox with approval prompts | They execute; we never do — but a judge may read that as *less* capable ("Codex does this and runs it"). Our answer: portable WebMCP tools on any machine via the bridge (PLAN §10 #8) — the "any machine" beat that would prove it is unbuilt | high (Rushing) |
| MCP-B (`@mcp-b/*`, Nahas) | page tools relayed to Claude Desktop/Cursor via an extension; polyfill; React bindings | Same direction of relay as our `mcp` subcommand — a judge (Nahas) may see our MCP parity as his own idea re-implemented. Difference: ours relays *user-forged* tools born at runtime and the relay socket is denied PTY input (`bridge.js:204-219, 265-269`) | medium |
| Shopify storefront tools (10 fixed per store) | fixed list at load, commerce | Nothing in common except the API; we register zero commerce tools | low |
| "Agent proposes / human approves" entries (≈48%) | governed shared surfaces | Identical safety sentence; the difference is only the birth of new tools — if the birth is not on screen in 10 s we are filed with them | **highest** |
| Chrome Labs `use-webmcp-tool` / `@webmcp-registry/kit` / `agentk` | per-view registration lifecycle; registries; cmdk→tools | Developer-authored tools registered by code; ours are authored by the end user at runtime and hashed | low-medium |
| arXiv 2606.06387 (tool surface poisoning) | recommends identity-bound tools + traceable logs | We implement two of its four recommendations (hash + ledger) — implementation, not invention; cite it, do not claim it | low |
| Cloudflare edge bridge / Browser Run | tools injected at the edge; headless WebMCP | Not retrofit (PLAN §0.1); our sandbox uses their SDK as a host, not as the tool layer | low |

**Novelty score: 7/10.** Justification: the combination (user-made runtime tools + identity hash + countersigned ledger + inert-by-construction execution + same-bridge judge sandbox) is not in RESEARCH §6/§6b's lists and the pieces are real in code, not mock. It is not 8+ because (a) each piece has a named ancestor (Warp workflows, MCP-B relay, the arXiv mitigations), (b) the evidence that the runtime-birth lane is empty is weak (name/description search), and (c) the thing that would make it undeniably different — the agent's tool list visibly growing in the sponsor's own consumer, and a tool forged on one machine driving another — is unmeasured/unbuilt. Under the "reject below 8" rule the honest move is not to reject but to buy the last point with the ChatGPT measurement and the any-machine beat, both < 3 h.

**Three most likely ways this entry loses:**

1. **The ChatGPT half never happens or fails on the day.** Every gate's ChatGPT row is red (PROGRESS Gates A/B/C); if Site tools does not list the page, safety review blocks `terminal_propose`, or the list does not refresh on `toolchange`, the hero shot is Chrome-only and the OpenAI judge's first ten seconds are a blank Site-tools arrow. PLAN §10 #1's kill rule (Chrome primary, say so) has not been triggered because the measurement was never taken.
2. **Filed in ten seconds as a governance entry.** The landing page leads with pairing + prompt line (`App.tsx:112-128`); the differentiator is step 3 of a tour; there is no video; README's GIF shows `seq 1 5`. Combined with the 48% lane share, the judge files it before the birth.
3. **Stage 1 / operational failure on judging day.** Repo still private; no video; `npx` claim untrue; judge pool of 10 instances with 30-min sessions (Opus VERIFY P2, four IPs exhaust it); a TTL expiry reads "link not valid"; a Worker redeploy after Tue kills live sessions (DEMO.md freeze rule); the April-23 failure mode is "it did not open".

---

## 8. Ranked gap list (top 15)

Owner: **C** = Claude can do it alone; **Arav** = human-only (login, money, account, decision, camera). Dependency column names the external thing that gates it.

| # | gap | score impact | est. h | owner | dependency |
| --- | --- | --- | --- | --- | --- |
| 1 | **Measure the ChatGPT half**: prod URL in ChatGPT desktop on Sol/Terra → Site tools = 6? `propose ls` invoked? forge → list refreshes without reload (yes/no + s)? `terminal_wait` abort budget → FIELD-NOTES + `docs/evidence/gate-c/chatgpt-*.png`; trigger PLAN §10 #1 if red | Rushing +3; Leverage, Execution, Creativity all carry a "works in the named consumer" clause; decides the video's cold open | 1–2 | Arav (account) + C (protocol, docs) | ChatGPT desktop with GPT-5.6 Sol/Terra (plan tier — money) |
| 2 | **Video < 3:00 + 5 logged rehearsals + QuickTime `demo-backup.mp4`** (DEMO.md shot list; one un-logged builder-mode run V1–V8 exists as stills; no mp4) | Stage 1 pass/fail; Execution; every judge's first 60 s | 4–6 | Arav (camera, narration); C (dry-run script already exists: `terminal-demo-dryrun.json`; V-path script in FIELD-NOTES) | #1 for beats 0–1; a seeded `rokan do` question for `calls:0` (V5/V6 prove `githubstatus.com` works) |
| 3 | **Repo public + LICENSE in About (done) + Devpost form + YouTube public**; decide the history purge (PROGRESS 1c) before flipping | Stage 1 pass/fail | 1 | Arav | history-purge decision (force-push) |
| 4 | **`rokan do` in the judge container**: `smoke:image` on `Dockerfile.rokan`, measure one replay under ¼ vCPU, commit `vendor/*.whl` (untracked now), add seeded hosts to `allowedHosts` (`worker.ts:39`), switch `wrangler.jsonc` image, redeploy **before Tue 12:00** | Impact +2, Galloni +1, Rushing ("Codex does this" answer becomes a live replay) | 2–4 | C (needs Arav's "go": Docker build pins CPU 10–20 min under amd64 emulation — PROGRESS) | Docker go; Worker redeploy window; image size vs `basic` disk (4 GB) with Chromium |
| 5 | **TTL expiry UX**: map bridge `timeout` with "session ended" message to a `session_ended` state → card "session ended · new session" (SANDBOX-PLAN §2.1/2.3); add "retrying in N s" to the disconnected chip | Execution, Galloni; a judge who spends 30 min sees "link not valid" | 1 | C | — |
| 6 | **Hash + `forged_<name>` + schema preview on the Forge card before approval**; show `old → new` on re-forge (FORGE-PLAN §2.3) | Nahas +1, Drasner; the identity story becomes visible at decision time | 1 | C | — |
| 7 | **`npm publish rokan-terminal`** (`npm pack --dry-run` verified per PROGRESS 1a) so README/DEMO/SUBMISSION's `npx rokan-terminal` is true for a stranger | Execution, Grigorik | 0.3 | Arav (`npm login`) | npm account |
| 8 | **DevTools → Application → WebMCP panel screenshots** (before/after birth, after invocation) + one Model Context Tool Inspector shot (FORGE-PLAN §7.3, PLAN T2.1) | Drasner +1, Leverage evidence | 0.5 | C (headed Chrome) | Chrome headed with flag |
| 9 | **Stranger test from a different network** (Gate D L8) and raise `max_instances` (Opus VERIFY P2: four IPs exhaust 10) | Execution, Galloni; the April-23 risk | 0.5 + config | Arav (phone hotspot / Aarya's machine); C (config) | containers cost per instance (money) |
| 10 | **Recovery beat with a real agent** (Codex over MCP is wired: Fable VERIFY §C): `false` step → `prior_step_failed` → agent reads tail → proposes fix → Enter; plus a **Netlify/Render consequential write** as the forged `deploy` tool | Roberts +2, Creativity | 1.5 | Arav (Netlify/Render account, credits form before Sep 1 12:00 PT); C (script) | Netlify/Render account |
| 11 | **Any-machine beat** (PLAN §13.2): pair the same page to a Linux VM through the tunnel; forged tool runs there | Rushing, Galloni, Impact (widens audience to servers) | 1 | C (bridge runs anywhere Node runs) + Arav (VM) | a VM (money, small) |
| 12 | **Doc-drift sweep** so "say the true thing" holds: PLAN §3 "7 fixed", FORGE-PLAN §2.1/§3.5 `sandbox_status`, SANDBOX-PLAN §2.2 1/10 min · `sleepAfter 35m` · DELETE, PLAN §8 `calls:1 · 4.2s` (unshowable, R5), SECURITY §4 "second tab → busy" (judge mode replaces), README 109/365, AGENTS 93, PROGRESS "ghost decoration", DEMO pre-stage "HN seeded" (R7) | Execution, Gao, Nahas (they read the docs) | 1 | C | — |
| 13 | **Landing page leads with a birth** (PLAN §0.9 on the page, not only in docs): above-the-fold example of a forged tool with hash and a real `registered` timestamp, or the GIF; README first screen cites FIELD-NOTES | Creativity +1, the 10-second filing problem | 1 | C | — |
| 14 | **Judge container has something to act on**: seed a tiny repo with a failing test in `/home/judge` so "are the tests passing?" → `pytest -q` → recovery works for a stranger (python3 exists, pytest does not — `Dockerfile:6`) | Impact, Roberts, Execution (tour step 1 has nothing to propose but `ls`) | 0.5 (+ redeploy) | C | Worker redeploy before freeze (with #4) |
| 15 | **`terminal-busy.json` + substituted-span highlighting in the ghost overlay + `{{param}}` highlighting on the card** (TERMINAL-PLAN §7, FORGE-PLAN §4.3 — SECURITY §2 leans on "the human sees the substituted span") | Nahas (security honesty), Execution completeness | 1.5 | C | — |

Also open but unranked: Netlify credits form deadline Sep 1 12:00 PT (Arav); office hours Aug 31 11:00 PT (Arav + Aarya); Safari/no-WebMCP smoke (T2.7, 10 min); CI does not run the headless evals (Chrome in CI, 1 h); `vendor/` policy (commit the wheels or gitignore them — CLAUDE.md says "three wheels in `vendor/`").

---

## 9. Docs vs code

### What the docs claim that the code does not do

- PLAN §3 header, FORGE-PLAN §2.1 and §3.5: **7 fixed tools** incl. a reserved `sandbox_status` — code has **6** (`schemas.ts:234`); `sandbox_status` exists nowhere; `MAX_VISIBLE_TOOLS` is dead (`schemas.ts:235`, no importer).
- FORGE-PLAN §3.1: `forge_create` returns `hash` — it does not (`register.ts:240-248`); the hash is first computed at approve (`forge.ts:246`).
- FORGE-PLAN §2.3 / TERMINAL-PLAN §2.6: the card shows the **hash**, a **JSON-schema preview**, **highlighted `{{param}}`** — none in `ForgeCard.tsx`.
- FORGE-PLAN §2.3: "Human may flip back" `kind` to read — the read radio is disabled when mutating (`ForgeCard.tsx:102`).
- FORGE-PLAN §4.3 (and SECURITY §2's reliance on it): overlay **colours substituted spans** — plain `textContent` (`Terminal.tsx:248`).
- PLAN §4: proposal "rendered as a **diff** against the current prompt"; TERMINAL-PLAN §2.3 "diff vs current input" — no diff; the ghost hides when the line is non-empty.
- PLAN §4: redacted spans "**highlighted in the pane** so the human sees what would have leaked" — `redactLine` is exported "for the pane's live highlighting" (`redact.ts:103`) and used by **0** components.
- TERMINAL-PLAN §2.2: `Cmd/Ctrl+K` toggles Share-screen — absent.
- TERMINAL-PLAN §2.1: "reconnecting in **N s**" banner — chip reads `disconnected · retrying` (`Panes.tsx:47`).
- TERMINAL-PLAN §2.3 and PROGRESS Gate B row: ghost text as an xterm **decoration** — it is an overlay (FIELD-NOTES xterm #6; SECURITY §1 already says overlay).
- TERMINAL-PLAN §2.5: floating "Forge this" near the selection; output lines dropped via the bridge ledger — button is in the ghost bar; output lines are kept (`forge-this.ts:3-4`).
- TERMINAL-PLAN §7: `terminal-busy.json` — absent (busy covered only by bridge smoke).
- SANDBOX-PLAN §2.1 step 5 / §2.3: TTL → "session ended · start a new one" — the page shows "This pairing link is not valid" (`client.ts:223` maps `timeout` → `unauthorized`; `Panes.tsx:237`).
- SANDBOX-PLAN §2.2: 1 session/IP/10 min → code 3 (`wrangler.jsonc:25`); `sleepAfter '35m'` → `'10m'` (`worker.ts:87`); `destroy()` on `DELETE` → route removed (`worker.ts:9`); uv / rokan-do / `SKILL.md` / `operations.json` in the image → only in the unwired `Dockerfile.rokan`; cold-start give-up "> 25 s" → ≈ 20 s (`worker.ts:92-96`).
- PLAN §2 architecture: judge mode = "xterm `SandboxAddon`", "rokan-do wheel + playwright chromium", "$-capped key" — replaced by our own bridge over `wsConnect` (SANDBOX-PLAN §0), no Chromium in the wired image, no key by design (PLAN §4/§12.6 still tell Arav to set a spend cap and a Worker secret; `worker.ts:33` says no key is wired).
- PLAN §2 and §5: `rokan-do run --json` printing `model_calls` — never landed; counts are not printed (R5), so `calls` is `0` or `null` only.
- PLAN §8 0:20 and DEMO pre-stage: `rokan do "top 5 HN titles"` seeded → `calls:0 · 0.36s` — HN is not seeded and cannot be persisted (R2, R7); PLAN §8 1:10 `calls:1 · 4.2s` — `calls:1` is not producible by the code (`register.ts:220`, `Panes.tsx:198`).
- PLAN §3: `evals/` with Chrome's `evals-cli` ordered/unordered assertions — custom CDP harness (PROGRESS 15:40: `evals-cli` not on npm); CI does not run it (`ci.yml`).
- PLAN §4 / SECURITY §4: "bridge refuses a second connection" / "second tab → busy" — true in builder mode only; judge mode replaces the old tab (`bridge.js:221-234`).
- PLAN §7 T4.3 model-call cap — dropped by design (no key); T4.4 egress test, T1.3 tunnel-kill, T2.7 Safari, T3.x ChatGPT, T5.x ops — no evidence any was run.
- README "109 unit tests", "365 steps"; AGENTS.md "93 unit tests" — VERIFY passes report **114**; the 16 cases hold **406** step objects (`grep -c '^\s*{'`, prompt-line 194 matches Opus VERIFY exactly).
- README/DEMO/SUBMISSION `npx rokan-terminal` — not on npm (PROGRESS 1a); README/PairingCard are honest about it, DEMO.md pre-stage line 6 is not.
- FORGE-PLAN §4.10 field-note names (`forge.evicted`, `forge.toolchange`, `forge.approve_latency_ms`) — emitted as `forge.unregistered {reason, age_ms}`, `toolchange {forged_visible}`, `forge.approved {decision_ms}` (`forge.ts:356, 266`, `register.ts:306`).
- FORGE-PLAN §2.6 "all limits in `schemas.ts`" — forge limits are in `forge-spec.ts:45-57`.
- CLAUDE.md "Nothing from Rokan except three wheels in `vendor/`, seeded operations, and `SKILL.md`" — the wheels exist locally but are **untracked**; seeds + SKILL.md were committed at 19:18 (`23e37bd`); PROGRESS 20:45 "no `vendor/` claim remains" is now stale in the other direction.

### What the code does that no doc claims

- **Judge session survives a reload** via `sessionStorage` (`judge-resume.ts`, `session.ts:70-77`) — only in a PROGRESS finding line, not in SANDBOX-PLAN/SECURITY/README.
- **Judge-mode tab takeover** (`replaced`, close 4410; a replaced tab cannot type — `bridge.js:221-234, 279-284`; smoke ×2; J6 662 ms) — SECURITY.md still describes only `busy`.
- **Half-open socket detection**: 3 unanswered pings → close → reconnect (`client.ts:192`); `NO_HELLO_CLOSE_CODE 4499` (`client.ts:52`).
- **Mixed-content refusal with a reason** when a `ws://` link is opened from https (`session.ts:87-91`) — Fable VERIFY F3 fix, documented only in the review.
- **`?renderer=dom`** forces the DOM renderer (`Terminal.tsx:105-108`); WebGL context-loss handling `:109-113`.
- **`high_entropy_value` redaction** (24+ mixed-case base64-ish after `=`/`:` with a plain-name deny-list) and `hex_run` 32+ hex (`redact.ts:72-90`) — SECURITY §3 lists the named-key rules and "32+ hex", not the entropy rule and its `id/sha/build/version` exceptions.
- **`stripPrompt` grammar** for `user@host dir %` / `judge@rokan:~ $` prompts (`forge-this.ts:10-15`).
- **Provisional Gate rows (180 s) + `confirm`** after the bridge answers (`worker.ts:46, 80, 102`) — in SECURITY §6 only as a parenthesis; J3/J4 measured.
- **`forge_list` output-budget policy** (drop `params` first, then evicted entries, `truncated:true`) — `register.ts:260-268`; FORGE-PLAN §3.3 describes it, PLAN §3 row 7 says "params dropped first" — consistent; noted because no case asserts the truncation path.
- **Harness `diag` dump on first failed step** (session, status, pending, screen, field notes; `webmcp-cdp.mjs:65-72`), **runner rebuilds a stale `.next`** and **reaps its server on every exit/signal** (`run-all.mjs:36-60`, `evals/test/runner-cleanup.test.mjs`) — Opus VERIFY P1/P2 fixes, undocumented outside PROGRESS.
- **`title: 'Forged: <name>'`** on every forged `registerTool` (`forge.ts:325`) and `title` on the six fixed tools (`register.ts:311`).
- **`execute` refuses after abort** (`forge.ts:330`) and a failed `registerTool` rolls the map back to the previous tool (`forge.ts:302-305`) — SECURITY §2 states the first, not the rollback.
- **`agent_connected` / `tab_replaced` / `session_ended` / `shell_restarted` bridge ledger kinds** (`bridge.js:90, 217, 232, 371`) — SECURITY §5 names only `executed`, `paired`, `shell_exited`.
- **Per-pane React error boundaries** so a render fault cannot abort the six tools (`App.tsx:23-44`; FIELD-NOTES xterm #2).
- **`forge.cancelActive()` on bridge disconnect** (`session.ts:118`) and `stopAfterCurrent` on unforge mid-step (`forge.ts:368-385`).
- **`rokan` shim on the PTY PATH** (`packages/bridge/shims/rokan`) — README does not mention that `rokan do` is a shim over `rokan-do` (FIELD-NOTES R1 does).


## Progress against the ranked gaps (C, 2026-08-29 01:30 PT)

- Gap 5 (TTL → "session ended", retry countdown): **done 3884c16**.
- Gap 6 (hash + schema preview on the card; `hash` in `forge_create` result): **done 3884c16**.
- Gap 12 (doc drift: 6 fixed tools, `sandbox_status`, PLAN §8 `calls:1`, SECURITY takeover, README counts, DEMO HN): **done 3884c16**.
- Gap 4 (rokan do in the judge image): wheels built (`vendor/`), `Dockerfile.rokan` staged + lints, seeds + SKILL.md staged, egress allowlist = seeded hosts (`3884c16`); **blocked on Arav's Docker go** for the build + smoke + image switch.
- Gap 15 (busy case): builder-mode "second tab → busy" is a smoke check (`smoke.mjs`), judge-mode takeover is a smoke check + measured live (J6).
- Gaps 1, 2, 3, 7, 9, 10, 11: human / money / account (see owners above).
