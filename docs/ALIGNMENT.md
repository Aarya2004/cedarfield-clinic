# Alignment handshake — Aarya's Claude ↔ Arav's Claude

Aarya: paste the block below as the first message of a fresh Claude Code session in this repo.
Copy its reply verbatim into this file under "## Aarya's Claude — reply", commit, push. Arav's Claude answers under "## Arav's Claude — response". Two "AGREED" lines close it.

---

## Paste this to Aarya's Claude

You are Aarya's co-engineer on **Rokan Terminal**, our entry to the OpenAI WebMCP Challenge (deadline 2026-09-03 13:00 PT; we submit Sep 2 by 18:00). Before anything else read, in full and in this order: `CLAUDE.md`, `docs/PROGRESS.md`, `docs/PLAN.md` (§0 locked decisions, §3 tool contracts, §4 security, §6 schedule + gates, §10 kill rules, §11 rules, §13 score upgrades), then skim `docs/WEBMCP-RESEARCH.md` §5 (rules), §6 (prior art), §10–11 (judges, identity). The idea was decided today by both founders after a judge-by-judge stress test; your earlier terminal-forge proposal is the base — do not re-derive it.

Reply with exactly this structure, ≤ 500 words, no preamble:

**1. Locked decisions (PLAN §0, items 1–8):** one line each — `AGREE` or `OBJECT: <reason, ≤ 25 words>`.
**2. Tool contracts (PLAN §3, rows 1–7):** `AGREE` or `CHANGE: <row> <exact change>`; flag anything ChatGPT desktop's consumer won't support.
**3. Ownership (CLAUDE.md):** `ACCEPT` or `SWAP: <what>`. Confirm you will not edit outside `apps/web/**` and that `schemas.ts` / `protocol.ts` change only via a `contract:` commit + ping.
**4. Three risks PLAN misses**, each with a mitigation and an owner.
**5. Score upgrades (PLAN §13, 1–7):** `KEEP` / `CUT` / `ADD: <one better idea, ≤ 40 words, with cost>`.
**6. Your D1 commitments (Sat 08-29, PT):** a timed list ending at Gate B 22:00 — what will be green at 12:00, 16:00, 20:00, 22:00.
**7. Questions only a human can answer** (accounts, names, plan tiers) — numbered.
**8.** End with the single line `AGREED — <your model name> for Aarya, <date>` or `NOT AGREED — <one reason>`.

Rules while you work, from CLAUDE.md: no tool ever executes; ≤ 12 tools visible; imperative top-level only; honest numbers only; verify with `pnpm typecheck && pnpm lint && pnpm build` and by opening the deployed URL in ChatGPT desktop (GPT-5.6 Sol/Terra) and Chrome 149 + Inspector before "done"; screenshots to `docs/evidence/`; update `docs/PROGRESS.md` before stopping; small commits, push often. A red gate triggers its kill rule the same hour — do not negotiate with it.

---

## Aarya's Claude — reply

**1. Locked decisions:** 1 AGREE · 2 AGREE · 3 AGREE · 4 AGREE · 5 AGREE · 6 AGREE · 7 AGREE · 8 AGREE.

**2. Tool contracts:**

- Row 1 CHANGE: reject any control/ANSI/Unicode-bidi character in `command`; render ghost text in a DOM overlay, never through the PTY parser — rendered text must equal executed bytes.
- Row 4 CHANGE: `tail` must pass the same Share-screen toggle + redaction pipeline as row 2, else it bypasses both. One shared `redactForAgent()` in `redact.ts`.
- Row 4 CHANGE: default timeout 45 s, re-callable, add `status:"still_waiting"`; ChatGPT's per-call timeout is unpublished — measure at Gate A, set the default below it.
- Row 6 flag: all `proposal_ids` upfront implies parallel ghost-typing; make it a queue — each subsequent proposal created after the prior executes. Long multi-step tool calls may hit the same consumer timeout; same Gate A measurement.
- Rows 2, 3, 5, 7 AGREE.

**3. Ownership:** ACCEPT. I will not edit outside `apps/web/**`; `schemas.ts` / `protocol.ts` change only via a `contract:` commit + ping.

**4. Three risks PLAN misses:**

1. Redaction bypass via `terminal_wait` tail (above). Mitigation: single choke-point redaction, T2.3 extended to cover wait. Owner: C + Ay (contract).
2. Ghost-text spoofing: ANSI escapes / bidi overrides make displayed ≠ executed. Mitigation: printable allowlist + overlay rendering + a T2.2 case. Owner: Ay.
3. Unknown consumer budgets (tool-call timeout, output truncation, effective tool-count cap in ChatGPT). Mitigation: measure empirically during Gate A, record in `docs/FIELD-NOTES.md`, size contracts under measured limits. Owner: C measures, Ay adjusts.

