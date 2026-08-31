---
id: T5
title: Manual-mode booking flow (the honest tax)
type: task
status: closed
assignee: aarya-claude
blocked-by: [T4]
---

## Question

The flow the counter measures — act 1's "lose the race by hand". A realistic (not strawman) manual
booking: board → pick a slot (opens detail) → details form (name, DOB, reason dropdown, phone,
accessibility-needs textarea — the fields a real clinic asks) → review step → book button.
Honesty rule: this must be a GOOD manual form — proper labels, sensible tab order, no dark patterns —
because the counted number is only defensible if manual mode is fair. It still costs ~dozens of
interactions because structure costs interactions; that is the point.

Integrate T4's counter scoped to the flow root; surface the live tally + final receipt. During a
drop (driven by T7's mock), slots can vanish mid-flow ("this slot was just taken — start over"),
which is the honest race-loss beat, not sabotage: the rival takes slots on its schedule whether or
not you are mid-form. Form state in `lib/drop/manual-flow.ts` (testable reducer). `data-*` hooks
on every step.

## Resolution (2026-08-30)
Commit 70d7856. 25 tests. Fair clinic flow (real fields, proper labels/tab order), counter scoped to flow root, live tally + receipt, mid-form slot loss preserves typed input (data-drop-slots-lost). Live-drive caught + fixed real bug: error summary stole focus per errorCount change, eating keystrokes after failed submit — now once per attempt. Verified independently: targeted 49/49 (w/ T4).
