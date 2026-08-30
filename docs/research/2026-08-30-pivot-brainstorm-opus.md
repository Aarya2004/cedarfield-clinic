# Pivot brainstorm — Opus 5 (independent; 9 concepts, field scan of 1 623 repos, audience-reachability sub-check; 2026-08-30 ~10:00 PT)

Three sweeps in. Two of them kill my leading candidate, so the answer changed.

## Facts that constrain everything below

- **There is no weekend left.** Today is Sunday Aug 30. The window is **Mon Aug 31 + Tue Sep 1** — two business days — then submit Sep 2. Any "find a real user" plan that isn't an email/post going out Monday 9am ET does not exist.
- **Field scan: 1,623 repos in-window, 714 genuinely WebMCP.** Occupied lanes: **accessibility (11+ entries, several with 16–39 test files and live URLs)**, education/course-planning, canvases. **Empty lanes: legal deadlines, wage/employment standards, lab unit algebra, medication scheduling, benefits (one squatted empty repo), food labels (one unpolished restaurant tool).**
- **`faizydroid/airlock` (created 08-27, live) already built the privacy-analysis idea at a professional level**: count floor 5, numeric floor 20, depth cap to block cohort narrowing, query budget in released cells, data-independent refusals, 166 tests, 47 browser checks, zero `fetch` in the codebase. That was my #1 concept. It is dead.
- **"AI proposes, deterministic engine computes, system refuses" is a named commodity architecture** (neurosymbolic / LLM-verifier). Kognitos markets it as "No Hallucinations by Design." PolicyEngine, Code for America + Anthropic's SNAP Policy Navigator, and Trustwell AskReg all ship it. **It cannot be the idea. It can only be the implementation.** All seven domain spaces I researched score novelty 3–4 as products.
- **Pivot cost is measured, in your own repo** (`docs/research/2026-08-30-pivot-reuse-inventory.md`): extracting the forge for a non-terminal page = 8–12h, one non-shell action end-to-end = 6–10h, **14–16h of substrate re-plumbing before a single domain feature exists.**
- Three items still at zero decide the submission: **video, public repo (currently `Aarya2004/webmcp-private` — private, and SUBMISSION.md links it), one hour in ChatGPT desktop.**

---

# The 9 concepts

Scores are pessimistic, out of 10: **Lev**erage / **Exec**ution / **Imp**act / **Crea**tivity / **Front**ier.

### 1. Runbook — "the incident becomes a tool"
**Pitch:** The 3am fix you type once becomes a tool your agent can run next time — at zero model calls, ghost-typed, gated by your Enter, and it refuses when the box has drifted.
**Population / reach:** on-call engineers at 5–50-person startups. r/devops weekly thread + Gremlin community Slack (gremlin.com/slack) + r/sre. Reach: **yes, same day**; evidentiary value: weak (they are developers).
**Deterministic core:** the forged tool's command string + content hash. Agent forbidden: executing, editing an approved tool without re-approval, running when the recheck fails.
**15s:** Agent calls `forged_drain_queue` → ghost text at the prompt → Enter → exit 0, 6ms, ledger row. Second run: `calls: 0`.
**Tools (7):** `terminal_propose`, `terminal_read_screen`, `terminal_status`, `terminal_wait`, `terminal_history`, `forge_create` (C), `forged_*` (C).
**Build:** 4–8h — copy, one seeded runbook, a named user. Nothing new.
**Prior art:** Codex Record & Replay; agentic-service-dispatch; Ansible/Rundeck.
**Lev 8 / Exec 8 / Imp 6 / Crea 7 / Front 8 — top-10 ~28%**

### 2. Talon Bridge — a terminal for people who cannot type
**Pitch:** The agent proposes the command, the page ghost-types it, and one utterance or one switch press runs it — and anything you do once becomes a tool, so you never dictate it again.
**Population / reach:** Talon Voice users (RSI, motor injury, ALS) — **talonvoice.com/chat, open self-signup, has a #health channel, reachable today.** Highest-yield disability channel in the set.
**Deterministic core:** the confirm gate. Agent forbidden from executing; the only path to execution is the human's single confirm event. Refusal on drift and on hash change.
**15s:** Human says nine words. 47 keystrokes appear as ghost text. One "run." Counter on screen: *words spoken 9, characters not typed 312.*
**Tools:** same 7, plus `confirm_mode` (read).
**Build:** 10–14h — voice/switch confirm affordance, keystroke-saved metric, copy, one user quote. Substrate untouched.
**Prior art:** Talon + Cursorless; Serenade (dead); Voice Access. **No WebMCP entry in the field is a shell for motor-impaired users** — 11 a11y entries, all page-remediation.
**Lev 8 / Exec 7 / Imp 8 / Crea 8 / Front 8 — top-10 ~30%**
**Ethics gate:** paid, explicit that it's a competition entry, "no" accepted instantly. A quote obtained badly is worse than none.

