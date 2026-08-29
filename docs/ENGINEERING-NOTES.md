# ENGINEERING-NOTES — tacit knowledge for whoever builds next

Written 2026-08-29 ~04:10 PT by the session that shipped Plan 3. `docs/HANDOFF.md` says *what* to
do; this file says *how this codebase behaves* — the seams, the traps that already cost hours, and
what "done" means here. Read it once before your first edit.

---

## 1. The seams — where a change is safe, and where it is not

| seam | file | rule |
| --- | --- | --- |
| **Redaction choke point** | `apps/web/src/lib/webmcp/redact.ts` | *Everything* buffer-derived that leaves the tab goes through `redactForAgent`. Never add a second path. `screenLines` (terminal/adapter.ts) joins xterm's wrapped rows into logical lines **before** redaction — a `KEY=value` split across rows leaked the bare value once (J8). |
| **Trust boundary** | `terminal/adapter.ts:acceptProposal` + `components/Terminal.tsx` key handler | The only path from an agent's intent to the PTY is a human keypress. Any edit here is security-relevant: it needs a unit test *and* a real-PTY eval case. Gates that must stay: line-buffer empty, not `running:true`, paired, not already in flight. |
| **Contracts** | `webmcp/schemas.ts`, `webmcp/forge-spec.ts`, `ws/protocol.ts` ↔ `bridge/src/protocol.js` | Commit prefix `contract:`. `CLIENT_LEDGER_KINDS` must be the **same set** on both sides — `executed` is bridge-only (from OSC markers); clients send `executed_step`. Drift here is invisible until a row silently vanishes. |
| **Ledger** | `webmcp/ledger.ts` + `bridge/src/ledger.js` | Client HMAC chain (key never leaves the tab) + bridge countersignature (key never enters the tab). Say **tamper-evident, countersigned** — never "tamper-proof". Appends are `void`ed promises: assertions must poll. |
| **Forge engine** | `webmcp/forge.ts` | One active invocation across all forged tools; steps are pre-minted proposals promoted one at a time; budget 5 visible with pin/evict/restore; content hash = identity (same spec ⇒ same hash, measured across sessions, C4). |
| **Bridge sockets** | `bridge/src/bridge.js` | Builder mode: one tab, second gets `busy`. Judge mode: **newest tab with the token wins** (`replaced`, close 4410). One agent (MCP) process, newest wins too. A replaced socket must not reach the PTY, the agent or the ledger. |
| **Judge Worker** | `infra/sandbox/src/{worker,sid,origin,gate}.ts` | Signed **expiring** sids verified before any `getSandbox` (the SDK starts a container on first fetch); 403 a present-but-disallowed Origin *before* the Gate; Gate rows provisional 180 s until the bridge answers. |

---

## 2. Traps that already bit (do not rediscover these)

**Tests / CI**
1. A test that leaves an interval or socket alive **hangs the whole web suite** — node's runner never
   exits. Always `client.close()` in a `finally`. Run the suite with a guard loop and `pkill -f
   "strip-types --test"` on hang.
2. `apps/web` `"test"` script keeps its glob **quoted**. Unquoted, `/bin/sh` expands `src/**/*.test.ts`
   as one level and node silently runs a *single file* — "5 pass" while 121 tests never ran.
3. Ledger appends are async and `void`ed: **poll** (`for … await tick()`) instead of asserting
   immediately. One immediate assert flaked only on Linux CI.
4. Never assert a wall-clock **lower** bound (ping counts, elapsed ms) — CI under load produces
   fewer ticks, not more. Assert upper bounds or `>= 1`.
5. The eval runner already: rebuilds when `.next` is older than `src`, takes **free ports**, and
   reaps its own children on every exit path and signal (`evals/test/runner-cleanup.test.mjs` proves
   it). Do not reintroduce `killPort` / global `pkill` — it killed reviewers' bridges mid-run.
6. Harness: a bare `{"eval": …}` step with no `equals`/`matches` now **fails** if its value is
   null/undefined/false (a step that measured nothing used to count as a pass). On the first failed
   step the harness dumps `diag` — session state, `lastClose`, last sent frame types, screen tail,
   field notes. Read that before theorising.
7. `--only=<substr>` matches the case **filename**. `--bridge --mode=judge` runs the local bridge
   exactly as the container does.

