# SUBMISSION.md — Devpost description (paste-ready)

> Everything below the rule is the Devpost text. HTML comments are notes to us and must be stripped
> before pasting. Every number below is produced by a committed eval case; none is estimated.

**Project name:** _TODO — the two founders pick it; "The Drop" is the working title._
**Tagline:** Your agent can hold it. Only you can take it.
**Live URL:** https://rokan-terminal.vercel.app (the front door is the product; the booking page is `/clinic/book`)
<!-- Deployed and verified 2026-08-31: node evals/verify-deployed.mjs --url=… — all checks green
     (routes, nine tools, no booking tool, synthetic press refused, trusted press books, hold
     lapses clean, agent edge cases, responsive, front door is the product, axe clean ×3).
     Evidence: docs/evidence/clinic/2026-08-31-deployed-verification.txt
     TODO: the origin still carries the pre-pivot project name — see DROP-STATUS. -->
**Repo:** `https://github.com/<owner>/<repo>` (Apache-2.0)
<!-- TODO(before submit): the repo is PRIVATE. Devpost requires public source. Flip it, and rename
     it — "webmcp-private" is the first thing a judge reads. -->
**Video:** _TODO — unlisted YouTube, < 3:00, with audio._

---

## What it is

A clinic releases cancelled appointments in waves. They are gone in seconds.

On this page your agent does the fast, expensive part — watch the drop, compare, **hold** a slot the
instant it appears — and then it stops, because **the page publishes no booking tool**. The only
thing that books an appointment is one act from the person the appointment is for: **one key press,
one switch press, or one held gesture.** Nothing an agent can call, and nothing a script can fake,
reaches that step.

## How to test it — 60 seconds, no login, nothing to install

1. Open the live URL in **ChatGPT desktop** (GPT-5.6 Sol or Terra) or **Chrome 152+** with
   `chrome://flags/#enable-webmcp-testing`, then click **Book an appointment** (`/clinic/book`).
2. Check the **Site tools** arrow (or DevTools → Application → WebMCP): seven `clinic_*` tools —
   and no booking, cancel, or move tool among them. Watch the list again after step 5: three more appear.
3. Ask your agent: *"hold me the earliest appointment."* A slot freezes with a 45-second bar and
   the dock at the bottom arms.
4. Ask it to *"just book it."* It will explain that it can't, and why.
5. **Press Enter.** Booked — the receipt shows what the same task costs by hand versus the one
   press it cost you, and **three new tools appear in your agent's list**, born by that press.

Everything the description claims is also re-runnable from the repo in two commands (below).

## The problem, and who has it

Every task on the web costs a number of interactions. For a mouse user that number is invisible. For
someone using a switch, voice control, or a head pointer, each interaction costs seconds and real
physical effort — so an ordinary booking form is a long, tiring project, and a **timed** release is
not merely hard but structurally impossible: no assistive technology wins a race against a pointer.
Assistive technology has spent forty years making the gesture easier to perform. It has never made
the gesture unnecessary.

A declared tool does. `hold_slot(id)` contains no drag and no race. That is the specific thing
WebMCP changes for this person, and it is why the agent here is allowed to do everything **except**
the one act that should never be automated.

Measured on the page itself, by a counter that only counts events the browser marks trusted:

| | interactions the person spends |
|---|---|
| Booking by hand, keyboard only | **36 measured** (≥ 30 asserted), and the form is not finished yet |
| Booking with your agent | **1** |

## What humans and agents accomplish together here

Neither party can complete the task alone, and that is the design rather than a limitation.

- **The agent** watches a drop nobody can watch continuously, compares six slots faster than they can
  be read, holds one the instant it appears, keeps the clock, and explains the state out loud.
- **The person** does the one thing that must stay theirs: they decide, with a single act small
  enough to be available to almost anyone — a key, a switch, or a held gesture.
- **The page** enforces the split so neither has to trust the other's word for it.

## Why WebMCP, specifically

Seven tools are registered on `/clinic/book` when it loads (`document.modelContext.registerTool()`):
`clinic_list_drops`, `clinic_find_slots`, `clinic_clinicians`, `clinic_hold_slot`,
`clinic_hold_status`, `clinic_release_hold`, `clinic_explain_confirm`. **Three more are born by the
human's press**: the instant a person books, `clinic_my_appointment`, `clinic_prepare_cancel` and
`clinic_prepare_move` are registered live — `toolchange` fires, the agent's list grows — and they
are unregistered when the last booking is gone. The tool surface is not a static manifest; it is a
live statement of what the person has done. In MCP-B's taxonomy (read · navigation · human-approved
write): ten read/arming tools and zero write tools — the writes are the person's, at the page. The writes — hold, release, and the two prepare tools — are all
reversible and self-expiring; `clinic_prepare_cancel` / `clinic_prepare_move` **arm** the page's
dock and perform nothing: the cancel or the move happens only on a browser-trusted press, through
the same gate as booking. A search that matches nothing names the constraint that eliminated
everything, so an agent on a voice call can say which filter to relax.

**The tenth tool is the design.** There is no booking tool — and no cancel or move tool: booking is
gated on a browser-trusted event, which no tool call, no console `.click()` and no extension can
produce. Every synthetic attempt is counted and shown on screen instead of being silently dropped.

