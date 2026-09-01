# GestureConfirm — the camera dwell (ticket T6)

> **2026-09-01 — the clinic docks are the live surface now.** The manual camera test below was
> written against `/drop-spike`; the shipped module sits on `/clinic/book`'s confirm dock (book,
> cancel, AND move — the copy follows the verb). Fastest real-hand test today:
> `cd apps/web && pnpm build && pnpm start`, open `http://localhost:3000/clinic/book`, ask an agent
> to hold a slot (or use `window.__CEDARFIELD_AGENT__.holdSlot(...)` in the console), click
> **Enable camera** on the dock, hold an open palm through the dwell — the row books. Then book one,
> have the agent call `clinic_prepare_cancel`, and confirm the SAME palm cancels with the cancel
> copy. What to film and the tremor/flicker checks below still apply unchanged.

An open palm held in front of the lens for a configurable dwell (default 1000ms) calls the **same**
`onConfirm` the Enter key calls. It plugs into `ConfirmSurface`'s `gestureSlot` and it is never the
primary path: WCAG 2.5.4 requires motion actuation to have a UI alternative and to be disableable,
and here the alternative is the entire product.

Blink detection is banned by the ticket (5.6–46.5% false-positive literature). One canned gesture,
`Open_Palm`, held — nothing that can be triggered by an involuntary movement.

## Turning it on

```bash
bash apps/web/scripts/fetch-gesture-model.sh     # provisions ~42MB into public/models/ (gitignored)
cd apps/web && NEXT_PUBLIC_DROP_GESTURE=1 pnpm dev
open http://localhost:3000/drop-spike            # act II ("By agent")
```

With `NEXT_PUBLIC_DROP_GESTURE` unset, `DropBench` passes no `gestureSlot`, the module is unreachable
from the page, MediaPipe is in no bundle, and the response headers are byte-identical to pre-T6.

## The two doors the flag opens (`src/middleware.ts`)

Both are scoped to the flag and shut again without it:

| Header | Default | With the flag |
| --- | --- | --- |
| `Permissions-Policy` | `camera=()` — `getUserMedia` disabled for this origin | `camera=(self)` |
| CSP `script-src` | no wasm | adds `'wasm-unsafe-eval'` (wasm compilation only; not JS `eval`) |

Without the first, the module can only ever report `unavailable`. Without the second, Chrome refuses
to instantiate the MediaPipe wasm. `connect-src 'self'` already covers the model fetch because the
assets are same-origin.

## Assets and licence

Both the wasm runtime and `gesture_recognizer.task` are served from **our** origin under
`/models/mediapipe/`. There is no runtime request to a Google CDN, ever — a visitor's IP is not
handed to a third party the moment they enable a camera, the demo does not depend on someone else's
uptime, and the CSP stays closed.

- `@mediapipe/tasks-vision@1.0.1` (pinned exact) — **Apache-2.0** code.
- `gesture_recognizer.task` (float16, 8,373,440 bytes, sha256 `9795 2348 … 0482`) — **NOT Apache**.
  The weights are governed by Google's MediaPipe model terms of service. That is why `public/models/`
  is gitignored and the file is fetched per-deployment by `scripts/fetch-gesture-model.sh` rather
  than redistributed in this repository. Read the model card before shipping this to production.

### MediaPipe phones home; our CSP stops it

Observed in the headless drive, 2026-08-30: on recognizer creation, `tasks-vision` attempts a
`fetch` to **`https://odml.pa.googleapis.com/v1/log`**. There is no documented option to turn that
off. Our `connect-src 'self'` refuses it, and the refusal is what the two CSP lines in the console
are — the request never leaves the machine, and the recognizer works anyway. Do not widen
`connect-src` for this. If a future version makes the telemetry load-bearing, that is a reason to
drop the dependency, not to open the door.

The other console line, `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.`, is MediaPipe
logging an *info* message through `console.error` — theirs, not ours. It also tells you the GPU
delegate fell back to CPU, which is expected headless and should not happen on a real laptop.

Cold cost, measured from the files on disk: 34MB of wasm (three builds — SIMD, no-SIMD, ES module;
the browser downloads one) + 8.0MB of weights + ~200KB of JS. All of it behind an explicit click:
`import('@mediapipe/tasks-vision')` happens in the enable handler and nowhere else.

## What it does not prove

`ConfirmSurface` can claim "the agent structurally cannot press this" because the UA marks
synthetic events `isTrusted === false`. **The gesture path has no equivalent guarantee** — a
printed hand or a video of one is an `Open_Palm` to any classifier. So this module is off by
default, behind a build flag, and the demo's security line stays a keyboard line. Do not let it
drift into the pitch as a security feature.

## Manual test — real camera, ~4 minutes

Headless Chromium has no camera, so the loop below is the only thing that exercises MediaPipe. Do
it on the machine that will run the demo, in the browser that will run it.

