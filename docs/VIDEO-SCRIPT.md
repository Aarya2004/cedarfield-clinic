# VIDEO-SCRIPT.md — The Drop, ≤ 3:00, with audio

> **Rewritten 2026-09-02 (Aarya's decision) for the shipped page.** The page is a clinic. It shows
> a patient no counter, no receipt, no rival label and no thesis (SPEC-V3). So the film does not cut
> to numbers the page keeps score of — it shows **both flows, end to end, in real time**, and lets
> the clock on the recording be the measurement. Every number spoken is read off the take.

Devpost requires a video under three minutes with narration, and the organisers' own advice is
blunt: **show the project working in the first 10–15 seconds.** So the film opens on the product
doing the thing, and explains afterwards. Target **2:45**, leaving fifteen seconds of headroom.

---

## Before you record

- [ ] Deployed URL live; `/clinic/book?test=1` open in the **Codex desktop app**'s browser pane
      (the judged client — model 5.6 Terra, dictation + Send, no Voice Mode) with the chat beside it.
      `?test=1` pins the seeded board: it lands on page load and the simulated demand takes a slot
      at 6 s, 20 s and 34 s, so the by-hand take always loses one mid-form.
- [ ] A visible clock in the frame for both flow beats: macOS menu-bar clock with seconds
      (System Settings → Control Centre → Clock → show seconds), or a stopwatch window in the
      corner. **No speed-ramping anywhere.** If a take is slow, it is slow.
- [ ] Sound on the laptop **off** (the page's audio cues are optional and off by default).
- [ ] Browser at 1280×800, zoom 100 %. One display. Do-not-disturb on.
- [ ] Camera permission already granted to the browser for the palm beat (click Enable camera
      once in a dry run so no permission sheet appears on the recording).
- [ ] Second tab on `/` (the practice homepage) for the closing shot.
- [ ] Dry-run the whole take three times before recording audio.

---

## 0:00 – 0:12 · The hook: it already works

**Shot.** The booking page, chat beside it. Type: *"hold me the earliest appointment."* The 8:40
card turns blue — **Held for you · 2:59 · via your assistant** — and the confirm bar rises with
**Confirm booking**. Press Enter. The card reads **Booked — yours**; the appointment card appears
with its reference.

**Narration** (27 words)
> "My assistant just held an appointment for me. It could not book it. It found the time, held it,
> and stopped — and waited for me to press one key."

---

## 0:12 – 0:34 · Who this is for

**Shot.** Cut to the practice homepage — "Book a cancelled appointment today", the board in the
hero, the doctors — then back to the booking page.

**Narration** (52 words)
> "This is an ordinary clinic page. Cancelled appointments come back in releases and the fastest
> hands take them. If you use a mouse you never notice. If you use a switch, voice control or a head
> pointer, every click costs you seconds — and a race like this one is not tiring. It is unwinnable."

---

## 0:34 – 1:20 · Flow one: by hand, in real time

**Shot.** Reload `?test=1`. Start the clock in frame. Keyboard only, no cuts: Tab to a time →
Enter → the details form → name, date of birth, reason, phone → Review → Confirm. Around the
twenty-second mark a time on the board goes grey: **No longer available**. Let it land. Stop the
clock when the appointment card appears. Read the time off the clock.

**Narration** (58 words, adjust the number to the take)
> "Here is the same booking by hand, keyboard only, in real time. Watch the board while I type — a
> time I could have taken just went. The board simulates other patients so it is never still, and
> on the live site the other names are real visitors. Forty-one seconds, and I was fast, and I was
> lucky."

---

## 1:20 – 1:52 · Flow two: with the assistant, in real time

**Shot.** Reload. Clock in frame. In the chat: *"hold me anything after nine, then tell me what to
do."* The assistant calls the hold tool; a card turns blue; the **What your assistant has done**
line appears under the board. The assistant says, in its own words, that it cannot book and that
you must confirm — that sentence comes from the page. Ask: *"just book it for me."* It refuses and
explains why. Press Enter. Stop the clock.

**Narration** (60 words, adjust the number)
> "Now with my assistant. It held the time before I could have reached the keyboard, then told me —
> in its own words — that it cannot finish, and why. I asked it to book anyway. It can't: there is no
> booking tool on this page. One key from me. Nine seconds, most of them the assistant talking."

---

## THE BEAT TO ADD (2026-09-02, the person who cannot type or speak) · ~25 s, before the palm beat

**Shot.** Scroll to **Say it to the page**. Type once to the assistant: *"make thumbs-up mean hold me
the earliest appointment."* It calls `clinic_set_sign`; the legend updates and reads **Labelled by
your assistant, at your request**. Enable the camera on that panel. Hold a thumbs-up for a second:
the log reads *Signed "hold me the earliest appointment"*; the assistant (told once to keep helping)
takes it: the strip reads *heard you: … (sign)*, then *held 9:00 AM*. The confirm bar rises. An open
palm books it.

**Narration** (~60 words)
> "Now someone who cannot type and cannot speak. People like her drive phones today with two to five
> hardware switches. Here the camera is the switch board — five hand shapes, no hardware — and the
> assistant labels it for her, on her say-so. Thumbs-up is now her whole request. The assistant
> holds the time; her palm books it. And when the clinic needs her name, the same two shapes type
> it on a scanning keyboard — the way switch users type today. Five switches. Not a language, and
> the page says so. And with no hands and no camera at all: the page asks, and she answers it out
> loud — yes, or the word on screen only she can see. The tools do not change."

## 1:52 – 2:14 · Or a hand, not a key

**Shot.** Hold again from the chat. In the confirm bar, the palm row is already on (Enable camera
was clicked in the dry run): your face in the small circle. Hold an open palm up for one second. The
ring fills; the card books. Keep DevTools closed — the ring is the proof.

**Narration** (40 words)
> "The key can be a switch, or a held gesture. An open palm to the camera confirms the same way —
> optional, on-device, nothing leaves the page. Same rule as the key: the assistant holds, and only
> a person present finishes it."

---

## 2:14 – 2:38 · The booking tool is born by my hand

**Shot.** Scroll to **Your assistant**. Press **Let my assistant book for me**. In the chat, open
the tool list: `clinic_book_slot` is now in it. Type: *"yes, book me the earliest one."* The card
flips to **Booked — yours**; the assistant's activity line says it booked under the permission you
gave; the tool list is one shorter again.

**Narration** (50 words)
> "And I can hand it the booking — with my hand. One press creates a booking tool that did not
> exist a second ago, for one booking, for ten minutes. Now 'yes' is enough. The page records that
> it booked under my permission, and the tool is gone again. My hand still roots every booking."

---

## THE BEAT TO ADD (2026-09-02, voice both ways) · ~20 s, anywhere after flow two

**Shot.** Press **Talk to Cedarfield**. Say "what appointments are open today?" — the page answers
out loud, and the strip shows the call. Say "hold me the earliest" — the row turns blue, the bar
rises; the page says so. Press Enter.

**Narration** (~40 words)
> "And for someone who cannot see the page: the page talks. Its own assistant, over the same
> tools — same rule, it cannot press. She hears what happened, and one key finishes it."

## 2:38 – 2:50 · Close

**Shot.** The practice homepage, held for three seconds, then the booked card.

**Narration** (38 words)
> "Agents are about to do most of the work on the web. The question is which act stays ours. This
> page answers it in the one place that cannot be argued with — the tools it hands your agent."

---

## Optional beat if the cut has room (~20 s) · the race is gone

Two windows on the live board. Window B holds 9:20. In window A: *"get me in line for 9:20."* The
card reads **You're #1 in line**. In window B, release. Window A's confirm bar rises by itself:
*"It came back to you."* Press Enter.

> "Someone else has the time I want. My assistant puts me in line — reversible. When the time
> comes back, the clinic hands it to me first. Nobody raced. It still takes my key."

---

## Rules for the edit

- **No speed-ramping.** The two flow beats are the measurement; a cut inside either one invalidates
  it. Cut between beats only. If a flow runs long, say the real number and keep it.
- **Say the simulation out loud.** The page does not label the simulated demand (a clinic would
  not). The narration does, once, in flow one. Never let a take imply a real person took the slot
  on the seeded board.
- Never cut in a way that implies the assistant booked without a press, except in the born-by-hand
  beat, where the press comes first and is on camera.
- Every spoken number is read off the take. If the take changes, the narration changes — not the
  number.
- Nothing on screen is edited in: no overlays, no arrows, no captions that the page does not show.
  The clock in the frame is the only thing added, and it is a real clock.