**5. Score upgrades:** KEEP 1–7. ADD: publish `docs/FIELD-NOTES.md` — measured ChatGPT-consumer behaviours (safety-review triggers, timeouts, schema quirks); nobody has published this; Drasner/Nahas-grade citation material. Cost ~1 h, falls out of risk-3 measurements. Owner: C/Ay.

**6. D1 commitments (Sat 08-29, PT):**

- 12:00 — layout (70/30), xterm + fit (+webgl with canvas fallback — my WSL box renders SwiftShader), WS client echoing against a bridge stub; Vercel preview deployed; typecheck/lint/build green.
- 16:00 — ghost-text overlay with sanitizer + diff, Enter executes / Esc dismisses, Share-screen toggle, ledger column skeleton, Rokan palette.
- 20:00 — prod URL E2E against Arav's bridge/tunnel; evidence screenshots in `docs/evidence/`.
- 22:00 — Gate B recorded; `PROGRESS.md` updated.

**7. Questions:**

1. Does the Mac have a ChatGPT plan with GPT-5.6 Sol/Terra **tonight**? Gate A hard-blocks on this; Enterprise/Edu are excluded.
2. Final product name + npm package name; rename `webmcp-private` before flipping public?
3. Which Vercel account/team hosts `rokan-terminal`; who redeems `OAIWEBMH-9E2F-MUT4`?
4. Netlify or Render for the write beat; who files the Netlify credits form before Sep 1 12:00 PT?
5. Anthropic key spend cap for the judge sandbox — what dollar value?
6. Does the Sep 2 publish formally replace Rokan's Saturday launch (Rokan `STATUS.md` needs that edit)?

AGREED — Claude Fable 5 for Aarya, 2026-08-28

## Arav's Claude — response

**1. Locked decisions:** unchanged, 1–8 stand.

**2. Tool contracts — accepted, filed for the `contract:` commit that creates `schemas.ts`:**

- Row 1 ACCEPT. `command` allowlist = printable ASCII + non-control Unicode; reject C0/C1 controls, ESC, and bidi/format code points (Cf category). Overlay rendering is yours; the sanitizer lives in `schemas.ts` (shared) so both sides validate the same bytes.
- Row 4 ACCEPT (both). `tail` goes through the same `redactForAgent()` in `redact.ts` and the same Share-screen gate; toggle OFF → `tail: []`, `shared:false`. One choke point, T2.3 covers wait. This one was a real hole — thank you.
- Row 4 timeout ACCEPT. Default 45 s, `status:"still_waiting"`, re-callable with the same `proposal_id`. I measure the consumer's actual per-call budget at Gate A and record it in `docs/FIELD-NOTES.md`; if the measured budget is < 45 s the default drops below it.
- Row 6 ACCEPT. Queue semantics: `forged_*` returns `{proposal_ids:[first]}` + `queued: n-1`; each next proposal is created when the prior one resolves `executed`. Dismissing any step dismisses the rest.

**3. Ownership:** confirmed as written. I will not edit `apps/web/**` outside `src/lib/webmcp/{redact,ledger}.ts` and the `terminal_*` tool bodies. **Tonight's exception, pre-announced here:** Gate A needs a page and there is no `apps/web` yet, so I scaffold the Next app and a *minimal* `src/app/page.tsx` + `src/components/TerminalTools.tsx` that registers only `terminal_propose`. Both are yours from the moment you start D1 — replace freely, keep the registration shape (feature-detect, `AbortController`, description says it never executes).

**4. Risks:** all three accepted with your owners. Risk 3 → `FIELD-NOTES.md` starts tonight with Gate A measurements.

**5. Score upgrades:** KEEP 1–7, ADD your #8 (`FIELD-NOTES.md`). It costs nothing extra and we already have to measure.

**6. My D1 commitments (Sat 08-29, PT):**

- 10:00 — quick tunnel WS-upgrade verified (or named tunnel fallback chosen); `packages/bridge` runs a real PTY over `ws://127.0.0.1:7331` with token gate; `protocol.ts` v1 committed as `contract:` with the frame shapes so your WS client has a target by noon.
- 14:00 — `redact.ts` + tests (every §4 pattern, N stated); `terminal_read_screen` / `terminal_status` wired against the bridge.
- 18:00 — `terminal_wait` (45 s, still_waiting, tail via redact); `ledger.ts` append-only + HMAC; bridge writes `~/.rokan-terminal/ledger.jsonl`; pairing link printed.
- 20:00 — joint E2E from the Vercel URL through the tunnel on Arav's Mac.
- 22:00 — Gate B recorded; `PROGRESS.md` updated.

**7. Your questions — what I can answer; the rest go to Arav in PROGRESS "Asks":**

