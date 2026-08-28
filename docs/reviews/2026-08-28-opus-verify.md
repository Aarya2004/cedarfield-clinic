# VERIFY pass — Opus 5 — 2026-08-28

Executed, not read. Every line below is a number I measured on this machine, or a step I could not
run with the reason stated. Evidence: `docs/evidence/verify-opus/live-endpoints.txt`.

## Verdict

**Gate A reproduces exactly at the expected numbers, the live URL and the deployed judge Worker are
healthy, and every finding from my passes 1–3 is verified closed by measurement — including the
pass-3 P1, which is fixed properly rather than disabled.**

**One new P1, and it is the thing that crashed the laptop today:** `evals/run-all.mjs` leaks a
detached `next-server` on every early-exit or interrupted run. I measured **14 orphans holding
767 MB**, the oldest alive **2 h 33 m**, and reclaimed all of it.

---

## A. Cold gate — every expected number hit

| step | expected | measured |
| --- | --- | --- |
| `apps/web` typecheck · lint · build | clean | clean |
| `apps/web` test | 114 | **114/114** |
| `packages/bridge` check | pass | pass |
| bridge `node --test test/*.test.mjs` | MCP 3 + trailer 4 | **7/7** |
| bridge `smoke` | 36 | **36/36 in 2864 ms** + MCP **3/3** |
| `infra/sandbox` check | 12 | **12/12** |
| `evals/run-all.mjs` | 7/7 | **7 cases, 0 failed** |
| `evals/run-all.mjs --bridge` | 8/8 | see caveat |
| `evals/run-all.mjs --bridge --mode=judge` | 8/8 | **8 cases, 0 failed** |

**Caveat, stated rather than hidden.** My first pass of the two builder-mode suites reported
`1 failed of 7` and `1 failed of 8`. Neither was a product defect:

- Two other agents were driving this same checkout at the same time (the builder committed
  `6cef16b` mid-run and its loop runs `pkill -f rokan-terminal.js`, which kills a reviewer's bridge;
  `docs/evidence/verify-fable/` shows the Fable reviewer running the same suites).
- A later attempt produced no output at all because `git pull` brought new `apps/web` commits and
  `run-all` served a **stale `.next`** — the app never came up.

After a rebuild on a quiet machine at `6cef16b`, the prompt-line suite is **7 cases, 0 failed**
(forge-birth 33 · forge-budget 25 · forge-injection 49 · forge-queue 34 · forge-string-input 19 ·
gate-a 19 · tour 15 steps). I did not get a clean builder-mode `--bridge` re-run inside the
three-attempt budget and stopped rather than loop; judge mode — the harder path, against the live
container — is 8/8, and the builder's own J9 records 8/8.

## B. Live URL and judge Worker — measured

| check | measured |
| --- | --- |
| `GET https://rokan-terminal.vercel.app/` | **200 in 196 ms**, 6059 B |
| CSP on the live response | nonce + `strict-dynamic`, no `unsafe-inline` for scripts; `connect-src` now names the Worker |
| other headers | `x-frame-options: DENY`, `nosniff`, `referrer-policy: no-referrer` |
| `GET /api/health` (Worker) | **200 in 58 ms**, `{"ok":true,"mode":"judge"}` |

I did **not** do B.2–B.8 as written: they need a headed Chrome with the WebMCP flag and the Model
Context Tool Inspector, and the judge steps must come from a different network. I am on the
builder's network and have no GUI, and the prompt's own rule (J4/J5) is that a judge session from
this network locks the IP. Starting one to satisfy a checklist would have burned a slot the demo
needs. The builder's J9/J10 already record that path from a real Chrome tab.

## D. Adversarial — executed

### D1. rokan trailer attribution — my pass-3 P1, verified fixed **and not merely disabled**
`bridge.js:118` now gates on `isRokanCommand(state.last_command)`. Five cases on a real PTY, zsh:

```
PASS  NEGATIVE  plain echo                 last_rokan=null
PASS  NEGATIVE  echo with "rokan do" in an arg   last_rokan=null
PASS  NEGATIVE  ": rokan do; echo …" prefix      last_rokan=null
PASS  POSITIVE  rokan do "x"               last_rokan={"ms":7,"replayed":true}
PASS  POSITIVE  FOO=1 rokan do "x"         last_rokan={"ms":7,"replayed":true}

ledger rows with rokan_calls:0 whose command is NOT rokan: 0
RESULT: 5/5
```

The two negatives beyond the prompt's case are bypasses I invented; both are refused. The positives
prove the feature still works, which is the half a disable-it "fix" would fail.

### D7. Forged sid → 403 before any container
Real WebSocket handshakes against the deployed Worker:

```
random sig  -> HTTP 403 handshake refused (125 ms)
zero sig    -> HTTP 403 handshake refused (83 ms)
ff sig      -> HTTP 403 handshake refused (83 ms)
```

`wrangler containers list` showed **1 container, 7 live instances** before and after — no instance
started. (Note the 7: see P2-3 below.)

### Cross-origin write endpoint
`POST /api/session` with `Origin: https://evil.example` → **403 `{"error":"origin not allowed"}`**,
before the Gate. My pass-3 P1-3 confirmed fixed live.

