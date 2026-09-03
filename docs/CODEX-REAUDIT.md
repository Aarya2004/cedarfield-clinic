# Codex re-audit prompt (paste into a Codex task with the booking page open in its browser pane)

Replace `ec52b81` with the commit `git log --oneline -1` prints on `main` after the deploy.

```text
Re-audit https://rokan-terminal.vercel.app/clinic/book on production build ec52b81. For EACH numbered
item below, report PASS or FAIL with the exact text or value you observed. Do not summarise; do not
skip items you cannot run — mark them BLOCKED with the reason. Use the WebMCP tools directly where
an item names one. Use only synthetic data. Do not book an appointment unless an item says so.

Prior findings, to re-verify on this build:
1. Fresh page → fetch tools → immediately call clinic_list_drops. Repeat 3 times on 3 fresh loads.
   PASS = no "stale" error on any first call.
2. Tool list at load on the live board: 12 tools including clinic_wait_for_request. PASS = present
   before any request exists.
3. clinic_explain_confirm: one protocol sentence — "No booking tool by default … a trusted, visible
   permission creates a one-use, ten-minute clinic_book_slot; cancel and move are never delegated".
   PASS = the answer contains that protocol and tool_that_books is null.
4. Profile: "Who is this appointment for?" — leave the date empty, press Save. PASS = an alert
   naming the count, a field-level error under the date, aria-invalid=true on the date field, focus on
   it. Then type 12/04/1990 (day first), a name, a phone, Save. PASS = "Booking as … · Apr 12, 1990 …
   · Saved." and localStorage cedarfield.patient.dateOfBirth === "1990-04-12".
5. "Not you? Remove", then press "Let my assistant book for me". PASS = a strip at the top says to
   add the patient's name, date of birth and phone; no permission is created.
6. Type a request into "Say it to the page" and press Hand it over. PASS = the log shows Typed "…",
   "1 request waiting", and "Talk to Cedarfield" is NOT disabled (its status line reads "Voice is
   ready…" or the not-set-up line — never a "listening" excuse).
7. Call clinic_wait_for_request. PASS = it returns your text with via "typed" and next_step telling
   you to call it again; the panel's waiting count drops to 0 immediately (not after a second).
8. Press "Listen for me". Report the exact status line. PASS = either "Listening…" or an explicit
   "Speech recognition is unavailable in this browser — its speech service did not answer" line.
   FAIL = a bare "Listening stopped (network)".
9. "Talk to Cedarfield": report the status line BEFORE pressing. PASS = "Voice is ready…" (or the
   explicit not-set-up line). Then press it and allow the mic. PASS = state goes live and stays live
   for 10 s; the recognizer panel says it is paused because of the call. End the call. PASS = the
   recognizer's Listen button is enabled again.
10. Enable the sign camera on the "Say it to the page" panel with nothing in front of it for 15 s.
    PASS = no "Signed …" line appears. Then, if you can, show a thumbs-up for one second. PASS =
    Signed "yes". Report what the "Seeing:" line says throughout.
11. "Change what the shapes mean": set thumbs up to "hold me the earliest appointment", press Done.
    PASS = the legend shows it and localStorage cedarfield.signs carries it. Reset. PASS = defaults
    back, key removed.
12. With a profile on file: press "Let my assistant book for me". PASS = the tool list gains
    clinic_book_slot. Call clinic_book_slot with slot_id "no-such-slot". PASS = unknown_slot and the
    grant still stands. Press "Take that back". PASS = the tool is gone within a second.
13. Hold a slot with clinic_hold_slot, then press the confirm control on the page yourself (one
    trusted press). PASS = the row reads "Booked — yours", the card names the patient and a reference,
    and the strip announced the hold when it landed.
14. Availability consistency: compare the open slots the page shows with clinic_list_drops.open_count
    at the same moment, twice. PASS = equal both times (a wave rollover between reads is not a fail —
    say if one happened).

Then: list anything you saw that is not covered above, ranked P1/P2/P3, with the exact text. Say
"no P1, no P2" explicitly if that is the case.
```
