# THE DROP — state of play and the road to submission (2026-08-31, Engineer #4)

Product locked. Aarya built the surface; I own the contract, the proofs, and the submission spine.
This file is the single source of truth for what is green, what is blocking, and who owns each item.

## Green right now (verified on this machine, main @ 420db61)

| Thing | State |
|---|---|
| `apps/web` gate | `typecheck` clean · **418/418 tests** · lint 0 errors (2 warnings) |
| Product routes | `/clinic` (landing) · `/clinic/book` (the product) — build clean |
| WebMCP tools | five registered on `/clinic/book`: `clinic_list_drops`, `clinic_hold_slot`, `clinic_hold_status`, `clinic_release_hold`, `clinic_explain_confirm` |
| **The invariant** | **no booking tool exists** — asserted by unit test (by name, in the defs, in the descriptions) and by five negative assertions in the live eval |
| `clinic-thesis` eval | **33 steps, 0 failed, 0 page errors**: tools listed → `clinic_hold_slot` holds → board flips to `held_by_you` → dock arms → **synthetic click blocked** (untrusted counter increments, slot stays held) → **CDP-trusted Enter books it** → `clinic_hold_status` answers `booking: human_only`. Measured: **1** trusted human input on the agent path |
| `clinic-manual-tax` eval | the same booking by keyboard: **36 trusted inputs and the form is still not valid** (a floor, not the total — see the case header) |
| Contract | `DropDriver.book()` ratified — closes T8 finding #1; `hold()` is the only verb ever registered, `book()`/`confirm()` are human-only and unreachable from any tool |
| Evidence | `docs/evidence/clinic/` — trace JSONL + `held-armed.png`, `booked.png`, `manual-form.png` |

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

- [ ] README rewritten for the product (judges may score from it alone) + the 60-second judge script
- [ ] `docs/SUBMISSION.md` rewritten: the four criteria, the honest numbers, prior art named (Mabel's Table)
- [ ] SECURITY §10 ported to main (trust boundaries: what a tool can and cannot reach)
- [ ] Deployed-URL run of both clinic evals once Vercel is live
- [ ] A third eval: the hold lapses and the slot returns (the TTL honesty beat)

## Rails that must not slip
Fictional inventory and the simulated rival stay labelled on screen. Every number on screen is measured by
the code that shows it. The accessibility framing is an *additional operable path*, never a conformance
substitute. Keyboard/switch is the primary confirm; the camera is a flagged enhancement, off by default.
