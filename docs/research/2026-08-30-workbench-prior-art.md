# Prior-art sweep — "Rokan Workbench" (canvas of other sites' WebMCP tools)

Research window 2026-08-29/30 (Opus 5 research agent, hostile brief, ~100 tool calls). Every claim carries a URL;
"not found" means searched and unsourced. Commissioned to decide *canvas workbench* vs *terminal + forge* as the
product surface. Verdict at the end. Companion: `docs/SELF-EVAL-WORKBENCH.md`.

## Two corrections to our own premises

- The current API is **`document.modelContext.registerTool()`**; the getter moved from `Navigator` to `Document`
  (~2026-05-27) and **Chrome 150 deprecated the `navigator` alias**. Two of three non-Shopify live implementations
  (render.com, wppopupmaker.com) still use the old spelling and register nothing on current Chrome. Our
  `apps/web/src/lib/webmcp/types.ts:48-53` already resolves `document ?? navigator` — correct.
- **"≤ 12 tools visible" (PLAN §0.4, CLAUDE.md) has no external source.** Chrome: *"While there isn't a maximum
  number of tools allowed…"* (https://developer.chrome.com/docs/ai/webmcp/best-practices). OpenAI documents no cap.
  Real limits are per-tool: 500-char description, 150 per param description, 30 per name, 1.5 K per output
  (https://developer.chrome.com/docs/ai/webmcp/secure-tools). Keep the discipline; stop citing "Chrome's guidance".

## 1. Prior art — visual builders composing MCP/agent tools as nodes

(a) consumes tools declared by web *pages* · (b) emits a new *web-declared* tool · (c) human-keypress write gate.

| Product | (a) | (b) | (c) | Source |
|---|---|---|---|---|
| n8n (MCP Client Tool / MCP Server Trigger) | no | partial (SSE/HTTP endpoint) | out-of-band (Slack/Gmail approval) | https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolmcp |
| Zapier MCP / Agents | no | partial | yes (approval request, 2026-05-29) | https://docs.zapier.com/mcp/how-tools-work |
| Make.com | no | partial | HITL app (Enterprise beta) | https://developers.make.com/mcp-server |
| Gumloop | no | no (`start_flow_run` only) | yes | https://docs.gumloop.com/core-concepts/human_in_the_loop |
| Dify | no | partial (two-way MCP v1.6) | Human Input node v1.13 | https://dify.ai/blog/v1-6-0-built-in-two-way-mcp-support |
| Flowise · Langflow | no | server-side MCP ("Share → MCP Server") | Langflow: open FR #6867 | https://docs.langflow.org/mcp-server |
| Composio · Pipedream · ElevenLabs Workflows | no | no / partial | yes | https://elevenlabs.io/blog/introducing-agent-workflows |
| **OpenAI Agent Builder / AgentKit** | no | no | Human-approval node | **deprecated, shuts down 2026-11-30** (https://developers.openai.com/api/docs/deprecations) |
| LangGraph Studio · Vellum · Relay · BuildShip · Sim.ai · Rivet · Activepieces · Trigger.dev | all no | server-side at best | mostly yes | https://docs.sim.ai/workflows/deployment/mcp |

"Codex Modeling Studio" is a first-party WebMCP *showcase* (3D studio, three hand-authored tools), not a canvas:
https://developers.openai.com/showcase/codex-modeling-studio.

**Synthesis.** Node canvas ⇄ server-side MCP is a commodity (~12 products; OpenAI is killing its own). HITL exists
in 14/19, always out-of-band. **Zero of 19 mention `modelContext`** (code-searched). The (a)+(b) column is empty —
see §2 before reading that as "open".

## 2. The WebMCP field (GitHub only — the Devpost gallery is unpublished as of 2026-08-30)

### Canvas/workflow entries already public in this hackathon
- **cardea** — https://github.com/SankrityaT/openai-mcp-hackathon · https://cardea-two.vercel.app · created
  2026-08-26 · 818 tests · MIT. README: *"cardea opens a canvas, plans it, runs the branches in parallel on the
  actual web, and stops at every move that spends, sends, or signs so you make that call yourself."* 12 tools on
  `document.modelContext` (`create_mission … resolve_approval, open_takeover, open_pages …`). **The Workbench minus
  cross-site consumption and minus tool re-emission. The single most decision-relevant find.**
- **duet** (2026-08-30, https://nishn304.github.io/duet/) — node canvas, agent `propose_changes` → human Approval
  Lane → docker-compose/Terraform.
- **webmcp-canvas-builder** (ajeesh1987, 2026-08-29) · **saturate** (a7t-ai, 2026-08-27) · **patchwork-webmcp**
  (Damso74, 2026-08-30) · **hex-machina** (adiprathapa, 2026-08-27) · **webmcp-research-workbench** (itprodirect,
  2026-08-27, https://webmcp-research-workbench.vercel.app — literally "Workbench").

### Runtime tool-forging entries (our forge thesis, already in the field)
- **agentic-service-dispatch** (tandttakumi, 2026-08-27, https://agentic-service-dispatch.vercel.app) — *"Human
  approval creates one exact, time-limited WebMCP capability — and consumes it after one action."* Registry goes
  5 → 6 → 5; the approved tool does not exist until a human approves.
- **learn-powerplatform-fyi** (miskaone, 2026-08-26) — "mastery gates that register new tools when earned".
- **mace** (edycutjong, 2026-08-29) — "the registered WebMCP tool set IS the motion stack".

### Cross-site / orchestration prior art (non-hackathon)
- **PaulKinlan/chrome-agent-platform** (Chrome DevRel, 2026-08-14) — NTP agent hub, "sites-as-sub-agents".
- **igrigorik/AgentBoard** — a judge's own extension: "script WebMCP tools, connect remote MCP servers"; one sidebar
  per tab.
- **jeromeetienne/webmcp_everywhere** — adapters that "register tools into sites that never shipped their own".
- **dallman2/webmcp-sandbox** (2026-06-26) — containerised Chromium + extension + MCP server. **The "headless daemon
  in a hosted sandbox" already exists as OSS.**
- CDP bridges: tech-sumit/webmcp-cdp, littleplato/webmcp-cdp-bridge, KevinBolcic/webmcp-cdp;
  uyencss/webmcp-workflow (executes "WebMCP workflow JSON"); o1-spec/mcpx (reliability runtime, Saga compensation).
- **Spec issue #261** (2026-08-26): *"preserve completed WebMCP tasks as reviewable workflow documents"* — "Save as
  routine", re-discover tools, fresh approval for consequential actions. Cites **OpenAI Codex Record & Replay**
  (shipped: https://learn.chatgpt.com/docs/extend/record-and-replay). #227 cross-tab discovery unresolved; #262
  "WebMCP loses context when tools appear or disappear" — the forge's own failure mode is a known open problem.
- Sky-to-Porch = HuiYingChung/sky-to-porch-webmcp (wizard, single-site). "2D WebMCP", "Chip", "Kyun-Kyun",
  "screen-readers-webmcp": **not found**.

## 3. Supply — production sites that declare tools

- **Shopify** (only large-scale deployment; verified by fetching `cdn.shopify.com/storefront/webmcp/webmcp-0.1.1.js`,
  65 509 B): exactly 10 tools — `browse_store cancel_cart get_cart get_product manage_orders proceed_to_checkout
  search_catalog search_shop_policies_and_faqs show_variant update_cart`. Live 2026-08-30 on aloyoga, rhode,
  saltandstraw, allbirds, gymshark, kyliecosmetics, everlane, brooklinen, reebok (not fashionnova). Loader
  feature-detects `document.modelContext || navigator.modelContext`. Merchants cannot add tools (allowlist of one).
  Rollout: https://shopify.dev/changelog/webmcp-liquid-hydrogen (posted 2026-08-05, effective 2026-08-21).
- **OpenAI doc sites** (learn.chatgpt.com, developers.openai.com): 5 tools (`search_openai_docs, lookup_page,
  lookup_context, navigate_to_page, generate_custom_guide`).
- **render.com** 5 read tools via `navigator.modelContext` only → dead on Chrome 150+. **wppopupmaker.com** (WP plugin,
  old `provideContext`). Suede Agent Studio self-reported (#266), `registerTool` not found in bundles. Telerik/Kendo
  press release 2026-08-20 (secondhand).
- Platforms: **Cloudflare** developer preview, opt-in switch, not default-on (https://blog.cloudflare.com/webmcp/,
  2026-08-06). **Vercel, Netlify, Wix, Squarespace: not found.**
- Registry https://webmcp.com (nekuda): 399 sites / 363 "live" / 2 307 tools; 32 Shopify-signature. Spot-check:
  coinranking, hunchbank, bestprice.gr show **zero `modelContext`** — treat 363 as an upper bound.
- Google I/O logo wall re-fetched 2026-08-30: redfin, instacart, creditkarma, turbotax **zero**; target.com has the
  trial enabled and **registers no tools**. Spronta (2026-07-23): *"registered tools round to zero outside demos"*.

**Net:** real cross-site supply = Shopify's identical 10 commerce tools + OpenAI's docs + one broken site.

## 4. Consumers (Aug 2026)

- **ChatGPT desktop built-in browser** (https://learn.chatgpt.com/docs/webmcp, 2026-08-25): GPT-5.6 Sol/Terra only;
  no declarative, **no iframes (same- or cross-origin)**; *"Tools belong to the page that provides them"*; per-call
  safety review + confirmation for consequential actions; non-tool browsing "aren't WebMCP tool calls".
  help.openai.com 20001423: *"ChatGPT can work across tabs, but each site tool is available only on the webpage that
  provides it. A tool from one page does not carry over to another page or website."* Sequential A→B with two tabs:
  **implied, undemonstrated, untested by anyone.**
- **Codex CLI / IDE: cannot reach page tools** (https://learn.chatgpt.com/docs/browser; openai/codex#25647).
- **Chrome / Gemini in Chrome**: chromestatus 5117755740913664 "Proposed"; OT 149→156; ship stage empty; "Gemini in
  Chrome will soon support WebMCP" (2026-05-19). DevTools WebMCP panel since 149; Tool Inspector extension drives
  `gemini-3-flash-preview`.
- Brave Leo experimental (v1.94.44); Edge 150 OT (no agent); Claude in Chrome no (#30645); Comet/Dia/Arc not found;
  Atlas shut down 2026-08-09.
- **CDP `WebMCP` domain** (browser_protocol.json tip ea39a11): `enable/disable/invokeTool/cancelInvocation`,
  events `toolsAdded/toolsRemoved/toolInvoked/toolResponded`, `Annotation{readOnly, untrustedContent,
  consequential, autosubmit}`; landed 2026-03-10. **Puppeteer `page.webmcp`** since v24.41.0 (2026-04-15);
  chrome-devtools-mcp `list_webmcp_tools` since v0.22.0; **Playwright: none** (#40234 closed "see if it gains
  adoption"). Cloudflare Browser Run advertises WebMCP for remote agents. Chrome's non-goal: *"primarily designed for
  local browser workflows with a human in the loop."*
- **Hard blocker:** `tools` Permissions Policy defaults to `['self']`; cross-origin needs the *other* site's
  `exposedTo`. **A page cannot call Shopify's `search_catalog`; only a browser that navigates there can.**

## 5. Judge signals

- Criteria (equal): Leverage · Execution · Impact · **Creativity — "does the project differ from existing
  concepts?"** Framing: *"an app that becomes meaningfully better when people and their agents can use it together."*
- Organizer update 2026-08-29: *"The strongest projects start with a real problem and use WebMCP because it fits."*
  *"Show the project working in the first 10 to 15 seconds."* Only don'ts: vague naming/description; **"fake or
  overstate what's actually running."**
- **"Do judges test my project? They may, but they're not required to — they can judge based on your description
  and repo alone."** After the deadline: touch nothing — site included.
- Grigorik: X post ~2026-08-25 (snippet-sourced) "millions of Shopify storefronts are live". Colleague Yoav Weiss on
  TAG #1238. **Nahas: his wiki lists Cross-Origin Data Leakage as a known WebMCP vulnerability class**
  (https://github.com/MiguelsPizza/WebMCP/wiki/Known-Security-Issues-With-WebMCP); interview: *"the agent comes to
  the website, not the other way around."* Drasner's demo title: *"Give agents tools, not DOM."* Galloni co-authored
  https://blog.cloudflare.com/the-agentic-internet/. **Gao wrote vercel/shop #498 then #504 — replaced his own
  storefront tools with Shopify's CDN script**; his bar: re-validate args server-side, bounded redacted results, no
  IDs/URLs/upstream error text, "unsafe to retry" on ambiguous mutations. Roberts/Rushing: nothing found.
- Commerce fatigue: **no judge statement exists — do not claim one.** The structural case: every sponsor demo is
  commerce (Netlify Kurio, Cloudflare coffee, Vercel shop) → saturation; a storefront clone dies on "differ from
  existing concepts", not on distaste. OpenAI's own exemplars are not commerce (Modeling Studio, WanderNote, Margin).
- Cross-site composition: TPAC scoped cross-origin aggregation out of v1 (#52); Chrome: unrestricted exposure
  "virtually guaranteed to lead to CSRF" (#188); Mozilla: page-locality is defense-in-depth (#227); published
  origin-isolation break (Fernandes 2026-04-30); spec's SOP section is a TODO.
- WebKit formally opposes WebMCP (#670): "brittleness moves from the DOM into the tool descriptions".

## Novelty read — Workbench **4/10**

1. Canvas is the most crowded shape (cardea, duet, canvas-builder, saturate, patchwork, hex-machina,
   research-workbench); cardea already ships canvas + parallel real-web branches + spend/send/sign gates.
2. Forge (workflow → new tool) is the one open (a)+(b) slot — but proposed at spec level (#261), demonstrated by
   agentic-service-dispatch, and OpenAI ships the thesis as Record & Replay.
3. "Compose other sites' declared tools" is the most novel and most fragile part: page-blocked, daemon-only, and
   the daemon plumbing is a sponsor primitive (Browser Run, Puppeteer, webmcp-sandbox).
4. The keypress gate scores zero for novelty (`requestUserInteraction()`, 14/19 products).
5. Judges' exemplars reward one deep site, not a hub reaching out.

## The three facts that decide canvas vs terminal + forge

1. **A near-identical canvas is live and well-executed (cardea, 2026-08-26, 818 tests).** The field has **no
   terminal/shell project**.
2. **Cross-site composition is blocked in-page, per-page in ChatGPT's own words, deferred past v1, flagged by a judge
   as a vulnerability class — and its only supply is Shopify's 10 tools, which judge Gao's own repo deleted as
   redundant.** A canvas of "tools other sites declare" is commerce cosplay by architecture.
3. **Execution plumbing is real but commoditised; the forge is the only empty column, surface-agnostic, and never
   leaves our origin.** Keep the forge, drop the canvas. Buy the Workbench's ambition with one real cross-site node
   inside the terminal: one third-party site's declared tool, called through the sandbox, ghost-typed, Enter-gated.

## Repo actions regardless of surface
- Reword the "≤ 12 tools" claim as our own discipline (PLAN §0.4, CLAUDE.md).
- Adopt Gao's output discipline explicitly in README (bounded, redacted, "unsafe to retry").
- README/description/video carry the score — judges may never run the app. Freeze covers the deployed site.
- Test sequential A→B tool use in ChatGPT desktop with two tabs open before relying on it either way.
