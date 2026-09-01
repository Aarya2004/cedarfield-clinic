# DESIGN.md — the clinic surface

**The product:** Cedarfield Clinic (placeholder brand) releases cancelled appointments in waves. Your
agent lists, searches, holds, and arms — it cannot book, cancel, or move. One browser-trusted press does.
**The brand, one sentence:** a calm clinic with typographic drama; the drama is scale and motion, not darkness.

Read this file before you touch anything under `apps/web/src/components/clinic/**` or add a clinic route.

## How to use this file

1. Read this file. Read `tickets/SPEC-V1.md` §5 and `tickets/SPEC-V2.md` if you are adding a surface, not restyling one.
2. Build with the **names** in §Vocabulary. Never open `clinic-tokens.css` to copy a hex, and never
   write a hex, an rgb(), or a raw px colour into a component. If you need a colour that has no token,
   you are probably about to break the colour law — re-read §The laws first.
3. Presentation goes in `clinic.css`. Components carry class names, `data-*` hooks, and content.
4. Run the eval loop (§Eval loop). A change that has not been driven in a browser is not done.

## The laws

Eight rules. They are already true in the code; keep them true.

**One gutter, one question.** Every horizontal band on both routes is `[label gutter] [body]`
(`.cl-band` / `.cl-band__label`). The gutter answers *whose is this?* — never a step number, never an
icon. On the landing it names the actor (`Your agent` · `The clock` · `You`); on the sheet each row's
gutter names the state (`Open` · `Held — yours` · `Taken`). The rhyme between the two is the point:
by the time a visitor reaches the board they have already learned to read that column. On the board
step the band deliberately carries **no** label, so the row gutters land in the same column
(`ClinicBooking.tsx`, `<Band label={flow.step === 'board' ? undefined : 'Booking'} wide>`).

**Cedar means yours, and nothing else is ever coloured.** `--clinic-yours` marks the held row, the
booked row, the agent strip, the CTA, the focus ring, the agent lane of the receipt, and the single
word `You` in the landing gutter (`.cl-band__label[data-actor='you']`). That is the whole list. A page
where one thing is cedar is a page you can read from across a room.

**A loss is an absence.** A slot the rival took is `--clinic-gone`: grey, struck through
(`.cl-row__strike` scales to 1), and labelled with `RIVAL_LABEL`. It is never red, never orange, never
a badge with a colour. `--clinic-alert` appears in exactly three places: an invalid field, the error
summary, and the last ten seconds inside the dock — where it is a safety signal, not decoration.

**Mono means measured.** `--clinic-mono` is reserved for numbers this page counted with its own
instrument (`.cl-counter`, `.cl-receipt__n`, `.cl-receipt__breakdown`, `.cl-dock__blocked`) and for the
seconds burning on a hold (`.cl-dock__seconds`). Appointment times and the next-wave clock are set in
the **sans** at display size with tabular figures (`.cl-row__time`, `.cl-chosen__time`,
`.cl-clock__value`) — a timetable, not a terminal.

**The signature move.** Spend the boldness in one place: the held row. `[data-slot-state='held_by_you']`
swells (`min-height` 5.5rem → 9.5rem over `--clinic-swell`), its time is reset at `--clinic-time-held`
in cedar, and the hairline beneath the numeral (`.cl-ttl` inside `.cl-ttl__track`) retracts left-to-right
as the hold burns. That retreating rule **is** the TTL bar — the countdown is set in type rather than
drawn beside it. `--cl-fraction` is written per frame from `fractionLeft()`; never add a CSS transition
to it or the rule lags the number it belongs to. Everything else on the page stays flat.

**The dock owns its own ink.** `.cl-dock` is the one dark object on a paper page, so it paints only from
`--clinic-dock-*` — its own bg, raise, edge, ink, muted, yours, attention, alert. It never reads
`--clinic-ink`, and it never reads the app shell's `--ink` / `--bg` / `--muted` (that collision was
1.2:1 on the bench — T8 findings #2/#3). Clinic tokens are declared on `.clinic`, never on `:root`.

