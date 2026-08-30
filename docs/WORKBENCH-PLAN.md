# Workbench, absorbed — cross-site native composition inside the shipped product (build plan)

Decision record: `docs/SELF-EVAL-WORKBENCH.md` (§8 = the executor-(a) re-score) · evidence:
`docs/research/2026-08-30-workbench-prior-art.md`, `docs/evidence/probe/`. Repos: `~/dev/webmcp-private`
(entry) and `~/dev/Rokan` `feat/tier0-native` (engine; only wheels move over). Written 2026-08-30 ~01:30 PT
by Engineer #4 in the format of `optimized-mapping-tarjan.md` / `bright-squishing-corbato.md`.

## Context
Arav's 2026-08-30 directive: replace the terminal with an n8n-shaped Workbench where a human + agent compose
tools *other sites declare over WebMCP*, executed by our headless daemon (executor **a**), kept as a forged tool.
Measured tonight: executor (a) **works in the judge image** — `list_tools(allbirds)` 10 tools / 8 866 ms,
`search_catalog` **ok 469 ms, 0 model calls**; in the *live* sandbox the same call listed **0 tools** because the
daemon stops listening 3 s after `domcontentloaded` and Allbirds on ½ vCPU registers later (HTTP 200, Chromium
151 fine). Prior-art sweep: a near-identical canvas (**cardea**, 2026-08-26, 818 tests) plus six more canvas
entries are live; **no terminal entry exists**; the forge is the only empty column; cross-site supply is
Shopify's identical 10 tools + OpenAI docs. Scope agent: a 48-h canvas = 8–9 h me + 14–16 h Aarya, isolated.
**Verdict: no pivot. Absorb the Workbench's content — cross-site native steps in a forged tool — and add the
visual as a view, on a branch, under the existing kill rule.** Freeze Tue 09-01 12:00 PT; submit Tue; hard
close Thu 09-03 13:00 PT.

## Map — what stays, what changes
```
 ONE PAGE (apps/web)        TERMINAL (stays)   FORGE (stays)          WORKBENCH VIEW (new, branch `workbench`)
                            ghost text·Enter   commands[≤5]·params    read-only node strip of a forged tool:
                            ledger·redaction   forged_<name> tools    site · tool · rung · ms · calls per step
        │ ws (unchanged)                                              (Aarya; ≤1 day; no new page tools)
 BRIDGE packages/bridge (stays; trailer regex already accepts ⚙ native:site:tool)
        │ PTY
 `rokan do "<goal> at <site>"`          ladder unchanged (native replay → compiled → native+1 call → planned)
 `rokan-do native list <url>`           NEW: explicit, 0 model calls, prints the trailer line + --json
 `rokan-do native invoke <url> <tool> --set k=v … [--json]`   ← the web:native step a forged tool chains
 daemon: ROKAN_WEBMCP_QUIET_MS (shipped d62b290)   judge image: 15 s window, wheels 0.1.3 (787f810)
```
- The terminal stays the vehicle and the trace. The compile engine stays as the honest fallback for the 99 %
  of sites with no tools — demoted from the headline, never cut (open-net directive: "any website").
- A composed tool = a forged tool whose `commands[]` are `rokan-do native invoke …` lines across ≥2 origins,
  plus a machine step. Each step: ghost-typed → Enter → OSC exit/ms → ledger row with the ⚙ native chip.
- Nothing new executes anything. No new WebMCP tools on the page (7 fixed + ≤5 forged stays exactly as is).

## Deliverables (build order; each ships alone)
0. **Sandbox Tier 0 live** — window fix deployed (image `787f810` + Worker env), instance size decided by the
   standard-3 probe, `/probe/native-invoke.py` returns 10 tools + ok invoke *from the live sandbox*. Judge suite
   15/15 after the deploy. **Gate for everything below.**
1. **`rokan-do native` subcommand** (Rokan, `cli_native.py`, ~3.5 h): `list <url>`; `invoke <url> <tool>
   (--input '<json>' | --set path=value …) [--allow-write] [--json]`; `--allow-write` refused when
   `ROKAN_TASK_CLASSES` excludes `general`; `@prev` reads `$ROKAN_MCP_HOME/native-last.json`; always prints the
   render-grammar line (`⚡ ⚙ native:<site>:<tool>`, `calls:0` by construction) then one JSON line with `--json`;
   exit 0/1/2. Tests ×8 in `test_cli_wiring.py`/`test_native.py`; `regression_gate.py` 8/8; wheel 0.0.3; image.
2. **One composed forged tool, measured** — `forged_price_check({{product}})`: Allbirds `search_catalog` →
   Brooklinen `search_catalog` → `jq` compare. Recorded in builder mode and in the judge sandbox; FIELD-NOTES
   row with per-step ms and 0 calls. Seeded phrasing so a stranger can forge it from the hero card.
3. **Workbench view** (branch `workbench`, Aarya): `lib/workbench/model.ts` (pure: ForgeSpec ↔ steps, tested),
   `components/workbench/StepStrip.tsx` (linear cards, arrows, provenance chips from `executed_step` rows),
   shown under the Tools pane for the selected forged tool; `NEXT_PUBLIC_WORKBENCH=1` gate; `/` untouched.
   Merge only if demoable Mon 22:00 PT with web 211+/211 green; else the branch dies and main is untouched.
4. **Pitch** — README line 2 / SUBMISSION opening / video first 15 s: "WebMCP is a reliability layer, not a
   capability layer"; the three claims (reliability via declared tools · portability ChatGPT/Codex/MCP ·
   human-gated writes); Gao's output discipline named; delete the unsourced "≤ 12 tools (Chrome's guidance)".
5. **ChatGPT desktop run** (Arav's keyboard) on the shipped page + the probe page — §15 #1, still the biggest
   lever; sequential A→B tool use with two tabs is untested by anyone.

## Schedule (PT)
- Sun 08-30 02:00–04:00 — D0: deploy image, verify rollout (`wrangler containers list`), live probe, 15/15.
- Sun 08:00–12:00 — D1 subcommand + tests + wheel; 12:00–14:00 image + deploy + live probe; 14:00–16:00 D2.
- Sun 16:00 → Mon 22:00 — D3 on `workbench` (Aarya) with the kill rule; D4 copy (me) in parallel.
- Mon evening — D5 with Arav; video; Tue 12:00 freeze covers the deployed site (judges may never run the app:
  README/description/video carry the score; touch nothing after the deadline).

## Verification (definition of done)
- `pnpm check` (sandbox 40+), `pnpm smoke:image:rokan` (≤ 3 500 MB, Chromium boots as judge), judge suite 15/15
  with `--trace`, live `/probe/native-invoke.py` → 10 tools + ok; Rokan gate 8/8 + real-sites 6/6;
  web `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; a real-Chrome stranger run of `forged_price_check`
  with three Enters and three ⚙ native ledger rows, screenshot in `docs/evidence/`.

## Kill rules
- D3 not demoable Mon 22:00 → branch abandoned, no discussion. D1 not green by Sun 14:00 → D2 uses `rokan do`
  phrasing (1 select call on first run, 0 on replay) instead of explicit invoke; still measured, still honest.
- Instance size: never raise caps or size for convenience; standard-3 only if the probe proves it necessary.
