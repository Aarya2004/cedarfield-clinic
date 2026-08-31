# SPEC-V1 — The Drop, first real prototype (branch drop-ui-spike-2)

Decided with Aarya 2026-08-30 (post-bench): real provisional WebMCP tools · small site (landing +
booking) · calm-clinic visual direction with typographic drama · manual-is-the-page (no mode toggle).
The `/drop-spike` bench stays untouched as the dev rig. This is the page we'd polish into the submission.

## 1. Product frame

A fictional clinic — placeholder brand **"Cedarfield Clinic"** (pure content, swaps when the founders
pick the product name; no Rokan identity). Honest banner on every page: *demo inventory, simulated
rival, nothing real is booked.* The thesis, on the landing page in large type:
"Every task on the web is a number of interactions. For millions of people, each one is expensive.
This page hands the structure to your agent — and leaves you the one act that must stay yours."
Trust lines (from the verdict doc, first-ten-seconds rule): your own agent · your own booking ·
no resale · only a human books.

## 2. Site map

- `/clinic` — landing (Rokan's `/` stays intact on this branch): thesis headline, next-drop countdown (live), three-step how-it-works
  (agent holds → TTL burns → your one press books), the honesty/a11y statement, CTA → `/book`.
- `/clinic/book` — the product: live slot board + drop countdown, the confirm dock (armed only during your
  hold), manual booking flow (clicking a slot books by hand — the page is simply a bookable clinic),
  quiet always-on interaction counter, and after an agent-held booking the side-by-side receipt
  (by hand N vs with your agent 1). Both routes `force-dynamic` (CSP nonce — bench finding #5).

## 3. WebMCP tools — PROVISIONAL (Arav red-lines; schema marked provisional in code)

Registered top-level, imperative, feature-detected, one AbortController, on `/book` only.
Wired to the existing mock driver through the `useDropSession` seam (the transplant point).

- `clinic_list_drops()` → next wave time + open slots (id, time, clinician, kind, state).
- `clinic_hold_slot({slot_id})` → holds for the visitor; result carries ttl_seconds + the choreography
  sentence ("The slot is held. Tell your human: one keypress on the page books it — you cannot.").
- `clinic_hold_status()` → seconds left, slot, state.
- `clinic_release_hold()` → releases.
- `clinic_explain_confirm()` → why no booking tool exists (trusted-event explanation, for agents that ask).

**Deliberately absent: any booking/confirm tool.** The driver's internal `book()` (bench finding #1)
serves the HUMAN manual path only; it is never registered. Tool count 5 — far under the 12 cap.
Descriptions carry the choreography (tools-only standard; no resources/prompts claims).

## 4. Reuse vs rebuild

- **Keep verbatim (logic + 150 tests):** mock-driver, interaction-counter + COUNTING.md, time,
  urgency, confirm-logic (isTrusted gate), audio-cues, manual-flow reducer, board-announce,
  gesture-logic, types.ts seam, useDropSession fold.
- **Rebuild (all presentation):** board/cards, TTL/countdown, confirm dock, manual flow UI, landing.
  frontend-design skill drives it; the bench's DropBench/drop-bench.css are not referenced.
- **Gesture:** stays behind `NEXT_PUBLIC_DROP_GESTURE=1`, plugs into the new confirm dock's slot;
  out of the default experience until the two manual checks in GESTURE.md pass.

## 5. Design language (calm clinic, typographic drama)

Paper-light surface, near-black ink, ONE accent used only for "yours" states; huge numerals for
times and the countdown (the drama is scale + motion, not darkness); WCAG AA minimum everywhere,
big targets, visible focus, reduced-motion parity (bench standards carry over). All color through
`--drop-*` tokens incl. the confirm dock family (bench findings #2/#3 — no global --ink leakage).
The rival stays honestly labelled; the lost-slot beat keeps the persistent "who took it" rail.

## 6. Iteration-1 scope cuts

No waitlist cascade, no accounts, no forge/kept integration, no landing-page illustrations,
no ChatGPT-specific styling. The counter comparison needs no persistence beyond the session.

## 7. Acceptance (the definition of done for iteration 1)

1. Gate: `pnpm typecheck && lint && build && test` (baseline 378) — zero new lint errors.
2. Headless drive of `/book`: manual booking end-to-end with measured receipt; agent path via REAL
   tool calls through the CDP WebMCP harness pattern (`evals/harness/webmcp-cdp.mjs`): tools listed,
   `clinic_hold_slot` invoked → hold appears → CDP-trusted Enter books → receipt shows the collapse;
   synthetic press still blocked; no booking tool present in the listed tools (assert!).
3. Landing renders, countdown live, zero console errors both routes, 390px clean.
4. Screenshots of landing, board mid-drop, held+armed dock, side-by-side receipt → scratch/.
