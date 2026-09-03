# For Aarya and Aarya's Claude — the final hours (2026-09-03, ~02:10 PT)

Read this first, then `docs/DROP-STATUS.md` (one row per batch, newest at the top), then
`docs/VIDEO-SCRIPT.md` and `docs/DEVPOST.md`. Everything below is true of production build `52767c8`
or newer; the build number is printed in the page's colophon.

## State of the product

- Production is `52767c8`, verified with two deployed-suite rounds (38 checks each), the live board
  with two visitors, the registry probe (14 tools) and the first-call probe on the live board (tools
  present in the first snapshot, no wait). Every build today was verified the same way before the next.
- Three consecutive independent audits (Codex 5.6) on production came back with no P1 and no P2.
  The prompt for a fourth is `docs/CODEX-REAUDIT.md`; run it once on the final build before recording.
- Local gate at every release: 512 unit tests · typecheck · lint · 39 browser cases · axe on all routes.
- Since 891c755: the phrase board (ready sentences, one press each), the camera follows the visit and
  comes back after the bar's palm, the scanning keyboard is a sheet and summons the sign camera, voice
  captions (You / Cedarfield), the assistant's cursor travels and clicks with the tool's name, motion on
  every state change, "Take it back" on a heard line.
- What is NOT machine-proved and needs a person: a real microphone, a real hand, a trusted press.
  That is the rehearsal checklist below.

## Since your last sync, in `apps/web` (your lane, edited at Arav's direction, all cases green)

`ClinicBooking.tsx` (permission card, spoken-word consent, the assistant's pointer, colophon with
build stamp) · `ListenPanel.tsx` (the agent's question card, routing for the confirm word and the open
question, `?test=1` seam) · `PatientOnFile.tsx` (scanning keyboard, memory-only sample) ·
`AssistantGuide.tsx` (visitor promise first) · `SlotSheet.tsx` (taken rows read "No longer available")
· `ConfirmDock.tsx` (one copy line) · new `ScanKeyboard.tsx`, `SpokenWord.tsx` · `clinic.css`
(appended sections only) · `app/clinic/book/page.tsx` (inline WebMCP bootstrap under the CSP nonce,
build stamp). New tools: `clinic_ask`, `clinic_set_sign`. Counts: seeded 12, granted 13, shared 14.

**Please do not restyle the confirm bar, the permission card, the question card or the colophon before
the video is recorded.** Copy fixes are welcome with a case run (`node evals/run-all.mjs --only=clinic-`).

## Two facts the recording needs (whoever has the machine)

1. Does the camera run inside the Codex app's browser pane? Press Enable camera on the "Say it to the
   page" panel and hold up a hand: does the porthole show it and the Seeing line name a shape?
2. Does the microphone run there? Press Talk to Cedarfield: does it go live?
The Codex pane has no speech service, so "Listen for me" says so there by design; Chrome carries voice.
If the pane runs neither, record shots 3–7 in Chrome with the Chrome 152 agent, or use the bracketed
fallbacks below in the Codex pane.

## Rehearsal checklist — say "green" to each before pressing record

1. Fresh load shows the permission card and 14 tools within a second.
2. In the Codex pane: the camera runs (Enable camera on "Say it to the page", hold up a hand, the Seeing line names it).
3. The agent loop takes the request, holds a time; the strip announces it; the cursor travels to the row, clicks, and labels it.
4. The agent's question card appears; a thumbs-up to the sign camera resolves it (Seeing: "thumbs up (NN%) — hold it steady", then Signed "yes").
5. A scripted confirm is refused with "That did not confirm. Press Enter, or select the confirm button."
6. A real press on "Let my assistant book for me" flips the permission card and adds the booking tool.
7. The palm on the bar's camera books; or, under a grant, "yes" to Codex books through clinic_book_slot.
8. "Take that back" removes the tool and the card returns to standard.
9. Hands only, card empty: one finger opens the keyboard, thumbs-up picks a row, thumbs-up a letter, a fist steps back, done moves to the next field, two fingers saves; after the palm books, the sign camera is back on by itself.
10. Recorder at 1080p, system audio and microphone on; captions generated after.

## THE DEMO IS RECORDED IN THE CODEX APP, IN VOICE MODE (Arav, 2026-09-03 ~04:25 PT)

The visitor speaks to Codex; Codex works the page's tools in its browser pane. The page's own
"Listen for me", the heard lines and their "Take it back" are NOT in the demo. Everything the judge
sees on the page is what Codex's calls do: the cursor travelling and clicking with the tool's name,
the strip, the tool chips, the question card, the permission card, the confirm bar, the receipt.
Consent is the palm to the bar's camera in the pane (test that the camera runs there FIRST), or
Enter/click. Hands-free voice booking is: grant by palm (or one press) → say "yes" to Codex → Codex
calls clinic_book_slot under the grant → the gold chip is spent. That is a legitimate, fully hands-free
path and it is the one to record if the palm-to-bar shot is flaky.

One trap: while clinic_ask is open, Codex is waiting on the PAGE. If you answer by voice to Codex
instead of a thumbs-up or a button on the card, the call times out. So: answer the question card with
a thumbs-up (or its button); or the prompt below tells Codex to use a 20 s timeout and fall back to what
you said by voice.

## The Codex loop prompt (paste into Codex before shot 3, page open in its pane)

