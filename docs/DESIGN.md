# DESIGN.md — the clinic surface

**The product:** Cedarfield Clinic, a GP practice at 14 Marlow Row, releases cancelled appointments
as they come free. A patient books one online, then sees, moves or cancels it. Your assistant can
list, search, hold and arm — it cannot book, cancel or move. One browser-trusted press does.
**The brand, one sentence:** a practice website a patient would trust with their own booking —
white, plain, one sans face, one blue, and nothing on the page that is not needed to book.

Read this file before you touch anything under `apps/web/src/components/clinic/**` or add a clinic route.

## How to use this file

1. Read this file. Read `tickets/SPEC-V1.md` §5 and `tickets/SPEC-V2.md` if you are adding a surface,
   not restyling one.
2. Build with the **names** in §Vocabulary. Never open `clinic-tokens.css` to copy a hex, and never
   write a hex, an `rgb()`, or a raw colour into a component. If you need a colour that has no token,
   you are probably about to break the colour law — re-read §The laws first.
3. Presentation goes in `clinic.css`. Components carry class names, `data-*` hooks, and content.
4. Run the eval loop (§Eval loop). A change that has not been driven in a browser is not done.

## The laws

Seven rules. They are already true in the code; keep them true.

**One column, sections stacked down it.** Every horizontal band on both routes is a full-bleed
`<section>` whose contents are held to a 1120px column with 24px of page padding
(`.cl-band` → `.cl-band__inner`). Separation between sections is the grey/white alternation
(`.cl-band--grey` is `--clinic-band`), never a rule and never a gutter word. `Section`'s `label` prop
is written to `data-clinic-band` for the harness and is **not drawn**: the section's own `<h2>` names
it on screen. The booking route narrows the same column to 52rem — a form and the button that submits
it should be one short eye movement apart.

**One face, one scale.** Public Sans sets everything: headings, body, buttons, appointment times, the
countdown. `--clinic-sans` is the only type token. No serif, no monospace, no uppercase tracked
labels, no letter-spaced small caps — those were the previous look and they are what read as
machine-made. Headings are sentence case and never end in a full stop. Type sizes come from
`--clinic-h1` / `-h2` / `-h3` / `-body` / `-small` / `-time`; prose holds to `--clinic-measure`
(≈68 characters).

