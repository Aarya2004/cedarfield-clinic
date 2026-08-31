# Fresh read of the challenge + the five linked entries + Workbench v2 (2026-08-30 ~05:30 PT)

Independent Opus 5 reader (web only, no repo access), commissioned by Arav: "really go through the point of the
challenge and the thesis." Condensed faithfully; URLs kept. Full agent output in the session transcript.

## The challenge, verbatim where it matters
- "Instead of leaving agents to guess their way through **your** UI, you define exactly how they can use **your**
  app, so they complete tasks faster, more accurately, and more reliably." — the possessive is load-bearing:
  site-owner defines, visitor's agent consumes. (webmcp.devpost.com)
- "an app that becomes meaningfully better when people and their agents can use it together" — first line of
  Requirements; the operative thesis.
- Four equal criteria; **tie-break = WebMCP Leverage**, then Execution. Stage 1 pass/fail: fits theme + applies
  the API. Description must state "what humans and agents can accomplish together."
- OpenAI's three example ideas (3D models with your agent · shared doc with agent comments · personalised
  crossword) and the showcases (Codex Modeling Studio, WanderNote, Margin): **every official example is one
  site, one surface, human and agent looking at the same thing.**
- learn.chatgpt.com/docs/webmcp: use site tools when "you and the agent need to see the same thing"; "Tools
  belong to the page that provides them."
- **W3C explainer non-goals, verbatim: "Headless browsing scenarios" and "Fully autonomous workflows"; goal:
  "Prevent web content disintermediation."** Chrome: "primarily designed for local browser workflows with a
  human in the loop."
- Cloudflare's example page = a commerce walkthrough (`discover_tools → search_products → add_to_cart awaiting
  confirmation → checkout`) + a React/Vite starter; $20 credits.
- Sponsors: Chrome ships **WebMCP evals** ("test your tools before you ship"), `useWebMCPTool` hook, DevTools
  inspector; Cloudflare Browser Run + WebMCP docs; Vercel storefront PR; Shopify storefront tool docs.

## The five entries (all single-origin; four list no video)
- **Chip** — cloud agent ↔ ESP32 over Web Serial; 9 tools incl. `request_user_action`, `erase_board`. Memorable:
  WebMCP as the only legal bridge from a cloud model to a USB port.
- **MCPencil** — human+agent Pictionary; **strongest presentation** (10 screenshots, repo, built-with names
  GPT-5.6 Sol/Terra — tested in the judging client). Purest reading of "use it together."
- **Sky to Porch** — hazard-evidence map over NASA/NOAA/USGS/EPA (server-side REST, one origin); returns
  limitations + source status as first-class output.
- **2D WebMCP (screen readers)** — deep-link-to-element as evidence for blind users; thinnest execution,
  strongest legitimacy (spec goal "improve accessibility through agents").
- **Kyun-Kyun** — co-op Godot escape game; agent reads structured game state; vehicle for the author's `Gua` lib.

## The field beyond the five (679 repos in the window; gallery unpublished)
- **Cardea** (the entry to beat): canvas, parallel real-web branches on Cloudflare Browser Rendering, approval
  cards, 12 tools, llms.txt, judge instructions for both clients, 818 tests.
- **Ensemble** — Chrome extension that *consumes* Shopify storefronts' tools across origins (one look from
  several stores, fill every cart). The only true cross-site consumer found.
- **Skulora Outfitter** — mission across real Shopify merchants; `plan_kit / search_products / prepare_checkout`;
  progressive tool disclosure; **5-step ~3-min judge script + `harness.json` of measured numbers** (the
  presentation bar; steal it).
- **AgentFlow**, **webmcp-flow**, Duet, Relay, Shared Canvas, SheetCanvas, Canvas Builder, Patchwork, Saturate…
  — the agent-driven node canvas is the most crowded shape in the field.
- Zero results for `webmcp cross-site` / `multi-site` / `orchestrator` / `n8n`.

## Workbench v2 (own tools = workflow CRUD; nodes = other sites' tools; headless daemon executes)
**What exists:** Cloudflare Browser Run + WebMCP (shipped 2026-04-15: an MCP client discovers and calls
website tools through a remote browser); Firecrawl `/interact` (headless `getTools/executeTool` for Claude
Code, free tier); Ensemble + Skulora (cross-storefront composition, this hackathon); Codex Record & Replay
(kept, re-runnable workflows); n8n/Zapier/Gumloop with MCP clients; a dozen canvas entries.
**Gap (narrow):** no consumer web page where human + agent co-author a durable, typed, re-runnable graph of
other sites' declared tools with writes behind a click.
**Novelty 5/10** — every layer is separately shipped; what remains is the assembly.
**Three failures:** (1) *the standard's authors list your mechanism as a non-goal* — headless, autonomous,
disintermediating — with Chrome's judge on the panel; (2) *supply is one pack* — Shopify's 10 tools on every
Liquid storefront plus a long tail of `contact_sales`/`search_docs`; the only supported workflow is
cross-storefront shopping, already claimed by Ensemble and Skulora and owned by Shopify UCP / OpenAI agentic
commerce; (3) *40 h is not enough for the part that must work live* — per-site Chromium, cookie banners,
geo-gates, async `toolchange`, split `navigator`/`document` getters, and a live URL that must survive three
unfamiliar storefronts on a judge's network on Sep 15.
**What it can do that alternatives can't:** fan-out in parallel (latency, not capability); durable re-run with
new inputs as an inspectable typed graph; zero-integration supply. **The founder's claim "Codex/Claude Code
can't connect these" is false as stated** (Browser Run since April; Firecrawl today). The true claim: *no page
lets a person and their agent mint and keep these together* — which is the forge.
**Real workflows with today's supply:** A. cross-storefront kit assembly (verified tools; already built twice);
B. restock/price watch (dull on video); C. non-commerce — could not verify a coherent chain. One workflow, one
vertical, claimed twice.
**"Define exactly how agents can use it":** Workbench's `workflow_*` are generic CRUD over a graph; 90 % of its
engineering is invisible to Leverage scoring because it runs in a daemon the spec disclaims. The forge —
`forge_create` producing a `forged_*` tool that did not exist at page load, live-registered, `toolchange`,
unregistered on transition, human's Enter runs it — is "define exactly how agents can use the app, by letting
the human define it at runtime." Strongest single answer to the challenge sentence found in 679 repos.

| hostile | Workbench v2 | Terminal + forge + cross-site native steps |
|---|---|---|
| Leverage (tie-break) | 5 | 8 |
| Execution | 4 | 7 |
| Impact | 6 | 5 |
| Creativity | 5 | 8 |
| **Total** | **20/40 · top-10 8–12 %** | **28/40 · top-10 25–35 %** |

**Build in 40 h:** terminal + forge, "not close." Add cross-site *steps* to a forged tool (another site's
declared tool, executed visibly, Enter-gated) as one seeded demo tool — ~6 h — not a workflow engine. Steal
Skulora's judge script + `harness.json`. Drop "Codex can't connect these" from all copy.
