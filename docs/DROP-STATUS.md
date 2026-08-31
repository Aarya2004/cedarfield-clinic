# THE DROP — state of play and the road to submission (2026-08-31, Engineer #4)

Product locked. Aarya built the surface; I own the contract, the proofs, and the submission spine.
This file is the single source of truth for what is green, what is blocking, and who owns each item.

## Green right now (verified end to end on this machine, main @ HEAD)

| Thing | State |
|---|---|
| `apps/web` gate | typecheck clean · **418/418 unit tests** · lint 0 errors · production build clean |
| Routes | **`/` is the product** (clinic landing) · `/clinic` same landing · `/clinic/book` the product · `/terminal` Rokan, kept and still evalled |
| WebMCP tools | five on `/clinic/book`: `clinic_list_drops`, `clinic_hold_slot`, `clinic_hold_status`, `clinic_release_hold`, `clinic_explain_confirm` |
| **The invariant** | **no booking tool exists** — asserted by unit test (by name, in the defs, in the descriptions), by five negative assertions in a live browser, and by test fakes that throw if a tool reaches `book()`/`confirm()` |
| **Eval suite** | **17/17 cases pass, 0 failed** — 8 clinic + 9 legacy Rokan |
| `clinic-thesis` | 33 steps: tools listed → `clinic_hold_slot` holds → dock arms → **synthetic click blocked** → **trusted Enter books** → `hold_status` says `human_only`. Measured: **1** human input |
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
   → **all 13 checks green** (routes 200 · five tools register in a real browser · no booking tool ·
   synthetic press refused · trusted press books · hold lapses clean · agent edge cases · responsive ·
   front door is the product · axe clean on all three routes). Evidence:
   `docs/evidence/clinic/2026-08-31-deployed-verification.txt`.
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

## Rails that must not slip
Fictional inventory and the simulated rival stay labelled on screen. Every number on screen is measured by
the code that shows it. The accessibility framing is an *additional operable path*, never a conformance
substitute. Keyboard/switch is the primary confirm; the camera is a flagged enhancement, off by default.