### 3. Newsroom Drift Desk — the check that survives next week's release
**Pitch:** A reporter verifies a number once on a FOI dataset; the page mints a tool; next month's release runs the same check at zero model calls and **refuses** when the government renamed a column instead of quietly returning a wrong number.
**Population / reach:** data journalists. **NICAR-L (listserv@lists.missouri.edu, no IRE membership needed) posted Monday 9am ET → 3–10 replies same day.** Best single channel in the whole set.
**Deterministic core:** SQL over sql.js in-page; schema fingerprint per run; agent may only emit a parsed SELECT. Forbidden: stating any number itself, DML, row-level output.
**15s:** Drop `x5j9-wybp` (CDC Lyme by county, 190KB, 1,523 literal `Suppressed` cells). Ask for a rate. Re-drop the 2023 file with a renamed column → `DRIFT — refused, no number issued.`
**Tools (7):** `list_tables`, `describe_table`, `propose_query`, `run_check` (C), `explain_refusal`, `forge_check` (C), `export_signed` (C).
**Build:** 16–20h + 14–16h substrate = **30–36h**. sql.js is ~1.2MB wasm, no image rebuild.
**Prior art:** Datasette Agent (Simon Willison, shipped OSS), Hex Magic, **Airlock (in this hackathon)**.
**Lev 8 / Exec 6 / Imp 7 / Crea 5 / Front 7 — top-10 ~18%** (Creativity capped: a judge who saw Airlock sees this as its sibling.)

### 4. Bench — wet-lab protocol algebra
**Pitch:** The agent writes the dilution; a unit-algebra engine computes every volume and refuses on dimensional mismatch rather than rounding.
**Reach:** r/labrats (~650k, grads on campus in late Aug) — **easiest genuine non-developer in the set; 1 post → 5–20 comments, 2–5 DMs in 24h.**
**Core:** `pint` in the container. Agent forbidden from arithmetic.
**15s:** "500mL 1× TAE from 50×, plus 2mM MgCl₂ from 1M" → poured table, one line refused for a missing molar mass.
**Build:** 20h + substrate. **Prior art:** Sigma/Tocris/GraphPad calculators (free), Benchling, **Emerald Cloud Lab's Symbolic Lab Language** (dimensional typing that hard-errors, since 2023).
**Lev 6 / Exec 6 / Imp 6 / Crea 4 / Front 4 — top-10 ~10%**

### 5. Clockwork — Ontario statutory deadlines for self-represented litigants
**Reach:** **CLEO Connect (cleoconnect.ca, info@cleoconnect.ca) — a network of clinic workers with a newsletter; single highest-yield email in the list.** ACTO. Zero on Sunday, live Monday.
**Core:** day-counting over an encoded rule table + statutory holidays. Agent may never state a date.
**Empty WebMCP lane** — but **LawToolBox shipped an MCP connector for Claude in 2026**, and Deadlines.com's CompuLaw rules engine dates to 1978.
**Build:** 21h + substrate. Legal accuracy in 2 days with no lawyer is the embarrassment risk.
**Lev 5 / Exec 6 / Imp 8 / Crea 4 / Front 3 — top-10 ~10%**

### 6. Shift — employment-standards recompute
**Reach:** Workers' Action Centre (workersactionentre.org, runs Stop Wage Theft) Monday. Marginal.
**Killer:** Ontario ships a **free official ESA Self-Service Tool**, and WorkLaw Canada already ships a free *AI-powered* severance calculator.
**Lev 4 / Exec 6 / Imp 7 / Crea 3 / Front 2 — top-10 ~6%**

### 7. Label — allergen gate for micro food businesses
**Reach: the Saturday farmers-market play expired yesterday.** Fallback is emailing market managers Monday.
**Killer:** Trustwell AskReg already does AI allergen ID over a deterministic nutrient DB; every incumbent (ReciPal, Nutrifox, LabelCalc) ships a custom-ingredient escape hatch by design.
**Lev 4 / Exec 7 / Imp 6 / Crea 3 / Front 3 — top-10 ~5%**

