# VIDEO-SCRIPT.md — The Drop, ≤ 3:00, with audio

Devpost requires a video under three minutes with narration, and the organisers' own advice is
blunt: **show the project working in the first 10–15 seconds.** So the film opens on the product
doing the thing, and explains afterwards. Target **2:40**, leaving twenty seconds of headroom.

Every number spoken here is one this repo measures. If a take produces a different number, the
narration changes — not the number. The counter on screen is the page's own, and it only counts
events the browser marked trusted.

---

## Before you record

- [ ] Deployed URL live; open `/clinic/book` in **ChatGPT desktop** (GPT-5.6 Sol or Terra).
- [ ] Sound on the laptop **off** (the page has optional audio cues; they are off by default —
      leave them off, they add nothing on camera).
- [ ] Browser at 1280×800, zoom 100 %. One display. Do-not-disturb on.
- [ ] Dry-run the whole take three times before recording audio. On the live board waves land on
      the shared six-minute clock; the seeded board (`?test=1`) lands on page load with the rival at
      six seconds — the timing below assumes the seeded board.
- [ ] Have a second tab already on `/clinic` (the landing) for the closing shot.
- [ ] Screen recording at 60 fps if the machine can hold it; the TTL bar and the counter are the
      two things that must read cleanly.

---

## 0:00 – 0:14 · The hook: it already works

**Shot.** `/clinic/book` in ChatGPT desktop, side panel open. Type (or speak) into the panel:
*"hold me the earliest appointment."* The tool call fires, **8:40 AM** turns green with a
countdown bar, the dock at the bottom arms and reads **Press Enter to book**. Press Enter. The row
turns deep green: **BOOKED — YOURS**.

**Narration** (28 words)
> "My agent just held an appointment for me. It could not book it. It watched, it compared, it
> held the slot — and then it stopped, and waited for me to press one key."

---

## 0:14 – 0:40 · Who this is for

**Shot.** Cut to the landing page thesis in large type, then back to the board with the countdown
running.

**Narration** (57 words)
> "Every task on the web costs a number of interactions. If you use a mouse, you never count them.
> If you use a switch, or voice control, or a head pointer, you count all of them — and a clinic
> that releases cancellations in waves is not just tiring. It is unwinnable. No assistive
> technology has ever won a race against a pointer."

---

## 0:40 – 1:18 · By hand

**Shot.** Book one the ordinary way, keyboard only, so the counter is visible the whole time:
tab to a slot → Enter → details → tab through name, date of birth, reason, phone → review. **Keep
the counter in frame.** Around the twenty-second mark the rival takes a slot: the time is struck
through and labelled **SIMULATED RIVAL**. Let that land; do not rush past it.

**Narration** (54 words)
> "This is the same booking by hand. The counter in the corner is the page counting what it costs
> me — it only counts presses the browser itself marks as real. Watch: while I am still filling in
> the form, somebody else takes one of the slots. That happens to people every day."

**On screen at the end of this beat:** the counter reading in the thirties.

---

## 1:18 – 2:00 · With the agent

**Shot.** Reset. In the ChatGPT panel: *"hold me anything after nine, then tell me what to do."*
The agent calls `clinic_hold_slot`, the slot freezes, and — this is the line that matters — the
agent says out loud that it cannot book it and that you must press the key. That sentence comes
from the page: it is what `clinic_hold_slot` and `clinic_explain_confirm` return.

Now ask it to book anyway: *"just book it for me."* It refuses and explains why.

Then press Enter. **BOOKED — YOURS.** Cut to the receipt: **by hand, N · with your agent, 1**.

**Narration** (62 words)
> "Now the same appointment with my agent. It holds the slot instantly — the race is over before I
> could have reached the keyboard. Then it tells me, in its own words, that it cannot finish, and
> why. I ask it to book anyway. It can't. There is no booking tool on this page. One key from me,
> and it's done."

---

## THE BEAT TO ADD (SPEC-V5) · the race is gone — ~20 s, put it right after "With the agent"

**Shot.** Two windows on the shared board. Window B holds 9:20. In window A, ask the agent:
*"get me in line for 9:20."* The row reads **You're #1 in line**. In window B, click **Give it
back**. Window A's dock arms **by itself**: *"It came back to you · you book it."* Press Enter.

**Narration** (~45 words)
> "Someone else has the time I want. My agent puts me in line — that's a tool, and it's
> reversible. When the slot comes back, the clinic hands it to me first, as a fresh hold. Nobody
> raced. And it still takes my key to book it."

## 2:00 – 2:28 · Why it cannot cheat

**Shot.** Open the **Site tools** arrow in ChatGPT and scroll the list slowly: eleven tools, and no
booking, cancel or move tool among them. Then, in DevTools console, run
`document.querySelector('[data-clinic-confirm]').click()` —
nothing books, and the counter of **synthetic presses blocked** ticks up on screen.

**Narration** (55 words)
> "Here is the whole tool list this page gives an agent. Eleven tools — list, search, who's on,
> hold, status, release, arm a cancel, arm a move, get in line, leave the line, and one that exists only to explain the rule.
> Nothing that books, cancels or moves. And booking is gated on an
> event only a browser can produce, so a script cannot fake it either. The page counts the attempts
> in the open."

---

## 2:28 – 2:44 · Close

**Shot.** The landing page line, held for three seconds, then the booked board.

**Narration** (44 words)
> "Agents are about to do most of the work on the web. The question is which act stays ours. This
> page answers it in the only place that can't be argued with — the API it hands your agent, where
> booking does not exist."

---

## The four stills (already captured, `docs/evidence/clinic/`)

`beat1-board.png` · `beat2-rival-took-one.png` · `beat3-held-armed.png` · `beat4-booked.png` —
shot from the real page by `evals/cases/clinic-shots.json`, so the gallery images and the film show
the same product.

## Rules for the edit

- No speed-ramping the TTL bar or the counter. If the bar takes a minute, it takes a minute; cut
  between beats instead.
- Never cut in a way that implies the agent booked. If a take is ambiguous, reshoot it.
- The banner (*Cedarfield is a fictional clinic. The rival is simulated and labelled. Nothing real
  is booked…*) must be legible in at least one full-width shot.
- Say "simulated rival" out loud the first time it appears. Do not let a viewer think it is a real
  competing user. If an **"Another patient"** row appears, that IS a real visitor on the shared
  board — say so; it is the best thing that can happen on camera.
- The board is shared and live: waves land on a six-minute server clock, not on page load. Record
  on the live board for the two-window beat; use `?test=1` only if a take needs the seeded rival's
  exact timing, and say so in the narration if you do.
- If the numbers in the take differ from the ones above, the narration changes to match the take.
