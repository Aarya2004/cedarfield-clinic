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
instant it appears — and then it stops, because **the page publishes no booking tool at load**. The
only thing that books an appointment is one act from the person the appointment is for: **one key
press, one switch press, or one held gesture.** Nothing an agent can call, and nothing a script can
fake, reaches that step.

**The booking tool is born by your hand.** Press *Let my assistant book for me* (or hold an open
palm to the camera) and the page births `clinic_book_slot` — one booking, ten minutes. Say *"yes,
book it"* and the agent books; the page records **0 interactions — under the permission you gave**;
the tool dies with the booking. Your hand roots every booking, pressed once, earlier.

## How to test it — 60 seconds, no login, nothing to install

1. Open the live URL in **ChatGPT desktop** (GPT-5.6 Sol or Terra) or **Chrome 152+** with
   `chrome://flags/#enable-webmcp-testing`, then click **Book an appointment** (`/clinic/book`).
2. Check the **Site tools** arrow (or DevTools → Application → WebMCP): eleven `clinic_*` tools —
   and no booking, cancel, or move tool among them. Watch the list again after step 5: one more appears.
3. Ask your agent: *"hold me the earliest appointment."* A slot freezes with a three-minute bar, and the page's **Agent activity** log records the call in its own words ("held 8:40 AM with Dr. Fanning · 180 s, your press books it") — you never have to trust the chat's narration, and
   the dock at the bottom arms.
4. Ask it to *"just book it."* It will explain that it can't, and why.
5. **Press Enter.** Booked — the receipt shows what the same task costs by hand versus the one
   press it cost you, and **a new tool appears in your agent's list**, born by that press.

Everything the description claims is also re-runnable from the repo in two commands (below).

## What the standards bodies are asking for — and what this page answers

The W3C APA (accessibility) working group reviewed WebMCP on 5 August 2026 and recorded that they
are "excited for the possibilities of this technology" but "concerned about the API in its current
form", asking for designs that keep "review by the user" in the loop and never interfere with the
accessibility tree. The specification's own *Accessibility considerations* section is, at
submission time, empty (WebMCP issue #277). This page is one concrete answer: the agent does
everything a person with a switch cannot — watch, search, hold, queue — and the one act that
must stay the person's is gated on the browser's own notion of a real keypress, with a keyboard
path first, a camera gesture as an opt-in, and every synthetic attempt counted in the open.

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

Nine base tools are registered on `/clinic/book` when it loads (`document.modelContext.registerTool()`):
`clinic_list_drops`, `clinic_find_slots`, `clinic_clinicians`, `clinic_hold_slot`,
`clinic_hold_status`, `clinic_release_hold`, `clinic_prepare_cancel`, `clinic_prepare_move`,
`clinic_explain_confirm` — the arming tools included, on purpose, so a person with no booking always
hears *"you have nothing booked"* rather than *"I have no such tool"*. **The tenth is born by the
human's press**: the instant a person books, `clinic_my_appointment` is registered live —
`toolchange` fires, the agent's list grows — and it is unregistered when the last booking is gone.
What the press creates is purely additive: a client slow to notice `toolchange` loses nothing; a
client that sees it watches a human act change the agent's surface.

**Both halves of the API.** The patient-details form is also published *declaratively*
(`toolname`, `tooldescription`, a `toolparamdescription` per field) so Chrome lists it as a tool an
agent can fill — with no `toolautosubmit`: the agent fills, the person reads it over and presses
Review, then Book; a submit attributed to an agent or a script is refused and counted. This is the
"review by the user" model the W3C APA group asked for on 5 August 2026, built with the primitive
the platform provides for exactly that.

**And on the shared board — where every real visitor is — two more tools make eleven, and the race is gone.** `clinic_join_waitlist` and
`clinic_leave_waitlist`, let an agent put its human *in line* for a slot someone else holds. When
that slot comes back — a hold lapses, a cancellation, a move — the server hands it to the first in
line as a fresh three-minute hold; the dock arms by itself (*"It came back to you"*) and one press
books it. The agent does the watching a person with a switch cannot; the person does the one act
that must stay theirs; the database keeps the order between strangers. In MCP-B's taxonomy (read ·
navigation · human-approved write): read/arming tools, two reversible queue verbs, and zero write
tools — the writes are the person's, at the page. The writes — hold, release, and the two prepare tools — are all
reversible and self-expiring; `clinic_prepare_cancel` / `clinic_prepare_move` **arm** the page's
dock and perform nothing: the cancel or the move happens only on a browser-trusted press, through
the same gate as booking. A search that matches nothing names the constraint that eliminated
everything, so an agent on a voice call can say which filter to relax.

**The missing tool is the design.** There is no booking tool at load — and no cancel or move tool,
ever: those acts are gated on a browser-trusted event, which no tool call, no console `.click()` and
no extension can produce. Every synthetic attempt is counted and shown on screen instead of being
silently dropped. The one booking tool that can exist is created by that same trusted event: the
person's press births it, for one booking, and the booking kills it.

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
or moves, an atomic move, three bookings each at most. Waves release on a six-minute server clock
for everyone at once. **No model call of our own anywhere in the product**: the reasoning is the
visitor's own agent, in their own client. One `DropDriver` seam is where the backend plugs in
(`supabase-driver.ts`; the seeded in-page driver behind `?test=1` is what every eval drives);
`hold()` is the agent's verb and the only one ever registered, while `book()`, `confirm()`,
`cancel()` and `move()` are the human's and are unreachable from any tool — the unit-test fakes
throw if a tool so much as reaches for them.

Verification is a first-class part of the repo, not a claim in a README:

| Proof | Case |
|---|---|
| Nine tools at load, ten after the human books (one born live, additive only); **no** booking/cancel/move tool (nine negative assertions) | `evals/cases/clinic-thesis.json` |
| A synthetic press is **blocked**; a browser-trusted press **books** — same page, same run | same case |
| The agent path costs the person **1** interaction | same case |
| A hold lapses after 3 min: the slot returns, **nothing was booked** | `clinic-hold-lapses.json` |
| A rival takes a slot mid-read; holding a gone slot is refused **with a reason** | `clinic-rival-race.json` |
| Booking by hand costs ≥ 30 asserted / **36 measured** interactions | `clinic-manual-tax.json` |
| Cancel/move are armed by the agent, performed only by a trusted press; a move swaps atomically | `clinic-cancel.json`, `clinic-move.json` |
| The voice surface: searches, clinician listing, refusals readable aloud | `clinic-voice-tour.json` |
| **0 axe violations** across WCAG 2.0/2.1/2.2 A + AA on all three routes | `node evals/a11y.mjs` |
| The shared board is real: visitor B books, visitor A's open page shows "Another patient" with no reload; the database refuses B the slot A holds | `node evals/live-two-visitors.mjs` |
| The cascade: A queues for B's held slot; B lets go; A's dock arms by itself — "It came back to you" — nobody raced | same command |

Plus 444 unit tests. Traces and screenshots for every row are committed under
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

A real clinic's scheduling system behind the same `DropDriver` seam the live board already uses
(the waitlist cascade shipped — see above); a longer queue window across releases, so that when a hold
lapses the next person receives their own full window and nobody has to race at all; and a
standards note to the WebMCP CG, whose accessibility section is currently an empty stub, proposing
consequential acts as human-only affordances that a tool surface deliberately cannot express.
