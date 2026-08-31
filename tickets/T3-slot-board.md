---
id: T3
title: Slot board + slot card states
type: task
status: open
assignee:
blocked-by: []
---

## Question

Build `SlotBoard` + `SlotCard` on mock data. Card states (the demo's emotional arc lives here):
`open` · `held_by_you` (TtlBar slot, glowing lane) · `held_by_other` (locked, anonymized holder chip)
· `taken_by_rival` (the loss — visibly claimed by the labelled "simulated rival", brief exit
animation, then gone/greyed) · `booked_yours` (the win). Board: a drop wave renders 8–12 slot cards
(time, clinician, kind) in a grid that reads at video distance — big type, judge watches from a
recording.

Data shape: define `Slot`/`SlotState` in `lib/drop/types.ts` — OUR shape, documented as the UI-side
type the future adapter maps Arav's contract INTO (never import from webmcp libs here).
Skin: all colors/spacing through a `drop-tokens` layer (CSS vars) so the brand swaps when the name
lands — no Rokan palette hardcoding. State transitions announced via one polite live region on the
board ("9:20 slot taken", "9:40 held — yours"), throttled. Every card: `data-slot-id`,
`data-slot-state`. frontend-design skill first; the lost-race beat (state flips under contention)
must be legible in under 3 seconds of video.
