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

## Talk to Cedarfield — the live voice loop (needs OPENAI_API_KEY on the deployment)

CI proves the honest degrade (`clinic-voice-unavailable.json`: no key → the panel says so, tools
still register). The spoken loop itself needs a real key, a real microphone and a person:

1. On a deployment with `OPENAI_API_KEY` set (and `NEXT_PUBLIC_DROP_VOICE=1`, the build default),
   open `/clinic/book`, press **Talk to Cedarfield**, allow the microphone. `data-clinic-voice`
   goes `connecting` → `live`; the status line reads "Listening…".
2. Say "what appointments are open today?" — the agent answers aloud; the strip at the top shows
   "Your assistant: N open of 6"; `data-clinic-voice-calls` ticks to 1.
3. Say "hold me the earliest appointment" — a row turns to *Held for you · via your assistant*, the
   confirm bar rises, the agent says the slot is held and that only you can book it.
4. Say "book it" — the agent must refuse (no `clinic_book_slot` in its list) and tell you to press.
   Press **Let my assistant book for me** (or show a palm there): the tool list is re-sent with
   `clinic_book_slot`. Say "yes, book it" — booked; the card reads "0 interactions from you".
5. **Stop listening** ends the session; five minutes ends it on its own.

Write the run down in `docs/evidence/clinic/` with the date, the client secret's model name from the
route's JSON (`model`), and what the agent said at each step.

## clinic-soak.json — time-driven paths (~3 min)

Lives in `evals/cases/` and runs in `run-all`, but is deliberately NOT in `verify-deployed`: its
walk-away beats (a 45 s cancel arm expiring, a full 90 s wave rollover) exceed the per-case timeout.
Against an origin, run it by hand on the seeded board:

    node evals/harness/webmcp-cdp.mjs '<origin>/clinic/book?test=1' evals/cases/clinic-soak.json

## clinic_booking_form — the declarative half (Chrome only, by hand)

Open `/clinic/book` in Chrome 152+ with `chrome://flags/#enable-webmcp-testing`, click a slot,
then **Start** — the patient-details form is now published by the browser itself as the tool
`clinic_booking_form` (DevTools → Application → WebMCP, or the Model Context Tool Inspector
extension). Invoke it from the Inspector with a name, date of birth (YYYY-MM-DD), reason, phone:
the browser fills the fields, the page shows **"Filled in by your agent. Read it over — nothing is
sent until you press Review, then Book."** There is deliberately no `toolautosubmit`; a submit the
browser attributes to an agent is refused and counted on the form. The CI case
(`clinic-declarative.json`) proves registration, the absence of autosubmit, the refused synthetic
submit and the person's trusted path; the fill itself is Chrome's and is checked here.
