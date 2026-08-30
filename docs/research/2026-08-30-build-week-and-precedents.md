# Build Week winners, prior OpenAI/Chrome/sponsor hackathons — what this rubric rewards (2026-08-30 ~07:30 PT)

Independent Opus 5 research (63 tool calls; sources listed at the end of the agent's report, key ones inline).
Condensed; the judgments are the researcher's, checked against the pages it fetched.

## The load-bearing fact
**The WebMCP rubric is a find-and-replace of the Build Week rubric** (openai.devpost.com/rules vs
webmcp.devpost.com/rules): Execution and Potential Impact are word-for-word identical; "WebMCP Leverage" swaps
the product name into the Codex criterion; Creativity = "Quality of the Idea". The eight Build Week winners
(scored 2026-08-25) are the calibration set. In the identically structured gpt-oss edition the **tie-break was
the first-listed criterion**, whose text asked *"can other models do the same thing, or does the project
showcase the strengths uniquely?"* → here: **nothing but WebMCP could do this.** gpt-oss put "safety of the
user" inside Design (= Execution here): the human gate is scored under Execution, not as a bonus.

## The eight Build Week winners (all OpenAI judges; ~8,000 projects)
| Winner | Audience (named) | AI vs deterministic / the constraint | Real user | Won on |
|---|---|---|---|---|
| Second Voice | people with dysarthria | 2–3 ranked candidate sentences; nothing spoken without human selection | no | "the smallest UX decisions carried the most weight"; reported WER got *worse* (22→32 %) → eval-driven |
| AirBridge | Windows users with AirPlay devices | zero-AI audio path; local policy allowlist "an LLM can't argue with" | no | hard protocol work + policy layer; 19 commits |
| **veTriage** | vet receptionists at one practice | **no LLM at runtime**; footer "Deterministic • No LLM runtime • Session-only data"; RED downgrade needs a vet | **yes — piloted July 13, used July 14; the practice manager found a flaw that forced a redesign** | domain expertise → builder; the only winner with a video |
| Pulse | cardiac-arrest teams (Cairo) | "no language model in the clinical loop"; fail-closed; 29 replayed scenarios | no (research prototype, said so) | built between shifts, no team |
| Echo Canvas | acoustic designers | deterministic DSP; model = constrained authoring layer, validated schemas | no | "AI is most reliable as a constrained authoring layer" |
| Sentinel | MCP-server authors | AST/Semgrep → GPT corroborates citing real lines → Docker probes; model "cannot write probe code" | no | anchored to OWASP Agentic Top 10; SARIF GitHub accepts; ablation artifact; `--replay-review` runs with **no API key** |
| Mechanica | museum visitors/students | "data is law": every dimension source-tagged; docent refuses out-of-corpus; **poison tests** | no | "ours showcases restraint" |
| Dấu | Vietnamese learners | DSP grades, LLM coaches — *because* ASR normalises tones; withheld 2/38 references; 91.7 % family vs 72.2 % exact, qualified | one native speaker | "asks the learner to try again rather than confidently giving the wrong answer"; $12 spend disclosed |

**Winners vs finalists — the four differentiators:** (1) a URL a stranger opens cold or a runnable artifact
(every winner; Sentinel with no demo shipped `--replay-review`); (2) **a named non-builder who used it and
changed the product** (veTriage) — finalists offered *plans* (SayAhead, Canopy, Tomok); (3) falsifiable
evidence placed where a judge sees it (poison tests, ablation, withheld cases, an unflattering number) —
ResearchOS had 7 %→93 % in prose and lost; (4) **the user is not the builder** — Emberframe, GenUI, Vibe Signal
built for people like themselves in a saturated genre (6+ "watch your Codex agents", 4+ "spatial canvas for
agents") and finished finalists; Sentinel is the exception because it anchored to an external standard.
Every winner said Codex wrote the code; nobody was penalised for agent authorship, they were rewarded for
*governing* it. Solo/duo builds win; repo heft is not rewarded.

## Precedents
- **gpt-oss Open Model Hackathon** (2025, 8 637 → 488 submissions): winners embodied — RoboChef (robot arm),
  a smell printer, Steam Deck 3D-printing, **Memory Palace** (two prizes, offline-first companion for memory
  loss), bota. "A visible 'I can't believe that works' moment beats a clean app."
- **Chrome Built-in AI Challenge 2024/2025** (Drasner's org): the most valuable prize is literally *Most
  Helpful* ($14 k) and **both 2025 winners were disability tools** (Nutshell hands-free browsing; AAC Board AI —
  which *removed* a feature over a 20 % error rate). **Generic sidebar chatbots and "an agent that automates
  the browser" (Marionette) got honorable mentions.** Criteria include "solving an existing problem in a
  compelling manner" and "would a user use it more than once".
- MCP hackathons: the meta-layer keeps winning — Observee (observability), **Cite-Before-Act** (Anthropic/
  Gradio Best Overall: "require explicit approval before state-mutating operations") → **approval gating is
  table stakes, not a differentiator** (also Bander/SayAhead: finalists, not winners).
- Sponsors: Cloudflare/Netlify paid for depth into their primitives; Vercel for quality/speed; Shopify for one
  consumer verb over the catalog. **No OpenAI Apps SDK hackathon ever; no DevDay hackathon; Build Week 2026 was
  the first** → the WebMCP Challenge is OpenAI's first ChatGPT-apps-shaped competition.
- Codex hackathon winner's lesson: *"work backwards from the demo. Your demo is your product."*

## What the panel's own companies say (all converge)
Chrome explainer: "the agent sees a contract… with the user still in the loop for permission and confirmation".
Shopify: "cart updates change the cart the shopper sees"; `requires_escalation` handoff. Cloudflare: "the human
stays in control and creators keep their traffic". Vercel #498: read-before-write, bounded results. Nahas:
explicit over implicit; write tools behind "here's what I'm about to submit — yes or no?". **Chrome's evals doc:
"before releasing tools into production, you must confirm agents understand when to call the tool" — published
tool-selection evals are on-criterion.** Limits: 500-char descriptions, 150/param, **1.5 K per tool output**.

## Reading for our decision
- **Impact-on-humans ranks first, and "hybrid human+agent user" is a mode, not an audience.** Winners named a
  population you could go find. "Based on what's demonstrated" = scored off the video and the live URL.
- **The tie-break test:** the Workbench and the compile engine survive WebMCP being removed (n8n over any API;
  browser-use); the forge does not → forge wins the deciding axis.
- **Our red flags, by name:** a tool for people like us (developers) in a saturated genre; approval-gate as the
  idea; numbers in prose instead of artifacts; no named outside user. **Our on-pattern assets:** a URL a stranger
  opens (judge sandbox), refusal as a feature (drift), honest unflattering numbers (3/5 cold, n=3 spread),
  evals + harness + A/B arms, "no key needed" judge mode (Sentinel pattern), constraint printable in the UI
  (veTriage footer pattern: "No tool ever runs a command · your Enter · signed ledger").
- **Cheapest highest-value action in the calibration set:** one named non-builder who uses it before the
  deadline and changes something, quoted in the README. Then the video showing the moment (Site tools 7 → 8).
