---
id: T6
title: MediaPipe gesture module (flagged progressive enhancement)
type: task
status: closed
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

## Resolution (2026-08-30)
Commit c845a1a. 22 tests (dwell/flicker/cancel/fire-once). @mediapipe/tasks-vision@1.0.1 pinned; model+wasm (42MB) NOT committed — sha256-pinned fetch script (scripts/fetch-gesture-model.sh) + gitignore. Headless: no-camera path 20/20 (honest visible line, keyboard still books, ZERO Google-origin requests), fake-camera 10/10 (pipeline 2230ms cold, hand-free feed books nothing). RATIFIED by orchestrator: (1) middleware camera/wasm headers exist ONLY under NEXT_PUBLIC_DROP_GESTURE=1 (verified in src/middleware.ts:24; flag-off headers byte-identical); (2) connect-src stays closed — MediaPipe telemetry to odml.pa.googleapis.com is refused by CSP and the recognizer works anyway; never widen it. OPEN: real-palm recognition + ChatGPT-desktop getUserMedia are the two manual human checks (GESTURE.md); gesture stays out of the demo script until done.