1. **Provision + serve.** Run the fetch script, then `NEXT_PUBLIC_DROP_GESTURE=1 pnpm dev`, open
   `/drop-spike`, click **Act II — By agent**, then **Simulate the agent's hold_slot call**. The
   confirm surface arms and the gesture strip is under it reading `Or book it with an open palm.`
   with `data-gesture-state="disabled"`.
2. **Enable.** Click **Enable camera**. Expect, in order: `Loading the vision runtime…` →
   `Loading the hand model — N%` (a real byte count, streamed) → `Waiting for the camera…` → the OS
   permission prompt → your own face, mirrored, inside the ring. `data-gesture-state` goes
   `loading` → `ready`.
3. **Dwell.** Hold an open palm, fingers spread, 30–60cm from the lens. The ring fills over the
   slider's duration and `data-gesture-state` reads `held`; at full it reads `fired`, the booking
   lands exactly as if you had pressed Enter, and the ring turns green. Check the ledger row in the
   rail changed. **Check the interaction counter did not count a keystroke that never happened.**
4. **Cancel.** Re-run (Reset → hold again), start a dwell, and drop your hand at roughly half. The
   ring empties and does not book. Put it back up — the ring starts from zero, not from where it
   stopped. Then hold it steady but let it flicker (rotate the hand briefly): a dropout under 250ms
   must not cost the hold.
5. **Off.** Click **Camera off**. The camera light goes out (verify at the OS level — this asserts
   the tracks were actually stopped), `data-gesture-state` returns to `disabled`, and Enter still
   books. Reload: it is still off.
6. **Denied.** In a fresh profile, block the camera at the prompt. Expect
   `data-gesture-state="unavailable"` and *"Camera access was declined. The keyboard still books
   this — press Enter."* Press Enter: it books. Nothing is disabled, nothing is stuck spinning.

### localStorage keys

| Key | Values | Meaning |
| --- | --- | --- |
| `drop.gesture.enabled` | `on` \| `off` \| absent | the off switch; absent or anything else = off |
| `drop.gesture.dwellMs` | `400`–`3000` | the slider; junk or out-of-range falls back to `1000` |

`drop.audioCues` is T1's, unrelated.

A remembered `on` **does not** reopen the lens on load unless
`navigator.permissions.query({name:'camera'})` already reports `granted` (see `shouldAutoStart`).
Persisting a switch must not mean prompting somebody for a camera on a page they just opened, and
in Firefox/Safari — no camera permission descriptor — the answer is `unknown`, so it waits for a
click. To test: set `drop.gesture.enabled=on` with a standing grant and reload; the camera should
come up on its own. Clear it, grant nothing, reload: nothing should happen.

## Open question — ChatGPT desktop: UNVERIFIED

**We do not know whether `getUserMedia` resolves inside ChatGPT desktop's embedded view.** It is an
Electron-class host; camera access there depends on the host's permission handler and its own
Permissions-Policy, neither of which we control or have tested. Both outcomes are handled and
neither is allowed to matter:

- If it resolves, the dwell works exactly as it does in Chrome.
- If it rejects or `navigator.mediaDevices` is missing, `classifyCameraError` returns `denied` or
  `unsupported`, `data-gesture-state` goes `unavailable`, and the strip renders one line saying the
  keyboard still books it. **Nothing is blocked and nothing looks broken** — the module degrades
  invisibly, which is the whole requirement.

Somebody with the desktop app should run step 2 there and write the answer into this file. Until
then, do not put the gesture in the demo script or the video.

## Where the logic lives

Everything decidable without a webcam is in `../../lib/drop/gesture-logic.ts` and unit-tested
against synthetic frames in `gesture-logic.test.ts` (22 tests): dwell accumulation, flicker
tolerance, cancel-on-lost-palm, fire-once, the frame-delta clamp, the six `data-gesture-state`
values, error classification, and the two prefs. `GestureConfirm.tsx` is the adapter — wasm, camera,
ring — and should stay thin enough to read in one sitting.

Two rules in there are worth knowing before you change anything:

- **Time is credited from the last sighting, not the last frame.** rAF runs at 60Hz+ and a webcam
  delivers ~30fps, so half the ticks carry an image MediaPipe has already seen (and it rejects a
  repeated timestamp). Those are reported as *no gesture*; the grace window absorbs them. Credit
  from the previous frame would halve the hold and double every dwell.
- **A frozen feed cancels; it never confirms.** Repeated frames are not re-asserted as "still a
  palm", so a stalled camera on a still image runs out the grace window and empties the ring. Same
  reason `MAX_FRAME_MS` caps what one frame may credit: a backgrounded tab must not come back and
  book something.

## Data hooks

`data-gesture-confirm` on the root, plus `data-gesture-state`
(`disabled|loading|ready|held|fired|unavailable`), `data-gesture-progress` (`0.00`–`1.00`),
`data-gesture-dwell-ms`, `data-gesture-toggle` / `data-gesture-enable` (the button),
`data-gesture-retry`, `data-gesture-dwell-input`, `data-gesture-live`.
