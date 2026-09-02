# The Drop — your agent can hold it. Only you can take it.

> **Working title.** The product name is being chosen by the two people building it; the fictional
> clinic on the page is "Cedarfield Clinic". Everything below is true today; the seeded board and
> every proof re-run from this repo, and the live board's schema is committed under
> `supabase/migrations/`.

A clinic releases cancelled appointments in waves. They are gone in seconds. On this page your
agent does the fast, expensive part — watch the drop, compare, **hold** a slot the instant it
appears — and then it stops, because **there is no booking tool**. The only thing that books an
appointment is one act from the person the appointment is for: **one key, one switch press, or one
held gesture.** Nothing an agent can call, and nothing a script can fake, reaches that step.

**Live:** **https://rokan-terminal.vercel.app** — the front door is the product. Open it in **ChatGPT desktop** (GPT-5.6 Sol or Terra) or in
**Chrome 152+** with `chrome://flags/#enable-webmcp-testing`.
**Video:** _TODO — unlisted YouTube, ≤ 3:00._ · Entry for the **OpenAI WebMCP Challenge**. Apache-2.0.

---

## 60 seconds, no login

1. Open the live URL, then **“Book an appointment”** (`/clinic/book`). Six appointments; a countdown to the next release; a quiet counter in the
   corner that counts every interaction the page costs you. No login, no account of yours — the
   page signs itself into an anonymous session so your hold is yours across reloads. Nothing is real.
2. **Book one by hand.** Click a slot, fill the form, submit. Watch the counter climb — and watch a
   slot or two vanish while you type: the (labelled) simulated rival, or **another visitor on the
   same board**, labelled "Another patient". Open it in two windows and race yourself: this board is
   one world for everyone. That is the web most people use.
3. **Now ask your agent**, in ChatGPT's side panel: *"hold me the earliest appointment."* It calls
   `clinic_hold_slot`. A slot freezes with a three-minute bar (three minutes because chat clients take 10–39 s per call — measured on ChatGPT desktop, `docs/evidence/clinic/2026-09-02-chatgpt-desktop-transcript.md`), the dock at the bottom arms, and the
   page says who holds it. Your agent cannot finish. **Press Enter.** Booked — one interaction.
4. Ask it to book one *without* you: *"just book it."* It will tell you it can't, and why — that
   answer comes from `clinic_explain_confirm`, a tool whose only job is to explain the boundary.

---

## The problem this is actually about

Every task on the web costs a number of interactions. For a mouse user that number is invisible.
For someone using a switch, voice control, or a head pointer, each interaction costs seconds and
effort, so an ordinary booking form is a long, tiring project — and a **timed** release is not hard
but *impossible*: no assistive technology wins a race against a pointer. Assistive tech has always
made the gesture easier to perform. It has never made the gesture unnecessary.

A declared tool does. `hold_slot(id)` has no drag in it and no race in it. That is the part of
WebMCP that matters here, and it is why the agent is allowed to do everything **except** the one
act that should never be automated.

Measured on this page, in the harness, against the page's own counter:

| | interactions the person spends |
|---|---|
| Booking by hand, keyboard only | **36 measured** (the case asserts a ≥ 30 floor) — and the form is not finished yet<sup>1</sup> |
| Booking with your agent | **1** — the keypress that books it |

<sup>1</sup> A floor, not the total: Chrome's native date picker does not accept segment entry over
CDP, so the headless run cannot complete the by-hand booking. A real keyboard finishes it; the
page's own receipt shows both numbers live. Case: `evals/cases/clinic-manual-tax.json`.

---

## What makes this WebMCP, specifically