**Drama from scale and motion.** Weight comes from size (`--clinic-thesis` up to 5.25rem,
`--clinic-time-held` up to 5rem, `.cl-receipt__n` up to 5.5rem) and from one orchestrated arrival
(`.cl-rise`, three steps 70ms apart, once; `cl-dock-in`, once). Never from a dark panel, a shadow stack,
or a gradient. One easing (`--clinic-ease`), three durations. Nothing loops.

**Reduced-motion parity carries the same information.** Under `prefers-reduced-motion: reduce` the
rises, the dock's entrance and every transition stop — and the two TTL rules keep retracting, because
they are the countdown, not an animation of it. `scrollIntoView` switches to `auto`. If you add motion,
add its reduced-motion branch in the same edit, and ask which branch loses information.

## Information architecture

Both routes: the honesty line (`.cl-banner`, wrapped in its own `<header>` banner landmark) →
`.cl-masthead` → bands inside `<main class="cl-shell">`. Exactly one `<h1>` per route (visually hidden
on `/clinic/book`), and no content outside a landmark — axe gates both.

**Landing** (`/` and `/clinic`, same component): thesis band (full width, no gutter) → `Next release`
(live `NextWaveClock`) → `Your agent` (+ `ToolManifest`) → `The clock` → `You` (cedar gutter +
`ToolManifest absent`) → `Honestly` → `Access`. Above the fold: the thesis sentence, the one cedar
clause inside it, and one CTA. Nothing else — no stat trio, no logo wall, no illustration (SPEC-V1 §6).

**Booking** (`/clinic/book`): `This wave` → agent strip when a hold arrives from an agent → the board
or the manual flow → `What it cost` → the fixed dock → `Honestly`. Everything a person does to book
sits inside `[data-clinic-measured="booking"]`, including the dock — pressing Enter is a real
interaction and belongs in the by-hand number too.

**The demo-ordering fact.** The receipt reads as a collapse only if the by-hand lane runs **first**:
the page counter starts on arrival, the dock counter is born with the dock. `By hand` is the left
column (`data-lane="hand"`), `With your agent` the right and the cedar one. Do not reorder them, and
do not let a new surface reset the page counter outside `restart()`.

## Voice

Write from the visitor's side of the screen. Active voice, sentence case, plain verbs, no filler.
An action keeps its name through the flow: the dock says `Press Enter to book`, the eyebrow says
`Held by your agent · you book it`, the line says `Book 8:40 AM`.

- **Measured or absent.** Never write a number a component did not receive from an instrument. A lane
  nobody ran shows `.cl-receipt__empty` (a rule) and the words `Not measured yet.` — a blank is honest,
  a placeholder is not. This is the one rule with zero exceptions anywhere in the project.
- **Honesty blocks.** Both routes carry an `Honestly` band, and both state the same facts in plain
  words: demo inventory, seeded rival labelled as one, nothing real booked, no payment. The tool
  manifest prints the absence rather than describing it — `<s>clinic_book_slot(slot_id)</s>` under
  `Not on this page`, with *"the verb was never registered, so there is nothing for an agent to find."*
- **Trust lines**, exactly four, in `.cl-trust`: Your own agent · Your own booking · No resale · Only a
  human books. Do not extend the list; it is the first-ten-seconds promise.
- **Refusals name the constraint.** A tool that finds nothing says which filter emptied the board. A
  blocked press is counted and printed on screen (`.cl-dock__blocked`), never swallowed. A lost slot
  says who took it, at which step, and that *"Everything you typed is still here — choose another time."*
  Errors do not apologise and are never vague: `.cl-field__error` names the field's problem and
  `.cl-summary` links to it.
- **No product-identity claims.** Cedarfield is a placeholder brand; nothing here borrows Rokan's identity.

## Hard floors

- **WCAG 2.2 AA, gated.** `node evals/a11y.mjs` must exit zero on `/`, `/clinic`, `/clinic/book`. Any new
  colour ships with its computed ratio in a comment beside the token, like every existing one.
- **The trusted-event gate stays visible.** `data-untrusted-attempts` and the on-screen
  "N synthetic presses blocked" line are the proof. Never hide, cap, or prettify that number.
