# Self-eval — the "Rokan Workbench" directive (2026-08-30, Engineer #4 / Fable 5)

Arav's ask: replace the terminal-first product with a node-canvas "Workbench" (n8n / ElevenLabs shape) where
a human + agent compose a workflow from tools *other sites declare over WebMCP*, keep it as a forged tool,
and let any agent call it. Step 1: probe executor (c) — the agent itself — with one tool `next_step()`.
Step 2: this document. **Verdict up front: do not switch. Keep the shipped product; take two sentences
from the brief into the pitch. Reasons, numbers and what I could not measure are below.**

## 0. Premises in the brief that are stale (verified in code + gate runs, 2026-08-29 night)

| Brief says | Actual |
|---|---|
| "Tier 0 has two open P0s, regression_gate red 5/6" | `scripts/regression_gate.py` **PASS 8/8**; real-sites **6/6** (140 s). The write gate is enforced in `native.invoke()` (`_is_write_name`); `_try_native` is wired into `service.perform` (`service.py:657`). `search_catalog` / `get_cart` / `get_product` classify as **read** by the verb allowlist. |
| "a daemon judges can't run" | The judge container now carries headless Chromium + a sid-bound, capped model proxy. Live stranger proof (docs/evidence/stranger/): an unseeded PostgreSQL-docs question **planned · 9 019 ms → ⚡ compiled · 783 ms · 0 calls**. Judge suite **15/15, 0 retries, 96 s**. |
| "executor (a) is video-only" | No: (a) runs in the judge sandbox today; that is what the 15/15 suite exercises. |
| "cut Tier 0 wiring from `service.perform()`" | Cutting it removes the only *native consumption* proof we have (Leverage). It is gated, tested, and green. Don't. |

## 1. Step 1 — what was measured, what was not

**Built + deployed:** `https://rokan-sandbox.rokan-sandbox.workers.dev/probe/next-step` (`infra/sandbox/src/probe-page.ts`,
commit `2316970`). One tool, `next_step`, returns a literal instruction: step 1 → allbirds.com `search_catalog`
("wool runners"); step 2 → brooklinen.com `search_catalog` ("linen sheets"); then `DONE`. Each call is logged on
the page and in `localStorage`, so a consumer run leaves evidence even if the tab is reloaded.

**Contract, under Chrome 152 + `--enable-features=WebMCP` via the CDP harness** (`docs/evidence/probe/2026-08-30-next-step-contract-chrome-harness.jsonl`):
`list` → `[next_step]` · three invocations → `CONTINUE step 1 (allbirds)` → `CONTINUE step 2 (brooklinen)` → `DONE`,
**22–24 ms each, 0 failed, 0 page errors**. N = 2 full runs (before and after the site-2 change). The tool works.

**Site survey — what "tools other sites declare" means on the open web today** (same flagged Chrome, `list` after 4 s):