### 8. Two-Agent Room — your agent and mine on one page
**Pitch:** Two people, two agents, one page-scoped shared state; each agent sees the other's moves as they land, and neither can commit without its human.
**Frontier is the whole product.** No named population, no user, and it needs a Durable Object relay that PLAN §0 explicitly cut from v1.
**Build:** 25h+, and the demo needs two live humans in ChatGPT desktop — a client you have **never once measured**.
**Lev 9 / Exec 3 / Imp 4 / Crea 8 / Front 9 — top-10 ~8%**

### 9. Privacy Desk — REJECTED, scored for the record
Agent queries data it never sees, agency-grade small-cell suppression (CMS 1–10, NCHS <10, StatCan base-5 rounding).
**Airlock built it, better, three days ago, with an A1–A10 attack suite.** Also: Snowflake shipped `AGGREGATION_CONSTRAINT(MIN_GROUP_SIZE => 5)` to GA in Feb 2024 under Cortex Analyst, and `Noisegate` (2026-06-30) put a constrained-AST-over-MCP version on GitHub.
**Lev 8 / Exec 5 / Imp 7 / Crea 2 / Front 5 — top-10 ~7%**

---

# Devil's advocate — top 3

## Talon Bridge

**What already exists:** Talon Voice + Cursorless (voice-driven coding, the incumbent); Dragon/Voice Access (OS dictation); Serenade (dead); 11 WebMCP a11y entries this week (A11yMCP, curbcut, inclusivepatch, tweaksy-live, accesscart, Hear-My-Site) — all page remediation.
**Why those aren't enough:** Talon makes *dictation* efficient; it does nothing about the fact that a shell command is 300 characters of hostile phonetics. Cursorless is an editor, not a shell. Every WebMCP a11y entry fixes the *page*; none gives a disabled user a *machine*. The unlock is new: an agent that can compose the command precisely, plus a standard that lets the page hand it that job without ever letting it press the key.
**Proposed idea:** A shared terminal for people who cannot type, where the agent composes and the human's single confirm executes — and every task done once becomes a named tool, so the dictation cost of the second time is one word.
**Novelty: 8/10.** The unique insight: for this population **the human-in-the-loop gate is not a safety tax, it is the entire accessibility feature** — the smallest possible human act (one switch press) authorizing the largest possible machine act. Everyone else pitches the gate as a brake; here it's the interface.
**Three ways this fails:** (1) Talon users are mostly former developers, so a judge can still say "built for people like you" — the disability framing has to be carried by a real quote, or it reads as costume. (2) The named user doesn't materialize by Tue evening, and you've spent 14h to add a footer. (3) The confirm affordance needs to work in ChatGPT desktop, a client you have **never measured** — if Site tools don't refresh on `registerTool` there, the "never dictate it again" half of the pitch needs a reload and dies on video.

## Runbook

