---
id: T8
title: Playground page — the clickable demo prototype
type: task
status: in_progress
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
