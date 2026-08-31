# THE DROP — complete specification and build plan (v2, LOCKED lanes; branch `drop`)

Written 2026-08-30 ~19:00 PT by Engineer #4 (Fable 5) on Arav's lock of the concept. Format and depth follow
`hashed-hatching-wall.md` / `optimized-mapping-tarjan.md` / `bright-squishing-corbato.md`. Decision evidence:
`docs/research/2026-08-30-timed-drop-verdict.md` (rivals, MediaPipe, per-criterion) ·
`…-build-week-and-precedents.md` (what this rubric pays) · `…-webmcp-removes-the-gesture.md` (the exclusion
argument) · `…-pivot-reuse-inventory.md` (file-by-file reuse, hours) · hostile evals in `docs/reviews/`.
Working name **"the drop"** — the PRODUCT NAME is Arav+Aarya's (Devpost guidance: humans name it); renaming
touches copy only (`site.ts` constant).

## 0. Locked decisions (edit here, not in chat)
1. **Product:** a booking page where scarce slots drop and vanish; the visitor's agent (voice, via ChatGPT)
   watches/compares/**holds** (90 s TTL); **booking is not a tool** — one human act books: key, switch, or
   held camera gesture. One-liner: *"Your agent can hold it. Only you can take it."*
2. **Population + claim:** people for whom every interaction costs 10–30× (switch/voice/tremor). Two measured
   claims only: the interaction tax collapses (page-counted: manual N → agent mode ≤3 presses) and the race is
   abolished (waitlist cascade — nobody races). Framed as an *additional operable path* (never "the accessible
   version"; W3C APA + Cerovac reject conformance-substitute readings).
3. **Confirm channels, in priority order:** keyboard/switch (primary, zero-permission, WCAG 2.5.1/2.5.4);
   camera gesture (progressive enhancement, MediaPipe, self-hosted models, per-user threshold + dwell bar,
   disableable); voice confirms only via the user's own OS voice-control pressing a key. **The page never
   listens to audio.** Consent must arrive on a channel the agent cannot speak on.
4. **No model calls, no API key, $0 marginal cost.** The visitor's agent does all reasoning. The Worker/DO
   never talks to an LLM. (Rokan wheels, model proxy, bridge, PTY: **not used** — main keeps them.)
5. **Honesty rails:** fictional inventory labelled on the page (sponsor norm — Mabel's Table is fictional);
   the rival agent labelled "simulated rival"; the four-part line in the first 10 s of page + video (*your own
   agent · your own account · no resale · the human performs the consequential act*); every on-screen number
   measured by the code that shows it; camera-denied state says so; README names Mabel's Table and states the
   inversion before any judge does.
6. **Five rungs of the pitch** (video + README order): tax collapsed → race abolished → capability shared
   (pass-the-tool) → pattern published (snippet + WebMCP spec issue: the spec's Accessibility section is an
   empty stub) → human-only acts as the agentic web's primitive (closing line, no code).
7. **Fallback is sacred:** `main` = shipped Rokan Terminal (15/15 live). Kill rule §9. Nothing on this branch
   touches main until the kill gate passes.
8. ≤ 8 WebMCP tools; Chrome's budgets as recommendations (500/150/30 chars, 1.5 K output); `readOnlyHint`
   correct everywhere; `untrustedContentHint: true` on anything echoing visitor-authored text (labels).
9. Judged surfaces: ChatGPT desktop (GPT-5.6 Sol/Terra) and Chrome 152+ (`document.modelContext` only).

## 1. Map — what stays, what is new, how it connects
```
 ┌────────────────────────── ONE PAGE apps/web (branch drop, route /) ─────────────────────────┐
 │ BOARD (new, Aarya)        CONFIRM SURFACE (new, Aarya)      TAX COUNTER (new, shared)        │
 │ waves · slots · TTL bars  DOM-native, ARIA live region,     manual N vs agent-mode presses,  │
 │ contention feed           huge target, key/switch first,    measured in adapter              │
 │ "simulated rival" chip    gesture module behind a flag      LEDGER RAIL (reuse, restyle)     │
 └───────────┬──────────────────────────┬──────────────────────────────────────────────────────┘
             │ WebMCP tools (§3)        │ hold events over WS (§4)     [NO mic. NO model. NO PTY.]
 ┌───────────▼──────────────────────────▼─────────────────────────────────────────────────────┐
 │ Cloudflare Worker (infra/sandbox rails reused: sid.ts HMAC identity, origin.ts, caps)       │
 │  └─ DropRoom DO (new): slots · waves · holds(TTL) · waitlist · bookings · rival bot         │
 │     alarm() expires holds → cascades offers · every write validated server-side (Gao's bar) │
 └────────────────────────────────────────────────────────────────────────────────────────────┘
 REUSED VERBATIM: ledger.ts (HMAC chain) · redact.ts · kept.ts · proposals.ts · types.ts ·
   Chip/Provenance/ForgeCard atoms · Tour shape · evals/harness/webmcp-cdp.mjs · deploy rails
 ADAPTED: forge.ts (inject dangerPolicy; JSON step dialect) → forged "my usual" + pass-the-tool
 NOT USED (stay on main): xterm/PTY/bridge · rokan wheels · model proxy · sandbox container image
 OTHER LOCAL REPOS (~/dev: Rokan, Quorus, chase): nothing needed — this product has no browser
   daemon and no model; if Arav meant a specific repo ("handset"?), name it and I'll re-check.
```

## 2. Product specification
### 2.1 Vocabulary
**Wave** — a scheduled release of N slots at time T (seeded schedule, every 3–5 min so a judge never waits).
**Slot** — {id, service, start, duration, room}. **Hold** — one visitor's exclusive 90 s claim on a slot.
**Offer** — a waitlist head's automatically-granted hold window after a lapse. **Confirm** — the human act;
never a tool. **Manual mode** — the same booking done with pointer/keyboard only; every interaction counted.
### 2.2 The flows
- **Agent flow:** visitor (voice→ChatGPT) → agent calls `watch_slots`/`list_drops` → wave lands → agent calls
  `hold_slot` (target < 150 ms server round trip, measured) → page shows THE CONFIRM SURFACE with TTL bar →
  human presses/gestures → DO books → ledger row `booked · hold 00:41 remaining · via switch` → agent sees
  `hold_status` flip to `booked`.
- **Contention:** the rival bot (labelled) and any other visitor race the same wave; a slot taken mid-scan
  animates out with "taken by another visitor". Two REAL browsers can race each other (shared DO room).
- **Waitlist cascade:** `join_waitlist({service})`; on lapse/release the head visitor's agent receives the
  offer (WS push → page event → agent sees it in `hold_status`), full 90 s window, human confirms. Nobody
  re-races. Fairness: FIFO per service, one live hold per visitor, join position visible.
- **Manual mode:** toggle on the board; identical inventory; a click-through booking form; the page counts
  every pointerdown/keydown/scroll-commit into `tax.manual`. Agent mode counts human inputs the same way
  (`tax.agent` — expected ≤ 3). Both counters rendered from the same measurement code (`tax.ts`).
- **Forge — "my usual":** after a booking, "Save as my usual" → ForgeCard (reused) → registers
  `book_my_usual_<label>` (kept via kept.ts, re-approval on reload) whose run = watch+hold matching pattern;
  confirm remains human. **Pass-the-tool:** "Send this tool" → base64url envelope {spec, hash, forged_by}
  (kept.ts shapes) in a link; receiver's page parses BEFORE registering, shows sender+hash+behaviour on an
  approval card; never auto-registers; ledger kind `received`.
- **Gesture module:** lazy chunk; `getUserMedia` → MediaPipe GestureRecognizer (self-hosted .task, VIDEO
  mode); confirm = chosen gesture held ≥ 800 ms above threshold with on-screen dwell ring; default gesture
  Open_Palm; threshold slider + "use keyboard instead" always visible; module OFF until the user enables it.
### 2.3 Empty/error states (judge-visible)
Camera denied → "camera unavailable here — keyboard/switch mode" (never hidden). Between waves → countdown to
next wave + waitlist CTA. Hold lapsed → "your hold expired — you kept your waitlist place". WS drop →
reconnect banner (ws/client.ts backoff), tools answer from last-known state with `stale: true`.

## 3. WebMCP contracts — exact (`apps/web/src/lib/drop/schemas.ts`, `contract:` commits only)
Tool count: 7. All top-level document; names ≤ 30 chars; descriptions ≤ 500; params ≤ 150 each.
1. `list_drops {}` → `{now, waves:[{id, at, service, slots_total, slots_expected_open}], next_wave_in_s}`
   readOnlyHint:true.
2. `watch_slots {service?: string}` → `{slots:[{id, service, start_iso, duration_min, state:
   open|held_by_you|held|booked}], as_of, stale?}` readOnlyHint:true. ≤ 1.5 K: capped at 12 slots + `more`.
3. `hold_slot {slot_id: string}` → `{ok, hold?: {id, slot_id, expires_in_s}, reason?:
   taken|already_holding|not_open}`. Description states: "Holding books nothing and auto-releases; only the
   person can confirm, on the page." readOnlyHint:false.
4. `release_hold {hold_id: string}` → `{ok}`.
5. `hold_status {}` → `{hold?: {slot_id, expires_in_s, confirm:"waiting for the person"}, offer?: {...},
   waitlist?: {service, position}, booking?: {slot_id, booked_at}}` readOnlyHint:true. THE polling tool; the
   agent narrates the TTL from here.
6. `join_waitlist {service: string}` → `{ok, position}`; `leave` via `release_hold` semantics (`wl_` ids).
7. `explain_confirm {}` → static text: why there is no booking tool, what the person does, the four-part
   honesty line. readOnlyHint:true. (Agents quote it on camera — free Leverage.)
Forged: `book_my_usual_<label>` (≤ 2 visible; forge budget from forge-spec constants, MAX_FORGED_VISIBLE
re-used). NO `confirm_booking` — enforced by a schemas.ts unit test asserting the tool list never contains it.
Identity: per-visitor `sid` HMAC cookie (sid.ts pattern) sent on the WS and in tool executes (page-side, from
session state — agents never see another visitor's holds as their own).

## 4. DropRoom Durable Object (`infra/drop/src/room.ts`, new package `infra/drop`, Worker + DO, own
`wrangler.jsonc`; deploys to `drop.<subdomain>.workers.dev`; Vercel page talks WS + fetch to it)
- Storage: `slots` (Map, seeded per wave), `holds {holdId → {sid, slotId, expiresAt}}`, `waitlist {service →
  sid[]}`, `bookings`, `taken_log`. One room = one demo world (`idFromName('main')`); `?room=` for private
  judge rooms (isolated worlds, no cross-judge interference — the caps lesson from Rokan applied).
- Methods (all validate server-side; Gao's bar): `getState(sid)`, `hold(sid, slotId)` (atomic; refuses if
  slot not open or sid already holds), `release`, `confirm(sid, holdId, channel)` — **requires a
  page-originated confirm token minted on keydown/gesture, single-use, 5 s expiry** (an agent calling fetch
  directly cannot mint it: it is issued only to the page over the authenticated WS after a trusted input
  event; residual risk stated in SECURITY: a malicious page script could synthesize — the boundary is the
  page, same class as Rokan's Enter, documented honestly), `joinWaitlist`, `alarm()` (expire holds → cascade
  offers → rival bot ticks), `seedWave()`.
- Rival bot: inside the DO, takes 1–2 slots per wave with jittered 3–8 s delay, `sid:"rival:sim"`, never
  takes the last slot of a wave (a judge must always be able to win), never holds > 1.
- Caps: per-sid 1 live hold + waitlist ≤ 3; per-IP room joins ≤ 10/10 min (gate-logic.ts reused); WS
  messages rate-limited (backpressure.js reused).
- Latency: `hold` path is one DO write; measure and print server ms in the response (the honest number).
## 4b. Web wiring (`apps/web` on this branch)
- New: `src/lib/drop/{schemas.ts, room-client.ts (ws/client.ts reuse), tax.ts, confirm.ts, gesture/ (lazy)}`,
  `src/components/drop/{Board, Wave, SlotCard, ConfirmSurface, TaxCounter, WaitlistCard, RivalChip}`,
  `src/app/page.tsx` replaced (terminal components stay in-tree, unimported).
- Reuse wiring: `register.ts` pattern for tool registration (new `registerDropTools()`); `proposals.ts` AS the
  offer/confirm queue (a hold-awaiting-confirm IS a proposal: `promote/resolve/wait` unchanged); `ledger.ts`
  kinds renamed via union extension (`held/booked/lapsed/received/forged/invoke_failed`); `kept.ts` for
  forged tools; ForgeCard relabelled "steps"→"pattern".
## 4c. Reuse manifest (from `2026-08-30-pivot-reuse-inventory.md`, verified file:line)
Verbatim: `ledger.ts` 205 LOC/5t · `redact.ts` 167/19 + mirror · `kept.ts` 194/18 · `proposals.ts` 131/7 ·
`types.ts` 53 · `ws/client.ts` 346/11 · `Chip/Provenance/ForgeCard` ~320 · harness 218 · `sid.ts` 35 ·
`origin.ts` 19 · `gate-logic.ts` window math · `backpressure.js` 69. Adapted: `forge.ts` (inject
`dangerPolicy` at :17/:235/:263/:463; JSON dialect in `forge-spec.ts` :170-206; templated
`forgedDescription` :254). Not used: `lib/terminal/*` 1 502 · bridge 1 503 · container image · model proxy.

## 5. Evals (`evals/cases/drop-*.json`, harness unchanged; runner prefix +30 LOC)
d1 tools-present (7, no confirm_booking — the negative assertion IS a case) · d2 hold→key-confirm→booked
(ledger row, ms measured) · d3 TTL lapse → state open again · d4 contention (two harness sessions, one slot:
exactly one wins, loser gets `taken`) · d5 waitlist cascade (lapse → offer to head) · d6 agent-cannot-confirm
(execute a synthetic confirm attempt → refused; screenshot) · d7 manual-mode tax counter > agent count ·
d8 forge my-usual → kept → reload → re-approval card · d9 pass-the-tool parse-before-register + hash mismatch
refused · d10 caps (2nd hold refused). Screenshots into `docs/evidence/drop/`.

## 6. Security & honesty (docs/SECURITY.md gains §10)
Injection surface: visitor-authored labels (`my usual` names, waitlist service strings) → redact.ts on ledger
write + `untrustedContentHint` on any tool echoing them; slot inventory is page-authored. The confirm token
boundary stated as in §4. No PII asked, no auth, no payments (out of scope, stated). MediaPipe .task files
self-hosted (`public/models/`, ToS phones home otherwise); camera frames never leave the page (no canvas
upload; assert no fetch in gesture module — unit test greps the chunk). Caps table in README.

## 7. Schedule (PT; two engineers + Arav; internal deadline Mon 22:00 gate, freeze Tue 12:00, submit Wed ≤
18:00, hard close Thu 13:00)
- **Tonight (Sun eve):** me — `infra/drop` scaffold + DropRoom + unit tests (hold/expire/cascade/rival/token)
  + `schemas.ts` (`contract:` commit) + `registerDropTools` on a bare page; Arav — `/probe/camera` in ChatGPT
  desktop (60 s), ffmpeg fix, name chosen with Aarya; Aarya — reads ALIGNMENT brief + DROP-PLAN, mocks board.
- **Mon AM:** me — WS client + proposals wiring + tax.ts + evals d1–d6 against deployed DO; Aarya — Board,
  ConfirmSurface, TTL bars, manual mode.
- **Mon PM:** gesture module (flagged) · d7–d10 · pass-the-tool · README v1 (judge script) · **22:00 GATE:**
  core loop green on the DEPLOYED url in ChatGPT desktop (drop → agent holds → key confirm → booked; agent
  blocked; race visibly lost without hold) **or revert to shipping Rokan as-is.**
- **Tue:** video (first 15 s: race lost → held lane → one press) · Devpost description · spec issue filed ·
  repo public + rename · office hours 11:00 (Arav asks: toolchange refresh? getUserMedia?) · freeze 12:00 —
  slack to 18:00 only for text, never code.
- **Wed:** submit by 18:00; then touch nothing (site included).
## 8. Kill rules (binding)
- Camera dead in ChatGPT desktop → keyboard/switch everywhere in the judged flow; gesture filmed in Chrome,
  labelled as such in the video. (Not a gate — the design already assumes it.)
- DO not green Mon 12:00 → single-visitor world, rival simulated client-side, labelled (loses two-browser
  race; keeps everything else).
- Gesture unreliable Tue 09:00 → module off, one README line "camera confirm: experimental, disabled".
- **Mon 22:00 core-loop gate fails → `git checkout main`, ship Rokan, use Tue for its video.** No debate.
- Pass-the-tool slips → cut silently (rung 3 becomes roadmap; nothing else depends on it).

## 9. Verification (definition of done, before "green" is said)
`pnpm typecheck && lint && test && build` (web) · `infra/drop` unit suite (DO logic ≥ 20 cases incl. token
single-use, cascade order, rival never-last-slot) · evals d1–d10 against the DEPLOYED Worker with `--trace` ·
open the deployed page in ChatGPT desktop (Sol/Terra): the d2 flow by hand, screenshots to
`docs/evidence/drop/` · Chrome 153 + flag: DevTools WebMCP pane screenshot showing `hold_slot` vanish on
another's hold (the Leverage shot) · axe-core pass on the board + confirm surface (an a11y-framed entry that
fails axe is dead) · `harness.json` of measured numbers (hold ms, TTL accuracy, tax counts) committed.

## 10. Judge-by-judge (one line each; the sentence we want in their notes)
Rushing: "deep site-tools use, worked first try in Sol." · Drasner: "tools-not-DOM, real a11y thinking,
axe-clean, the pane shot." · Grigorik: "bounded domain verbs; the absent tool is the contract." · Nahas: "my
taxonomy, plus a write the API cannot express." · Galloni: "a real DO, honest caps, $0 to run." · Gao:
"server-validated writes, evals in repo." · Roberts: "our demo family, completed with the gate we blogged
about." Panel risk unchanged: crowded booking category — the README's first screen names Mabel's Table and
states the inversion (the Dấu move).

## 11. Objectivity — claims this plan rests on, stated so they can be refuted
(1) ChatGPT desktop exposes page tools reliably (proven for Rokan's 7). (2) `toolchange` mid-session refresh
UNPROVEN — if absent, the retracting-tool beat moves to the Chrome/DevTools shot only; core flow unaffected
(hold_status carries the state). (3) getUserMedia in ChatGPT desktop probably DENIED — design assumes it.
(4) The confirm-token boundary is page-trust, same class as Rokan's Enter — stated, not hidden. (5) Novelty
6/10; the bet is Impact 8 + Leverage 7 with all four ≥ 6 beats the field's spiky profiles. (6) Two-browser
contention needs the DO green — kill rule 2 covers.

## 12. Rollback
`main` untouched; Vercel prod still serves Rokan until Arav flips the alias; the DO is a separate Worker
(`drop`) — deleting it removes the product cleanly; every doc this plan supersedes stays in git history.