That is the honest answer to "could you do this without WebMCP?" — no. Behind the page a database
enforces fairness between strangers — one hold each, hold-before-book, only your own booking
cancels or moves, an atomic move — and it cannot enforce that a *human* pressed anything; no
server can. A page's own tool surface is the only place you can hand an agent real capability
while making the consequential act *inexpressible* in the API it is given, and the only place a
trusted press can be told from a scripted one. `clinic_explain_confirm` exists so the agent can
explain that boundary in its own words when a user asks it to just book the thing.

## Implementation

Next.js 15 (App Router, TS strict) on Vercel. **The board is shared and live**: one Supabase
Postgres inventory every visitor sees — open it in two windows and race yourself. An anonymous
session per browser (no sign-up, no credentials), realtime updates with a poll fallback, and the
integrity a page can never provide for two strangers at once enforced by the database as RLS +
`SECURITY DEFINER` functions: one hold per visitor, hold-before-book, only your own booking cancels
or moves, an atomic move, three bookings each at most. Waves release on a 90-second server clock
for everyone at once. **No model call of our own anywhere in the product**: the reasoning is the
visitor's own agent, in their own client. One `DropDriver` seam is where the backend plugs in
(`supabase-driver.ts`; the seeded in-page driver behind `?test=1` is what every eval drives);
`hold()` is the agent's verb and the only one ever registered, while `book()`, `confirm()`,
`cancel()` and `move()` are the human's and are unreachable from any tool — the unit-test fakes
throw if a tool so much as reaches for them.

Verification is a first-class part of the repo, not a claim in a README:

| Proof | Case |
|---|---|
| Seven tools at load, ten after the human books (three born live); **no** booking/cancel/move tool (nine negative assertions) | `evals/cases/clinic-thesis.json` |
| A synthetic press is **blocked**; a browser-trusted press **books** — same page, same run | same case |
| The agent path costs the person **1** interaction | same case |
| A hold lapses after 45 s: the slot returns, **nothing was booked** | `clinic-hold-lapses.json` |
| A rival takes a slot mid-read; holding a gone slot is refused **with a reason** | `clinic-rival-race.json` |
| Booking by hand costs ≥ 30 asserted / **36 measured** interactions | `clinic-manual-tax.json` |
| Cancel/move are armed by the agent, performed only by a trusted press; a move swaps atomically | `clinic-cancel.json`, `clinic-move.json` |
| The voice surface: searches, clinician listing, refusals readable aloud | `clinic-voice-tour.json` |
| **0 axe violations** across WCAG 2.0/2.1/2.2 A + AA on all three routes | `node evals/a11y.mjs` |

| The shared board is real: visitor B books, visitor A's open page shows "Another patient" with no reload; the database refuses B visitor A's held slot | `node evals/live-two-visitors.mjs` |

Plus 441 unit tests. Traces and screenshots for every row are committed under
`docs/evidence/clinic/`. The seeded-board proofs above re-run from a clean clone in two commands;
the live board's schema is committed under `supabase/migrations/`.

## What we are not claiming

- **The clinic is fictional and the page says so on every screen.** Nothing real is booked, no
  payment is taken, no one signs up (an anonymous per-browser session only). The rival is a
  labelled simulation; every other name on the board is a real visitor, labelled "Another patient",
  never as the rival.
- **This is not a conformance substitute.** The agent path is an *additional operable path* beside a
  keyboard-accessible page — never "the accessible version". W3C's APA group is explicit that an
  agent route does not discharge a page's own obligations, and we agree with them.
- **Keyboard and switch are the primary confirm.** The camera gesture is **live and strictly
  opt-in** — no lens opens until the person clicks "Enable camera" on the dock. On-device, from our
  origin, visible threshold, dwell resets on any flicker so a tremor cannot fire it (WCAG 2.5.4),
  keyboard always beside it. And voice is deliberately NOT a confirm channel: the agent has a voice
  — in a live demo it could speak the confirmation into the mic itself. It does not have a hand.
- **We are not the only entry that withholds a tool, and we say so.** Several entries in this
  challenge gate a consequential act behind a human click, and one registers the withheld tool when
  a button is pressed. What no other entry does, as far as we can find: the withholding is
  *permanent and platform-enforced* (a browser-trusted event, not a UI promise), every synthetic
  attempt is **counted on screen**, the cost of the task is **measured** both ways by the page
  itself, an atomic move keeps a rescheduling human from ever racing their own cancellation — and
  the human-final act itself is made available to someone who cannot press anything at all, with a
  held gesture.
- **We did not invent the hold.** Netlify's own WebMCP demo, *Mabel's Table*, has agents place
  five-minute holds on restaurant tables. The inversion is ours: there the agent also confirms; here
  it cannot, the race is visible rather than implied, and the page counts what the task costs you
  either way.
- Not a scalper tool: **your own agent, your own booking, no resale, and only a human books.**

## What is next

A real clinic's scheduling system behind the same `DropDriver` seam the live board already uses;
the waitlist cascade, so that when a hold
lapses the next person receives their own full window and nobody has to race at all; and a
standards note to the WebMCP CG, whose accessibility section is currently an empty stub, proposing
consequential acts as human-only affordances that a tool surface deliberately cannot express.
