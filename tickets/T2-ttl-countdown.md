---
id: T2
title: TTL bar + drop countdown
type: task
status: closed
assignee: aarya-claude
blocked-by: []
---

## Question

Two small time components, props-driven, zero external state:

1. `TtlBar` — `{ totalSeconds, secondsLeft, label? }`: a burning hold bar. Smooth (CSS transform,
   not width-per-tick re-render), color shifts with T1's same urgency thresholds (share the tokens),
   numeric seconds always visible (never color-only — a11y), `aria-hidden` on the bar with the number
   in an `aria-live="polite"` text alternative at milestones.
2. `DropCountdown` — `{ dropAt: Date }`: banner counting down to the next drop wave ("next drop in
   0:42"), flips to a live "DROP" state at zero (parent drives actual slot appearance).

Time math in `lib/drop/time.ts` (unit-tested: formatting, threshold edges, negative clamp).
No timers inside the components — parent passes time down (mock driver T7 owns the clock), so
components stay deterministic and testable.

## Resolution (2026-08-30)
Commit e3bbe25. 10 tests. Pure components, parent-owned clock, scaleX fill w/ reduce-motion guard, milestone-only announcements, display ceils (0:00 only when truly gone). Verified independently: targeted suite green.