**Browser / evidence**
8. Screenshots from the Chrome extension land in a temp dir that is cleaned quickly — copy them into
   `docs/evidence/…` in the **same** command, not later.
9. Screenshots the user drags into chat live in `/var/folders/**/TemporaryItems/` and vanish within
   seconds. Ask for a real path (Desktop or `docs/evidence/`) instead of retrying.
10. Navigating to the **same** URL with a different `#hash` does not reload the SPA (the old session
    keeps reconnecting to a dead tunnel). Navigate to a different URL first, then to the link.
11. The headless harness runs a ~800 px-wide window. A mobile breakpoint above that hides the whole
    app and turns every case red — the breakpoint stays **719 px**.

**Consumers**
12. **Codex CLI reads its MCP tool list once per session** and ignores `listChanged`: a tool forged
    during a session is callable only from a **new** Codex session (C3). Chrome 152 refreshes live.
13. Codex on a ChatGPT-plan account refuses `gpt-5.3-codex`; omit the model override. A review of a
    150 KB diff at `xhigh` does not finish in 10 minutes — scope the diff (one subsystem per pass).

**Infra**
14. `docker build --check` warns `InvalidBaseImagePlatform` on an arm64 Mac — expected; wrangler
    builds `linux/amd64`.
15. Locally, `--cpus 0.25` starves node-pty under amd64 emulation (bridge > 30 s to open a socket).
    Measure ¼-vCPU numbers on Cloudflare, not on the Mac.
16. `NEXT_PUBLIC_*` are **build-time**: `vercel env add` then redeploy, and pass them to any local
    `pnpm build` you want to behave like production.
17. A `wrangler deploy` of `infra/sandbox` replaces the container fleet and **drops every live judge
    session**. Per-IP cap is 3 sessions/10 min, 3 concurrent, 30-min TTL — a `--judge` run costs a
    slot and the builder shares the judge's IP.

---

## 3. What "done" means in this repo

- A fix ships with a regression test **in the same commit**, and the test must fail for the right
  reason before the fix (say so in the message when you checked).
- Every claim in a doc traces to a test name, an eval case, or a `FIELD-NOTES` row. If it does not,
  delete the claim — never soften it into marketing.
- One batched gate run per change; no loops, no re-running gates to feel better.
- Commit messages carry the measurement (`smoke 38/38`, `web 126/126`), not adjectives.
- `docs/PROGRESS.md` + `docs/FIELD-NOTES.md` updated **before** you stop, always.

---

## 4. Honest weak spots as of this handoff

1. **ChatGPT desktop is entirely unmeasured** — every "works in the consumer" claim currently rests
   on Chrome 152 + Codex CLI. This is the single biggest unknown and it is human-gated.
2. `rokan do` exits **127** in the deployed container (HANDOFF §3). Builder mode is measured and fine.
3. **Impact** is the weakest criterion (self-review ~5–6): the "any machine" beat and a consequential
   write against a real service (Netlify/Render) are designed but unbuilt.
4. No video, no logged rehearsals; `docs/evidence/demo-backup.gif` is the only fallback.
5. Forge **budget/eviction** and **unforge/restore** are tested but never shown to a human — a judge
   who pins and unpins is walking untrodden UX.
6. Safari / no-WebMCP path renders correctly by code but has never been screenshotted.
7. `npx rokan-terminal` is untrue until published; README says clone + node (honest).

---

## 5. Prioritisation under the deadline

- **The live URL is sacred.** Never break it to add polish. Deploy web freely, sandbox never after
  the freeze.
- Anything a judge sees in the **first ten seconds** outranks anything they would have to dig for.
  ~48 % of entries share our governance sentence — the *birth* must be visible before the safety story.
- A measured, honest smaller claim beats an impressive unmeasured one. Judges distrust numbers; ours
  survive because the code that shows them produces them.
- If a change touches the trust boundary or redaction, it costs a test **and** a rehearsal. Budget it.
- When something fails three times, stop and write the state down. Every hour lost this sprint was
  lost to a loop, not to a hard problem.

---

## 6. Working with Arav (so the next session does not misread the room)

- Continuous sprint: no "tomorrow", no "next session". But **quality over speed** — he has said
  explicitly to take as long as needed, never to rush into poor work.