| Site | Declared WebMCP tools |
|---|---|
| allbirds.com | 10 — `search_catalog browse_store get_product show_variant get_cart update_cart cancel_cart proceed_to_checkout manage_orders search_shop_policies_and_faqs` |
| brooklinen.com | the same 10 |
| kyliecosmetics.com | the same 10 |
| gymshark.com | 0 |
| bombas.com | 0 |
| webmcp-challenge.examples.workers.dev (Cloudflare's own example) | 1 — `reveal_extra_credits_link` (a promo, not a store) |

So the Workbench's raw material is **one vendor's identical 10-tool catalog surface, repeated**, plus hackathon
demo pages. Every honest Workbench demo is "search two Shopify stores". Hold that thought for §4.

**Not measured — the part that decides (c):** whether a real consumer agent will *leave our page, call a foreign
origin's declared tool, come back, and call `next_step` again*.
- ChatGPT desktop (GPT-5.6 Sol/Terra): needs Arav at the keyboard (app running; I do not drive his screen during
  a call). Prompt to paste, on the probe URL: *"Run the workflow on this page: call next_step, do exactly what it
  says (it will send you to other sites and back), and keep calling next_step until it says DONE. Then tell me
  both results."* Evidence lands in the page log; screenshot the Site-tools arrow at each step.
- Chrome 152: `document.modelContext` is absent in Arav's running Chrome until it restarts with the flag; the
  Tool Inspector extension (drives `gemini-3-flash-preview`) is the only agentic consumer there.
- Known constraint from research (WEBMCP-RESEARCH:82, :285): **ChatGPT drops a page's tools when the page
  closes.** A two-site workflow in one tab therefore *unregisters* `next_step` on every hop; the agent must
  navigate back and the page must re-register on load (the probe does). Each hop is a full navigation plus the
  agent's own reasoning. Measured agent overhead per tool call in our A/B (`docs/evidence/ab/`): **15.8 s
  (Claude) / 23.2 s (Codex)** wall-clock. Expected two-site workflow via (c): **4–5 agent turns ≈ 60–120 s**,
  against **783 ms** for the same question compiled. That is the honest prior; it needs one consumer run to
  become a number. Until then (c) is *unproven*, not *disproven*.

## 2. Hostile-judge scores — the four official criteria, equal weight

Judge model: has opened Chip, Sky-to-Porch, screen-readers-webmcp, Kyun-Kyun and Cloudflare's example; files
in ten seconds; distrusts numbers; rewards what they can click now.

| Criterion | Workbench (what could exist by Mon 22:00 PT) | Shipped product (today, live) |
|---|---|---|
| **WebMCP Leverage** | **4.** The canvas cannot call another origin's tools from the page: `getTools({fromOrigins})` needs the other site to opt in with `exposedTo`, and Shopify does not. So the "composed tool" the page registers is a *prompt* — a list of instructions the agent reads and executes itself. One tool registered, none consumed. A judge who has read the spec sees this in one look. | **7.** 7 fixed tools + user-made tools born at runtime via `registerTool` (no other entry does this); native consumption of a site's declared tools from `rokan do` (Tier 0, gated, measured 235 ms first invoke / 24 ms reused); every number on screen measured by the code that shows it. |
| **Execution** | **3–4.** A canvas designed, built and stranger-proofed in ≈ 36 h, over an executor nobody has measured, with the existing green baseline to protect. Realistic Monday state: a canvas that renders nodes and a `next_step`-style tool underneath it. | **8.** Web 211/211 · bridge 34 unit + 43 smoke · sandbox 40/40 · evals unit 3 · prompt-line 9/9 · real-PTY 13/13 · judge suite 15/15 live. Five review passes with P0/P1s closed; SECURITY §6–§9 true to the code; live caps trip proven. |
| **Potential Impact** | **5.** The brief's framing is right — WebMCP is a reliability layer, not a capability layer — but the Workbench does not *demonstrate* it: the agent is still the one navigating. What it demonstrates is a nicer way to write a multi-step prompt. | **6.** "Do it once, now it's a tool" + open-net `rokan do` for strangers. Still reads as a dev terminal to generalist judges (SELF-EVAL-2026-08-29 called this the criterion that stops us — unchanged). |
| **Creativity & Ambition** | **4–5.** The n8n/Zapier/Make node canvas is the most-recognised automation UI on earth; ~28 % of live entries already use the workspace/canvas/board metaphor (WEBMCP-RESEARCH:197). Devil's-advocate novelty: **5/10** — "n8n, but the nodes are WebMCP tools". Arav's own bar is 8. | **6–7.** Runtime-forged tools and consume-else-compile are a lane no other entry is in (field research: all four rivals are single-site, fixed-list). |
| **Mean** | **≈ 4.3** | **≈ 6.9** |

Does the Workbench beat shipping what exists? **No — by two and a half points on a hostile read, and it also
loses on the presentation gate (live URL must work for a stranger by freeze).**

## 3. What breaks if we switch

1. **Locked decision PLAN §0.5** — "no chat-style `ask`/`do` meta-tools." A forged tool whose output is
   *instructions to the agent* is exactly that meta-tool. The Workbench's execution model is a rule we wrote down
   to avoid.
2. **Honest numbers (PLAN §0.6).** Agent-executed steps run in the consumer's own loop; we cannot measure or
   display their ms or call counts. The Ledger column goes blank for the headline feature.
3. **The 12-tool cap** is unaffected, but the *no-execution invariant* becomes moot: nothing runs on our side,
   so "your Enter is the trust boundary" stops being true for the new surface — the agent's own confirmation
   UI is the boundary, and that is OpenAI's story, not ours.
4. **The green baseline** cannot be protected while `apps/web` is rebuilt around a canvas in the same tree
   (Aarya's lane, reviewer shared checkout). Kill rule as written by Arav: not demoable Mon 22:00 → revert.
   The revert itself costs the Monday we need for the ChatGPT desktop run, the video, and the freeze.
5. **Reversibility of the pitch.** README/SUBMISSION/DEMO/SECURITY are consistent with the shipped product
   after the honesty audit; a half-switched pitch is the worst of both.

## 4. The Grigorik trap (FORGE-PLAN §13, row "Ilya Grigorik"; EXECUTION-PLAN:216)

His "no" column: *re-registering Shopify's tools · gimmick with no reusable core · commerce cosplay.* §1's survey
shows the only declared tools on the open web are his ten, cloned per storefront. A Workbench demo is therefore,
unavoidably, "compare two Shopify stores with Shopify's own tools, no cart" — a product-comparison widget built
on his API, judged by the person who shipped that API. That is the definition of commerce cosplay.

The shipped product's answer still holds: **no commerce in the demo** (hero = `status_of {{site}}`, PostgreSQL
docs for the stranger run); his tools appear only as Tier 0's *proof that native consumption is the first rung*
(read verbs only, no cart, measured), not as the story.

## 5. Where the brief is right — take these, not the canvas

- **"WebMCP is a reliability layer, not a capability layer"** — better than anything in our current copy. It goes
  into README line 2, SUBMISSION's opening, and the video's first 15 s.
- **Three claims only** — reliability via declared tools · portability across ChatGPT / Codex / MCP · human-gated
  writes. Our current pitch makes more claims than that; cut to these three.
- **Cross-site composition** already exists as a forged tool whose `commands[]` chain `rokan do` steps
  (COMPOSE-PLAN §"Composed tool"; `deal_hunt`-shaped). It needs *one measured example in the video*, not a UI.

## 6. What I recommend for the remaining ~50 h to freeze

1. **The ChatGPT desktop run** (§15 #1 — "the single biggest lever") on the *shipped* page, and the probe page
   as a 5-minute side-measurement so (c) becomes a number in FIELD-NOTES. Arav's keyboard, my checklist.
2. Pitch copy → the three claims (README, SUBMISSION, DEMO cold open). Half a day, zero code risk.
3. Video: forge → invoke → ⚡ replay 0 calls, then one composed cross-site forged tool with a native step.
4. Freeze Tue 12:00 as planned. No canvas.

If Arav overrides: the only Workbench I would build is **a read-only visual of an existing forged tool's steps
(provenance, rung, ms per step) rendered as nodes** — a *view* over the substrate, no new execution model, no
new tools, ≤ 1 day, behind the existing Tools pane. That keeps every locked decision and adds the "delightful
and visual" surface SELF-EVAL-2026-08-29 said the generalist judges want.

## 7. Objection, one line (mirrored in PROGRESS `## Objections`)

Workbench scores ≈ 4.3 hostile vs ≈ 6.9 for the shipped product; its execution model is the banned §0.5
meta-tool and, on today's open web, unavoidably commerce cosplay; the two right sentences in the brief go into
the pitch; executor (c) stays unmeasured until one consumer run. Do not start the canvas.
