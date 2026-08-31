# SUBMISSION.md — Devpost description (paste-ready)

> Everything below the rule is the Devpost text. HTML comments are notes to us and must be stripped
> before pasting. Every number below is produced by a committed eval case; none is estimated.

**Project name:** _TODO — the two founders pick it; "The Drop" is the working title._
**Tagline:** Your agent can hold it. Only you can take it.
**Live URL:** https://rokan-terminal.vercel.app (the front door is the product; the booking page is `/clinic/book`)
<!-- Deployed and verified 2026-08-31: node evals/verify-deployed.mjs --url=… — all checks green
     (routes, five tools, no booking tool, synthetic press refused, trusted press books, hold
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

Five tools are registered on `/clinic/book` with `document.modelContext.registerTool()`:
`clinic_list_drops`, `clinic_hold_slot`, `clinic_hold_status`, `clinic_release_hold`,
`clinic_explain_confirm`. Two of them write — `clinic_hold_slot` and `clinic_release_hold` — and
everything they write is reversible and self-expiring.

**The sixth tool is the design.** There is no booking tool, and there cannot be one: booking is
gated on a browser-trusted event, which no tool call, no console `.click()` and no extension can
produce. Every synthetic attempt is counted and shown on screen instead of being silently dropped.

That is the honest answer to "could you do this without WebMCP?" — no. A REST endpoint would let
anything holding the URL book the slot. A page's own tool surface is the only place you can hand an
agent real capability while making the consequential act *inexpressible* in the API it is given. The
fifth tool exists so the agent can explain that boundary in its own words when a user asks it to
just book the thing.

## Implementation

Next.js 15 (App Router, TS strict) on Vercel. The board is a seeded in-page driver — no accounts, no
database, no backend, **and no model call of our own anywhere in the product**: the reasoning is the
visitor's own agent, in their own client. One `DropDriver` seam is the single place a real clinic
backend would plug in; `hold()` is the agent's verb and the only one ever registered, while `book()`
and `confirm()` are the human's and are unreachable from any tool — the unit-test fakes throw if a
tool so much as reaches for them.

Verification is a first-class part of the repo, not a claim in a README:

| Proof | Case |
|---|---|
| Five tools registered; **no** booking tool (five negative assertions) | `evals/cases/clinic-thesis.json` |
| A synthetic press is **blocked**; a browser-trusted press **books** — same page, same run | same case |
| The agent path costs the person **1** interaction | same case |
| A hold lapses after 45 s: the slot returns, **nothing was booked** | `clinic-hold-lapses.json` |
| A rival takes a slot mid-read; holding a gone slot is refused **with a reason** | `clinic-rival-race.json` |
| Booking by hand costs ≥ 30 asserted / **36 measured** interactions | `clinic-manual-tax.json` |
| **0 axe violations** across WCAG 2.0/2.1/2.2 A + AA on all three routes | `node evals/a11y.mjs` |

Plus 418 unit tests. Traces and screenshots for every row are committed under
`docs/evidence/clinic/`. Everything above re-runs from a clean clone in two commands.

## What we are not claiming

- **The inventory is fictional and the page says so on every screen.** Nothing real is booked, no
  payment is taken, nothing is signed in. The rival is a seeded simulation, labelled as one wherever
  it appears.
- **This is not a conformance substitute.** The agent path is an *additional operable path* beside a
  keyboard-accessible page — never "the accessible version". W3C's APA group is explicit that an
  agent route does not discharge a page's own obligations, and we agree with them.
- **Keyboard and switch are the primary confirm.** The camera gesture is a progressive enhancement,
  off in the submitted build, always beside a keyboard alternative, with a visible threshold and a
  dwell that resets on any flicker so a tremor cannot fire it (WCAG 2.5.4).
- **We did not invent the hold.** Netlify's own WebMCP demo, *Mabel's Table*, has agents place
  five-minute holds on restaurant tables. The inversion is ours: there the agent also confirms; here
  it cannot, the race is visible rather than implied, and the page counts what the task costs you
  either way.
- Not a scalper tool: **your own agent, your own booking, no resale, and only a human books.**

## What is next

A real clinic backend behind the same `DropDriver` seam; the waitlist cascade, so that when a hold
lapses the next person receives their own full window and nobody has to race at all; and a
standards note to the WebMCP CG, whose accessibility section is currently an empty stub, proposing
consequential acts as human-only affordances that a tool surface deliberately cannot express.