- He wants **proof, not assurance**: numbers, screenshots, measured comparisons. "I think it works"
  is the thing that lost April 23.
- He asks conceptual questions mid-build ("is this synthetic WebMCP?", "is it 100× faster?").
  Answer directly and briefly with the measured number, correct the premise if it is wrong, then
  keep building. Do not stop the sprint to write an essay.
- Never yes-man. If a plan item is derivative or a claim is unsupported, say so in one sentence and
  propose the alternative.
- Resource discipline is non-negotiable — a previous session crashed his laptop with parallel
  headless Chromes, servers and Docker builds. One thing at a time, killed in the same step.

---

## 7. My own mistakes this session — do these differently

Written so the next session is faster than this one was. Each line cost real minutes.

**Loops and waiting**
1. I re-ran the **live judge suite after every fix**. Each run costs a per-IP session slot, and the
   cap (3 / 10 min) then blocked the next attempt — I burned ~40 minutes on `429 … retry in N s`.
   Batch fixes, then run `--judge` **once**. Use `--only=<case>` to prove a single fix.
2. When a run hit the cap I sometimes retried immediately instead of scheduling `sleep <retry_after>`
   in the *same* command. Read `retry_after_s` from the 429 body and wait exactly that long, once.
3. Deploy → test in three separate attempts. Chain them: `pnpm deploy && sleep <cap> && node
   evals/run-all.mjs --judge=…`.

**Commands**
4. `node packages/bridge/bin/rokan-terminal.js --help` — the CLI has **no** `--help`; it started a
   real bridge **and a Cloudflare tunnel** that I then had to hunt down. Read the file header
   (`sed -n 1,40p`) for options instead of asking a binary.
5. zsh eats unquoted globs: `grep --include=*.ts` and `ls apps/web/.env*` die with "no matches
   found" and abort the rest of a compound command. **Quote every glob.**
6. `sed -i '' 's/…/…/'` silently matched nothing twice (JSON with spaces after commas). Always
   verify with a follow-up `grep -c`, or use a python3 heredoc with `assert s.count(old) == n` —
   which is what I switched to and should have started with.
7. One command dumped a 130 KB Codex diff into the transcript. Pipe everything through
   `grep | cut -c1-200 | head`, always, even when you expect a small result.

**Verification**
8. I trusted a subagent's "126/126 green". It was true — and it had also changed a **breakpoint**
   that turned 16 of 17 eval cases red. **After any agent touches UI, run the integration suites
   yourself** (`node evals/run-all.mjs` and `--bridge`) before committing.
9. When a test hung I re-ran it. The right move is the guard loop (`& pid=$!; for i in $(seq 1 N);
   … kill -0`) plus reading the log tail — that is how the leaked-interval bug was actually found.
10. I asserted on a stale anchor several times while another agent edited the same tree. Re-read the
    anchor immediately before editing when anything else is running, and prefer short anchors.

**Cleanup**
11. Twice a `pgrep` at the end of a command showed `LEFTOVER` (a bridge, an eval runner). Put the
    `pgrep … && echo LEFTOVER || echo clean` check in the **same** command that finishes the work,
    and kill by PID in that same command.
12. `git status --short` showed reviewer worktree dirs as untracked and I briefly treated the tree as
    dirty. Check who owns an untracked path before acting on it.

**Judgement**
13. I offered "rehearsals" while the star command was not in the container. Order the work by what
    makes the *product* true, then evidence, then rehearsal.
14. Ad-hoc WebSocket probe scripts against a container tripped a `[cyber]` safeguard and force-
    switched the model mid-sprint. Use `pnpm smoke:image:rokan`, plain `docker exec`, and the eval
    harness — never hand-rolled socket probes into running containers.

**What worked — keep doing it**
- One batched shell command per unit of work: edit (python3 heredoc with counted asserts) →
  typecheck/lint/test → build → commit → push → `pgrep` cleanliness check.
- `browser_batch` for Chrome: navigate + wait + eval + screenshot in one round trip.
- Long builds/deploys in the background with a notification, never a poll loop.
- The harness `diag` dump: it root-caused the judge-mode drop (close 4400 from a resize frame) in one
  run after two blind attempts.
- Codex via MCP for adversarial review, scoped to one subsystem per pass — both passes found real
  P1s that four human-style review passes had missed.
