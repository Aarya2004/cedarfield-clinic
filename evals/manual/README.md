# Manual eval cases

Cases that need something the CI harness cannot fake.

## clinic-gesture-fires.json — "the palm books it"

Needs a real open palm on the fake camera. The full pipeline short of the classifier is already
CI-proven (`clinic-gesture-boot.json`: wasm + model + getUserMedia + teardown; and the dwell logic
is unit-tested); this case closes the last inch — canned-gesture classification firing the act.
Findings from the attempt to fake it (2026-09-01): Chrome's `--use-file-for-fake-video-capture`
works and the recognizer runs on it, but Google's canned classifier read our best stock palm photo
as `None 0.77` (hand detected, gesture not) and white-background cutouts as no hand at all. A live
hand classifies fine — that is what the model was trained on.

Run it with a webcam recording of your own open palm (a few seconds, converted to y4m), or just
test live per `apps/web/src/components/drop/GESTURE.md` and watch `data-gesture-seen` — the dock
now prints the model's live classification (e.g. `Open_Palm 0.92`), so the filmed manual test is
self-verifying.

    ROKAN_EVAL_CHROME_FLAGS="--use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
      --use-file-for-fake-video-capture=/path/to/your-palm.y4m" \
      node evals/harness/webmcp-cdp.mjs 'http://localhost:3000/clinic/book?test=1' \
      evals/manual/clinic-gesture-fires.json

## clinic-soak.json — time-driven paths (~3 min)

Lives in `evals/cases/` and runs in `run-all`, but is deliberately NOT in `verify-deployed`: its
walk-away beats (a 45 s cancel arm expiring, a full 90 s wave rollover) exceed the per-case timeout.
Against an origin, run it by hand on the seeded board:

    node evals/harness/webmcp-cdp.mjs '<origin>/clinic/book?test=1' evals/cases/clinic-soak.json
