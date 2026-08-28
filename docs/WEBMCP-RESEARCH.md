# WebMCP — everything, verified, 2026-08-28

> Purpose: the single reference for the OpenAI WebMCP Challenge entry and for
> Rokan's position on WebMCP. Every load-bearing claim below was read from a
> primary source today (spec text, repo commits/issues, Devpost rules, OpenAI's
> site-tools doc, WebKit/Mozilla position threads). Anything not read directly
> is marked UNVERIFIED. Companion: `docs/IDEA-LEDGER.md` §F/§K/§L/§N (our
> standing verdict: _WebMCP is inventory, not competition_).

---

## 0. The thirty-second version

- **WebMCP** = a page calls `document.modelContext.registerTool({name, description, inputSchema, execute})`; the browser hands that tool list to an agent; the agent calls the tool inside the user's live, signed-in page. Tools only — no resources/prompts/sampling.
- **Who wrote it**: Microsoft (Walderman, Lee, Nolan) + Google (Bokan, Sagar, Van Opstal), first published 2025-08-13 as `window.agent`; now edited by Farolino (Google), Sagar (Google), Walderman (Microsoft) in the W3C **Web Machine Learning Community Group**. Draft CG report, **not** on the standards track. Latest spec edit 2026-08-26.
- **Who ships it**: Chrome 149–156 origin trial (flag `chrome://flags/#enable-webmcp-testing`), Edge 150 origin trial, Brave Leo experimental, **ChatGPT Desktop built-in browser + Codex (since 2026-08-25)** — the first mainstream consumer. Gemini in Chrome: "soon". Claude in Chrome: no (issue closed not-planned). **WebKit: opposed** (2026-06-03). Mozilla: neutral, warming to the imperative API only.
- **Supply in the wild**: Shopify turned it on for every Liquid + Hydrogen storefront (10 tools). Cloudflare's edge bridge can add tools to any site it fronts. Vercel's `shop` template. Nine I/O origin-trial partners (Expedia, Booking, Shopify, Credit Karma, TurboTax, Redfin, Etsy, Instacart, Target). Otherwise ≈ zero real deployment per every July survey.
- **The challenge**: OpenAI + Chrome + Cloudflare + Shopify + Vercel + Render + Netlify. 10 days, opened 2026-08-25 11:00 PT, **closes 2026-09-03 13:00 PT**. Top 10 get $3K + Codex Micro + ChatGPT Pro ×3 + sponsor credits. 3,001 registered. Four criteria, 25% each, tiebreak = WebMCP Leverage.

---

## 1. The API, exactly (spec 2026-08-26)

```webidl
partial interface Document {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};
[Exposed=Window, SecureContext]
interface ModelContext : EventTarget {
  Promise<undefined> registerTool(ModelContextTool tool, optional ModelContextRegisterToolOptions options = {});
  Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options = {});
  Promise<DOMString> executeTool(RegisteredTool tool, optional object inputObject = {}, optional ModelContextExecuteToolOptions options = {});
  attribute EventHandler ontoolchange;
};
dictionary ModelContextTool {
  required DOMString name;        // 1–128 chars, [A-Za-z0-9_.-] only
  USVString title;
  required DOMString description;
  object inputSchema;             // JSON Schema object (was DOMString until #241, 2026-08-14)
  required ToolExecuteCallback execute;   // (inputObject, {signal}) => Promise<any>
  ToolAnnotations annotations;    // { readOnlyHint=false, untrustedContentHint=false }
};
dictionary ModelContextRegisterToolOptions { sequence<USVString> exposedTo; AbortSignal signal; };
dictionary ModelContextGetToolOptions     { sequence<USVString> fromOrigins; };
dictionary ModelContextExecuteToolOptions { AbortSignal signal; };
dictionary RegisteredTool { required name; title; required description; inputSchema; required Window window; required USVString origin; annotations; };
```

Facts that bite:

