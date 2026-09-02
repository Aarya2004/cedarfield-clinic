# SPEC-V3 — Cedarfield Clinic, production-ready (branch clinic-production)

Aarya's directive, 2026-09-01: **"Make it a real clinic page — no 'see how it works', no demo
messaging. Literally what a clinic or hospital page would look like."** Scope: booking-complete
(home + booking + your-appointment). This supersedes the demo-facing parts of SPEC-V1/V2 §copy;
DESIGN.md's laws stand EXCEPT where they mandate demo chrome (revision follows this build).

## 1. What goes (all pages)

- The interaction counter badge, the "What it cost" receipt, and every effort comparison. The
  counting module may keep running and writing `data-*` attributes (invisible) so the eval harness
  can re-point — but NOTHING visible.
- "Simulated rival" labels and chips. A taken slot reads as a clinic would say it: "No longer
  available." No attribution.
- The honesty essay/banner, the thesis sentence, all WebMCP/agent talk in visible copy
  ("your agent cannot press the key" → gone). The "Site tools · N" indicator: remove visible text
  (keep the headless `data-clinic-tools` hook).
- "How this works" / demo framing of any kind.

## 2. What stays (reframed in clinic language)

- Waves → "Cancelled appointments are released daily at <time>." (Real clinics do this.)
- Holds → "This time is held for you for 45 seconds." TTL bar stays (it's good product UI).
- The trusted-press confirm dock → a normal confirm step: "Confirm this booking — press Enter."
  Switch/gesture options framed as accessibility features ("Confirm your way: key, switch, or a
  held gesture"), not as a thesis. Synthetic presses are still ignored; the blocked-counter line
  is removed from UI (hook may stay).
- All 9 `clinic_*` tools, registration unchanged (tool descriptions are agent-facing, untouched).
- Agent-originated holds still legible, but in product voice: "Held for you — 0:41" with a small
  "via your assistant" tag (a real product with agent integration would say this much).
- Gesture confirm, audio cues, a11y standards, tokens, the calm-clinic design language.

## 3. Pages

- **`/` + `/clinic` — clinic home:** masthead (Cedarfield Clinic, nav: Appointments · Clinicians ·
  Contact), hero (clinic photo-free, typographic: "Same-day cancellations, released fairly."
  CTA "Book an appointment"), services strip (General practice · Follow-ups · New patients),
  clinicians section (the four existing doctors, specialty + next available), release-times info
  block, hours + contact + location footer (fictional but complete: address, phone, NHS-style
  info). No thesis anywhere.
- **`/clinic/book` — booking:** the board as-is minus §1 removals; copy pass to clinic voice.
  Fields/flow unchanged.
- **Your appointment** (section on /clinic/book after booking, or `/clinic/appointment`):
  confirmation reference (e.g. CF-4X2K), date/clinician/kind, add-to-calendar (ics download),
  cancel and move actions (the existing armed-dock flows, phrased as product: "Cancel this
  appointment — press Enter to confirm").

## 4. Constraints

- Branch `clinic-production` only; do NOT touch evals/** (Arav re-points them — ALIGNMENT ping
  carries the hook inventory), packages/bridge, infra, /terminal.
- Keep every `data-*` hook that costs nothing to keep; list any that must go in the report.
- Gate: typecheck/lint/build/test green (439 baseline; UI-copy tests will need updating — update
  tests that assert removed demo copy, list each). `node evals/a11y.mjs` stays 0 violations.
  Do not run the clinic eval cases (known-broken until re-pointed).
- DESIGN.md revision is a follow-up commit (drop "Unlabelled Simulation" law's visible-label
  requirement, receipt laws → hooks-only); do not edit DESIGN.md in the build commits.

## 5. Acceptance

A visitor who has never heard of WebMCP or this hackathon sees a credible clinic booking site,
books, gets a confirmation with a reference, and can cancel/move. An agent-driven hold + one
trusted press still books. Zero demo vocabulary anywhere in rendered text (grep the built HTML for:
rival, simulated, demo, agent cannot, interaction, counted, WebMCP, tool). Screenshots of home,
board, held-dock, confirmation → scratch/.
