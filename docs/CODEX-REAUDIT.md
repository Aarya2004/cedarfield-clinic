# Codex re-audit prompt (paste into a Codex task with the booking page open in its browser pane)

Production build at the time of writing: `891c755` (main, deployed and verified twice, 2026-09-03 ~02:30).​

```text
Re-audit https://rokan-terminal.vercel.app/clinic/book on production build 891c755. For EACH numbered
item below, report PASS or FAIL with the exact text or value you observed. Do not summarise; do not
skip items you cannot run — mark them BLOCKED with the reason. Use the WebMCP tools directly where
an item names one. Use only synthetic data. Do not book an appointment unless an item says so.

Prior findings, to re-verify on this build:
1. Fresh page → fetch tools → immediately call clinic_list_drops. Repeat 3 times on 3 fresh loads.
   PASS = no "stale" error on any first call.
2. Tool list on the live board: 14 tools including clinic_wait_for_request, clinic_ask and clinic_set_sign, on three fresh loads,
   (new since the last pass: a scanning keyboard under each patient-card field, and "answer aloud" on every dock —
   a spoken "yes" or the word shown on screen books, with "Listen for me" on; the grant card takes the word only),
   fetching about one second after the page shows the slot list (the page registers each set in
   parallel; Chrome fires toolchange as sets land — a fetch inside the first frames may catch a set
   mid-registration and must be re-fetched on toolchange). PASS = 14 on all three.
3. clinic_explain_confirm: one protocol sentence — "No booking tool by default … a trusted, visible
   permission creates a one-use, ten-minute clinic_book_slot; cancel and move are never delegated".
   PASS = the answer contains that protocol and tool_that_books is null.
4. Profile: "Who is this appointment for?" — leave the date empty, press Save. PASS = an alert
   naming the count, a field-level error under the date, aria-invalid=true on the date field, focus on
   it. Then type 12/04/1990 (day first), a name, a phone, Save. PASS = "Booking as … · Apr 12, 1990 …
   · Saved." and localStorage cedarfield.patient.dateOfBirth === "1990-04-12".
5. "Not you? Remove", then press "Let my assistant book for me". PASS = a strip at the top says EITHER
   to add the patient's name, date of birth and phone, OR that the press did not come from you (the
   browser marked it as scripted — automation presses are not trusted input; that is the guard
   working). Report which. No permission is created either way.
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
12. With a profile on file: press "Let my assistant book for me". If the strip says the press did not
    come from you, report PASS-GUARD and skip the rest of this item (your driver's presses are not
    trusted; only a person's are). Otherwise: PASS = the tool list gains clinic_book_slot; call it
    with slot_id "no-such-slot" → unknown_slot and the grant still stands; "Take that back" → the
    tool is gone within a second.
13. Hold a slot with clinic_hold_slot, then press the confirm control on the page yourself. PASS = the
    strip announced the hold when it landed, AND either the row reads "Booked — yours" with a card
    naming the patient (a trusted press) OR the bar says "That did not confirm. Press Enter, or select
    the confirm button" (your driver's press was not trusted — PASS-GUARD). Release the hold after.
14. Availability consistency: compare the open slots the page shows with clinic_list_drops.open_count
    at the same moment, twice. PASS = equal both times (a wave rollover between reads is not a fail —
    say if one happened).

New on this build:
15. Patient card, "Not you? Remove", then "Type the patient's full name with two switches". PASS = a
    scanning keyboard opens under the card: six rows (a–g, h–n, o–u, v–z + space + delete, 0–6,
    7–9 / - + done), the first row highlighted, sweeping about once a second; the on-screen Select
    picks the row, Select again types the highlighted key into the name field; Escape steps back
    out of a row; "Close keyboard" keeps what was typed. Report the screen-reader status line text.
16. While that keyboard is open, "Talk to Cedarfield" and the request queue are untouched: type a
    request into "Say it to the page" → it still queues (PASS), and the keyboard's own Space/Enter
    handling does not fire when focus is on a text field or a button (PASS = typing a space into
    the request line inserts a space).
17. Hold a slot with clinic_hold_slot. PASS = the confirm bar shows "Or … answer aloud … say yes or
    the word on screen <WORD>" where <WORD> is 5–7 lowercase letters in a box, aria-hidden; the
    "You can also…" line names "say the word shown below"; clinic_hold_status and the assistant's
    record on the page do NOT contain that word. Release the hold: PASS = the word is gone. The grant
    card ("Let my assistant book for me") shows a word but says "the word on screen" only — no
    "yes" (PASS).
18. Enable the camera on the "Say it to the page" panel and show an open palm. PASS = the Seeing:
    line says the palm is not a request here and names the five shapes, and nothing is signed. On a
    hold's confirm bar, the same palm reads "an open palm (NN%) — hold it" (PASS).
19. Fresh load with no profile: PASS = the card asks who the appointment is for; "Ada Okonkwo" never
    appears on the live board without the ?test=1 flag.
20. clinic_ask({question:"Hold 10:30 with Dr Lin?", choices:["Hold it","Show another time"], timeout_seconds:45}):
    PASS = a card "Your assistant asks: …" with two buttons and a Stop appears in the "Say it to the
    page" panel while the call is open; press "Show another time" → the tool returns
    answer:{index:1,label:"Show another time",via:"button"}; the card is gone; the assistant's record
    says "asked you … — you chose …". Then call it with one choice → choices_required. Then call it
    and type "the first one" into the typed line → index 0, via "typed", and NOTHING is queued
    (waiting count stays 0).
21. The permission card under "Your assistant": PASS = at load it reads Can / Cannot / Booking with
    "no tool can book until…"; after a trusted press on "Let my assistant book for me" (or PASS-GUARD
    if your press is scripted) it reads "Until <time> — one booking, for <patient>, when you say yes"
    and the tool count is one higher; "Take that back" returns it.
22. The assistant's pointer: after any successful tool call (say clinic_hold_slot), PASS = a small dark
    pill reading "your assistant · held …" appears ON the held row itself and fades after ~5 s; after
    clinic_ask it sits on the "Say it to the page" panel.

Then: list anything you saw that is not covered above, ranked P1/P2/P3, with the exact text. Say
"no P1, no P2" explicitly if that is the case.
```
