# The video — one loop, three minutes (2026-09-03, final)

Rules: under 3:00. Real screen, real hand, real voice, real Codex — nothing staged, every number on
screen is the page's own. Captions on (a Deaf judge reads it). No tool inventory. One person, one
agent, one public page. Record each shot separately, then cut. Rehearse every shot once before the
take; if a shot fails twice, record the fallback named beside it.

Build: `057b8de` (or newer, verified). Browser: Chrome, the live board, sound on. Agent: Codex
desktop with the page in its pane for shots 3–7 (or Chrome 152 with the WebMCP flag if the Codex
pane will not run the camera — say which in the Devpost text).

## Shot list

**0:00–0:15 — the person, not the clinic.** Black screen, one line of text, then the page.
> "A visitor arrives at a public website with their own agent, and their own way of communicating.
> Typed, spoken, a hand shape. The page tells that agent exactly what it may do — and never lets it
> commit."

**0:15–0:35 — arrival.** Fresh load of `/clinic/book`. Cursor rests on the permission card:
Can / Cannot / "no tool can book until…". Then the Tools pane: fourteen tools, none of them a
booking tool.
> "Fourteen tools when the page loads. Search, hold, release, wait for the person, ask them one
> question. Not one of them can book."

**0:35–1:00 — the agent works, the person only speaks.** "Listen for me" on. Say to the page:
"hold me the earliest appointment." Codex, looping on the wait tool, picks it up, calls the tools,
holds a slot. The strip announces the hold; the row turns "held via your assistant"; the record
lists the calls.
> "The person says it once. The agent takes it from the page, searches, and holds the time. Every
> call is written on the page, in words the person can check."
*Fallback: type the sentence into the typed line instead of speaking it.*

**1:00–1:25 — the agent asks, through the page.** Codex calls the ask tool: "Hold 10:30 with
Dr Lin, or show another time?" The card appears in the panel. Answer with a thumbs-up to the
camera (the first choice). The card resolves, the tool returns the answer.
> "When the agent needs a decision, it asks through the page. She answers with a hand shape. The
> page hands the agent her choice — never her authority."
*Fallback: press the card's button on screen.*

**1:25–1:50 — the boundary.** Codex tries to confirm on its own: the bar says "That did not
confirm. Press Enter, or select the confirm button." Then show the grant card's word, or press
"Let my assistant book for me" yourself. The permission card flips to "Until … one booking, for
[name]"; the Tools pane gains `clinic_book_slot`.
> "The agent cannot press. A scripted press is counted and refused. Only the person can grant —
> a press, a palm, or a word only they can see — and then, for ten minutes, a booking tool exists
> that did not exist before."

**1:50–2:15 — the human commits.** Say "yes" to the bar with Listen on, or hold the palm to the
bar's camera. The booking lands: card with the reference, "For [name]", Add to calendar, and
the cost line: "1 interaction from you once your assistant had held it."
> "One word. One palm. That is the whole cost to the person — measured by the page, not claimed."
*Fallback: press Enter on the confirm control.*

**2:15–2:40 — take it back.** Press "Take that back" on a fresh grant, or let it lapse: the tool
vanishes from the Tools pane; the card returns to standard. One cut of the scanning keyboard typing
a letter with two shapes.
> "Revoke it, and the tool is gone. And when the clinic needs her name, two hand shapes type it —
> the way switch users type today. Not sign language, and the page says so."

**2:40–3:00 — why WebMCP.** The Tools pane and the permission card side by side.
> "Without WebMCP the agent scrapes, guesses and clicks. With it, the page declares what an agent
> may do for this person, right now — and consent is a tool that is born and dies. Your words. Your
> agent. Your final say."

## What is NOT in the video, on purpose
Talk to Cedarfield (the page's own voice agent) — one line in the Devpost text, not a shot.
The switch-board labelling tool, the waitlist, cancel and move — README only. Any claim of ASL.

## Before recording — the rehearsal checklist (say "green" for each)
1. Fresh load shows the permission card and 14 tools within a second.
2. "Listen for me" says Listening; a spoken sentence appears as Heard "…".
3. Codex loop: wait → hold → record, with the strip announcing.
4. Ask tool → card → thumbs-up resolves it (Seeing: line says "thumbs up (NN%) — hold it steady").
5. Scripted confirm refused with the exact sentence.
6. Grant by press → card flips → tool appears.
7. "yes" with Listen on books; or the palm on the bar books.
8. "Take that back" → tool gone.
9. Scanning keyboard: thumbs-up selects a row, then a letter.
10. Screen recorder at 1080p, system audio on, mic on; captions generated after.
