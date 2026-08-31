---
id: T8
title: Playground page — the clickable demo prototype
type: task
status: closed
assignee: aarya-claude
blocked-by: [T1, T2, T3, T5, T7]
---

## Question

`apps/web/src/app/drop-spike/page.tsx` — wire T1+T2+T3+T5+T7 (and T6 if flagged on) into the full
60-second demo arc, driven entirely by the mock driver:

1. DropCountdown → wave drops → manual mode: judge tries by hand, counter runs, rival wins
   (`scenario('lose')`).
2. "Agent mode" toggle (a labelled sim button standing in for real tool calls — honest caption:
   "simulating the agent's hold_slot call") → hold freezes a slot → TtlBar burns → ConfirmSurface
   arms → Enter → booked, counter shows the collapse.
3. The expire path (`scenario('expire')`) reachable for completeness.

Purpose: (a) the lock-decision aid for the two humans tonight, (b) the transplant test — if wiring
here is clean, wiring to Arav's real contract is the same seam. Screenshot the three beats to
scratch/ (webapp-testing skill), both light/dark if trivial. This page never claims WebMCP — no
navigator.modelContext calls on the spike; the honest caption carries that.

## Resolution (2026-08-30)
Commit 472423c. /drop-spike "Drop Bench": three acts, transport (pause/reset/seed/scenario), event trace, 39-vs-1 ledger. Headless-proven: zero console errors; CDP-trusted Enter accepted while synthetic click blocked+counted in the same run; typed input survives mid-form slot loss; deterministic per seed; 0px overflow at 390px. Shots in scratch/beat*.png. Orchestrator re-verified gate (356/356, typecheck clean) + reviewed beat2 screenshot.

FIVE TRANSPLANT FINDINGS (for the lock / Arav):
1. CONTRACT GAP: confirm() presupposes a hold — first-come booking hangs. Real contract needs book(slotId) beside confirm(heldSlotId) (or confirm-on-open), and it must be ONE call — take-then-book round trip is a race the user loses.
2. Token collision: ConfirmSurface dark keycap vs paper :root --drop-ink (1.2:1) — namespace --drop-cs-* or ship the dark family in drop-tokens.css.
3. TtlBar/DropCountdown lean on global --ink/--muted — give them --drop-* tokens.
4. Driver-swap fold cleared during render (one-frame stale-board bug, fixed in seam).
5. force-dynamic required: static prerender breaks the per-request CSP nonce → page never hydrates. Check every future route.
