# 'WebMCP removes the gesture' — is it demonstrable on a live site? (Opus 5, 70 tool calls, 2026-08-30 ~15:00 PT)

Sponsor-demo agent has stalled; I covered most of its scope from the directory data directly. Reporting now.

## Method

Pulled the full public WebMCP directory via its API (`https://webmcp.com/api/v1/tools`, `/api/v1/sites`, paged) — **2,307 unique tools across 399 sites (2,040 tools / 363 hosts marked `live`; 267 / 36 marked `demo`)**, with complete JSON input schemas. Grepped all 45 gesture/race keywords, then verified the survivors by fetching served HTML and shipped JS bundles, plus one runtime check in Chrome.

## Live sites that remove a drag gesture

| Site / URL | Tool | Input schema | Gesture removed | Verified how |
|---|---|---|---|---|
| [demos.telerik.com/.../webmcp-operations-hub](https://demos.telerik.com/blazor-ui/marketing-campaigns/webmcp-operations-hub) | `shipment-tracker-grid-column-reorder` | `{id: enum[12 cols], position: number}` | drag column header to new position (**2.5.7**) | fetched shipped bundle |
| same | `shipment-tracker-grid-column-resize` | `{id: enum, size: "200px"}` | drag column edge | same |
| same | `shipment-tracker-grid-group` | `{field}` | page literally reads *"Drag a column header and drop it here to group by that column"* | read in browser |
| same | `warehouse-map-map-set-zoom` / `-set-center` | `{level}` / `{latitude, longitude}` | map drag-pan + scroll-zoom | same bundle |
| [allsvgicons.com/free-logo-maker/](https://allsvgicons.com/free-logo-maker/) | `set_logo_maker_state` / `update_logo_maker_state` | `layers[].{x: px, y: px, scale, rotation: -180..180}` | drag-to-position, drag-to-scale, drag-to-rotate on a canvas | 13× `modelContext`, 3× `registerTool` inline in served HTML |
| [cesium-browser-agent.pages.dev](https://cesium-browser-agent.pages.dev/) | `flyTo` / `setView` | `{longitude, latitude, height, heading, pitch, roll}` bounded | 3D globe drag-orbit / drag-pan / scroll-zoom | `modelContext` + `setView` in served HTML |
| same | `measure` | `{mode: distance\|area, positions: [[lon,lat,h]]}` | click-drag point placement | same |
| persona-chat.dev/webmcp-slides.html | `reorder_slides` | `{slideId, position: 1-based}` | drag-to-reorder slides | directory schema only — SPA bundle, **runtime registration not verified** |
| ourmanynames.com | `show_person` | `{person, openProfile}` | canvas pan | directory only; **no markers in served HTML** |

**Total: ~10 gesture-replacing tools across 4 hosts — 0.5% of the 2,040 live tools.**

The Telerik finding is the structural one. `telerik-blazor.js?15.0.1.0` (the shipping commercial bundle, 4.6 MB) contains:

```js
function i(){return "undefined"!=typeof document && Boolean(document.modelContext)}
e.registerMcpTool=function(t){ if(!i()) return null;
  try{ return document.modelContext.registerTool(t) }catch(t){ return null } }
```

plus `getColumnReorderSchema`, `getColumnResizeSchema`, map `SetZoom`/`SetCenter` (`registerMcpTool` appears 52×). Progress shipped this across Telerik UI for Blazor, Kendo UI for Angular and KendoReact ([Q2 2026 preview](https://www.telerik.com/blogs/telerik-and-kendo-meet-webmcp) → [Aug 2026 release](https://www.globenewswire.com/news-release/2026/08/20/3348395/0/en/progress-software-announces-new-telerik-and-kendo-ui-release-to-accelerate-ai-powered-development-and-agent-ready-applications.html)). **Drag-replacing tools are now a component-library default, not a one-off.** Their Scheduler also registers `reschedule` (drag-to-move-event). Caveat: registration is gated on `document.modelContext`, so it is inert until the flag/origin trial is on — I confirmed `navigator.modelContext` was absent in stock Chrome 152.

## Shopify — precise, and it does *not* support the claim

Verified live on aloyoga.com (also reebok.com, awaytravel.com, btosports.com): a `shopify:webmcp_adapter` script gated on `(document.modelContext||navigator.modelContext).registerTool`, loaded after `shopify-origin-trials`.

- `show_variant` → `{catalog: {handle, variant_id | selected_options: [{name, value}]}}` — replaces *clicking* a swatch. Target-size relief (**2.5.8**) at most. Not a drag.
- `update_cart` → `{cart: {line_items: [{id, item.id, handle, query, quantity: int, 0 = remove}]}}` — replaces +/- stepper *taps*. Not a drag.
- `proceed_to_checkout` → `{}`. `get_cart` → `{}`. **No timer, hold, countdown, or expiry anywhere in the schemas.**

## Timed / raced interactions — nothing, anywhere

No live site declares a tool that enters or removes a race. The two closest actively disclaim it: **alpina.travel**'s `start_samspitze_checkout` states it "does not hold dates, reserve the apartment, or take payment"; **nycrsvps.com**'s `get_reservation_open_date` only *calculates when* a Resy/Tock drop opens — it does not book. No seat-hold, checkout-countdown, or waitlist-race tool exists in the corpus.

## Origin-trial partners — no evidence

Homepages fetched with a real UA, grepped for `modelContext` / `registerTool` / `webmcp_adapter` / origin-trial meta: **redfin.com, instacart.com, target.com, creditkarma.com, turbotax.intuit.com all served full pages with zero markers.** expedia.com (429), booking.com (202 challenge shell), etsy.com (403) — **could not verify**. Tools could still live on inner pages or in client bundles, so this is "no evidence", not proof of absence.

## Sponsor demos — these *do* remove drags, but they are demos

`webroom.openai.chatgpt.site` `crop_image {x,y,width,height}` / `rotate_image {degrees}` / `resize_image` (replaces crop handles); `cubecade` `queue_cube_moves` (replaces 3D cube drag); Chrome's pizza-maker `add_topping {topping, size, count}` (replaces drag-topping-onto-pizza). Mystery Doors (`openDoor1/2/3`) is plain clicks. The `ticket-booking` demo's `select_showtime {movie_id, date, time, tickets}` has **no seat map and no hold timer**. I did not verify the Netlify demos (Kurio / Tagboard / Mabel's Table) — **could not verify**.

## Verdict

**Yes — but barely, thinly, and entirely by accident.** The claim "WebMCP removes the gesture" is demonstrable today on real live sites: **allsvgicons.com's logo maker** (`layers[].x/y/rotation/scale` vs. canvas drag) is the purest open-web case, **cesium-browser-agent.pages.dev** the most dramatic (a 3D globe operable without an orbit drag), and **demos.telerik.com** the most consequential because the capability ships inside a commercial component library used by thousands of enterprise apps. It is *not* only sponsor demos. But it is 4 hosts out of 363, none of them a household-name production site, and **not one of them frames it as accessibility** — the tools exist for agent convenience. Timed/raced interactions: **not at all, on any site.**

**Has anyone written the WCAG framing? No — it is unclaimed.** [Cerovac's article](https://cerovac.com/a11y/2026/03/webmcp-and-the-future-of-the-agentic-web-do-not-leave-accessibility-behind/) names **zero** SC numbers and never mentions dragging, target size, switch access, or eye gaze; it argues the *defensive* case (WebMCP must not become an "alternate accessible version"). [W3C issue #65](https://github.com/webmachinelearning/webmcp/issues/65) cites only **SC 3.3.4**. The spec's own `<h2 id="accessibility">Accessibility considerations</h2>` is an **empty stub** — I confirmed it directly: line 1800 of `index.bs`, nothing before Acknowledgements at 1803, and "accessib\*" appears 4× in the whole document with no substantive use — while the intro names `[=assistive technologies=]` as a first-class tool consumer. Telerik's blog gets nearest ("Drag-and-drop has a new sibling: tell-and-confirm", plus a general accessibility claim) but cites no criterion. The two accessibility-framed hackathon repos ([InclusivePatch](https://github.com/1aifanatic/inclusivepatch-webmcp-challenge), [Tweaksy Live](https://github.com/YoavAlro/tweaksy-live)) do *remediation* and *presentation adaptation*, not gesture removal. Devpost's gallery is unpublished — **could not verify** entries.

**One risk worth pre-empting:** Cerovac and the W3C APA WG both explicitly hold that WebMCP must not become a conformance substitute. Frame it as *an additional operable path alongside an accessible page*, never as the accessible version — otherwise an accessibility-literate judge will reject it on sight.

---

Both verified first-hand. Two corrections to my report:

## Correction 1 — Target.com *does* carry a live WebMCP origin trial

My earlier grep missed it because the token is base64. Decoding all six `<meta http-equiv="origin-trial">` tokens on `www.target.com`:

```
{'origin': 'https://www.target.com:443', 'feature': 'WebMCP', 'expiry': 1794873600}   # ~Nov 2026
```

plus `"WEBMCP_ORIGIN_TRIAL_ENABLED":true` in the page config blob. **But `modelContext` and `registerTool` both appear 0 times** in the HTML, and the parallel agent grepped all 57 referenced Next.js chunks with no hits. So: Target has the trial switched on and a feature flag live, and registers nothing observable yet. Revised partner table — expedia (429), booking (202 shell), etsy (403), creditkarma (Akamai error page) = **could not verify**; redfin, instacart, turbotax = **no markers** (Redfin, the obvious map-pan case, has no WebMCP anything); target = **token present, no tools observable**.

## Correction 2 — the timed race *does* exist, on a sponsor demo

My "not at all, on any site" was too strong. Netlify's **Mabel's Table** ([webmcp-mabels-table.netlify.app](https://webmcp-mabels-table.netlify.app/)) ships it. Verified by pulling `/assets/index-BeShSkui.js` myself:

```js
{name:"mabel_hold_table",
 description:"Place a five-minute hold on an available seating time. Return the hold token to the user and confirm promptly.",
 inputSchema:{type:"object",properties:{date:H,time:{...},partySize:A},required:["date","time","partySize"]}}
```

with `mabel_confirm_reservation {holdToken, name, notes?}`, registered via `document.modelContext ?? navigator.modelContext` → `registerTool(n,{signal})`. That is the seat-hold-with-countdown pattern as a typed tool. Its own meta description calls it "a fictional neighborhood bistro" — a Netlify sponsor demo, not a real restaurant.

## Revised verdict

**Drag: yes, on real live sites** — allsvgicons.com's logo maker (`layers[].x/y/rotation/scale`), cesium-browser-agent.pages.dev (`flyTo/setView` with heading/pitch/roll), and demos.telerik.com, where I proved it hardest by pulling the shipped commercial bundle and finding `document.modelContext.registerTool` plus `getColumnReorderSchema`/`getColumnResizeSchema` inside `telerik-blazor.js` 15.0.1.0. That last one means every app built on Telerik/Kendo inherits drag-replacing tools.

**Timed race: only on sponsor demos** — `mabel_hold_table` exists; nothing equivalent on any open-web production site. The two closest live sites actively disclaim it (alpina.travel: "does not hold dates"; nycrsvps.com only calculates when a drop opens).

**Shopify still doesn't help you** — `show_variant`, `update_cart {quantity, 0=remove}`, `proceed_to_checkout {}`. Swatch and stepper *taps*, no drag, no timer. Target-size relief (2.5.8) at most.

**The framing is still unclaimed, and that is the asset.** Cerovac's article names zero SC numbers; W3C issue #65 cites only SC 3.3.4; the spec's `<h2 id="accessibility">Accessibility considerations</h2>` is an empty stub (index.bs line 1800 — nothing before Acknowledgements at 1803; "accessib\*" appears 4× document-wide, none substantive) while the intro names assistive technologies as a first-class tool consumer. Telerik's blog claims accessibility in general terms but cites no criterion.

**Two things to get right in the pitch.** First, the honest claim is *"nobody has framed this as accessibility"*, **not** *"nobody has built a tool that replaces a drag or a hold"* — the second is now demonstrably false and a judge who searches will find Telerik, Webroom's `crop_image {x,y,width,height}`, Cubecade's `queue_cube_moves`, and Mabel's hold token. Cite them as accidental precedent that the substrate works. Second, a genuinely useful nuance the parallel search surfaced: Chrome Labs' own real-estate-map pans the map only as a *side effect* of `view_property_details`, and WanderNote's `set_map_view` takes `{scope, date, activityId}` — semantic selection, not a pan delta. Nobody has shipped pan/zoom as a *primitive* on the open web except Telerik and the Cesium globe. That gap is the specific, defensible thing to claim.

And keep the guardrail I flagged: present it as an additional operable path alongside an accessible page, never as the accessible version — both Cerovac and the W3C APA position explicitly reject WebMCP as a conformance substitute.