- **Preserve every `data-*` hook.** The CDP harness drives the real UI through them: `data-clinic-slot`,
  `data-slot-state`, `data-armed`, `data-clinic-confirm`, `data-clinic-dock-ttl`, `data-clinic-count`,
  `data-clinic-counter`, `data-clinic-action`, `data-clinic-field`, `data-clinic-flow`. Add hooks with a
  new surface; never rename one without updating `evals/cases/clinic-*.json`.
- **`export const dynamic = 'force-dynamic'` on every new route.** `middleware.ts` mints the CSP nonce
  per request; a statically prerendered route ships nonce-less scripts and never hydrates (T8 finding #5).
- **390px, zero overflow.** `clinic-responsive.json` asserts `scrollWidth - innerWidth <= 1` and that no
  element's right edge passes the viewport, at 390×844 and 1280×900, with the dock armed.
- **Nothing flashes above 3 Hz. Nothing repeats.** The only continuous animation on the page is a TTL rule.
- **Visible focus everywhere.** `.clinic :focus-visible` is a 3px cedar outline; the keycap uses
  `--clinic-dock-attention` against the dark dock. The confirm key answers Space as well as Enter.

## Named anti-patterns — recognise, then refuse

1. **Bench Chrome** — scenario pickers, seed inputs, pause/reset transports, event traces, an "agent
   mode" toggle. That was `/drop-spike`, the dev rig. A product page has none of it.
2. **Terminal Cosplay** — mono for headings, labels, times, or body. Mono is an instrument readout only.
3. **Traffic Light** — urgency as three loud colours sprayed across the page; a taken slot painted red.
   One accent means yours; everything lost is hueless.
4. **Placeholder Digit** — a `36`, a `1`, a `98%` typed into JSX because the slot looked empty. If no
   instrument produced it, draw the blank.
5. **Drama by Darkness** — reaching for a near-black section, a dark hero, or a shadow stack to make
   something feel important. The dock is the only dark object, and it earns it by being the one act.
6. **Gradient Slop** — the template hero: gradient wash, 01/02/03 numbered steps, an icon per feature,
   a stat trio, a pill badge. Numbering is only honest when order carries information; here the actor
   changing is the information, so the gutter names the actor.
7. **Unlabelled Simulation** — demo inventory, a seeded rival, or a mocked agent shown without saying
   so on the same screen. Every simulated thing carries its label at the point of use.
8. **Disabled Hero** — a giant primary control that sits inert most of the session saying "nothing
   held". A control disabled 90% of the time trains people to ignore it. The dock does not exist until
   a hold or a prepared act exists.
9. **Ornamental Motion** — an animation that carries no information, or a "reduced motion" branch that
   deletes one that does. Ask what each moving thing measures; if the answer is nothing, cut it.
10. **Token Leak** — a component reading `--ink` / `--bg` / `--muted` from the app shell, declaring
    clinic tokens on `:root`, or hard-coding a hex. That is the 1.2:1 bug, every time.

## Vocabulary — the bounded set you reference by name

Never read these files for values; use the names. Sources: `clinic-tokens.css`, `clinic.css`.

| Family | Names | Intent |
|---|---|---|
| Paper | `--clinic-paper` `--clinic-sheet` `--clinic-ink` `--clinic-muted` `--clinic-rule` `--clinic-rule-strong` | The sheet, the plate on it, text, secondary text, hairlines (never text) |
| Yours | `--clinic-yours` `--clinic-yours-ink` `--clinic-yours-wash` | The only accent: cedar, ink on cedar, the held row's wash |
| Gone | `--clinic-gone` `--clinic-gone-sheet` | Taken, lapsed, over — hueless by design |
| Alert | `--clinic-alert` | Invalid field, error summary, last ten seconds. Three places |
| Dock | `--clinic-dock-bg` `-raise` `-edge` `-ink` `-muted` `-yours` `-attention` `-alert` | The dark object's complete, self-contained ink family |
| Bridge | `--drop-calm` `--drop-attention` `--drop-critical` `--drop-ink` `--drop-muted` | Re-pointed so reused `lib/drop/*` helpers paint in cedar, not the bench's greens |
| Measure | `--clinic-gutter` `--clinic-band-gap` `--clinic-pad` `--clinic-measure` `--clinic-max` | The one grid: gutter width, band rhythm, page pad, reading measure, page max |
| Type | `--clinic-serif` `--clinic-sans` `--clinic-mono` | Thesis and leads · everything read and every time · measured numbers only |
| Scale | `--clinic-thesis` `--clinic-display` `--clinic-time` `--clinic-time-held` `--clinic-label` | Hero · lead · appointment time · the swell · uppercase gutter labels |
| Motion | `--clinic-ease` `--clinic-quick` `--clinic-settle` `--clinic-swell` | One easing, three durations |
| Runtime | `--cl-fraction` | Written per frame by JS; drives both TTL rules |

| Class family | Key names | Intent |
|---|---|---|
| Frame | `.clinic` `.cl-shell` `.cl-banner` `.cl-masthead` `.cl-wordmark` | Scope root, page column, honesty line, brand row |
| Band | `.cl-band` `--open` `--flush` `--full` `--wide` `--aside` · `.cl-band__label` `__body` `__aside` | The whole layout system; `[data-actor='you']` is the one cedar gutter word |
| Prose | `.cl-thesis` `.cl-thesis__tail` `.cl-lead` `.cl-prose` `.cl-note` `.cl-trust` `.cl-rise` | Hero sentence, its tail, band leads, body, footnote, promises, the load-in |
| Clock | `.cl-clock` `.cl-clock__value` `.cl-clock__unit` | The live next-release countdown, sans + tabular |
| Controls | `.cl-cta` `.cl-quiet` `.cl-link` `.cl-counter` | Primary (cedar), secondary, inline link, the always-on interaction tally |
| Sheet | `.cl-sheet` `.cl-row` `[data-slot-state]` `.cl-row__inner` `__state` `__main` `__time` `__strike` `__who` `__action` `__tag` `.cl-ttl` `.cl-ttl__track` | The schedule; a bookable row is a button and a gone row is the same box without one, so nothing reflows |
| Agent | `.cl-agent` | The strip that says a hold arrived and who took it |
| Manual | `.cl-panel` `.cl-chosen` `.cl-fields` `.cl-field` `__hint` `__error` `.cl-summary` `.cl-actions` `.cl-answers` `.cl-answer` `.cl-lost` | The by-hand walk, and the lost-slot rail that keeps what you typed |
| Receipt | `.cl-receipt` `__col` `[data-lane]` `__label` `__n` `__unit` `__note` `__breakdown` `__empty` | The same appointment priced twice; `__empty` is the honest blank |
| Dock | `.cl-dock` `[data-urgency]` `__ttl` `__inner` `__main` `__eyebrow` `__line` `__note` `__clock` `__seconds` `__unit` `__aside` `__minor` `__toggle` `__blocked` `.cl-key` `.cl-key__glyph` `.cl-dock-spacer` | The one act. The sentence is the hero; the keycap is the evidence a body must do this |
| Manifest | `.cl-manifest` `__title` `__list` `__note` | The five published verbs, and the struck one that does not exist |
| Utility | `.cl-sr` | Screen-reader-only; every live region on both routes uses it |

## Eval loop

```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm test
cd .. && node evals/run-all.mjs --only=clinic     # real tool calls in a real browser
node evals/a11y.mjs                               # axe-core gate, must exit 0
```

The cases that guard this file's rules specifically: `clinic-responsive.json` (390px, no overflow, hit
targets), `clinic-phone-acts.json`, `clinic-receipt.json` (the collapse, measured), `clinic-thesis.json`
(the absent tools), `clinic-shots.json` (the four evidence beats). Screenshots land in
`docs/evidence/clinic/`. If you change a `data-*` hook, the case that used it fails — fix the case in
the same commit.

## Proposed, not yet law

1. Retire the inline `style={{ marginTop… }}` props in `BookingSteps.tsx`, `ClinicLanding.tsx` and
   `ConfirmDock.tsx` into named classes; presentation is otherwise entirely in `clinic.css`.
2. `.cl-dock__gesture` is applied in `ConfirmDock.tsx` but has no rule in `clinic.css`. Give it one or
   drop the wrapper — a classed element with no rule is where drift starts.
3. Assert the colour law in an eval: no computed colour on `/clinic/book` outside the paper, cedar,
   gone, alert and dock sets. It is the single most load-bearing rule here and nothing tests it.
