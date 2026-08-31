---
id: T1
title: Confirm surface — the one human act
type: task
status: in_progress
assignee: aarya-claude
blocked-by: []
---

## Question

Build `ConfirmSurface` — the product's soul: the surface where the one human act happens.
Props: `{ secondsLeft, slotLabel, onConfirm, disabled?, gestureSlot? }`. Behavior:

- Fires `onConfirm` ONLY from a trusted event (`event.isTrusted === true`) — a synthetic/dispatched
  event is ignored and logged to a `data-untrusted-attempts` counter attribute (this is the
  demo's proof line: the agent structurally cannot press it).
- Keyboard-first: focused by default when armed, Enter/Space both fire, giant hit target (full-width,
  ≥96px tall), works with switch access (single-input).
- ARIA: `role="button"`, `aria-live="assertive"` announcements on arm ("Slot held. N seconds.
  Press Enter to book.") and on TTL milestones (30s, 10s) — announcements throttled, not per-second.
- Urgency states driven by `secondsLeft`: calm (>30s), attention (10–30s), critical (<10s) — visual
  only, no layout shift, no flashing above 3Hz (photosensitivity).
- `gestureSlot` renders an optional child (T6's module plugs in here later); absent = keyboard only.
- Disabled state (no hold active) explains itself.

Audio cues (opt-in): two subtle sound cues — hold armed, and the 10s TTL mark. OFF by default with
a visible toggle (unsolicited audio is itself an a11y complaint); Web Audio API oscillator/envelope
in `lib/drop/audio-cues.ts` (no audio asset files, no autoplay before a user gesture — browser
policy requires one anyway), volume modest, never blocks or delays the confirm path, respects
`prefers-reduced-motion`-style choice via the same persisted toggle. `data-audio-cues` state hook.

Logic that decides trusted/announce/urgency goes in `lib/drop/confirm-logic.ts` (relative imports,
unit-tested). Invoke the frontend-design skill before styling. This component must be beautiful —
it is on camera for the demo's climax.