**The tool that is missing is the design — and the tool that appears is the proof.** Nine base tools
are registered on `/clinic/book` when it loads (eleven on the shared board, which adds two queue verbs) — including the arming tools, on purpose: a person
with no booking must still hear *"you have nothing booked"* from their agent, and a voice user
whose client is slow to notice `toolchange` must never lose a capability. The tenth,
`clinic_my_appointment`, **does not exist until a person has booked**: the moment the trusted press
lands it is registered live (`toolchange` fires, the agent's list grows), and it is unregistered
when the last booking is gone. What the human's press creates is purely additive — a client that
misses the change loses nothing; a client that sees it watches a human act change the agent's
surface. None of the ten books, cancels, or moves anything — that is not an omission we could
patch later; it is the contract. Ask your agent out loud — *"what doctors are there?"*, *"anything after nine?"*,
*"cancel my appointment"* — and it can answer, search, hold, and **arm** the page. The act itself
is always one trusted press from you.

| Tool | `readOnlyHint` | What it does |
|---|---|---|
| `clinic_list_drops` | ✅ | The next wave and the open slots |
| `clinic_find_slots` | ✅ | Search by clinician, kind, time window — a miss names the constraint that killed it |
| `clinic_clinicians` | ✅ | Who is on the board, with their open times and kinds |
| `clinic_hold_slot` | ❌ | Holds one slot for 3 min for **this** visitor. Books nothing, auto-releases |
| `clinic_hold_status` | ✅ | Seconds left, and what the person must do |
| `clinic_release_hold` | ❌ | Gives the hold back early (a write — it mutates the board) |
| `clinic_prepare_cancel` | ❌ | **Arms** the dock to cancel your booking. Cancels nothing — your key does. Always present, so "nothing booked" is always sayable |
| `clinic_prepare_move` | ❌ | Freezes the target slot and **arms** the dock. One trusted press swaps atomically |
| `clinic_explain_confirm` | ✅ | Why no booking tool exists, what exists now, and what your press will create |
| *born by your press:* `clinic_my_appointment` | ✅ | Your booking(s), newest first — exists only while you have one |
| *shared board only:* `clinic_join_waitlist` | ❌ | Puts your human **in line** for a taken slot. If it comes back, it is theirs first — as a fresh hold, in order. Reversible |
| *shared board only:* `clinic_leave_waitlist` | ❌ | Takes them out of the line |

**Counted honestly:** nine tools on the seeded board (`?test=1`), **eleven on the shared board** every
real visitor is on (the two queue verbs), **twelve once you have booked** — exactly the
twelve-tool cap we set ourselves.

**Both halves of WebMCP, each doing the job it is for.** The tools above are the *imperative* API.
The patient-details form is also published *declaratively* — `toolname="clinic_booking_form"`,
a `tooldescription`, a `toolparamdescription` on every field — so in Chrome the browser itself
lists the form as a tool an agent can **fill**. It carries no `toolautosubmit` on purpose: the
agent fills, the page says *"Filled in by your agent. Read it over — nothing is sent until you
press Review, then Book"*, and a submit the browser attributes to an agent (or a script) is
refused and counted, exactly like a synthetic keypress on the dock. That is the model the W3C APA
group asked for on 5 Aug 2026 — "review by the user" — in the platform's own vocabulary. (ChatGPT
ignores declarative forms; the page is unchanged there.)

**The waitlist cascade — the race is gone.** On the shared board an agent can queue its human for
a slot that is held or booked by someone else. When that slot comes back — a hold lapses, a
cancellation, a move — the *server* hands it to the first in line as a fresh three-minute hold; the
dock arms by itself (**"It came back to you"**), and one press books it. The agent does the
watching a person with a switch cannot; the person does the one act that must stay theirs; the
database guarantees the order between strangers. A cascade grant arrives at a moment nobody at
the keyboard chose, so it is treated exactly like an agent-timed arm: no focus steal, 500 ms
dead zone. Proven with two visitors in `evals/live-two-visitors.mjs`.

In the vocabulary of the MCP-B taxonomy (read tools · navigation tools · human-approved write
tools): nine read/arming tools always, two reversible queue verbs on the shared board, one read
tool that exists only after a human act, and **zero write tools** — the writes that matter are
performed by the person, at the page, through a browser-trusted event the agent's API cannot
express.

Cancelling and moving are, if anything, *worse* to automate than booking — they destroy something
the person fought for. So they follow the same law: the agent prepares, the page shows exactly what
one press will do, and only a browser-trusted press does it.

Booking is gated on a **browser-trusted event**. A tool call cannot produce one; a `.click()` from
the console or an extension cannot produce one. The page counts every synthetic attempt in the
open, on screen. So the division of labour is enforced by the platform, not by a promise in a
description:

> *the agent does the fast, expensive parts · the person does the one part that must stay theirs*

This is also the honest answer to "could you do this without WebMCP?" — no. Behind the page a
database enforces fairness between strangers (one hold each, hold-before-book, only your own
booking cancels or moves, an atomic move); it cannot enforce that a *human* pressed anything, and
a server never can. The page's tool surface is the only place you can hand an agent real
capability (search, hold, watch, arm) while making the consequential act *inexpressible* in the
API the agent is given — and the only place a trusted press can be told from a scripted one.

---

## Every number here is measured, and you can re-run all of it

```bash
pnpm install
cd apps/web && pnpm typecheck && pnpm lint && pnpm test    # 444 unit tests
cd .. && node evals/run-all.mjs --only=clinic              # 17 live browser cases, real tool calls (seeded board, ?test=1)
node evals/a11y.mjs                                        # axe-core on all three routes
node evals/live-two-visitors.mjs --url=<origin>            # the shared board: visitor B books, visitor A's page shows it go
```

| Proof | Where |
|---|---|
| 9 tools at load, **10 after the human books** (one born live, additive only), **no** booking/cancel/move tool (9 negative assertions) | `evals/cases/clinic-thesis.json` |
| A synthetic press is **blocked**; a trusted press **books** — same page, same run | same case |
| The agent path costs the person **1** interaction | same case |
| A hold lapses after 3 min: slot returns, **nothing booked** | `clinic-hold-lapses.json` |
| The rival takes a slot mid-read; holding a gone slot is refused **with a reason** | `clinic-rival-race.json` |
| Booking by hand costs ≥ 30 asserted / **36 measured** interactions | `clinic-manual-tax.json` |
| Cancel is armed by the agent, performed only by a trusted press — synthetic press blocked, counted | `clinic-cancel.json` |
| Move swaps atomically on one press; at no instant are two slots booked | `clinic-move.json` |
| The voice surface: search misses name the killing constraint, readable aloud | `clinic-voice-tour.json` |
| **0 axe violations**, WCAG 2.0/2.1/2.2 A + AA, all three routes | `node evals/a11y.mjs` |