**What already exists:** Codex Record & Replay (OpenAI's own, shipped); Ansible/Rundeck/Runbook.md; Warp AI; agentic-service-dispatch (this hackathon — approval mints one time-limited tool, then consumes it).
**Why those aren't enough:** Record & Replay is a transcript, not a live tool surface a visiting agent can discover. Ansible needs someone to write YAML before the incident. agentic-service-dispatch's tool dies after one use, so there is no compounding. None of them refuse when the environment drifted.
**Proposed idea:** A terminal where the fix you type during an incident becomes a discoverable WebMCP tool that any future agent session can invoke at zero model calls, and that refuses rather than running stale.
**Novelty: 7/10.** Insight: the replay is cheaper than the plan — 546ms at 0 calls vs 15,780ms (Claude) / 23,164ms (Codex), because agents re-plan every single run. But 7 < your bar of 8, and the reason is honest: it's the product you already have with a better-named audience.
**Three ways this fails:** (1) n=3 with a 6.6–55.7s spread is the weakest number in your repo and the 42.4× headline is one 55s outlier from collapsing — a judge who reads `docs/measurements/` finds that. (2) "on-call engineer" is still a developer, so Impact stays ~6 and you remain the finalist profile. (3) It changes nothing, which means it only wins if the video and the ChatGPT run are excellent — i.e. it isn't a strategy, it's a label.

## Newsroom Drift Desk

**What already exists:** Datasette Agent (Willison, May 2026, OSS, LLM writes SQL); Hex Magic and Rows (schema-only to the model — already table stakes); **Airlock (this hackathon, live, 166 tests)**; Snowflake Cortex Analyst.
**Why those aren't enough:** All of them answer *today's* question. None of them persists a check as a re-runnable artifact, and none treats a schema change as a first-class refusal — which is the actual way government data betrays a reporter (a column renamed between releases, and the old query silently returns a wrong number).
**Novelty: 6/10.** The drift-refusal on re-run is the one unclaimed piece; the rest is the most-shipped architecture in data tooling, and a sibling entry already occupies the visual space.
**Three ways this fails:** (1) 30–36h of build, which is your entire remaining engineering budget — the video and the ChatGPT run go to zero. (2) A judge who opened Airlock reads yours as the weaker twin. (3) You'd be shipping a brand-new page into the ChatGPT desktop client on Sep 2 having never tested that client once.

---

# Ranking

| | Option | Lev | Exec | Imp | Crea | Front | Mean | Top-10 | New eng. hours |
|---|---|---|---|---|---|---|---|---|---|
| **C** | **Rokan re-aimed — Talon Bridge** | 8 | 7 | 8 | 8 | 8 | **7.8** | **~30%** | 10–14 |
| B | Rokan as-is + named user + video | 7 | 7.5 | 6 | 6 | 7 | 6.7 | ~26% | 0 |
| A | Clean pivot — Newsroom Drift Desk | 8 | 6 | 7 | 5 | 7 | 6.6 | ~18% | 30–36 |

**C wins.** It buys the two points you are actually missing — Impact and a user who is not the builder — for 10–14 hours instead of 30–36, and it buys them without touching `apps/web/src/app/page.tsx`. The re-aim is copy, one confirm affordance, one metric on screen, and one quote. Every commit of the 105 you've landed since Friday still counts as Execution evidence. And the frontier claim gets *stronger*, not weaker: "the smallest human act authorizing the largest machine act" is a better answer to "the future of the web" than "a faster terminal."

**A loses on arithmetic, not taste.** 14–16h of substrate re-plumbing before feature one, plus 16–20h of domain build, against a competitor in the same lane who has been live since Aug 27 with 166 tests. The hostile eval already priced a pivot at ~6% and that was for a *canvas*, which at least reused the page.

**B is the floor, not the plan.** It is 0.9 points behind C for zero hours saved that you'd actually spend elsewhere.

## Order of operations, Sun→Wed

1. **Today (Sun):** fix ffmpeg, **record the video**. Make the repo public and rename it — `webmcp-private` is a bad first frame and SUBMISSION.md currently links a private repo under an account that isn't yours. Post to r/labrats and the Talon Slack tonight (paid, explicit, "no" accepted).
2. **Mon AM:** NICAR-L post + CLEO Connect email as backup user channels. Arav's hour in **ChatGPT desktop** — you have never once measured it, and the forge's "no reload" moment is unverified there. This is the single largest unknown in the submission.
3. **Mon, in parallel:** Aarya ships the confirm affordance + keystroke-saved counter. **Kill rule: not green by Mon 22:00 PT → drop it and submit B.** It lives at `/`-adjacent, not in place of it.
4. **Tue:** the quote goes in the README, caps revert to the judging row, freeze.
5. **Re-lead the pitch on drift, not 42.4×.** n=3 with a 6.6–55.7s spread will not survive a judge who opens `docs/measurements/`.

## Cost of being wrong

If C is wrong and a pivot would have won: you lose ~3 percentage points of top-10 odds and finish where you already were. If you pivot and it's wrong: you lose the 105-commit Execution artifact, the 15/15 suite, the drift evidence, the A/B harness, and the video window — hostile eval puts that at ~6%, a **20-point** downside. The asymmetry decides it: **-20pp against +5pp.**

The one thing that would change my answer: if Monday's ChatGPT desktop run shows Site tools **do not** refresh on `registerTool`, the forge's 15-second moment dies in the judging client, and both B and C lose their hero. In that case the fallback is not a pivot — it's re-cutting the video around `terminal_wait` and the 0-call replay, which need no live registration. Have that cut planned before Arav opens the app.

Files: `/Users/aravkekane/dev/webmcp-private/docs/research/2026-08-30-pivot-reuse-inventory.md` (the hours), `/Users/aravkekane/dev/webmcp-private/docs/reviews/2026-08-30-hostile-eval-workbench.md` (the prior scoring), `/Users/aravkekane/dev/webmcp-private/docs/PROGRESS.md` (the zero-items list).