# COUNTING.md — what counts as one interaction

This is the measurement spec for `interaction-counter.ts`. Every interaction number this project
shows on screen, in the video, or in the submission is produced by that module running under this
spec against real user input. Nothing is scripted, estimated, extrapolated, or typed in by hand.

Read this before you argue with the number. It is written to be argued with.

## The definition

> **One interaction = one discrete act of user input, made by a human, inside the measured region,
> that the user had to perform to move the task forward.**

Four words carry the weight:

- **discrete** — an act with a beginning the user chose. Not a continuous stream, not a consequence.
- **act of user input** — the user moved a finger. Not the app moving, not time passing.
- **human** — the browser must vouch for it (`isTrusted`). See [Trust](#trust).
- **inside the measured region** — the counter is scoped to one DOM root. See [Scope](#scope).

Total is a plain sum of four buckets, never weighted:

```
total = clicks + keys + scrolls + tabs
```

Anyone can recompute the total from the displayed breakdown. If you think one bucket is unfair,
subtract it — the breakdown is on screen for exactly that reason.

## The four buckets

### 1. `clicks` — pointer presses

Counted: one per `pointerdown` inside the root. Mouse, trackpad, touch, pen, and stylus all
produce it, so one instrument covers every pointing modality.

Why `pointerdown` and not `click`:

- A press is the act. `click` is the browser's report that a press and a release landed on the
  same element — a consequence, and counting both would double every button.
- A drag (scrubbing a slider, dragging a scrollbar) is one press, so it is one interaction.
- A double-click is genuinely two presses, and correctly counts as two.
- Presses that miss (you click a disabled control, you click empty space to dismiss a menu) count.
  They cost the user the same. We do not get to keep only the presses that worked.

### 2. `keys` — key presses

Counted: one per `keydown` inside the root, except the exclusions below.

Excluded, with reasons:

| Excluded | Reason |
| --- | --- |
| `keyup` | The release of a press already counted. |
| Bare modifiers (`Shift`, `Control`, `Alt`, `Meta`, `CapsLock`, `NumLock`, `ScrollLock`, `AltGraph`, `Fn`, `FnLock`, `Hyper`, `Super`, `Symbol`, `SymbolLock`) | Holding Shift to type a capital is part of one act of typing that letter, not a second act. `Shift+A` is one interaction. |
| Auto-repeat (`event.repeat === true`) | Holding Backspace to erase a word is one sustained act, not thirty. |
| `Tab` / `Shift+Tab` | Counted, but in the `tabs` bucket — see below. |

Typing counts per character. Entering a five-letter first name is five interactions. This is not
padding: character-by-character entry is the honest bulk of what a form costs a person, and it is
precisely the cost an agent removes. We report it rather than hiding it in a "filled one field"
abstraction that would flatter both modes equally and explain nothing.

Composition (IME) keydowns count once per physical key press, which is what the user actually did.

### 3. `scrolls` — scroll gestures, coalesced

Counted: one per **gesture**. A `wheel` event starts a gesture; further `wheel` events within
`SCROLL_GESTURE_GAP_MS` (350 ms) of the previous one belong to the same gesture and add nothing.
A gap of 350 ms or more starts a new gesture.

Why coalesce: one flick of a wheel or a trackpad emits tens of `wheel` events. The user performed
one act. Counting raw events would inflate manual mode by an order of magnitude and would be
indefensible. 350 ms is longer than the inter-event spacing of any continuous scroll and shorter
than a deliberate second flick.

The coalescing is deliberately generous against us: a slow, continuous two-second scroll counts as
one interaction even though the user kept working the wheel the whole time.

We do not listen for the `scroll` event, because every cause of a scroll is already counted
somewhere: a wheel/trackpad scroll is a `wheel`, a keyboard scroll is a `keydown`, a scrollbar drag
and a touch drag are a `pointerdown`. Listening for `scroll` as well would double-count all three,
and would also count scrolling the app itself performs.

### 4. `tabs` — keyboard focus moves

Counted: one per `Tab` or `Shift+Tab` keydown inside the root.

Broken out from `keys` for one reason: keyboard and switch users pay a Tab press for every field
they pass, and that cost is real but is not typing. A reader who thinks focus travel should not be
in the total can subtract this bucket from the displayed breakdown and get a number we would still
stand behind. Auto-repeat Tab (holding it down) is excluded exactly as in `keys`.

## What is never counted

- **Pointer movement and hover.** Moving a mouse across the screen, and hovering to reveal a menu,
  cost real time and real effort. We count none of it. This is the single largest way this spec
  undercounts manual mode, and we accept it because we cannot attribute movement to intent.
- **Consequence events**: `click`, `dblclick`, `input`, `change`, `submit`, `keypress`, `keyup`,
  `scroll`, `focus`/`blur`. Each is the browser reporting the result of something already counted.
- **Programmatic focus and programmatic scroll.** When the flow focuses the first field of a step
  or scrolls an error into view, the app did that, not the user. It is free. (This is also why the
  counter does not listen to `focusin`: it cannot tell an app-initiated focus from a user's, so it
  refuses to guess and counts neither. Keyboard focus travel is still captured, via `tabs`.)
- **Waiting, reading, deciding, page loads, network time.** This counter counts acts, not seconds.
  It never claims to measure duration, and no duration is derived from it.
- **Anything outside the measured root** — including the demo's own chrome, the tally badge itself,
  and any surrounding page furniture.
- **Anything a script dispatched.** See below.

## Trust

In a browser, an event counts only if `event.isTrusted === true`. Synthetic events dispatched by
page script, by the console, by an extension, by an automation driver, or by an agent are ignored.
Neither we nor a judge nor the agent can inflate the number from JavaScript.

The one exception is the unit test process, which has no browser and no trusted events. Tests
construct plain event objects and create the counter with `{ trustedOnly: false }` to exercise the
bucket logic. The trust filter is therefore asserted separately and directly: with the production
default, an untrusted event is dropped in every bucket. The filter is never disabled outside tests
— production code paths call `createCounter(root)` with no options.

## Scope

`createCounter(root)` attaches listeners to a single element in the **capture** phase. Capture is
required, not incidental: a descendant that calls `stopPropagation()` (a form widget swallowing
keys, say) must not be able to make its own cost invisible.

The measured root is the flow being measured, and only that. Manual mode and agent mode are
measured by the same function, with the same options, over the equivalent root. There is no second
code path, no per-mode adjustment, and no place in the module where a count can be assigned a
literal value — the only way any bucket increases is an event arriving from a listener.

## Reset and stop

- `reset()` zeroes all four buckets and forgets any in-flight scroll gesture, so the next `wheel`
  starts a fresh gesture. Listeners stay attached.
- `stop()` removes every listener and is idempotent. After `stop()` the final numbers stay readable
  — that is what the receipt line prints.

## Where this spec is generous to the other side

Stated plainly, because a hostile reading will find these anyway:

1. Pointer travel and hover are free here, and they are not free for a person. Fitts's law says the
   time cost of manual mode is worse than its interaction count suggests.
2. A long continuous scroll counts once.
3. Held keys count once.
4. Assistive-technology focus moves that arrive without a Tab keydown are not counted.
5. Autofill is free: if the browser fills four fields from one selection, the user pays for the
   selection, not the characters. We do not defeat autofill, and the manual form carries correct
   `autocomplete` attributes so autofill works — which lowers our own headline number.

Each of these makes the manual number **smaller** than the lived cost. None of them inflates it.
The number we show is a floor.

## Where it could be argued the other way

1. Per-character typing is the biggest contributor to manual mode. Someone could argue a field
   should count as one interaction. We disagree — a person types the characters — but the
   breakdown separates `keys` so that argument can be made against a visible number rather than a
   hidden one.
2. Missed and corrective presses count. Someone could argue only "productive" input should count.
   We do not know which presses were productive, and deciding after the fact would let us discard
   whichever presses hurt our case.
3. `tabs` is in the total. Subtract it if you disagree; it is displayed separately.

## The rule behind the rules

When a case is ambiguous, the counter does the thing that makes our own claim weaker: it does not
count. Every judgement call above resolves the same direction. That is the only way a number
produced by the party it flatters is worth anything.