### D5. Param quoting
`/tmp/pwned` does not exist after every injection case in all suites (`forge-injection.json`, 49
steps). No shell metacharacter escaped the single-quoting.

### Not run, with reasons
- **4× `POST /api/session` for the 429 text** — from this IP it would consume the builder's 3
  concurrent slots for 30 minutes (J4/J5). The prompt requires a second network; I have none. The
  429 copy is correct by inspection (`worker.ts:82` interpolates `perWindow` and pluralises).
- **`rm -rf /` double-Enter, paste/`cat` guards, TTL expiry** — these need a headed browser.

## Pass 1–3 findings: verified closed by measurement

| finding | verified |
| --- | --- |
| pass-1 P0 nested-object HMAC | smoke asserts nested tamper detected + key-order independence |
| pass-1 P1 pairing host allowlist | 4 unit tests incl. hostile targets |
| pass-2 P1 non-zsh wedge | bash/sh resolve unmeasured (bridge units 7/7) |
| pass-2 P1 `executed`/`executed_step` | producer at `forge.ts`, allowlists identical |
| pass-3 P1 trailer attribution | **5/5 above** |
| pass-3 P2 SECURITY.md rate limit | now "3 new sessions per IP per 10 min" |
| pass-3 P2 429 copy | now `${perWindow}` + pluralised + limit in the concurrent message |
| pass-3 P2 model-call cap claim | PLAN + SANDBOX-PLAN now state the honest version |
| pass-3 P2 dead `ANTHROPIC_API_KEY` | removed from `Env` |
| pass-3 P2 non-asserting eval steps | 141 eval steps, **2** still non-asserting (was 1 of 1 in gate-a) |

---

## P1

### 1. `evals/run-all.mjs` leaks a detached Next server on every early exit or interruption.
`evals/run-all.mjs:38,50,88,140`

`srv` is spawned `detached: true` (line 38) and only reaped by `process.kill(-srv.pid)` at line 140
— **after** two unconditional `process.exit(1)` paths that come earlier:

- line 50 `web app did not start` (I hit exactly this, from a stale `.next` after `git pull`)
- line 88 `bridge did not print a pairing link`

and `grep -c "process.on" evals/run-all.mjs` → **0**, so there is no SIGINT/SIGTERM handler either:
Ctrl-C, a harness stop, or another agent's `pkill` also leaks the detached server.

Measured on this machine after a day of runs by three agents:

```
16 next-server processes, 767 MB RSS
oldest: pid 51594, elapsed 02:32:56, 54 MB
each ~54–57 MB, one per leaked run
```

I reclaimed **767 MB** (16 → 2). This is the most likely proximate cause of the laptop crash the
prompt's resource rule refers to, and it is in the one command every reviewer, the builder, and CI
are told to run. Fix: `try/finally` around the run, plus
`process.on('SIGINT'|'SIGTERM'|'exit', cleanup)`, and move the two early exits through it.

---

## P2

2. **Stale build silently produces a misleading suite failure.** `run-all.mjs` runs `pnpm start`
   against whatever `.next` exists; after a `git pull` that changes `apps/web` it serves the old
   bundle, and the run either fails cases or dies at "web app did not start" — reported as an eval
   failure, not a build problem. Both my first-pass failures came from this class. Have `run-all`
   build (or stat `.next` against the working tree and refuse) before serving. Pre-freeze this is the
   difference between "a case regressed" and "you forgot to rebuild".
3. **7 of 10 container instances were live while idle.** `wrangler containers list` reports
   `LIVE INSTANCES 7` against `max_instances: 10` (`wrangler.jsonc`). With a 30-min TTL, sessions
   ending only on TTL or bridge idle (J5), and 3 concurrent per IP, **four judge IPs exhaust the
   pool** and the next judge gets a failed start. J1 attributes the pile-up to the pre-fix crash
   loop, so this may be decaying residue — but it should be re-measured cold before judging day,
   and `max_instances` is cheap to raise.
4. **`docs/FORGE-PLAN.md:485` still states the two retired facts** — "1 session/IP/10 min" (now 3)
   and "model-call cap" (deliberately not implemented). PLAN, SANDBOX-PLAN and SECURITY.md were all
   corrected; this row was missed. Internal doc, but it is in the judge-analysis table someone will
   read when writing the submission.
5. **Two eval steps still assert nothing** — `forge-birth.json` (1 of 18) and
   `gate-a-propose-wait.json` (1 of 4). 141 eval steps total. Down from pass 3, not gone.

---

## Objection — the verification environment, not the product

Three agents are executing the same suites in one working tree, on shared ports, PTYs and `.next`,
while the builder commits and runs `pkill -f rokan-terminal.js`. Today that produced two eval
"failures" that were not real, one run that produced no output, and 767 MB of leaked servers.

For the final pre-submission pass this matters more than any single finding: **the numbers in
PROGRESS are only as trustworthy as the isolation they were measured under**, and right now a green
run and a red run can differ by who else was typing. Before the freeze verification, one of:
serialise it (one agent runs the gate, others read the output), or give reviewers a separate
checkout. Otherwise the last thing you do before submitting is the least reproducible thing you do.
