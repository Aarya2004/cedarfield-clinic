---
id: T4
title: Interaction counter + measurement spec
type: task
status: in_progress
assignee: aarya-claude
blocked-by: []
---

## Question

The honesty-critical module: `lib/drop/interaction-counter.ts` + a small `CounterBadge` component.

1. Write `lib/drop/COUNTING.md` FIRST — the measurement spec: what is one interaction? Proposed:
   each discrete user input event that advances the task — pointerdown, keydown (not keyup, not
   modifiers alone), wheel/scroll gesture (debounced 350ms so one scroll = one), focus-by-tab counts
   (switch users pay per tab). Not counted: mouse movement, hover. The spec is what we defend to a
   judge; write it so the number survives hostile reading.
2. The module: `createCounter(root: HTMLElement)` → attaches listeners per spec, `count`,
   `breakdown` (clicks/keys/scrolls/tabs), `reset()`, `stop()`. Framework-free, relative imports,
   unit-tested with synthetic trusted-ish events (document the isTrusted caveat in tests: jsdom
   events count in tests; production counts real input only — assert the filter logic separately).
3. `CounterBadge` — `{ count, mode: 'manual' | 'agent' }`: quiet running tally that becomes the
   receipt line at task end ("manual mode: 41 interactions"). Never a hardcoded number anywhere —
   grep-proof: the strings "42" / "21×" must not appear in this code.
