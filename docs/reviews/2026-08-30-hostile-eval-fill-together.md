# Hostile evaluation — 'Fill Together' + alternates (Opus 5, 2026-08-30 ~14:00 PT)

# HOSTILE EVAL — "Fill Together" + two alternates

*Complete report, self-contained. All corrections from my earlier partial sends are folded in place. Everything marked **[measured]** I ran on this machine.*

**Verdict up front: do not build Candidate A as specified.** Its tool surface was shipped as a public WebMCP demo on 2026-05-02 by SimplePDF and is listed in the canonical WebMCP site directory; its core mechanic was shipped three days ago by a rival in this hackathon; its reuse claim was shipped two days ago by another. Feasibility is *fine* (I initially overstated a blocker and correct that in §2). But feasibility was never what kills it. Panel mean ≈ **5.9**, below Rokan as-is. Top-10 ≈ **10–13%**, #1 ≈ **1–2%**.

---

## §1 — Prior art, named and dated

### 1a. The kill shot: this exact tool surface is already a public WebMCP demo

**[SimplePDF WebMCP](https://webmcp.com/sites/ai.simplepdf.com)** — listed in the public **webmcp.com** directory, the first place any of these seven judges would look. Show HN **2026-05-02**, 60 points ([HN 47984675](https://news.ycombinator.com/item?id=47984675)); the demo URL is literally `copilot.simplepdf.com/?...&form=w9`. Declared tools, verbatim from the directory:

- `load_document` — "Load a document into the editor from a base64 data URL."
- `get_fields` — "List every fillable field in the loaded document, **including native dropdown and radio AcroFields**."
- `detect_fields` — "Automatically detect fillable fields in the loaded document and add them as editable fields."
- `set_field_value` — "Set the value of an existing field addressed by its id, or clear it with null."
- `focus_field` — "Scroll an existing field into view and focus it, addressed by its id."
- `get_document_content` — "Extract the document's text content page by page" (optional OCR).
- plus `delete_fields`, `select_tool`, `go_to`, `submit`.

**Fully client-side.** Shipped as a product: [SimplePDF Copilot](https://www.simplepdf.eu/copilot) — *"you describe what you need in your language, and the AI finds the right fields and fills them in."*

Your proposed `list_fields / describe_field / set_field / export_pdf` maps 1:1 onto `get_fields / focus_field / set_field_value / submit`.

The HN thread also contains, verbatim, the two critiques your judges will make:
- *"It looks cool but, how is this different from me uploading to chatgpt and asking it to fill in?"*
- *"In the chat box I typed my SSN is '123-45-6789'. It filled it in in the wrong box (4 Exemptions). What problem is this solving? Isn't it easy enough to just click in the correct box and type the values?"*

### 1b. Three in-window rivals already own your other three claimed novelties

All verified live via the GitHub API.

| Repo | Created | Stars | What it takes from you |
|---|---|---|---|
| [pauloportella/auto-webmcp-chrome](https://github.com/pauloportella/auto-webmcp-chrome) | 2026-08-27 | **15 — the highest-starred in-window repo I found** | "Turn standard web forms into structured WebMCP tools." Builds JSON Schema from native controls, labels, ARIA text, choices and **validation constraints**; demo GIF captioned *"agent fills 27 fields in one call"*; local-only, never submits, *"final submission remains under the user's control."* → **fields→schema, batch fill, human commits** |
| [Markcial/ventanilla](https://github.com/Markcial/ventanilla) | 2026-08-27 | 0, live on GH Pages | "Spanish freelance paperwork, prepared by your agent and decided by you." Its README argues your architecture thesis better than you would: records in *your browser* vs their servers · *you* sign vs they sign · **"What you see: the document itself"** vs "what the agent reports" · *"There is no backend to host, so there is nothing to charge for."* → **client-side, no server, show the artifact not a summary** |
| [mikelninh/public-service-passport](https://github.com/mikelninh/public-service-passport) | 2026-08-28 | 0, live on Netlify | **"Tell public services once. Reuse it safely."** Enter facts once → preserve provenance → reuse with permission → prepare safely → human approval. Reusable local passport, reviewable application packet, local export only, 100-case authority pilot. → **`save_profile` → `my_details` reuse across forms — your single best differentiator** |

Also in-window and adjacent:
- [Tactic-Systems/leafwright-paperdesk](https://github.com/Tactic-Systems/leafwright-paperdesk) (08-26) — *"Documents that fix themselves — a human+agent PDF workbench built on WebMCP… the one approval only a human can give."*
- [10xdev4u-alt/lattice](https://github.com/10xdev4u-alt/lattice) (08-28) — 14 typed tools over PDFs; *"The page IS the audit log."*
- [calgulbenkian/form-fuzzer](https://github.com/calgulbenkian/form-fuzzer) (08-26) — *"your agent perturbs a sandboxed fork of a bureaucratic application to find trap answers before you submit."* (Adjacent, not identical — it's a fuzzer, not a filler.)
- [harshpuri84/ladder-webmcp](https://github.com/harshpuri84/ladder-webmcp) (08-26) — *"Pull requests for agent actions… an agent proposes a change, a human sees its real blast radius, cuts it down, and only that lands."*

### 1c. "Forms" is the WebMCP hello world

WebMCP's **declarative API** exists specifically to turn an HTML `<form>` into a tool via `toolname`/`tooldescription` attributes; the canonical framing is literally ["Make Any HTML Form AI-Callable in 3 Minutes (No JavaScript Required)"](https://www.openhermit.com/blog/webmcp-declarative-api-html-toolname-2026). Every judge has read this. ChatGPT [doesn't support the declarative path](https://learn.chatgpt.com/docs/webmcp) — but that's an implementation detail invisible in a 3-minute video.

### 1d. The wider commercial field (~60 products checked, four buckets, none leaving the gap you think)

- **Modality remap** — the disabled user still composes every value: Apple Voice Control (+ Apple-Intelligence targeting, May 2026), Android/Windows Voice Access, Dragon, switch scanning, Tobii, [Voiceitt2](https://www.prnewswire.com/news-releases/voiceitt2-launched-first-of-its-kind-stand-alone-voice-application-for-people-with-speech-disabilities-now-available-to-customers-301901592.html) (Aug 2023), TypelessForm/AnveVoice.
- **Vendor cloud fillers** — [Instafill.ai](https://instafill.ai/) (has dedicated **I-130 and ODSP** landing pages), pdfFiller AI, AutoFillPDF, [Casium](https://casium.com/) ($5M seed Oct 2025, USCIS drafts + attorney review), Boundless, Mayflower (YC F2025). Liability precedent the panel may know: **[FTC final order against DoNotPay, 2025-01-16](https://www.ftc.gov/news-events/news/press-releases/2025/02/ftc-finalizes-order-donotpay-which-claimed-its-ai-service-was-worlds-first-robot-lawyer)**, $193k, for untested AI legal-paperwork claims.
- **Generalist browser/desktop agents** — gate per *action* or per *submit*, never per field: Gemini in Chrome auto browse (Jan 2026 — *"can fill in forms for you… with information from a PDF"*), "Find and Fill with Gemini" (Canary, Jul 2026), Claude in Chrome, rtrvr.ai, and **[Lapu AI](https://www.producthunt.com/products/lapuai)** (2026-07-23 — local-only, per-field diff preview with sources, permission-gated submit, audit trail; the closest non-web analogue to A).
- **Nearest shipping per-field approval** — [Microsoft Power Apps Copilot form-fill assistance](https://www.microsoft.com/en-us/power-platform/blog/power-apps/copilot-assistance-for-filling-forms-all-model-driven-apps/) (2024, per-field suggest-and-accept, cloud CRM) and [1Password Secure Agentic Autofill](https://1password.com/press/2025/oct/browserbase-ai-security-partnership) (2025-10-08, human approves *every* injection — credentials only).
- **Notably absent, contrary to the brief's assumption:** Adobe Acrobat AI Assistant does **not** fill AcroForm fields (Adobe's auto-fill is the non-AI Auto-Complete). Docusign's Feb 2026 "AI-Assisted Field Suggestions" *places* fields sender-side; nothing auto-fills the signer's values. Fillout / Formstack / Tally / Typeform Formless / Jotform are form **builders** or interviewers — the human still composes every answer.

### 1e. Benefits / intake / document lanes (for §5)

- **[Benefits Data Trust wound down Aug 2024](https://whyy.org/articles/philadelphia-benefits-data-trust-closure-employees-laid-off/)** — 273 staff laid off, $10B in benefits delivered since 2005. The sector's flagship is dead.
- **Deterministic benefits rules are already open source**: [PolicyEngine](https://www.policyengine.org/us/research/myfriendben-nc) + [MyFriendBen](https://github.com/Gary-Community-Ventures/benefits-api) (Django rules engine, 40+ benefits, live in CO and NC). Plus Prosper Canada's Benefits Wayfinder, Canada's Benefits Finder, AccessNYC, GetCalFresh, mRelief, findhelp.
- **Clinic intake is a mature B2B market**: Phreesia (+[VoiceAI, Sept 2025](https://www.phreesia.com/news/phreesia-launches-voiceai-a-conversational-ai-solution-to-transform-call-management-in-healthcare/)), Luma Health, Notable, Epic MyChart pre-check-in, athenahealth, Clearwave, Yosi; the 2026 market [already splits into four named lanes](https://getperspective.ai/blog/ai-patient-intake-software-2026-9-platforms-compared-by-workflow) with Perspective AI owning conversational intake. E-consent: Medidata Rave eConsent, Castor, REDCap.
- **In-window WebMCP consent/intake**: `solahai/referralarc` (*"capability-lifetime consent for the administrative handoff after a clinician orders care"*), `nexora-assistant/consentos-webmcp`, plus 7 consent repos.
- **Appeals**: [Fight Health Insurance](https://sfstandard.com/2024/08/23/holden-karau-fight-health-insurance-appeal-claims-denials/) (Holden Karau, Aug 2024, free, open source) → [Fight Paperwork](https://sfstandard.com/2025/06/30/fight-paperwork-health-insurance-ai-tool/) (2025).

### 1f. Field shape

**4,228 participants** (confirmed on Devpost — not ~3,000). **766 public repos** created in the 10-day window match `webmcp`; assume 400–700 real submissions against 10 prizes. **The Devpost project gallery is not yet published** — GitHub is your only window. Deadline **Sep 3, 1:00 pm PDT** (Devpost is authoritative). Theme counts inside the window: approval 22 · audit 17 · **accessibility 17** · document 15 · form 9 · consent 7 · pdf 2 · **terminal 0 · shell 0 · runtime tool creation 0**.

### 1g. What is genuinely uncovered

Exactly one conjunction, thinner than the pitch implies: *per-field human commitment* + *client-side page-declared tools* + *proposed-vs-approved ledger* + *an approval act cheap enough for someone with limited motor control*. SimplePDF has three of four minus approval semantics. **Any novelty claim must name SimplePDF explicitly and distinguish on approval granularity** — not on "we do WebMCP for PDFs." If you don't name it, a judge will, and the honesty story goes with it.

---

## §2 — Feasibility, measured

### 2a. PDF: I initially overstated the blocker — correcting

I first reported that 6 of 8 real government forms "cannot be opened." That is true of **stock pdf-lib** — the library the plan names — and false as a statement about feasibility.

**Stock pdf-lib 1.17.1** (last release **2021-11-06**, unmaintained, 276 open issues; README: *"pdf-lib does not currently support encrypted documents"*): **[measured]**

```
i-765  load()                        → Error: Input document ... is encrypted
i-765  load({ignoreEncryption:true}) → loads a corrupt graph, returns 0 fields
```

Every LiveCycle-produced government form is encrypted (Standard `/V 4 /R 4`, 128-bit, empty user password). Stock pdf-lib returns **0 fields** on all of them, with or without `ignoreEncryption`.

**`@cantoo/pdf-lib@2.9.1`** (published **2026-08-18**, maintained, drop-in: same `load/getForm/save` API) with `{ password: '' }` opens **every one**: **[measured, by me, on the same files]**

```
t2201-fill-23e.pdf (CRA Disability Tax Credit)  16pp  296 fields  529ms  write+save OK
on_00646e.pdf (Ontario Special Necessities)      4pp  129 fields  195ms  write+save OK
i-765.pdf (USCIS EAD)                            7pp  161 fields  149ms  write+save OK
i-90.pdf (USCIS Green Card replacement)          7pp  195 fields  179ms  write+save OK
VBA-21-526EZ-ARE.pdf (VA disability claim)      15pp  345 fields  282ms  write+save OK
on_0983e.pdf (ODSP/OW main application)          1pp    0 fields  — DEAD
ab_DS2444A/B (Alberta AISH)                      1pp    0 fields  — DEAD
```

**pdf.js 6.3.289** (2026-08-29, Apache-2.0, zero deps) also does the whole job alone — no password argument needed — via `annotationStorage.setValue(annotation.id, {value})` + `saveDocument()`, at 18–160 ms, verified round-trip by two independent parsers. Bundle: 128 KB gzip main + 364 KB gzip lazy worker.

**So the correct statement is: this is a one-line import change plus one option, ~1 hour, not a day of crypto plumbing.** Parsing is a non-issue (a 15-page/345-field form round-trips in 270 ms and ~7 MB); budget time on rendering.

### 2b. What is permanently impossible

**Ontario ODSP's main application (006-0983E) and Alberta AISH (DS2444A/B) are *dynamic* XFA** — `/NeedsRendering: true`, zero widget annotations, one placeholder page. **No browser library will ever fill them**; Alberta pushes applicants to an online portal instead. **[measured]** If the pitch is "disability benefits forms," those named targets are out of reach and you must triage on `/NeedsRendering === true` loudly. (The XFA scare is otherwise a false alarm: 10 of 11 US forms carry an `/XFA` packet but all are *static* XFA with a complete AcroForm layer underneath.)

### 2c. The form corpus, verified by downloading and parsing bytes **[measured]**

| Form | KB | Pages | Encrypted | Fields | Field-name quality |
|---|---|---|---|---|---|
| **USCIS I-9** | 512 | 4 | no | **128** | **human-readable** — `"Last Name (Family Name)"` |
| IRS 1040 | 215 | 2 | no | 199 | opaque |
| IRS W-9 | 138 | 6 | no | 23 | opaque — `f1_06[0]`, **no `/TU` tooltips at all** |
| VA 21-526EZ | 1,882 | 15 | no | 345 | semantic — `Veterans_Service_Number_If_Applicable[0]` |
| USCIS I-765 | 456 | 7 | **yes** | 161 | semantic + rich tooltips (`"Part 2. Information About You…"`) |
| USCIS I-130 | 713 | 12 | **yes** | 450 | semantic |
| SSA-16 / 827 / 1696 | 64–170 | 2–7 | **yes** | 156 / 26 / 91 | semantic |
| CRA T2201 | 735 | 16 | **yes** | 296 | mixed |
| Ontario ON00646E | — | 4 | **yes** | 129 | **good** — `applicantInfo[0].lastName[0]` |

Producers: Adobe LiveCycle `Designer 6.2–6.5` on all except **I-9 = `Acrobat Distiller 23.0`, the only true native AcroForm**.

**Your demo form is USCIS I-9.** Only non-XFA, non-encrypted form in the set; 128 fields; human-readable names; 5 dropdowns × 59 states; zero fill errors, flatten works, round-trip clean. Label quality is what determines whether the agent can use the tools at all, and nothing else comes close.

### 2d. Five landmines that hit Candidate A specifically **[measured]**

1. **`required` does not exist in the data.** The `Required` and `ReadOnly` flags were **0 across all 11 forms** — that logic lives in the XFA layer you discard. A's "deterministic core: field types / **required** / format / date validation" is therefore partly un-sourceable; you would hand-author required-ness per form. That collapses "drop any PDF" into "N hand-curated forms" a second time, and inventing it quietly is exactly what this panel punishes.
2. **`setText()` throws on maxLength overflow — it does not truncate.** On VA 21-526EZ, **120 of 292** text fields have `maxLength < 8`; a naive fill loop lost 41% of fields. Clamp from `getMaxLength()`.
3. **The WinAnsi crash is deferred to export.** Standard fonts are Latin-1 only; `setText('张伟')` succeeds and then `save()` throws `WinAnsi cannot encode`. **On immigration and disability forms, non-Latin names are the norm** — your most sympathetic user is the one whose export crashes minutes after everything looked fine. Embed a Unicode TTF via fontkit, or sanitize. Decide before you build.
4. **Don't `form.flatten()`.** One `PDFSignature` with no `/AP /N` aborts the entire flatten (VA 21-526EZ has 3), and `removeField()` on it also throws. Saving unflattened worked on every form.
5. **Don't split field names on `.`** — I-9 has real fields named `"List A.  Document 2. Expiration Date (if any)"`. And pdf.js's `alternativeText` is your best label source when names are opaque.

*(One thing untested: Acrobat fidelity. pdf-lib deletes `/XFA` on save, forcing Acrobat onto the AcroForm layer — safe. pdf.js preserves XFA and syncs *most* fields into the `datasets` packet but emits "Node not found" warnings for some — those may render blank in real Acrobat. Test on a real Acrobat install before claiming "works everywhere.")*

### 2e. WebMCP runtime — documented facts, with two corrections to the brief's assumptions

**The API name in your repo is dead.** Diffing Blink's `model_context_supplement.idl` across release branches:

| Chrome | `navigator.modelContext` | `document.modelContext` |
|---|---|---|
| 149 | ✅ only | ❌ |
| 150–151 | ✅ (alias) | ✅ |
| **152+** | **❌ removed** | ✅ only |

**Chrome stable is 153.0.8010.12.** `navigator.modelContext` exists on no current Chrome, and the word `navigator` appears nowhere in OpenAI's docs. Your CLAUDE.md pins **Chrome 149** — three releases stale. This is a silent zero on every judge's machine. Also: `registerTool` was sync/`undefined` in 149 and returns `Promise<undefined>` from 152+; and `navigator.modelContextTesting` (the 149–151 harness) was **deleted in 152**.

**Removed API surface:** `provideContext()` / `clearContext()` removed **2026-03-05** (#132); `unregisterTool()` removed **2026-03-27** (#156) — unregistration is now an `AbortSignal` in `ModelContextRegisterToolOptions`. Chrome's guide says flatly: *"Do not use `unregisterTool`."*

**Character budgets ARE documented** — I was wrong to call them folklore. [developer.chrome.com/docs/ai/webmcp/secure-tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools), heading **"Set character budgets"**: *"To avoid running into agent guardrails… 500 characters per tool description · 150 characters per parameter description · 30 characters per tool name and parameter name · **1.5K character limit per individual tool output**."* Cite them as **Chrome recommendations**, never as enforced caps.

**Tool count: no maximum, confirmed verbatim** — [Chrome best-practices](https://developer.chrome.com/docs/ai/webmcp/best-practices): *"While there isn't a maximum number of tools allowed, each tool takes up part of the context window and adds to the time for completion."* Nearest real citation for a soft cap is OpenAI's function-calling guide: *"Aim for fewer than 20 functions available at the start of a turn."* **Your ≤12 rule is your discipline, not a platform limit — don't present it as one.** (In-window rival ArchMorph ships 40.) Spec-normative: tool `name` is 1–128 chars, ASCII alphanumeric plus `_ - .`.

**Annotations — WebMCP has exactly two:** `readOnlyHint` and `untrustedContentHint`. `destructiveHint` / `idempotentHint` / `openWorldHint` are **MCP-only and inert in WebMCP**. `consequentialHint` exists in Chromium *main* only — absent from branches 7977 (152) and 8010 (153); spec issue [#217](https://github.com/webmachinelearning/webmcp/issues/217) still open. **So A cannot mark `set_field` "consequential" today** — that is a page-side convention, not a platform signal, and must be described as such. The good half: **`untrustedContentHint: true` is the exact, first-party answer** to PDF-sourced tooltip text flowing into tool descriptions.

**`toolchange` is spec-blessed for precisely the forge case.** The spec README documents it firing *"When tools are added, removed, or updated dynamically (**such as when user interactions result in new tools being registered**)"*, with a Chromium web test at `fast/webmcp/toolchange.html` and a dedicated WebMCP CDP domain. **Whether ChatGPT desktop re-discovers on `toolchange` without a reload is undocumented** — one hour of hand-testing, and it gates the forge and your hero shot.

**ChatGPT's surface** ([learn.chatgpt.com/docs/webmcp](https://learn.chatgpt.com/docs/webmcp)): "Site tools" in the address bar → "Available site tools". *"Tools belong to the page that provides them."* **Per-invocation safety review**: *"each tool invocation receives a safety review before it runs. Normal website-access and confirmation policies still apply, including for consequential actions."* *"Website-provided tool definitions and results are untrusted content."* Requires **GPT-5.6 Sol or Terra** (Luna disabled; unavailable in Enterprise/Edu). **Declarative-API tools and iframe tools are both explicitly unsupported** — validating your PLAN §0.

**Batching settles the 31-field question:** 31 `set_field` calls = 31 safety reviews; one `propose_values([...])` = one. So **your "per-field human approval" is really per-batch approval** — a visible contradiction between the safety claim and the accessibility claim. Name it, or a judge will. (Note: the specific "batch because each call costs a confirmation" argument is documented by nobody — present it as your reasoning, supported by OpenAI's "combine functions always called in sequence" and Anthropic's consolidation guidance.)

**Tooling:** the native **DevTools → Application → WebMCP pane** (available tools as the agent sees them, per-tool invocation counter, manual invocation, input/output inspection) supersedes the "Model Context Tool Inspector" extension named in your CLAUDE.md. Origin trial runs M149–M156, shipping target M157.

**Accessibility — the spec community has explicitly declined the framing.** [webmcp issue #91, *"Redundancy with the accessibility tree"*](https://github.com/webmachinelearning/webmcp/issues/91), opened 2026-02-15, **closed NOT_PLANNED 2026-08-17**, 29 comments. Chrome's `victorhuangwq`: *"if we overload accessibility features for agents, we risk creating an incentive for developers to optimize for machine efficiency over human usability."* Spec editor `domfarolino`: *"WebMCP tools are designed for no human involvement."* The **only** defensible claim is Léonie Watson's conditional one (2026-06-30): the *indirect* model, where an agent calls `filter-templates({...})` and updates the page, *"collapses it down to a single natural language utterance… but it has to flow through agents not through the screen reader directly."*

**Attribution correction:** there is **no public Sarah Drasner statement tying WebMCP to accessibility.** The Chrome Labs explainer *"WebMCP — Give agents tools, not DOM"* is **unbylined**; her name appears in it only as sample data in a `bookSlot` payload. The accessibility line the brief attributes to her org comes from Chrome's [agent-ready toolkit post](https://developer.chrome.com/blog/agent-ready-toolkit) (Kulikowski & Hablich, 2026-06-22). Misattributing it in copy is an own goal.

---

## §3 — Devil's advocate: Candidate A

**## What already exists**
SimplePDF's WebMCP demo (2026-05-02) declares `get_fields`/`set_field_value`/`focus_field`/`submit` client-side and is listed in the public WebMCP directory. `auto-webmcp-chrome` (08-27, 15★) builds a JSON-Schema tool from a form's labels/ARIA/validation constraints and fills 27 fields in one call with the human controlling submit. `public-service-passport` (08-28) does "tell it once, reuse it safely" with provenance for government benefits. `ventanilla` (08-27) does client-side, no-server, show-the-document-not-a-summary bureaucratic paperwork. Power Apps Copilot does per-field suggest-and-accept; 1Password does per-item human approval; Lapu AI does local-only per-field diff preview with sources and an audit trail. And the declarative WebMCP API's canonical demo is a form.

**## Why those aren't enough**
Honestly: they mostly *are* enough. The only defensible residue is that no one combines (i) page-declared client-side tools over a document the visitor brought, with (ii) an approval gate whose unit is smaller than the whole form, (iii) a proposed-vs-approved ledger, and (iv) an approval act cheap enough for someone with limited motor control. That is a fourth-decimal-place differentiator, not a category.

**## Proposed idea (one sentence)**
A page that turns a fillable PDF the visitor drops into it into a small set of typed WebMCP tools their own agent can call, where every value the agent proposes waits for the human's single keystroke and nothing ever leaves the browser.

**## Novelty score: 3/10.** One reason: the tool surface, the client-side architecture, and the reuse-across-forms claim each already exist by name — and two of the three shipped *inside this hackathon's window*.

**## Three ways this fails**

1. **Critical assumption** — "the agent knows the values." The page cannot verify the provenance of anything the agent proposes; the person told the *agent*, not the page. On a form with an SSN, a service number and a date of onset, a hallucinated value the human rubber-stamps is the failure mode — and it is precisely what the FTC sanctioned DoNotPay for. Your defence must be deterministic and visible (format validators, refusal on ambiguity, identity fields never agent-proposed). That is buildable and is your best remaining story, but it is a *smaller* product than the pitch — and §2d.1 shows the `required` half of it isn't even in the data.
2. **Market** — the audience is real (forms are universally hated) but nobody *chooses* a form-filling tool; they use whatever the agency's PDF opens in. Impact is scored "based on what's demonstrated," and what you can demonstrate in 2.5 days is one hand-checked form with no named non-builder who used it. That is exactly the finalist-not-winner pattern from the Build Week calibration set.
3. **Execution** — "47 fields become 47 tools" cannot ship (you get ~8 tools over 128–345 fields), so the headline sentence must be rewritten under deadline; batching converts per-field approval into per-batch approval; the WinAnsi export crash hits the immigration audience hardest; and the video, public repo and ChatGPT-desktop hour are all still at zero.

---

## §4 — Per judge, theme fit, probabilities, the two sentences

Scores are **WebMCP Leverage / Execution / Impact / Creativity**, as that judge would fill the form after ~6 minutes on Devpost and ~3 minutes in a client.

| Judge | Ten-second filing sentence | Scores | Mean | Exact "no" trigger |
|---|---|---|---|---|
| **Justin Rushing** — OpenAI, Browser Platform Lead | *"A client-side PDF form filler with site tools. SimplePDF shipped this in May and it's in the directory."* | 6/7/6/**3** | **5.5** | He opens `webmcp.com/sites/ai.simplepdf.com` — the canonical list of WebMCP sites — and finds your tool names. Secondary: your description says fields become tools and the Site-tools list shows eight. The organizer's one explicit don't is *"fake or overstate what's actually running."* |
| **Sarah Drasner** — Chrome, Distinguished Engineer | *"The accessible one. DOM-native, live region, keyboard approval — done properly. But it's the declarative API's hello world, done imperatively."* | 6/8/7/**4** | **6.25** | The a11y claim with zero disabled testers, in a lane of 17 entries, one of which ([A11yMCP](https://a11ymcp.vercel.app)) ships an **external real-agent transcript** and a WebMCP-vs-actuation eval harness whose numbers come from real runs. And issue #91 closed NOT_PLANNED means the CG has formally declined "WebMCP is an accessibility win" — you must argue Watson's narrow indirect model instead. |
| **Ilya Grigorik** — Shopify, Distinguished Engineer | *"Finally, a bounded typed contract instead of a shell. But the verbs are `set_field`."* | 7/7/6/**4** | **6.0** | He argued for domain verbs (`search_products`, `add_to_cart`), not CRUD over the document model. `set_field(name, value)` is `querySelector().value =` with a schema attached. He scores Leverage as competent and moves on. |
| **Alex Nahas** — MCP-B | *"Client-side, explicit tools, writes behind a human. Textbook — which also means not new."* | 7/8/6/**4** | **6.25** | He asks where the tool descriptions come from. **They come from `/TU` tooltips inside a PDF the visitor was handed by a third party** — attacker-controllable text flowing into tool descriptions and results. Prompt injection via an uploaded document is his wiki's home turf. (Answer with `untrustedContentHint: true` plus your existing `redact.ts` — a genuine reuse win.) |
| **Andrew Galloni** — Cloudflare, VP Research | *"No servers at all. Nothing to disintermediate. Clean and small."* | 6/7/6/**4** | **5.75** | Nothing triggers a no; nothing gives him a reason to argue *for* it either. His lane pays for depth into Cloudflare primitives and a static page uses none. |
| **Jude Gao** — Vercel, Next.js core | *"Clean Next 15, client-only. No server-side re-validation, because there's no server."* | 6/7/5/**4** | **5.5** | His published bar is re-validate args server-side with bounded results — the same critique the terminal drew, unchanged by the pivot. |
| **Sean Roberts** — Netlify, VP Applied AI | *"A static page that just opens. Good hygiene. Narrow."* | 6/7/6/**4** | **5.75** | Nothing to trigger, nothing to champion. |

**Panel mean ≈ 5.9.** Creativity is 3–4 with all seven, and Creativity's own text is *"does the project differ from existing concepts."* Worse: you are trading away the **tie-break criterion** — WebMCP Leverage, where the forge (**0 hits across 766 in-window repos**) is your only unclaimed asset — for a lane with a public incumbent.

**Theme fit on the three verbs:**
- *interact* — **8/10.** Agent proposes, human decides, both look at the same fields. Clean.
- *collaborate* — **6/10.** The division of labour is genuine (agent supplies structure, human supplies judgment), but it's one human and one agent.
- *create together* — **4/10.** The artifact is a *pre-existing government form*, filled in. That is data entry, not creation. MCPencil's Pictionary meets this verb more literally with 5% of the engineering.

**Overall theme fit ≈ 6/10** — better than the terminal's 3/10 on the open-web sentence, materially weaker on "create together."

**Probabilities.** Base rate: 10 prizes / ~500 real submissions = 2%. Candidate A with a live URL, video, public repo and strong execution: **10–13% top-10**, **1–2% #1**. (Raised from my initial 8–12% after the feasibility correction in §2a.) I am also marking down your standing baseline: with 4,228 participants, 766 repos, and a field including A11yMCP, HelpRelay (dependency-free, live, deterministic policy layer), ladder-webmcp, Cardea and Skulora, **Rokan as-is is 15–20%, not the 20–24% in your prior doc.**

**What breaks in 2.5 days:** (1) the "fields become tools" sentence has to be rewritten, and if it isn't, it's a fabricated claim of the same class as the "words spoken: 9" counter your last eval killed; (2) batching makes approval per-batch, putting the safety story in tension with the accessibility story; (3) `required` isn't in the data, so any required-field indicator is invented; (4) the WinAnsi export crash hits non-Latin names — the immigration audience — and only at export; (5) PDF-sourced text needs `untrustedContentHint` + redaction before Nahas reads it; (6) video, public repo and ChatGPT-desktop hour remain at zero, and two of those are Stage-1 pass/fail.

**The honest first sentence I would ship:**

> Drop a USCIS I-9 into a page that never uploads it: your own agent gets eight typed tools over its 128 fields, proposes values only from what you told it, refuses the ones it can't validate, and every proposal waits for one keystroke from you — with a ledger of what the agent proposed versus what you approved.

**The sentence I would never let them write:**

> ~~"Drop any fillable PDF and its 47 fields become 47 live tools."~~

False twice: no build of this registers one tool per field, and "any PDF" is contradicted by Ontario's ODSP main application and Alberta AISH, which are dynamic XFA and unfillable by any browser library, forever.

---

## §5 — Two alternates

### ALT B — Clinic/hospital intake & consent workspace (no PHI leaves the browser)

**## What already exists** — Phreesia (+VoiceAI, Sept 2025), Luma Health, Notable, Epic MyChart pre-check-in, athenahealth, Clearwave, Yosi, Jotform HIPAA; a 2026 market already segmented into four named lanes with Perspective AI owning conversational intake. E-consent: Medidata Rave eConsent, Castor, REDCap. In-window WebMCP: `solahai/referralarc` (*"capability-lifetime consent for the administrative handoff after a clinician orders care"*), `nexora-assistant/consentos-webmcp`, plus 7 consent and 17 accessibility repos.

**## Why those aren't enough** — all are provider-deployed and cloud-hosted; none exposes tools to the *patient's own* agent; and in every conversational one the transcript is itself PHI.

**## Proposed idea (one sentence)** — A page a clinic links to where the patient's own agent helps them complete intake and consent entirely client-side, exporting a signed packet the clinic ingests.

**## Novelty score: 4/10.** One reason: the only new element is an architecture claim ("client-side"), in a mature B2B market where the buyer is the clinic and the patient never picks the tool.

**## Three ways this fails**
1. **Critical assumption** — nobody brings their own agent to clinic intake; they are handed an iPad in a waiting room. The whole "visitor's agent" premise has no occasion to fire.
2. **Market** — your buyer is a clinic and you have none, and Impact is scored on what's demonstrated. A synthetic clinic demo is a mock-up of a market you cannot reach by Sep 2.
3. **Execution** — a PHI framing invites questions about HIPAA scope, e-signature legal weight and consent validity that you cannot answer in 2.5 days with no clinician in the loop; answering them badly is worse than not raising them.

**Per-judge:** Rushing 5/7/6/3 (5.25) · Drasner 5/7/7/3 (5.5) · Grigorik 6/7/5/3 (5.25) · Nahas 6/7/6/4 (5.75) · Galloni 5/7/5/3 (5.0) · Gao 5/7/5/3 (5.0) · Roberts 5/7/5/3 (5.0). **Panel mean ≈ 5.25. Top-10 4–7%. Reject.**

### ALT C — "Fill Together, forged": A's surface, Rokan's unclaimed mechanic

I'll be explicit that this is a variant of A rather than an unrelated third product — because after checking 766 in-window repos, the frame you specified contains no unclaimed third product.

**## What already exists** — everything in §1 for the document surface. For the mechanic: `tandttakumi/agentic-service-dispatch` (08-27, *"Human approval creates one exact, time-limited WebMCP capability—and consumes it after one action"*), `kero12345ro/staged-webmcp` (08-29, *"Approval, compiled into capability"*), `ICY0U/relay-webmcp` (08-29, action receipts), `harshpuri84/ladder-webmcp` (08-26, tool call as a pull request against a private state copy), `AkiGarage/helprelay-webmcp` (trusted-person handoff). Server-side: capability tokens, macaroons, UCANs, Codex Record & Replay. **But: runtime tool *creation* returns 0 hits across all 766 repos.** Every capability entry mints a permission for one session; none mints a *new named tool that did not exist at page load*.

**## Proposed idea (one sentence)** — A page where completing a form once, with your approval, mints a new typed WebMCP tool — `filed_i9({ new_employer })` — that did not exist at page load, is registered live into your agent's Site-tools list, and can only run again behind the same single keystroke.

**## Novelty score: 6/10.** One reason: the forge mechanic is unclaimed across 766 repos and is a direct answer to the tie-break criterion — a server-side MCP cannot mint a tool into the visitor's page, and the spec's own `toolchange` text describes this case verbatim — but the vehicle it rides on is the most-claimed surface in this evaluation.

**## Three ways this fails**
1. **Critical assumption** — that ChatGPT desktop picks up a live `registerTool` **without a page reload**. Undocumented; you measured Codex CLI reading tools once per session and ignoring `tools/list_changed`. The hero moment (Site tools 7 → 8, on camera) dies if it needs a reload. **Test this before writing a line of code — one hour, and it gates everything.**
2. **Market** — "a tool is born" is a mechanism a developer loves and a non-builder cannot see. Impact scores off demonstrated human benefit, and the benefit only appears on the *second* form.
3. **Execution** — you inherit §2's landmines (WinAnsi, maxLength, absent `required`), and you must scope to I-9 + one other in writing on day one or it eats the budget.

**Why C beats A on cost:** `forge.ts` (592 LOC / 27 tests, one `isDangerousIn` edit), `kept.ts`, `proposals.ts`, `ledger.ts`, `redact.ts` (which you *need* for PDF-sourced text), the eval harness and `ArtifactPanel` all transfer. **~20–24 h versus A's 30–36 h, for a strictly better novelty position.**

**Per-judge:** Nahas 8/8/6/7 (7.25) · Drasner 6/8/7/5 (6.5) · Rushing 7/7/6/5 (6.25) · Grigorik 7/7/6/5 (6.25) · Galloni 6/7/6/5 (6.0) · Roberts 6/7/6/5 (6.0) · Gao 6/7/5/5 (5.75). **Panel mean ≈ 6.3. Top-10 12–16%.**

### The other named candidates, killed briefly

- **Letter/email composer for people who can't type** — ChatGPT already writes the letter; there is no artifact only the page can hold, so "nothing but WebMCP could do this" has no answer. **Novelty 2/10. Reject.**
- **Benefits-eligibility navigator with deterministic rules** — the rules are **already open source and live** (PolicyEngine + MyFriendBen, 40+ benefits), the screener market is populated (Prosper Canada's Benefits Wayfinder, Canada's Benefits Finder, AccessNYC, GetCalFresh), the sector's flagship died (BDT, Aug 2024), and `public-service-passport` is shipping it *in this hackathon*. **Novelty 3/10. Reject.**
- **Long-document read-and-act workspace** — "chat with a doc" is the most saturated genre on the internet, and `lattice` (14 typed tools over PDFs, "the page IS the audit log") and `PaperPilot` are already in-window. **Novelty 2/10. Reject.**

---

## §6 — Final ranking and recommendation

| Rank | Option | Panel mean | Top-10 | Build cost |
|---|---|---|---|---|
| **1** | **No pivot.** Rokan as-is + video + public repo + ChatGPT-desktop hour + the `document.modelContext` fix | ~6.5 | **15–20%** | ~0 new build hours |
| 2 | ALT C — forge over one seeded, hand-checked form (USCIS I-9) | ~6.3 | 12–16% | 20–24 h |
| 3 | Candidate A as specified | ~5.9 | 10–13% | 30–36 h |
| 4 | ALT B — clinic intake & consent | ~5.25 | 4–7% | 25–30 h |

**Plain recommendation: do not pivot.** Candidate A trades your only asset that 766 repos don't have — runtime tool creation, 0 hits, and the tie-break criterion is *"nothing but WebMCP could do this"* — for a lane where the tool surface has been a listed public WebMCP demo since May and three in-window rivals have already taken your remaining three differentiators. Feasibility is not the problem; **novelty is, and it is not recoverable in 2.5 days.**

**Cost of being wrong.** If I'm wrong about not pivoting, you lose roughly 4 points of top-10 probability — an option worth about $120 in expectation. If you pivot and I'm right, the downside is not 10–13%: the video, the public repo, and the ChatGPT-desktop verification are the **only pass/fail gates and all three are at zero**, and a pivot spends exactly the budget that closes them. No video means judges score off a text description alone. **The asymmetry is roughly 20:1 against the pivot.**

**Do these today, in this order, regardless of the decision:**

1. **`const mc = document.modelContext ?? navigator.modelContext;`** — the old name was *removed* in Chrome 152; stable is 153; your CLAUDE.md pins 149. This is a silent Stage-1 failure.
2. **Hand-test `toolchange` re-discovery in ChatGPT desktop.** One hour. Gates the forge and the hero shot.
3. **Audit for `provideContext` / `clearContext` / `unregisterTool`** — all removed from the spec; use `AbortSignal`.
4. **Drop `destructiveHint` / `idempotentHint` / `openWorldHint`** (inert in WebMCP). Add **`untrustedContentHint: true`** to anything returning screen or document text.
5. **Fix the copy**: cite 500/150/30/1.5K as Chrome *recommendations*; state ≤12 tools as your own discipline (Chrome documents no maximum); note that *"each tool invocation receives a safety review before it runs"* is documented ChatGPT behaviour, so some measured latency isn't yours to claim; and do **not** attribute the accessibility line to Drasner — the explainer is unbylined and issue #91 closed NOT_PLANNED.
6. **Update CLAUDE.md**: Chrome 149 → 153; "Model Context Tool Inspector" extension → native DevTools **Application → WebMCP** pane.
7. **Office hours: Aug 31, 11:00 am PT.**

**If the founder still wants a document product after those**, take **ALT C**, not A: scope it in writing to **USCIS I-9** on day one, use **`@cantoo/pdf-lib` with `{password:''}`** (never stock pdf-lib), ship a loud `/NeedsRendering === true` rejection path, don't flatten, embed a Unicode font, and **name SimplePDF in your own README before a judge does** — the Build Week calibration set rewarded exactly that move (Dấu disclosed a $12 spend and withheld references and won; ResearchOS put 7%→93% in prose and lost).