Traces and screenshots for every one of these are committed under `docs/evidence/clinic/`.

---

## What we are not claiming

- **The inventory is fictional and says so on every page.** No real appointment is booked, no
  payment is taken, nothing is signed in. The rival is a seeded simulation and is labelled as one
  wherever it appears. (Sponsor demos in this challenge use fictional inventory too; we simply say so.)
- **This is not a conformance substitute.** The agent path is an *additional operable path* beside a
  keyboard-accessible page — not "the accessible version". W3C's APA group and WCAG are explicit
  that an agent route does not discharge a page's own obligations, and we agree.
- **Keyboard and switch are the primary confirm.** The camera gesture is **live in the submitted
  build and strictly opt-in**: the dock offers "Enable camera"; nothing loads and no lens opens until
  a person clicks it. It runs entirely on-device from our own origin (the ~42 MB of MediaPipe assets
  are fetched sha-pinned at build time, never committed — Google's model terms — and never from a
  CDN), with a visible threshold, an adjustable dwell that resets on any flicker so a tremor cannot
  fire it, and a keyboard alternative always present (WCAG 2.5.4). The boot pipeline — wasm under
  the production CSP, streamed model, camera grant, clean teardown — is asserted headlessly in
  `clinic-gesture-boot.json`; the dwell firing on a real hand is a filmed human test.
- **A gesture is not a browser-trusted event, and we say so.** The keyboard gate is `isTrusted` —
  unforgeable by any script. The camera gate is *physical presence*: a completed dwell requires a
  hand in front of a real lens the person opted into. Different trust root, stated honestly in
  `SECURITY.md`, and the reason voice is NOT a confirm channel: **the agent has a voice — in a live
  demo it could speak "book it" into the mic itself. It does not have a hand.** So voice drives
  everything up to the act (search, hold, arm a cancel or a move), and the act itself takes a key,
  a switch, or a hand.
- **We did not invent the hold.** Netlify's own WebMCP demo, *Mabel's Table*, has agents place
  five-minute holds on restaurant tables. What is different here is the inversion: in that demo the
  agent also confirms. Here it cannot, the race is visible rather than implied, and the page counts
  what it costs you either way.
- Not a spend limiter, not a sign-up system (an anonymous per-browser session only, no
  credentials), not a scalper tool: **your own agent, your own booking, no resale, at most three
  bookings each, and only a human books.**

---

## How it is built

```
apps/web
  app/page.tsx          the front door — renders the clinic landing
  app/clinic            the same landing at its own path
  app/terminal          Rokan Terminal, the pre-pivot entry, kept and still evalled
  app/clinic/book       the product: board · dock · manual flow · counter
  components/clinic     the calm-clinic surface (typographic, token-driven, no canvas)
  components/drop       ConfirmDock/Surface · TtlBar · SlotBoard · ClinicTools (the mount)
  lib/drop              clinic-tools (the twelve tools; two shared-board-only, one born by the press) · confirm-logic (the trusted-event gate)
                        supabase-driver (the shared live board: Postgres + RLS + RPCs)
                        mock-driver (the seeded board every eval drives) · interaction-counter · gesture-logic
supabase/migrations     the live board's schema and its six SECURITY DEFINER verbs
evals                   run-all.mjs · a11y.mjs · harness/webmcp-cdp.mjs · cases/clinic-*.json
docs/evidence/clinic    traces + screenshots for every claim above
```

The board is shared and live: one Supabase Postgres inventory every visitor sees, an anonymous
session per browser, realtime plus a 2.5-second poll. `?test=1` (or `NEXT_PUBLIC_LIVE_BOARD=0`)
gives the seeded in-page driver the evals run against, and the page falls back to it by itself if
the live board cannot be reached. No model call anywhere in the product — the reasoning is done by
*your* agent, in your client. The `DropDriver` seam (`lib/drop/types.ts`) is where the backend
plugs in (`supabase-driver.ts`): `hold()` is the agent's verb and the only one ever registered;
`book()`, `confirm()`, `cancel()` and `move()` are the human's and are unreachable from any tool.

**Security and trust boundaries:** `docs/SECURITY.md` §10 — including the one that is honestly a
residual (the server guarantees integrity between visitors; the page guarantees intent; a script
with the public key can book a slot of its own but never touch anyone else's).

## Where everything else is

`docs/README.md` is the index: what is current, and what describes *Rokan Terminal* — the pre-pivot
entry that still runs at `/terminal` and is still tested, but is **not** this submission. Every
pre-pivot document carries a banner saying so, so nothing in this repo can be mistaken for a claim
about the product being judged.

## Licence

Apache-2.0 — see `LICENSE`.