```text
You are my agent on https://rokan-terminal.vercel.app/clinic/book, open in your browser pane. I talk
to you by voice. Use the page's WebMCP tools only; never scrape, click or press anything on the page.
When I ask for an appointment: find times with the tools, then ALWAYS put the two best to me with
clinic_ask (two short choices, timeout_seconds 20) before holding. I answer on the page with a hand
shape or a button; if clinic_ask returns no answer, use what I told you by voice. Hold the time I
pick with clinic_hold_slot. After a hold, say in one sentence that it is held and that the page needs
my palm or my press to book — you cannot. If clinic_book_slot appears, I granted you one booking: use
it only when I say yes, then say what it answered. Never cancel or move anything. Report every tool
result in one plain sentence. Start now.
```

## The video — one loop, under 3:00, captions on

Screen: Chrome (or the Codex window with the page in its pane so the agent's transcript is on the
left and the page on the right), sound on, 1080p. Hands and voice: your own. One take per shot, cut
together. If a shot fails twice, do the [fallback] and move on.

**SHOT 1 — 0:00–0:10 — one line on black, then straight into the app.**
On screen for five seconds, no voice: "Your words. Your agent. Your final say." Then the page, open
inside the agent's app. No introduction — the README and the Devpost text carry the why. A judge
wants to see it work inside ten seconds.
SAY (over the page loading): "A visitor arrives at a public page with their own agent. The page
tells that agent exactly what it may do — and never lets it commit."
SHOW: the page loading; the permission card under "Your assistant": Can / Cannot / "no tool can book until…".

**SHOT 2 — 0:15–0:35 — arrival.**
SAY: "Fourteen tools when the page loads. Search, hold, release, wait for the person, ask them one
question. Not one of them can book."
SHOW: cursor on the permission card, then on the row of tool chips under "Your assistant" ("Tools
your assistant can use right now · 14"). Do not read the tool names.

**SHOT 3 — 0:35–1:00 — the person only speaks (to Codex, voice mode).**
DO: say to Codex: "Find me the earliest appointment." Codex calls the tools; the cursor travels to the
record and the board as it searches.
SAY (voice-over): "The person says it once. Their own agent searches the page's live board through
its tools. Every call is drawn on the page, in words the person can check."
SHOW: Codex's transcript on the left; the cursor with the tool's name; the record under "Your assistant".

**SHOT 4 — 1:00–1:25 — the agent asks, through the page.**
DO: Codex calls clinic_ask with the two best times. The card appears in the panel. Answer with a
thumbs-up to the sign camera (the first choice). Codex holds that time; the cursor travels to the row.
SAY: "When the agent needs a decision, it asks through the page. She answers with a hand shape. The
page hands the agent her choice — never her authority."
SHOW: the card; the Seeing line; Signed "yes"; the card resolving; the row "held via your assistant".
[Fallback: press the card's first button.]

**SHOT 5 — 1:25–1:50 — the boundary.**
DO: ask the agent to confirm the booking itself; the bar answers "That did not confirm. Press Enter,
or select the confirm button." Then press "Let my assistant book for me" yourself.
SAY: "The agent cannot press. A scripted press is counted and refused. Only the person can grant —
a press, a palm, or a word only they can see — and then, for ten minutes, a booking tool exists
that did not exist before."
SHOW: the refusal line; the permission card flipping to "Until … one booking, for [name]"; the
gold chip "book_slot · born from your press" appearing in the tool row. THIS IS THE SHOT: consent as
a tool that is born. Hold on it for two full seconds.

**SHOT 6 — 1:50–2:15 — the human commits.**
DO: with the hold on the bar, hold an open palm to the bar's camera for one second.
[Fallback, fully hands-free: the grant from shot 5 stands — say "yes" to Codex; it calls
clinic_book_slot and the gold chip is spent. Second fallback: press Enter on the confirm control.]
SAY: "One palm. Or one word to her own agent, under a permission she gave. That is the whole cost to
the person — measured by the page, not claimed."
SHOW: the appointment card: For [name] · Reference; Add to calendar; the cost line "1 interaction
from you once your assistant had held it" (or "0 interactions" under the permission).

**SHOT 7 — 2:15–2:40 — take it back, and type with two shapes.**
DO: press "Let my assistant book for me" again, then "Take that back". Then "Not you? Remove", open
"Type the patient's full name" under the patient card (the keyboard slides up), thumbs-up to pick a
row, thumbs-up a letter, fist to step back.
SAY: "Revoke it, and the tool is gone. And when the clinic needs her name, two hand shapes type it —
the way switch users type today. Not sign language, and the page says so."
SHOW: the chip fading with "gone"; the card back to standard; then, hands only: one finger opens the
keyboard, thumbs-up picks a row, thumbs-up a letter, two fingers saves the card.

**SHOT 8 — 2:40–3:00 — why WebMCP.**
SAY: "Without WebMCP the agent scrapes, guesses and clicks. With it, the page declares what an agent
may do for this person, right now — and consent is a tool that is born and dies. Your words. Your
agent. Your final say."
SHOW: the Tools pane and the permission card side by side. End on the colophon with the build number
visible for one second.

**Not in the video:** Talk to Cedarfield, the labelling tool, waitlist, cancel, move, any mention of ASL.

## Devpost

`docs/DEVPOST.md` has every field, ready to paste. The inspiration paragraph mentions a family member
with no detail; delete that sentence if they would rather not be referenced. The public repo,
the video link and the live URL are the last three fields.

## If something is not green

Send the exact line on screen to Arav's Claude. Fixes go to main with a case; production is redeployed
only after the local gate and two production rounds. Do not record on a build that has not been verified.