**One blue means an action, or your appointment.** `--clinic-yours` (#00548f, 7.88:1 on white) paints
the primary buttons, the Book control on a row, the held card's border and text, the appointment
card's top edge, the numbered step markers, links, and the focus ring. That is the whole list. Nothing
else on either route is coloured.

**A loss is an absence.** An appointment somebody else took is `--clinic-gone`: grey text on
`--clinic-gone-sheet`, labelled `No longer available`. Never red, never struck through, never a
coloured badge. `--clinic-alert` appears in exactly three places: an invalid field, the error summary,
and the last ten seconds inside the confirm bar — where it is a safety signal, not decoration.

**The signature is the held card, and the bar that matches it.** Spend the boldness in one place:
`[data-slot-state='held_by_you']` takes a 2px `--clinic-yours` border, a `--clinic-yours-wash` fill,
the line `Held for you · 0:41`, and a 4px progress bar that drains left to right. The confirm bar runs
the same bar edge to edge along its own top border, from the same variable, so a patient can see the
two are one clock. `--cl-fraction` is written per frame from `fractionLeft()`; **never** put a CSS
transition on either bar's width or it lags the number beside it. Everything else on the page is flat.

**The confirm bar owns its own ink.** `.cl-dock` is a separate surface that reused modules paint
into (`GestureConfirm` resolves `--clinic-dock-ink` / `-muted` / `-edge` and the `--drop-*` family),
so it declares a complete light ink family of its own and never reads the app shell's `--ink` / `--bg`
/ `--muted`. That collision was 1.2:1 on the bench (T8 findings #2/#3). Clinic tokens are declared on
`.clinic`, never on `:root`.

**Nothing moves that is not data.** The only continuous animation on either route is a progress bar,
and the only other motion is a 150ms colour transition on hover and focus. There are no entrance
animations, no rises, no staggered load-ins. Under `prefers-reduced-motion: reduce` the transitions
stop and both progress bars keep draining, because they are the countdown rather than an animation of
it. If you add motion, add its reduced-motion branch in the same edit and ask which branch loses
information.

## Information architecture

Both routes: `.cl-masthead` (wordmark · nav · phone · primary button) → sections inside
`<main class="cl-shell">` → `.cl-footer`. Exactly one `<h1>` per route, and no content outside a
landmark — axe gates both.

**Home** (`/` and `/clinic`, same component): hero (h1, one paragraph, the button, the phone line,
and `PracticeCard` beside it) → `Appointments you can book online` (three cards, grey field) →
`Our doctors` (`ClinicianRoster`, a bordered list) → `How released appointments work` (a real
three-step sequence, so the numbers are honest, grey field) + `NextWaveClock` → `Getting here, and
getting in` → footer. Above the fold: the h1, one paragraph, one button. No stat trio, no logo wall,
no illustration.

**Booking** (`/clinic/book`): `Book an appointment` (h1) with the availability sentence and the
release line → the arrival strip when a hold comes in from an assistant → `Available now` + the list,
or the manual flow → your appointment card → the fixed confirm bar. Everything a person does to book
sits inside `[data-clinic-measured="booking"]`, including the bar — pressing Enter is a real
interaction in the booking area.

## Voice

Write from the patient's side of the screen. Active voice, sentence case, plain verbs, no filler.
An action keeps its name through the flow: the row says `Book`, the bar's button says
`Confirm booking`, the card afterwards says `Cancel appointment` and `Move appointment`.

- **Measured or absent.** Never write a number a component did not receive from an instrument. A
  clinician with nothing left prints `No appointments left today`, not a dash and not a guess.
- **No product vocabulary, ever.** The words *demo*, *simulated*, *rival*, *agent*, *tool*, *WebMCP*,
  *interaction*, *counted* and *fictional* do not appear in anything a patient can see. The one tag
  that stays is `via your assistant` on a hold somebody's assistant reserved.
- **Refusals name the constraint.** A lost time says who took it, at which step, and that
  *"Everything you entered is still here — choose another time."* Errors do not apologise and are
  never vague: `.cl-field__error` names the field's problem under the control, and `.cl-summary`
  links to it.
- **No product-identity claims.** Cedarfield is a placeholder brand; nothing here borrows Rokan's.

## Hard floors

- **WCAG 2.2 AA, gated.** `node evals/a11y.mjs --url=…` must exit zero on `/`, `/clinic`,
  `/clinic/book`. Any new colour ships with its computed ratio in a comment beside the token, like
  every existing one.
- **The trusted-event gate stays.** `decideConfirm` fires `onConfirm` only for `isTrusted` events;
  blocked presses are counted into `data-untrusted-attempts` / `data-clinic-blocked`. Never remove,
  cap or bypass that.
- **Preserve every `data-*` hook.** The CDP harness drives the real UI through them: `data-clinic-slot`,
  `data-slot-state`, `data-armed`, `data-clinic-confirm`, `data-clinic-dock`, `data-clinic-dock-ttl`,
  `data-clinic-dock-eyebrow`, `data-clinic-dock-ways`, `data-clinic-release`, `data-clinic-audio`,
  `data-clinic-counter`, `data-clinic-action`, `data-clinic-field`, `data-clinic-flow`,
  `data-clinic-route`, `data-clinic-band`. Add hooks with a new surface; never rename one without
  updating `evals/cases/clinic-*.json`.
- **`export const dynamic = 'force-dynamic'` on every new route.** `middleware.ts` mints the CSP nonce
  per request; a statically prerendered route ships nonce-less scripts and never hydrates (T8 #5).
- **390px, zero overflow, 44px targets.** No element's right edge passes the viewport and every
  visible control is at least 44px tall at 390×844, with the bar armed.
- **Visible focus everywhere.** `.clinic :focus-visible` is a 3px `--clinic-yours` outline at 2px
  offset. The confirm button answers Space as well as Enter.

## Named anti-patterns — recognise, then refuse

1. **Bench Chrome** — scenario pickers, seed inputs, pause/reset transports, event traces, an "agent
   mode" toggle. That was `/drop-spike`, the dev rig. A patient booking an appointment is not running
   an experiment, and the page must not read like one.
2. **Editorial Cosplay** — a condensed serif display face, a 5rem hero sentence, headlines that end in
   a full stop, tracked small-caps eyebrows, hairline rules and a label gutter. It is a broadsheet
   costume on a booking form, and it is the single loudest tell that nobody real designed the page.
3. **Terminal Cosplay** — monospace for headings, labels, times or body. There is no monospace on
   these routes at all.
4. **Display Numeral** — an appointment time at 3rem, a countdown at 4rem, a held time that swells to
   5rem. A time on a timetable is 1.25rem and semibold; size is not drama, it is just size.
5. **Drama by Darkness** — a near-black panel, a dark hero or a glowing keycap to make something feel
   important. The confirm bar is white with a hairline and a soft shadow, and its button is a button.
6. **Arrow CTA** — `Book an appointment →`, `Book →`. The arrow says nothing the verb did not.
7. **Traffic Light** — urgency as three loud colours; a taken appointment painted red. One blue means
   an action; everything lost is hueless.
8. **Placeholder Digit** — a `36`, a `1`, a `98%` typed into JSX because the slot looked empty. If no
   instrument produced it, draw the words instead.
9. **Disabled Hero** — a giant primary control that sits inert most of the session. The confirm bar
   does not exist until a hold or a prepared act exists.
10. **Ornamental Motion** — an animation that carries no information, or a reduced-motion branch that
    deletes one that does. Ask what each moving thing measures; if the answer is nothing, cut it.
11. **Token Leak** — a component reading `--ink` / `--bg` / `--muted` from the app shell, declaring
    clinic tokens on `:root`, or hard-coding a colour. That is the 1.2:1 bug, every time.

## Vocabulary — the bounded set you reference by name

Never read these files for values; use the names. Sources: `clinic-tokens.css`, `clinic.css`.

| Family | Names | Intent |
|---|---|---|
| Surfaces | `--clinic-paper` `--clinic-band` `--clinic-sheet` `--clinic-ink` `--clinic-muted` `--clinic-rule` `--clinic-rule-strong` | White page, the grey field, cards, text, secondary text, borders (never text) |
| Action | `--clinic-yours` `--clinic-yours-hover` `--clinic-yours-ink` `--clinic-yours-wash` | The one blue, its hover, ink on it, the held card's fill |
| Gone | `--clinic-gone` `--clinic-gone-sheet` | Taken, lapsed, over — hueless by design |
| Alert | `--clinic-alert` `--clinic-alert-wash` | Invalid field, error summary, the last ten seconds |
| Confirm bar | `--clinic-dock-bg` `-raise` `-edge` `-ink` `-muted` `-yours` `-attention` `-alert` | The bar's complete, self-contained light ink family |
| Bridge | `--drop-calm` `--drop-attention` `--drop-critical` `--drop-*-ink` `--drop-ink` `--drop-muted` `--drop-cap-edge` `--drop-focus` `--drop-lip` | Re-pointed so reused `lib/drop/*` and `components/drop/*` modules paint legibly on white |
| Measure | `--clinic-max` `--clinic-pad` `--clinic-measure` `--clinic-section` | 1120px column, 24px page pad, reading measure, section rhythm |
| Type | `--clinic-sans` | The only face on these routes |
| Scale | `--clinic-h1` `--clinic-h2` `--clinic-h3` `--clinic-body` `--clinic-small` `--clinic-time` | 2.5 · 1.75 · 1.125 · 1.0625 · 0.9375 · 1.25rem |
| Motion | `--clinic-ease` `--clinic-quick` | One easing, one 150ms duration |
| Elevation | `--clinic-lift` | The confirm bar's shadow. The only shadow in the design |
| Runtime | `--cl-fraction` | Written per frame by JS; drives both progress bars |

| Class family | Key names | Intent |
|---|---|---|
| Frame | `.clinic` `.cl-shell` `.cl-masthead` `.cl-masthead__inner` `__aside` `.cl-wordmark` `.cl-nav` `.cl-phone` | Scope root, page column, the top bar and what sits in it |
| Section | `.cl-band` `--open` `--flush` `--grey` `--aside` `--wide` · `.cl-band__inner` `__body` `__aside` | The whole layout system: a full-bleed field holding a 1120px column |
| Prose | `.cl-thesis` `--book` `.cl-thesis__tail` `.cl-lead` `.cl-prose` `--lead` `--sm` `.cl-note` `.cl-step` | h1, its paragraph, section headings, body, footnote, the step counter |
| Controls | `.cl-cta` `.cl-quiet` `--sm` `.cl-link` | Solid primary, 1.5px outlined secondary, underlined inline link |
| Home | `.cl-card` `__head` `__lines` · `.cl-strip` · `.cl-steps` · `.cl-clock` `__value` `__unit` · `.cl-roster` `__row` `__name` `__spec` `__next` `__time` `__unit` | Practice card, the three kinds, the numbered sequence, the countdown, the doctors |
| List | `.cl-sheet` `.cl-row` `--gone` `[data-slot-state]` `.cl-row__inner` `__main` `__time` `__who` `__hold` `__via` `__action` `__tag` `.cl-ttl` `.cl-ttl__track` | The appointments; a bookable row is a button and a gone row is the same card without one, so nothing reflows |
| Arrival | `.cl-agent` `.cl-agent__via` | The strip that says a hold arrived and who reserved it |
| Manual | `.cl-panel` `.cl-chosen` `.cl-fields` `.cl-field` `__hint` `__error` `__optional` `.cl-summary` `.cl-actions` `.cl-answers` `.cl-answer` `.cl-lost` | The by-hand walk, and the rail that keeps what you typed when a time goes |
| Confirm bar | `.cl-dock` `[data-urgency]` `__ttl` `__inner` `__main` `__eyebrow` `__line` `__detail` `__clock` `__seconds` `__unit` `__note` `__aside` `__buttons` `__hint` `__minor` `__ways` `__toggle` `__gesture` `.cl-key` `.cl-dock-spacer` | The one act: a light panel, a primary button, a secondary, a hint, a progress bar |
| Appointment | `.cl-appt` `__head` `__time` `__detail` `__ref` `__actions` `__moves` `__note` | What a person has after they book |
| Footer | `.cl-footer` `__inner` `__top` `__mark` `__cta` `__cols` `__col` `__head` `__lines` `__note` `__legal` | Where we are · reaching us · opening hours |
| Utility | `.cl-sr` | Screen-reader-only; every live region on both routes uses it |

## Eval loop

```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm test    # 464 tests
cd .. && node evals/run-all.mjs --only=clinic              # real tool calls in a real browser
CHROME=/usr/bin/google-chrome node evals/a11y.mjs --url=http://127.0.0.1:3000   # axe gate, must exit 0
```

`--url` matters: without it both `a11y.mjs` and `pnpm build` rebuild `.next` underneath a running dev
server and 500 it. Screenshots come from
`node evals/harness/webmcp-cdp.mjs "<url>" steps.json`, whose steps take `waitFor`, `sleep`, `shot`,
`eval`, `key`, `invoke` and `viewport` (`{"viewport":{"width":390,"height":844,"dpr":2}}` is how you
check the phone). Evidence lands in `docs/evidence/clinic/`. If you change a `data-*` hook, the case
that used it fails — fix the case in the same commit.

## Proposed, not yet law

1. Assert the colour law in an eval: no computed colour on `/clinic/book` outside the surface, blue,
   gone, alert and bar sets. It is the most load-bearing rule here and nothing tests it.
2. `evals/cases/clinic-receipt.json` still drives `[data-lane]`, which no surface renders since the
   receipt was removed. Delete the case or rewrite it against the counters' `data-clinic-count-*`.
3. The manual flow's five fields are validated only on "Review your answers". On-blur validation for
   the date and the phone would catch a typo one screen earlier.