- **Unregister = abort the `signal` you passed at registration.** There is no `unregisterTool` in the current spec (older previews had it; MCP-B still documents it). In-flight executions survive unregistration (#248).
- **Return value**: the explainer returns MCP-style `{content:[{type:"text",text}]}`; OpenAI's own example returns a plain object `{title: document.title}`. Both are accepted; the spec says `Promise<any>`. Return small, structured, verifiable data.
- **`executeTool` returns `DOMString`** (serialised) at the spec level; input is an object since #246 (2026-08-17).
- **Permissions Policy `tools`**, default allowlist `['self']`. Cross-origin iframes need `allow="tools"`; `Permissions-Policy: tools=()` header disables. `registerTool` rejects with `NotAllowedError` when disabled.
- **Cross-origin exposure** is opt-in via `exposedTo: [origin…]`; discovery of foreign tools needs `getTools({fromOrigins})`; the browser checks both agree. Secure origins only.
- **`toolchange`** fires on the document's `modelContext` when registrations change anywhere in the tree.
- **`navigator.modelContext` → `document.modelContext`** moved 2026-07-21; Chrome 150 deprecates the old name but keeps the alias. Feature-detect `document.modelContext ?? navigator.modelContext`.
- **Not in the spec yet, but shaping it**: `consequentialHint` (#217, Mozilla wants safe defaults), `requestUserInteraction` → `requestUserInput` with "interactive" mode resolved first (#204/#165, group resolution 2026-06-11), `outputSchema` (#9), streaming/multimodal (#41/#82/#86), skills bundles (#161), tool collections / progressive disclosure (#255), agent-scoped cookies (#257), discovery beyond one frame tree (#227), a Service-Worker explainer for tools on sites the user does **not** have open (`docs/service-workers.md`).

### Declarative API (forms)

```html
<form toolname="search-cars" tooldescription="Perform a car make/model search" toolautosubmit>
  <input name="make" toolparamdescription="The vehicle's make (e.g. BMW)" required />
  <input name="model" toolparamdescription="The vehicle's model (e.g. 330i)" required />
  <button type="submit">Search</button>
</form>
```

Adds `SubmitEvent.agentInvoked`, `SubmitEvent.respondWith(promise)`, `toolactivated`/`toolcanceled` events, `:tool-form-active` / `:tool-submit-active` pseudo-classes. Schema synthesis is "TBD, Chromium implements a loose version". **ChatGPT does not support the declarative API at all** — and it does not support tools registered in iframes either. For this challenge: imperative, top-level, or it doesn't exist.

### Chrome's numbers for tool text (secure-tools guide)

description ≤ 500 chars · parameter description ≤ 150 · names ≤ 30 · single tool output ≤ 1.5K chars. Mark UGC/external data `untrustedContentHint`. Mark reads `readOnlyHint`. Expose writes only to origins you'd let act for the user.

---

## 2. How each consumer actually reaches the tools

| Consumer                                                    | Status                       | Mechanism                                                                                                                                                                                              | Notes                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **ChatGPT Desktop built-in browser** (ChatGPT Work + Codex) | **Live 2026-08-25**          | Native. "Site tools" arrow in the address bar; per-call safety review; consequential actions go through normal confirmation                                                                            | Requires **GPT-5.6 Sol or Terra** (Luna disabled); not in Enterprise/Edu; no declarative, no iframes; tools vanish when the page closes |
| **ChatGPT Sites** (`*.openai.chatgpt.site`, hosted builder) | Live                         | Same consumer; Sites can build a WebMCP site from a prompt                                                                                                                                             | D1 + R2 storage, "Sign in with ChatGPT" headers                                                                                         |
| **Chrome 149+**                                             | Origin trial (token) or flag | Gemini in Chrome "soon". Today: **Model Context Tool Inspector** extension (drives `gemini-3-flash-preview`), DevTools → Application → **WebMCP** panel (registered tools, invocation log, manual run) | The devs' test bench                                                                                                                    |
| Chrome extensions                                           | Experimental                 | `chrome.debugger` → CDP **WebMCP domain** (Chromium, Apr 2026); WebExtensions API discussion #74                                                                                                       | How MCP-B's extension relays page tools to Claude Desktop / Cursor                                                                      |
| **Cloudflare Browser Run**                                  | Preview                      | Headless Chrome 146-beta "lab" sessions; `navigator.modelContextTesting.listTools()` / `.executeTool(name, jsonString)`; reachable via `chrome-devtools-mcp` over `wss://`                             | The only headless path; the WG explicitly scoped remote automation _out_ (#21, #165)                                                    |
| Edge 150                                                    | Origin trial                 | Copilot in Edge is the intended consumer                                                                                                                                                               | UNVERIFIED that Copilot consumes today                                                                                                  |
| Brave                                                       | Experimental                 | Leo AI chat (brave-browser #55232)                                                                                                                                                                     |                                                                                                                                         |
| Claude in Chrome                                            | **No**                       | Screenshots + DOM only; claude-code #30645 closed not-planned                                                                                                                                          |                                                                                                                                         |
| Firefox / Safari                                            | None                         | Positions below                                                                                                                                                                                        |                                                                                                                                         |

---

## 3. Standards politics (this decides whether it's "the web" or "Chromium + OpenAI")

- **TAG (Sep–Nov 2025, #35)**: "too early to port any specific protocol to the platform… loudest concern is that MCP is not going to last." Group resolved to continue anyway; Anthropic moved MCP to the Linux Foundation's Agentic AI Foundation to blunt the concern.
- **WebKit — OPPOSED (2026-06-03, mwyrzykowski)**: an agent is _assistive technology_; a parallel JS tool layer "moves the brittleness from the DOM into the tool descriptions"; fix HTML/ARIA instead. Marcos Caceres (06-17): won't debate piece by piece; "a new solution before the problem has been established"; proposes **a new community group for agent-assisted user agents**. Farolino has "no objection" to moving WebMCP as-is into a WG (#192, 08-14).
- **Mozilla — neutral → interested in the imperative API only** (Jake Archibald, Martin Thomson, 2026-08-25/26): see #236 "reposition as a generic communication tool" and #237 API-shape notes; declarative variant "not a significant factor".
- Net: two engines ship it, one opposes, one is lukewarm. OpenAI's adoption is the thing that changed the market, not the W3C.

---

## 4. Timeline

| Date          | Event                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2025-08-13    | Explainer first published (Microsoft-led, `window.agent`)                                                                           |
| 2025-09 / 11  | TAG concerns; CG resolves to continue                                                                                               |
| 2026-02-10    | W3C Draft CG Report; Chrome 146 behind flag (`navigator.modelContext`)                                                              |
| 2026-02-23    | Brosset (Microsoft): "the browser is not an MCP server; it translates tools to MCP for agents"; `requestUserInteraction` introduced |
| 2026-04-20    | Chromium: `chrome.debugger` WebMCP CDP domain for extensions                                                                        |
| 2026-05-18/19 | Google I/O: Chrome 149 origin trial, nine partner sites, Lighthouse agentic audits, Gemini-in-Chrome "soon"                         |
| 2026-06-03    | WebKit opposed                                                                                                                      |
| 2026-06-09    | Chrome origin-trial blog                                                                                                            |
| 2026-06       | Edge 147 experimental                                                                                                               |
| 2026-07-21    | `document.modelContext`; `getTools()` spec'd                                                                                        |
| 2026-08-05    | Shopify default-on for all Liquid storefronts                                                                                       |
| 2026-08-06    | Cloudflare edge bridge (`/.webmcp/bridge.js`, packs: C2PA, site-MCP-server proxy)                                                   |
| 2026-08-14/17 | `executeTool()` spec'd; input becomes object; `inputSchema` becomes object                                                          |
| 2026-08-25    | **ChatGPT Desktop + Codex consume WebMCP; challenge opens; kickoff livestream 15:00 PT**                                            |
| 2026-08-26    | Spec latest; ChatGPT Desktop added to implementation-status.md                                                                      |

---

## 5. The challenge, exactly (Devpost rules, read 2026-08-28)

**Dates**: open 2026-08-25 11:00 PT · **close 2026-09-03 13:00 PT** (the OpenAI tweet said 17:00 and one community post said Sep 4 — treat 13:00 Sep 3 as the wall) · judging Sep 4–21 · winners ~Sep 23 14:00 PT.

**Eligibility**: age of majority; countries with OpenAI API access; **Quebec excluded, Ontario fine**; teams name one Representative; no employees/affiliates of sponsors or judges.

**Must submit**:

1. **Live URL** that works in the ChatGPT desktop built-in browser **or** Chrome 149+ with WebMCP enabled. Host anywhere (ChatGPT Sites, Cloudflare, Vercel, Render, Netlify, …).
2. **Text**: why WebMCP fits; how UX improves; **what humans and agents accomplish together that "was difficult or impossible before"**; implementation approach.
3. **Video** < 3 min, public YouTube, audio explaining the build and the WebMCP usage.
4. **Public repo** (GitHub/GitLab/Bitbucket) with all source, **OSS license visible in the About section**, and a demonstrable `document.modelContext.registerTool()` with name/description/inputSchema/execute.

**Pre-existing projects are allowed** if "meaningfully extended using WebMCP after 2026-08-25", with **timestamped commits** separating old from new; only the new work is judged. (Two forum threads ask whether a proprietary backend can stay private — unanswered as of today; assume the WebMCP-touching code must be public.) One entry per entrant is being clarified — assume one.

**Judging**: Stage 1 pass/fail (on theme, uses the API). Stage 2, four × 25%:

- **WebMCP Leverage** — thorough, skillful, non-trivial, working. _Tiebreak #1._
- **Execution** — a complete product experience, not a PoC. _Tiebreak #2._
- **Potential Impact** — a credible, specific problem for a real audience, actually addressed by what's shown.
- **Creativity & Ambition** — differs from existing concepts.

**Judges**: Justin Rushing (OpenAI, browser platform lead) · Sarah Drasner (Chrome) · Alex Nahas (MCP-B creator; his stated taxonomy: _read tools_ = flat always-on list, _navigation tools_ = "the system prompt of your website", _write tools_ = human-approved via elicitation; scope trust per domain with a TTL; hash tools) · Ilya Grigorik (Shopify) · Jude Gao (Vercel/Next.js) · Andrew Galloni (Cloudflare) · Sean Roberts (Netlify).

**Prizes (top 10, one prize per project)**: $3,000 + Codex Micro + ChatGPT Pro 1yr ×3 + merch + @OpenAIDevs spotlight; Cloudflare $10K credits; Vercel $3,600 + $600 gateway; Netlify $500 cash; Render $300; Shopify gear; Chrome 3-mo AI Ultra. Participant freebies: Render $50, Netlify 3,000 credits (first 1,000, closes Sep 1 12:00 PT), Cloudflare $20, Vercel code `OAIWEBMH-9E2F-MUT4`.

**OpenAI's own framing** (Provencher, DevEx): _"Codex is your customer. It's the one using the tools, not the user."_ Their four seed ideas: build/refine 3D models with an agent; a shared document where the agent comments under its own identity; a personalised crossword refined together; travel notes → itinerary with comments. Their flagship: **Codex Modeling Studio** (WASM + WebGPU, 3 tools, built on Sites; Codex screenshots the scene from angles without disturbing the user's view).

---

## 6. Prior art to NOT rebuild (the field, 2026-08-28)

Google Chrome Labs demos: Le Petit Bistro (declarative reservation), Travel flight search (React), zaMaker pizza, Mystery Doors, Maze, CineFlow tickets, Order Tracking/returns, L'Atelier hotel, WebMCP Sports (Angular), The Morning Ritual coffee reorder, UrbanEstates real-estate map, Luxe Leather, Smart Home dashboard, Page Agent (Gemini drives any WebMCP site).
Netlify: Kurio (marketplace + simulated checkout), Tagboard (guestbook, writes moderated via AI Gateway), Mabel's Table (live reservation state, negotiate alternatives), The Archive (human+agent detective mystery), Starter.
Vercel: `vercel/shop` (search, options, guest-cart read, add-to-cart; server-side re-validation; redacted results; BotID on writes) — then replaced by Hydrogen's built-in tools.
Cloudflare: coffee store; edge bridge; Browser Run.
OpenAI: Codex Modeling Studio.
Community: Air Bird booking, WebMCP Blackjack (multi-agent), Excalidraw+WebMCP, Architecture Flow Builder, Scholar Sidekick (citations), QR Code Crafter, isainative.dev / Agent Ready (site scoring), WordLift audit, webmcp-checker, WebMCP Inspector/Validator, `@webmcp-registry/kit` (tool registry + CLI), webmcp-next (API routes → tools), `agentk` (cmdk → tools), Persona chat widget.
Libraries: `@mcp-b/webmcp-polyfill`, `@mcp-b/global`, `@mcp-b/react-webmcp`, `use-webmcp-tool` (Chrome Labs), `webmcp-react`, `webmcp-kit`, Angular native, Cloudflare `agents/examples/webmcp-react`.

Saturated lanes: **storefront/cart, restaurant/hotel/flight booking, puzzle games, diagram/3D editors, site-scoring tools, "any MCP server → page tools" bridges.** A judge has seen each of these ten times by Sep 4.

---

## 7. Open problems the spec admits it hasn't solved (= where a project can be _ambitious_)

1. **Tools on sites you don't have open** — only a Service-Worker explainer; ChatGPT drops tools when the tab closes.
2. **Auth/session context for tools** (#87) — every tool re-invents it.
3. **Human-in-the-loop for non-browser clients** (#165) — Cloudflare's headless path has no first-party HITL.
4. **Real-user measurement / observability** (#186, #207) — nobody knows if agents show up or whether tools work over time.
5. **Reviewable workflow records** (#261) and **context loss when tools churn** (#262).
6. **Tool description honesty** — WebKit's core attack: "no guarantee a tool's declared intent matches its behavior"; consequential/reversible hints still unmerged (#176/#217); grammar-level injection mitigation (#239).
7. **Tool sprawl** — collections / progressive disclosure (#255), skills (#161); Chrome's 1.5K-char output budget.
8. **The long tail never ships tools** — Spronta July: "a standard with everything except users"; freeCodeCamp: "shipping a 0% adoption standard". OpenAI's consumer flips the demand side; supply outside Shopify/Cloudflare is still ≈ 0.

---

## 8. What this means for Rokan (not re-litigating the ledger; adding the new data)

**Standing verdict** (`IDEA-LEDGER` §K/§L/§N): WebMCP is Tier 0 _inventory_ — consume where it exists, compile where it doesn't; the middle (logged-in long tail: dashboards, portals, banks, utilities) never ships WebMCP. Threat window for commerce moved in to 2026 on 08-05.

**New market data as of 08-28** (this is what justifies touching it):

1. **The demand side broke first.** ChatGPT Desktop + Codex are the first mainstream consumer (08-25). The "chicken-and-egg" every July survey cited is half-resolved, on OpenAI's side, not Google's.
2. **OpenAI's frame is ours.** "Codex is your customer" = agents as primary users of the web = Arav's gateway sentence (§P addendum). OpenAI is now _marketing_ the thesis; we don't have to argue it.
3. **It is not universal.** WebKit opposed; Mozilla wants a different shape; the WG venue is unsettled. A "WebMCP-only" strategy is a Chromium+OpenAI strategy.
4. **The spec's own open list (§7) is rokan-do's feature list.** Operations compiled from pages that have no tools; a signed ledger of what ran (`op_use`); a half-life clock (`recheck`); human grants on writes; typed results with labels. WebMCP gives the head of the curve a schema; Rokan already has the schema for the tail, and the measurement WebMCP lacks.

**Therefore**: the entry should present Rokan as a **WebMCP consumer + compiler**, never as one more site that grew tools. The pieces that satisfy "WebMCP Leverage" are the ones where our app registers tools that let ChatGPT/Codex drive Rokan, and Rokan drives the web that never got tools — with the human in the loop on grants and writes, on the same page. Candidates, novelty-scored against §6, in `docs/IDEA-LEDGER.md` §S (added today). Decision is Arav's; nothing is built until he picks.

**Risks to name before picking**: (a) 6 days, a new web surface, and the rokan-do backend must be reachable from a public URL with per-user sessions — the hardest part is not WebMCP; (b) ChatGPT's consumer supports imperative top-level tools only — no iframes, no declarative — so anything clever with `exposedTo`/cross-origin composition demos only in Chrome 149, in front of an OpenAI judge; (c) the "proprietary backend private?" forum question is unanswered — plan for the WebMCP-touching code to be public and the rest of `rokan-do` is already Apache-2.0.

---

## 9. Build-facts checklist (for whoever writes the first line of code)

- Register on `DOMContentLoaded` in the top-level document; feature-detect `document.modelContext ?? navigator.modelContext`; keep the human UI fully working without it.
- `name` ≤ 30 chars in practice, `[A-Za-z0-9_.-]`; description ≤ 500; param descriptions ≤ 150; outputs ≤ 1.5K chars, structured, enough for the agent to verify the effect.
- Every read: `annotations.readOnlyHint: true`. Every result that carries third-party page text: `untrustedContentHint: true`. Writes: narrow inputs, state side effects in the description, re-validate server-side, never return secrets/URLs/ids the agent doesn't need.
- Unregister by aborting the registration `AbortSignal` when the UI state that backs the tool goes away; register per-view so the tool list mirrors what's on screen (this is what `use-webmcp-tool` does).
- Test bench: Chrome 149 + `chrome://flags/#enable-webmcp-testing` + Model Context Tool Inspector + DevTools Application → WebMCP; then the ChatGPT desktop app on Sol/Terra with the "Site tools" arrow. Chrome's `evals-cli` (`GoogleChromeLabs/webmcp-tools/evals-cli`) for ordered/unordered expected-call assertions.
- Deploy target that satisfies "live URL": Vercel/Cloudflare/Netlify for the web app; the rokan-do backend needs a public host with auth — that's the schedule risk.
- Repo: LICENSE at root **and** set in GitHub About; commits after 2026-08-25 clearly tagged; README says which browser/model to test with.
- Video < 3:00, YouTube public, narrated; show the tool list in the address bar, one read, one approved write, one thing the human did that the agent couldn't.

---

## Sources (primary, read today)

webmachinelearning.github.io/webmcp (spec 2026-08-26) · github.com/webmachinelearning/webmcp — README, `implementation-status.md`, `declarative-api-explainer.md`, `docs/service-workers.md`, issues #35 #74 #87 #161 #165 #192 #217 #227 + open-issue list, commits 07-21→08-26 · WebKit/standards-positions #670 · mozilla/standards-positions #1412 · developer.chrome.com/docs/ai/webmcp, /secure-tools, /evals, /devtools/application/webmcp, /blog/ai-webmcp-origin-trial, /blog/chrome-at-io26 · learn.chatgpt.com/docs/webmcp, /docs/sites, /docs/changelog · webmcp.devpost.com (overview, rules, resources, forum, gallery) · developers.openai.com/showcase/codex-modeling-studio · blog.cloudflare.com/webmcp · developers.cloudflare.com/browser-run/features/webmcp · shopify.dev/docs/api/web-mcp · github.com/vercel/shop/pull/498 · github.com/GoogleChromeLabs/webmcp-tools, /use-webmcp-tool · github.com/webfuse-com/awesome-webmcp · netlify.com/blog/compete-openai-webmcp-challenge · webmcpchallenge.netlify.app · webmcp-challenge.examples.workers.dev · arcade.dev Alex Nahas interview · patrickbrosset.com 2026-02-23 · spronta.com State of WebMCP July 2026 · searchenginejournal.com ChatGPT WebMCP · anthropics/claude-code #30645.

---

## 10. Addendum — ecosystem facts verified 2026-08-28 evening

- **Atlas is dead; that is why OpenAI wants supply.** ChatGPT Atlas was discontinued 2026-08-09 (announced Jul 9; help.openai.com "Evolving Atlas into ChatGPT for browser-based agentic work"); agentic browsing moved into the ChatGPT desktop app's built-in browser, Codex, and a Chrome extension. Site tools shipped in that successor on 08-25. OpenAI no longer ships a browser — it is buying the demand side of a Google/Microsoft spec.
- **Office hours 2026-08-31 11:00 PT** (Netlify + Render pages). Kickoff livestream was 08-25 15:00 PT.
- **Microsoft co-authors the spec and is not a sponsor.** Edge origin trial ends **2026-11-17**. Chrome trial 149–156; M156 stable ≈ Oct 2026 — the Chrome trial lapses ~Nov unless extended/shipped.
- **W3C TAG review #1238** (opened 06-11): open, labelled **"Missing: Multi-stakeholder support"**, all focus areas pending, assignees incl. Marcos Caceres (Apple). Combined with WebKit's oppose: one engine family behind it.
- **Security paper**: arXiv **2606.06387** "WebMCP Tool Surface Poisoning: Runtime Manipulation Attacks on LLM Agents" (Lee, Chang, Yu, Yeh, Jun 2026) — *Mid-Session Tool Injection* via third-party scripts: **Tool Hijacking** (AbortSignal abuse, registration races) and **Tool Framing** (poisoned `name`/`description`/`readOnlyHint`/`inputSchema`); both demonstrated. Recommends origin-bound tool identity, lifecycle consistency, data boundaries for third-party tools, **traceable logs of registration and invocation** — i.e. a ledger. Cite this in the write-up; it is the academic version of `op_use`.
- **Directory**: webmcp.com (nekuda) lists **365** sites — self-registration + scanner, so a floor, not a census; most "live" entries are Shopify defaults (Alo Yoga, Away, Reebok, 10 tools each). Also webmcp-registry.dev (DNS-TXT verification + lookup API), webmcp-checker.com. **No published crawl of `document.modelContext` in the wild exists** — nobody has measured whether declared tools work when invoked. (That measurement is a Door-Index-shaped artefact we could publish.)
- **Benchmark**: nekuda's **WindTunnel** — 49 tasks × 8 *self-hosted OSS apps* (medusa store, hi-events, easyappointments, learnhouse, idurar ERP, a directory, two read-only controls) × 16 model/interface configs, 2,352 attempts. Claims WebMCP 98% success, 6.8 s median vs 29.3 s, $0.009 vs $0.210/task, 12.5× fewer tokens. **Vendor benchmark, lab apps, not the live web** — quote only with that caveat; it is the number the field will wave around.
- **npm (weekly, 08-28)**: `@mcp-b/webmcp-types` ~53K, `@mcp-b/webmcp-polyfill` ~47K, `webmcp-types` (Chrome DevRel) ~16K, `@mcp-b/react-webmcp` ~7K. No `@vercel/`, `@netlify/`, `@cloudflare/`, `@shopify/`, `@stripe/` WebMCP packages exist. Angular has native experimental support; Kendo React and SlickGrid ship WebMCP bindings; Huawei (`opentiny/webmcp-sdk`) and Alibaba (`webmcp-nexus`) ship SDKs.
- **HN**: the challenge thread (item 49455713) is small; the Feb early-preview thread (47211249, ~360 pts) is the ARIA-vs-tools argument plus "land grab". Simon Willison's pro line: "an incredible accessibility technology disguised as an AI thing." Specific quotes from the challenge thread are agent-reported and UNVERIFIED (HN rate-limited today).
- **Open fight that matters to us**: whether **non-browser-vendor agents** may enumerate/invoke page tools — Mozilla's WebExtension + WebDriver-BiDi ask; issues #74/#188, PR #179 (UNVERIFIED numbers for the last two). Today the consumers are Chrome's built-in agent ("soon"), Edge (unverified), Brave Leo, OpenAI's browser, and Cloudflare's headless lab. Third-party agents = extension relay (MCP-B) or CDP.

---

## 11. Addendum — identity, and the surface Rokan should consume through (verified 2026-08-28 night)

- **A tool receives its input and an AbortSignal. Nothing else.** `ToolExecuteCallbackOptions { required AbortSignal signal }` is the whole IDL. `callerOrigin` exists internally only to gate `exposedTo` and is dropped before `execute` runs (#191, open, 1 comment). TPAC 2025 resolution, verbatim on #54: *"revisit [this] issue (likely in a different proposal) if there is a need for browser mediated interactions between browser agents and in-site agents — no clear need to address this in WebMCP atm."* #105 "Agent Identity Verification and Authorization Framework" (Feb 2026) is open, 5 comments, unanswered on the structural point: everything is client-side, so any agent label is forgeable by forking the browser.
- **Consequence for Rokan**: a WebMCP site cannot tell Rokan from Gemini from a forked Chromium. Exposure is gated by *origin* and *Permissions-Policy*, never by agent identity. No privileged lane exists for anyone; no one can lock us out of one either. Differentiation cannot come from "being a recognised agent". (IETF `webbotauth` has adopted zero drafts; the only party composing bot-auth + WebMCP into a stack is Cloudflare, at the edge.)
- **The Chromium CDP `WebMCP` domain is the cleanest third-party consumption surface** (chromedevtools.github.io/devtools-protocol/tot/WebMCP): `WebMCP.enable` → `toolsAdded[]` (each `Tool` = `name, description, inputSchema, annotations, frameId, backendNodeId, stackTrace`) → `WebMCP.invokeTool(frameId, toolName, input)` → `toolInvoked` / `toolResponded {status: Completed|Canceled|Error, output}` → `cancelInvocation`. Annotation flags carried: `readOnly, untrustedContent, consequential, autosubmit` — two of which the published IDL still lacks. Since `rokan-do` already drives Chromium over CDP, **Tier 0 consumption is this domain, not a content script**: enumerate tools on arrival, prefer them when `readOnly`, gate `consequential` behind the grant layer, log every `toolResponded` into `op_use`. This also gives per-frame provenance (`stackTrace`) that a content script never sees — useful against the MSTI paper's tool-framing attack.
