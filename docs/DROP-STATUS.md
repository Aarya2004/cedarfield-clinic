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
| **Eval suite** | **14/14 cases pass, 0 failed** — 5 clinic + 9 legacy Rokan |
| `clinic-thesis` | 33 steps: tools listed → `clinic_hold_slot` holds → dock arms → **synthetic click blocked** → **trusted Enter books** → `hold_status` says `human_only`. Measured: **1** human input |
| `clinic-manual-tax` | the same booking by keyboard: **36 trusted inputs and the form is still not valid** (a floor — see the case header) |
| `clinic-hold-lapses` | full 45 s TTL with no keypress → slot returns, **nothing booked**, dock disarmed |
| `clinic-rival-race` | the rival takes a slot mid-read; holding a gone slot is **refused with a reason** |
| `clinic-landing-frontdoor` | `/` carries the product and no terminal |
| **Accessibility** | **0 axe violations** on `/`, `/clinic`, `/clinic/book` across WCAG 2.0/2.1/2.2 A + AA — gated by `node evals/a11y.mjs` (it found 3 on the first run; fixed) |
| Contract | `DropDriver.book()` ratified — T8 finding #1 closed; `hold()` is the only registered verb |
| Judge-facing text | `README.md` and `docs/SUBMISSION.md` rewritten for the product; `SECURITY.md` §10 states the trust boundaries incl. the residual one |
| Evidence | `docs/evidence/clinic/` — traces + screenshots for every claim above |

## Blocking — only Arav / Aarya can clear these

1. **Deploy.** `rokan-terminal.vercel.app/clinic` is **404**; prod still serves Rokan. No git auto-deploy on
   this project → `cd apps/web && vercel --prod --yes`. **Everything below waits on this.**
2. **Repo is PRIVATE.** Devpost requires a public repo with an OSS licence (LICENSE exists, Apache-2.0).
   Also worth renaming — `webmcp-private` is the first thing a judge reads.
3. **The name.** "Cedarfield Clinic" is Aarya's placeholder for the *fictional clinic*; the **product** has no
   name. Humans pick it (Devpost's own guidance says not to let AI name it). One string swap in the copy.
4. **ChatGPT desktop verification** (after deploy). Two questions only that hour answers: does Sol/Terra
   list the five tools on `/clinic/book`, and does a tool call + a real keypress complete a booking there?
5. **Video** (< 3 min, audio, YouTube). ffmpeg was broken on the demo Mac — fix before recording.

## Mine, next, in order

- [x] README rewritten for the product + the 60-second judge script
- [x] `docs/SUBMISSION.md` rewritten; prior art (Mabel's Table) named before a judge names it
- [x] SECURITY §10 on main, corrected to the shipped product
- [x] Accessibility gate (`evals/a11y.mjs`) — committed, and the three violations it found are fixed
- [x] The front door: `/` is the product; Rokan kept at `/terminal`
- [ ] **Deployed-URL run** of the clinic evals + `node evals/a11y.mjs --url=…` (blocked on the deploy)
- [ ] The video's numbers pinned to the receipt the page itself shows (needs one manual browser run)
- [ ] Optional if time: the waitlist cascade, so a lapsed hold offers the next person their own window

## Rails that must not slip
Fictional inventory and the simulated rival stay labelled on screen. Every number on screen is measured by
the code that shows it. The accessibility framing is an *additional operable path*, never a conformance
substitute. Keyboard/switch is the primary confirm; the camera is a flagged enhancement, off by default.
