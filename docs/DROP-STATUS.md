# THE DROP — state of play and the road to submission (2026-08-31, Engineer #4)

Product locked. Aarya built the surface; I own the contract, the proofs, and the submission spine.
This file is the single source of truth for what is green, what is blocking, and who owns each item.

## Green right now (verified end to end on this machine, main @ HEAD)

| Thing | State |
|---|---|
| `apps/web` gate | typecheck clean · **433/433 unit tests** · lint 0 errors · production build clean |
| Routes | **`/` is the product** (clinic landing) · `/clinic` same landing · `/clinic/book` the product · `/terminal` Rokan, kept and still evalled |
| WebMCP tools | **nine** on `/clinic/book` (SPEC-V2, 2026-08-31): list, **find_slots**, **clinicians**, hold, status, release, **prepare_cancel**, **prepare_move**, explain_confirm. The prepare tools only ARM the dock — cancel/move are performed by a trusted press through the same gate as booking; a move swaps atomically with the target frozen |
| **The invariant** | **no booking tool exists** — asserted by unit test (by name, in the defs, in the descriptions), by nine negative assertions in a live browser, and by test fakes that throw if a tool reaches `book()`/`confirm()`/`cancel()`/`move()` |
| **Dynamic testing** (2026-08-31, per Arav: "real product, not a POC") | `clinic-chaos` (47 steps: garbage/injection inputs, double-arming, hold spam, re-hold refused `already_held_by_you`, reload recovery), `clinic-phone-acts` (cancel/move docks at 390px: no horizontal scroll, key reachable, press works), `clinic-soak` (~3 min: cancel arm expires at 45s WITHOUT cancelling, deferred wave rolls, tools coherent on the new board). **All three green locally AND against production.** Chaos+phone joined verify-deployed (now 20 checks); soak documented as manual (its waits exceed the per-case timeout) |
| **Eval suite** | **25/25 cases pass locally, 0 failed** — 16 clinic (incl. voice-tour/cancel/move + the dynamic trio chaos/phone-acts/soak) + 9 legacy; the kept terminal also re-proven with a real PTY bridge (11/11, 4 judge-only skips) |
| `clinic-thesis` | 42 steps: tools listed → `clinic_hold_slot` holds → dock arms → **synthetic click blocked** → **trusted Enter books** → `hold_status` says `human_only`. Measured: **1** human input |
| `clinic-manual-tax` | the same booking by keyboard: **36 measured** trusted inputs (case asserts ≥ 30) and the form is still not valid |
| `clinic-hold-lapses` | full 45 s TTL with no keypress → slot returns, **nothing booked**, dock disarmed |
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
5. **ChatGPT desktop verification.** The five tools are proven to register in Chrome against the live
   origin. Sol/Terra is still unmeasured, and it is the client the challenge names: open
   `https://rokan-terminal.vercel.app/clinic/book`, check the Site-tools arrow lists five `clinic_*`
   tools, say *"hold me the earliest appointment"*, then press Enter.
6. **Video** (< 3 min, audio, YouTube). Script is shot-by-shot in `docs/VIDEO-SCRIPT.md`; ffmpeg on
   the demo Mac needs fixing first.

## Mine, next, in order

- [x] README rewritten for the product + the 60-second judge script
- [x] `docs/SUBMISSION.md` rewritten; prior art (Mabel's Table) named before a judge names it
- [x] SECURITY §10 on main, corrected to the shipped product
- [x] Accessibility gate (`evals/a11y.mjs`) — committed, and the three violations it found are fixed
- [x] The front door: `/` is the product; Rokan kept at `/terminal`
- [x] **Deployed-URL run** — all 13 checks green against production, evidence committed
- [ ] The video's numbers pinned to the receipt the page itself shows (needs one manual browser run)
- [ ] Optional if time: the waitlist cascade, so a lapsed hold offers the next person their own window

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
Fictional inventory and the simulated rival stay labelled on screen. Every number on screen is measured by
the code that shows it. The accessibility framing is an *additional operable path*, never a conformance
substitute. Keyboard/switch is the primary confirm; the camera is a flagged enhancement, off by default.
