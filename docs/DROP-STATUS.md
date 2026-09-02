# THE DROP — state of play and the road to submission (2026-08-31, Engineer #4)

Product locked. Aarya built the surface; I own the contract, the proofs, and the submission spine.
This file is the single source of truth for what is green, what is blocking, and who owns each item.

## Green right now (verified end to end on this machine, main @ HEAD)

| Thing | State |
|---|---|
| `apps/web` gate | typecheck clean · **450/450 unit tests** · lint 0 errors · production build clean |
| **The judged client is the Codex desktop app** (2026-09-02 02:10, Arav's screenshot) | In-app browser pane, model 5.6 Terra, composer = dictation + Send only — **no Voice Mode**. Hands-free path for the video and for a disabled visitor: macOS Voice Control ("press Return" sends the dictated prompt; "press Return" on the page pane books — an OS-level key, browser-trusted). |
| **SPEC-V8 — the page's own record of the agent (2026-09-02, after the ChatGPT desktop test)** | Arav, testing with ChatGPT desktop: "it keeps saying it's doing something… how am I supposed to tell if these commands have happened or not". Now `ClinicTools` wraps every tool's `execute` and keeps an **Agent activity** log on the page (`role=log`, `aria-live=polite`): time · tool · one line derived from the tool's own JSON answer ("held 8:40 AM with Dr. Fanning · 180 s, your press books it", "refused — That slot was taken…", "dock armed to cancel 9:00 AM — only your press cancels") · measured ms. Never invented: `summariseToolAnswer` reads the answer, a refusal quotes the tool's `detail`. `data-clinic-agent-log` = call count, `data-clinic-call=ok|refused` per row; asserted in `clinic-thesis`. Unit test in `clinic-tools.test.ts`. |
| **The clock, retuned for chat clients (2026-09-02)** | Measured on ChatGPT desktop (`docs/evidence/clinic/2026-09-02-chatgpt-desktop-transcript.md`): 10–39 s per tool call; a 45 s hold had 31 s left when the agent finished reporting it; a 90 s wave rolled between two answers. **Holds are now three minutes, waves six** (`HOLD_TTL_SECONDS=180`, `WAVE_PERIOD_MS=360_000`, `PENDING_ACT_TTL_SECONDS=180`; migration `20260902040000_cedarfield_clock_for_agents.sql`, applied). The seeded rival still moves at +6/+20/+34 s so the board is alive in the first minute. Eval waits grew to match (hold-lapses 200 s, soak 200/400 s, run-all backstop 900 s). **Deployed and verified on production 2026-09-02** (`docs/evidence/clinic/2026-09-02-clock-and-log-production.txt`: 17/17 seeded, axe 0×3, 25/25 live incl. cascade, live hold `ttl_seconds:180`). |
| **For Aarya / Aarya's Claude — what changed on your surface today (2026-09-02)** | Arav asked Engineer #4 to touch `components/clinic` while you were busy. In your lane, all small and in your language: `ConfirmDock` act modes + origin `waitlist` (no autofocus + dead zone on cascade grants, keyed remount per slot/start); `SlotSheet` queue tag ("You're #1 in line" / "N waiting") + `taken_by_other` rows strike like rival rows; `ClinicFrame.ToolManifest` lists all twelve; `BookingSteps` details form carries the declarative attributes (`toolname`/`tooldescription`/`toolparamdescription`, no autosubmit) + an "agent-filled" banner + a refused-submit counter; NEW `BoardPreview.tsx` — the live board, compact and read-only, as the hero's aside on the landing (`.cl-preview` rules appended at the end of `clinic.css`); `.cl-dock__gesture` token remap so the gesture sheet is readable in the dark dock; `components/drop/ClinicTools.tsx` now renders the Agent activity log under its status line (inline styles on your tokens — give it `.cl-*` rules if you want it in the sheet's voice). Nothing was restyled; every rule reuses your tokens. Full history in `docs/PROGRESS.md`. |
| **The waitlist cascade (SPEC-V5, 2026-09-01)** | On the shared board an agent can put its human IN LINE for a taken slot (`clinic_join_waitlist`, reversible, cap 3, current wave only). When the slot comes back the server hands it to the first in line as a fresh three-minute hold — the dock arms by itself ("It came back to you"; treated as an agent-timed arm: no focus steal, dead zone) and one press books it. The rival never takes a queued slot. Registered only when the queue seam exists (seeded board: 9/10 tools unchanged). Proven in `live-two-visitors.mjs` (cascade beat) — **and on production 2026-09-02, 25/25** (`docs/evidence/clinic/2026-09-02-cascade-production.txt`); re-verified after the final-build deploy (`2026-09-02-final-build-production.txt`). |
| **Tools born from the human act (SPEC-V4)** | Nine at load (arming tools always, so "nothing booked" is always sayable); `clinic_my_appointment` is born by the press and dies with the booking; `list_drops.your_bookings` tells the truth from an always-present tool. |
| **The live board (SPEC-V3, 2026-09-01)** | ON by default: one shared Supabase inventory for every visitor, anonymous session per browser, realtime + poll, DB-enforced fairness (one hold, hold-before-book, own-booking cancel/move, atomic move, 3-booking cap, current-wave-only holds, no cross-visitor uuids, runtime kill switch `clinic_settings.live`). `?test=1` pins the seeded board — every eval drives that, none touch the shared world. Schema committed in `supabase/migrations/`. **Proven in a real browser 2026-09-01 (local build, anonymous sign-ins ON):** `node evals/live-two-visitors.mjs` — visitor B books mid-run, visitor A's open page shows "Another patient" with no reload, the database refuses B the slot A holds, 13/13 page steps; evidence `docs/evidence/clinic/live-another-patient.png`. **Re-run against PRODUCTION 2026-09-01 after Arav's deploy: green** (`docs/evidence/clinic/2026-09-01-live-board-production.txt`). |
| Routes | **`/` is the product** (clinic landing) · `/clinic` same landing · `/clinic/book` the product · `/terminal` Rokan, kept and still evalled |
| WebMCP tools | **nine** on `/clinic/book` (SPEC-V2, 2026-08-31): list, **find_slots**, **clinicians**, hold, status, release, **prepare_cancel**, **prepare_move**, explain_confirm. The prepare tools only ARM the dock — cancel/move are performed by a trusted press through the same gate as booking; a move swaps atomically with the target frozen |
| **The invariant** | **no booking tool exists** — asserted by unit test (by name and by verb, plus description budgets), by nine negative assertions in a live browser, and by test fakes that throw if a tool reaches `book()`/`confirm()`/`cancel()`/`move()` |
| **Dynamic testing** (2026-08-31, per Arav: "real product, not a POC") | `clinic-chaos` (47 steps: garbage/injection inputs, double-arming, hold spam, re-hold refused `already_held_by_you`, reload recovery), `clinic-phone-acts` (cancel/move docks at 390px: no horizontal scroll, key reachable, press works), `clinic-soak` (~10 min since the retune: cancel arm expires at 180 s WITHOUT cancelling, deferred wave rolls, tools coherent on the new board). **All three green locally AND against production.** Chaos+phone joined verify-deployed (17 checks: 3 routes + 13 cases + axe; axe prints its own three route lines); soak kept out of verify-deployed (its waits exceed the per-case timeout; run it via run-all or the harness with `?test=1`) |
| **Eval suite** | **26/26 cases pass locally, 0 failed** — 17 clinic (incl. voice-tour/cancel/move, the dynamic trio chaos/phone-acts/soak, and gesture-boot) + 9 legacy; the kept terminal also re-proven with a real PTY bridge (11/11, 4 judge-only skips) |
| `clinic-thesis` | 42 steps: tools listed → `clinic_hold_slot` holds → dock arms → **synthetic click blocked** → **trusted Enter books** → `hold_status` says `human_only`. Measured: **1** human input |
| `clinic-manual-tax` | the same booking by keyboard: **36 measured** trusted inputs (case asserts ≥ 30) and the form is still not valid |
| `clinic-hold-lapses` | full 180 s TTL with no keypress → slot returns, **nothing booked**, dock disarmed |
| `clinic-rival-race` | the rival takes a slot mid-read; holding a gone slot is **refused with a reason** |
| `clinic-landing-frontdoor` | `/` carries the product and no terminal |
| **Accessibility** | **0 axe violations** on `/`, `/clinic`, `/clinic/book` across WCAG 2.0/2.1/2.2 A + AA — gated by `node evals/a11y.mjs` (it found 3 on the first run; fixed) |
| Contract | `DropDriver.book()` ratified — T8 finding #1 closed; `hold()` is the only registered verb |
| Judge-facing text | `README.md` and `docs/SUBMISSION.md` rewritten for the product; `SECURITY.md` §10 states the trust boundaries incl. the residual one |
| Evidence | `docs/evidence/clinic/` — traces + screenshots for every claim above |

## Blocking — only Arav / Aarya can clear these

1. ~~**Deploy.**~~ **DONE 2026-08-31.** Live at **https://rokan-terminal.vercel.app** and verified
   end to end against production: `node evals/verify-deployed.mjs --url=https://rokan-terminal.vercel.app`
   → **all 15 checks green** after the 2026-08-31 redeploy (routes 200 · the full thesis · agent edge
   cases · responsive at 390 px · rival race · hold lapse · the -:1 receipt · front door · landing
   clock ticking on a phone · axe clean ×3 · and the agent is now told the live countdown —
   `next_wave_seconds` asserted numeric). Evidence:
   `docs/evidence/clinic/2026-08-31-deployed-verification.txt`.
   **GESTURE build deployed and re-verified 2026-09-01:** Arav ran the 20-check verifier — all
   green (incl. chaos + phone-acts). Gesture assets confirmed ON the origin (model 8,373,440 bytes,
   wasm 200s) and the full boot pipeline proven AGAINST PRODUCTION with a fake camera: wasm under
   prod CSP → model streamed → getUserMedia → `ready` → clean opt-out teardown. Still owed: Aarya's
   real-hand dwell test (GESTURE.md).
   **SPEC-V2 redeployed and re-verified 2026-08-31 evening:** Arav shipped the nine-tool build and
   ran the verifier himself from the repo root — **18/18 checks green** against the live origin,
   including `clinic-voice-tour`, `clinic-cancel`, `clinic-move` and axe ×3. Evidence:
   `docs/evidence/clinic/2026-08-31-deployed-verification-v2.txt`.
2. **Repo is PRIVATE.** Devpost requires public source with an OSS licence (LICENSE is Apache-2.0
   already). Flip it, and rename — `webmcp-private` is the first thing a judge reads.
3. **The origin still says `rokan-terminal`.** The submitted product is a clinic booking page; the
   URL on the Devpost card will read like a different project. Cheapest fix is a Vercel domain alias
   (Project → Settings → Domains → add e.g. `the-drop.vercel.app`) — the deployment does not need
   rebuilding, and the verifier re-runs against the new origin in one command.
4. **The name.** The fictional clinic is "Cedarfield Clinic"; the *product* has no name. Humans pick
   it (Devpost's own guidance). It is a string swap in `ClinicFrame.tsx` plus the two doc headers.
5. **ChatGPT desktop verification.** The tools are proven to register in Chrome against the live
   origin (nine seeded, eleven on the shared board, twelve once booked). Sol/Terra is still unmeasured, and it is the client the challenge names: open
   `https://rokan-terminal.vercel.app/clinic/book`, check the Site-tools arrow lists eleven `clinic_*`
   tools, say *"hold me the earliest appointment"*, then press Enter.
6. **Video** (< 3 min, audio, YouTube). Script is shot-by-shot in `docs/VIDEO-SCRIPT.md`; ffmpeg on
   the recording Mac needs fixing first.

## Mine, next, in order

- [x] README rewritten for the product + the 60-second judge script
- [x] `docs/SUBMISSION.md` rewritten; prior art (Mabel's Table) named before a judge names it
- [x] SECURITY §10 on main, corrected to the shipped product
- [x] Accessibility gate (`evals/a11y.mjs`) — committed, and the three violations it found are fixed
- [x] The front door: `/` is the product; Rokan kept at `/terminal`
- [x] **Deployed-URL run** — all 13 checks green against production, evidence committed
- [ ] The video's numbers pinned to the receipt the page itself shows (needs one manual browser run)

## UX proof sweep (2026-08-31, against production — the "prove it to yourself" pass)

Driven, photographed and asserted on the live origin, both widths:
- **Full desktop journey** (board → detail → form → errors → held → released → rival → booked):
  36 steps, 0 failed, 0 page errors. The GOV.UK-style error summary, the per-field messages and the
  focus handling are genuinely well built.
- **Full phone journey** (390×844: detail → form → dock armed → booked → receipt): 28 steps, 0
  failed, no overflow at any state. The dark dock with the ⏎ keycap, "45 SECONDS LEFT" and
  "0 SYNTHETIC PRESSES BLOCKED" is the best single screen in the product
  (`docs/evidence/clinic/phone-dock-armed.png`).
- **The receipt** close-up: honest empty by-hand lane ("Not measured yet — book one appointment
  yourself and this fills in"), agent lane "1 · 1 key · your agent … could not press the key", and
  the counting rules cited on the page itself.
- **Wave rollover proven live**: booking → grace holds the board ("nothing … cleared out from under
  you") → next wave lands (≥4 open) → the booked slot leaves the board, the receipt survives.
  13 steps, 0 failed, ~2.5 min real time.
- **Design decision reviewed and endorsed, not changed:** Esc does NOT release a hold. The dock is
  not a modal; an accidental Esc silently discarding a hard-won hold is a worse failure than
  tabbing twice to "Give it back". Recorded here so nobody "fixes" it later.
- Native form controls render light inside the light page (`color-scheme: light` scoped on
  `.clinic` — Aarya had already handled the dark-shell leak).

## Rails that must not slip
The fictional clinic and the simulated rival stay labelled on screen, and another real visitor is
labelled "Another patient", never as the rival. Every number on screen is measured by the code that
shows it. The accessibility framing is an *additional operable path*, never a conformance
substitute. Keyboard/switch is the primary confirm; the camera is on in the build and strictly
opt-in per person.
