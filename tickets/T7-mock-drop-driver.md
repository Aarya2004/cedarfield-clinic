---
id: T7
title: Mock drop driver (rival sim + hold/expire clock)
type: task
status: closed
assignee: aarya-claude
blocked-by: []
---

## Question

`lib/drop/mock-driver.ts` — the throwaway stand-in for Arav's Durable Object, so the whole UI runs
tonight. Deterministic, seedable, event-emitting:

- Owns the clock (components get time via props — T2's rule). `advance(ms)` for tests; rAF-driven
  in the browser.
- Emits the event stream the UI consumes: `drop_wave(slots[])`, `slot_taken(slotId, by:'rival')`,
  `hold_started(slotId, ttl)`, `hold_expired(slotId)`, `booked(slotId)`. The RIVAL: takes slots on
  a seeded schedule (aggressive early, tapering) — labelled honestly in UI as simulated.
- API mirrors what any adapter must offer: `subscribe(cb)`, `hold(slotId)`, `confirm(slotId)`,
  `release(slotId)` — this interface IS our proposal for the adapter seam; document it in the file
  header as the shape we'll ask Arav's contract to map into.
- Scenario presets for the playground + video: `scenario('lose')` (all slots gone in ~8s),
  `scenario('hold-and-book')`, `scenario('expire')`. Unit-tested: determinism per seed, expiry
  ordering, no slot taken twice.

## Resolution (2026-08-30)
Commit 09e2cf9. 19 tests. Seeded deterministic driver (advance(20000) ≡ 200×advance(100), byte-identical logs); rival never double-takes or steals a held slot. types.ts untouched; two seam gaps flagged for Arav (no hold_released event — release() resyncs via drop_wave; `at` is driver-clock not epoch). Verified independently: targeted suite + lose scenario (wave@0, 6 takes ending 7006ms).
