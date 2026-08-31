---
id: T6
title: MediaPipe gesture module (flagged progressive enhancement)
type: task
status: in_progress
assignee: aarya-claude
blocked-by: []
---

## Question

`GestureConfirm` — plugs into T1's `gestureSlot`; NEVER the primary path (WCAG 2.5.4: motion
actuation needs a UI alternative and must be disableable — keyboard stays primary, this is an
enhancement that upgrades in place when `getUserMedia` resolves).

- `@mediapipe/tasks-vision`, GestureRecognizer, `Open_Palm` HELD for a configurable duration
  (default 1000ms, visible dwell ring filling while held) → fires the SAME callback as the keypress.
  Blink is banned (5.6–46.5% false-positive literature). Threshold/duration slider visible to the
  user; off switch persists.
- Load discipline: ~19MB cold (11.2MB wasm + 8MB model). Lazy-load ONLY on explicit "enable camera"
  action, visible progress state, self-hosted `.task` file (note in code: model weights are under
  MediaPipe ToS, not Apache — self-host and say so; no Google-served model fetch at runtime).
- Failure honesty: no camera / denied / load-fail → module renders its "keyboard works" line and
  gets out of the way; never blocks T1. `data-gesture-state` hook
  (`disabled|loading|ready|held|fired|unavailable`).
- Feature flag: `NEXT_PUBLIC_DROP_GESTURE=1`. Test what's testable headless (state machine around
  recognizer events, mocked recognizer); real-camera check is a manual step documented in the
  component README, incl. the open question: getUserMedia in ChatGPT desktop is UNVERIFIED — this
  module must degrade invisibly there.
