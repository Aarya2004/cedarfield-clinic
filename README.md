# The Drop — your agent can hold it. Only you can take it.

> **Working title.** The product name is being chosen by the two people building it; the fictional
> clinic in the demo is "Cedarfield Clinic". Everything below is true today and reproducible from
> this repo.

A clinic releases cancelled appointments in waves. They are gone in seconds. On this page your
agent does the fast, expensive part — watch the drop, compare, **hold** a slot the instant it
appears — and then it stops, because **there is no booking tool**. The only thing that books an
appointment is one act from the person the appointment is for: **one key, one switch press, or one
held gesture.** Nothing an agent can call, and nothing a script can fake, reaches that step.

**Live:** `https://<deploy>` — the front door is the product. Open it in **ChatGPT desktop** (GPT-5.6 Sol or Terra) or in
**Chrome 152+** with `chrome://flags/#enable-webmcp-testing`.
<!-- TODO(before submit): paste the deployed origin here and in docs/SUBMISSION.md. -->
**Video:** _TODO — unlisted YouTube, ≤ 3:00._ · Entry for the **OpenAI WebMCP Challenge**. Apache-2.0.

---

## 60 seconds, no login

1. Open the live URL, then **“Book an appointment”** (`/clinic/book`). Six appointments; a countdown to the next release; a quiet counter in the
   corner that counts every interaction the page costs you. Nothing is signed in, nothing is real.
2. **Book one by hand.** Click a slot, fill the form, submit. Watch the counter climb — and watch a
   slot or two vanish while you type, taken by the (labelled) simulated rival. That is the web most
   people use.
3. **Now ask your agent**, in ChatGPT's side panel: *"hold me the earliest appointment."* It calls
   `clinic_hold_slot`. A slot freezes with a 45-second bar, the dock at the bottom arms, and the
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
| Booking by hand, keyboard only | **≥ 36** — and the form is not finished yet<sup>1</sup> |
| Booking with your agent | **1** — the keypress that books it |

<sup>1</sup> A floor, not the total: Chrome's native date picker does not accept segment entry over
CDP, so the headless run cannot complete the by-hand booking. A real keyboard finishes it; the
page's own receipt shows both numbers live. Case: `evals/cases/clinic-manual-tax.json`.

---

## What makes this WebMCP, specifically

**The tool that is missing is the design.** Five tools are registered on `/clinic/book`; none of
them books anything, and that is not an omission we could patch later — it is the contract.

| Tool | `readOnlyHint` | What it does |
|---|---|---|
| `clinic_list_drops` | ✅ | The next wave and the open slots |
| `clinic_hold_slot` | ❌ | Holds one slot for 45 s for **this** visitor. Books nothing, auto-releases |
| `clinic_hold_status` | ✅ | Seconds left, and what the person must do |
| `clinic_release_hold` | ✅ | Gives the hold back early |
| `clinic_explain_confirm` | ✅ | Why no booking tool exists — written for the agent to read aloud |

Booking is gated on a **browser-trusted event**. A tool call cannot produce one; a `.click()` from
the console or an extension cannot produce one. The page counts every synthetic attempt in the
open, on screen. So the division of labour is enforced by the platform, not by a promise in a
description:

> *the agent does the fast, expensive parts · the person does the one part that must stay theirs*

This is also the honest answer to "could you do this without WebMCP?" — no. A REST API would let
anything with the URL book the slot. The page's tool surface is the only place you can hand an
agent real capability (hold, watch, compare, queue) while making the consequential act
*inexpressible* in the API it is given.

---

## Every number here is measured, and you can re-run all of it

```bash
pnpm install
cd apps/web && pnpm typecheck && pnpm lint && pnpm test    # 418 unit tests
cd .. && node evals/run-all.mjs --only=clinic              # 4 live browser cases, real tool calls
node evals/a11y.mjs                                        # axe-core on both routes
```

| Proof | Where |
|---|---|
| 5 tools registered; **no** booking tool (5 negative assertions) | `evals/cases/clinic-thesis.json` |
| A synthetic press is **blocked**; a trusted press **books** — same page, same run | same case |
| The agent path costs the person **1** interaction | same case |
| A hold lapses after 45 s: slot returns, **nothing booked** | `clinic-hold-lapses.json` |
| The rival takes a slot mid-read; holding a gone slot is refused **with a reason** | `clinic-rival-race.json` |
| Booking by hand costs **≥ 36** interactions | `clinic-manual-tax.json` |
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
- **Keyboard and switch are the primary confirm.** The camera gesture is a progressive enhancement and
  is **off in the submitted build**; its ~42 MB of MediaPipe weights are provisioned by a script rather
  than committed (Google's model terms), so a fresh clone has the code and not the weights. When it is on
  it runs entirely on-device from our own origin, with a visible threshold and a keyboard alternative
  always present (WCAG 2.5.4 — motion actuation must be disableable).
- **We did not invent the hold.** Netlify's own WebMCP demo, *Mabel's Table*, has agents place
  five-minute holds on restaurant tables. What is different here is the inversion: in that demo the
  agent also confirms. Here it cannot, the race is visible rather than implied, and the page counts
  what it costs you either way.
- Not a spend limiter, not an account system, not a scalper tool: **your own agent, your own
  booking, no resale, and only a human books.**

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
  lib/drop              clinic-tools (the five tools) · confirm-logic (the trusted-event gate)
                        mock-driver (seeded waves + rival) · interaction-counter · gesture-logic
evals                   run-all.mjs · a11y.mjs · harness/webmcp-cdp.mjs · cases/clinic-*.json
docs/evidence/clinic    traces + screenshots for every claim above
```

The board state is a seeded in-page driver: no accounts, no database, no server round trip, and no
model call anywhere in the product — the reasoning is done by *your* agent, in your client. The
`DropDriver` seam (`lib/drop/types.ts`) is the one place a real backend would plug in: `hold()` is
the agent's verb and the only one ever registered; `book()` and `confirm()` are the human's and are
unreachable from any tool.

**Security and trust boundaries:** `docs/SECURITY.md` §10 — including the one that is honestly a
residual (the page itself is the trust boundary; what the design forecloses is anything holding
only the tool surface or the endpoints).

## Where everything else is

`docs/README.md` is the index: what is current, and what describes *Rokan Terminal* — the pre-pivot
entry that still runs at `/terminal` and is still tested, but is **not** this submission. Every
pre-pivot document carries a banner saying so, so nothing in this repo can be mistaken for a claim
about the product being judged.

## Licence

Apache-2.0 — see `LICENSE`.