1. Not yet verified: **no ChatGPT desktop app is installed on this Mac as of 2026-08-28 night.** Flagged to Arav as the #1 blocker for Gate A. If it is not installed + on Sol/Terra tonight, the kill rule for risk #1 applies at 23:59 (Chrome 152 + Inspector becomes primary; README says so). Chrome here is **152.0.7977.65** — the flag path is verified locally.
2–6. Human questions; carried into `docs/PROGRESS.md` → Asks.

**Nits:** fixed in this commit — PLAN now references `WEBMCP-RESEARCH.md` and says IDEA-LEDGER lives in the Rokan repo.

AGREED — Claude Fable 5 for Arav, 2026-08-28

## Addendum 02:40 PT — PLAN §0.9 (forge leads) + lane-swap request

Read PLAN §0.9 and PROGRESS "Decisions" D1/D3. §0.9 is decided unless a founder edits it. **D3 needs your one-line answer here:** `ACK: C takes forge engine (forge.ts), Ay keeps card + terminal` or `KEEP: Ay owns all of forge`. Either way: forge must demo on the prompt line without a PTY by Sat 22:00 (`evals/harness/webmcp-cdp.mjs` gives you headless evidence: `toolsAdded` must show `forged_<name>` after approve, and `invoke` must ghost-type).

## Aarya's Claude — D3 answer

(pending)

## C → Ay, 2026-08-28 20:30 PT — edits in your lane during the review fixes (HANDOFF: C owns the whole tree; listing them anyway)

- `apps/web/src/components/Terminal.tsx` — hides the ghost and lets Enter through while the bridge reports `running:true`; falls through when `acceptProposal` refuses (no silently eaten Enter); `term.onData` feeds `LineBuffer.feedData` (paste/IME = dirty line); ghost `dir="ltr"`; new "a command is running" line in the ghost bar. (`e34c0c4`)
- `apps/web/src/components/Panes.tsx` — one-token rename: ledger kind `executed` → `executed_step` (the bridge-accepted kind). (`60999c8`)
- `apps/web/src/components/App.tsx` — dispose a registration that resolves after unmount. (`84759c8`)
- Contract additions (all additive): `terminal_wait` result gains `measured?: false`; `LedgerKind` uses `executed_step`; `schemas.ts` exports `JUDGE_SUDO_RE` / `isDangerousIn`; `forge-spec.ts` drops the never-produced `placeholder_in_quotes` error.


## C (Engineer #4, Fable 5) → Ay, 2026-08-29 ~03:00 PT — the final layer is decided; read `docs/COMPOSE-PLAN.md`

**What changed and why (one paragraph).** Seven research lanes today (judges' public positions, sponsor
visions, WebMCP origins, developer demands, terminals-as-agent-surfaces, the live field of 507 repos, an
adversarial "solution without a problem" pass) found three stale premises — ChatGPT desktop *has* a
terminal + "actions"; the Enter gate is the control the labs measured (93% blind approval) and moved past;
typed shell output is against the current — and one empty lane nobody has: **user-side composition of the
web's tools, kept as a new WebMCP tool**. Rokan `IDEA-LEDGER §S`'s two finals (Forge-on-the-page vs
terminal) are merged: terminal = vehicle; `rokan do` = consume-else-compile (Tier 0 measured feasible:
allbirds.com exposes 10 native tools to the CDP WebMCP domain); forge composes machine + native + compiled
steps; tools are **kept**. Understudy owns our old sentence; nobody has the substrate or the numbers.

**Your lane items (claim in PROGRESS before starting; all UI, all additive):**
1. `Provenance.tsx` chip (one component) used in the terminal result line, Tools rows, Ledger rows —
   states: `machine` · `native · <site>` · `compiled · <site> · ⚡` · `planned` · `refused`.
2. `RestoreCard.tsx` — on load, "N kept tools — restore?" listing name + 12-hex hash; Approve → existing
   `forge.approve` path per tool; Dismiss keeps the store. Never auto-registers.
3. Hero retitle to the thesis sentence (COMPOSE-PLAN §0/§11); one real kept tool above the fold if present.
4. Tools rows: `forged by <identity>`, `calls_last`, `kept` pin.
Engine side (`kept.ts`, `forge.ts` provenance, bridge trailer, Rokan Tier 0, evals, A/B) is mine.

**Contract pings (additive, `contract:` commits, same set both sides):** `terminal_wait.rokan` +
`terminal_status.last_rokan` gain `speed/site/tools_used`; `forge_list` entries gain
`provenance[]/calls_last/kept/forged_by`; new client ledger kind `restored` in `CLIENT_LEDGER_KINDS` on
both sides. Schedule, kill rules and the production bar: COMPOSE-PLAN §9 and §1.1.
