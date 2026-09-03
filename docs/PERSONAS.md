# Who this is for — the whole workflow, from their seat (2026-09-02, Arav's ask: "zoom out and map it")

The booking workflow every clinic runs today, and what each person we build for meets at each step.
"Today" is an ordinary clinic site. "Cedarfield" is this page, as deployed. Every claim in the
Cedarfield column is something the evals or tonight's physical tests exercised; nothing here is a plan.

## The workflow of booking a cancelled appointment

| Step | What a clinic requires | Today, by hand | Cedarfield with an assistant |
|---|---|---|---|
| 1. Get there in time | Cancellations go in seconds | Refresh, scan, click first | The assistant watches and holds the instant a time appears (`clinic_hold_slot`, three-minute hold) |
| 2. Choose | Time, clinician, kind | Read the list, compare | "Hold me the earliest" / "anything after nine with Dr. Boone" — the assistant compares (`clinic_find_slots`, `clinic_clinicians`) |
| 3. Say who it is for | Name, date of birth, phone, reason | A form, every time | **Patient on file**, entered once per browser, reused by every path; the assistant is told whether it exists and the page refuses to book without it |
| 4. Confirm | An act the clinic can trust | Click Confirm | **One press** (Enter, a switch, "press Return" by voice control) or **one open palm** — or, once granted by that same press, the assistant books on "yes" (SPEC-V9) |
| 5. Know it happened | A confirmation | A page that changes | The **strip at the top** says what the assistant did the moment it did it; the page **scrolls and pulses** the row or card; the **record** under the times keeps every call; with sound on, the page **says it aloud**; the card names the patient and carries a reference and a calendar file |
| 6. Change it later | Cancel or move | Phone, or the same form again | "Cancel my appointment" / "move it to 9:20" — the assistant **arms** the act; the same one press or palm performs it (never the assistant) |

## The people, and what each one meets

| Person | Their channel to the assistant | Their act on the page | What tells them it worked | Not built (said plainly) |
|---|---|---|---|---|
| **Cannot use hands / limited motor** (switch, head pointer, voice control) | **"Say it to the page"** — press Listen for me once, speak; the agent takes each sentence through `clinic_wait_for_request`. Or **"Talk to Cedarfield"** — the page's own voice agent answers aloud. Or macOS Voice Control into the assistant's composer ("press Return" sends) | "press Return" / "Click Confirm booking" through Voice Control (OS-level, browser-trusted); every control has a unique speakable name (SPEC-V10); or the palm; or the one grant, then "yes" | Strip, pulse, spoken line with sound on, the agent's own voice, screen-reader status lines | The page never treats what it hears as a confirm — by design: an assistant has a voice too |
| **Cannot see / low vision** (screen reader) | Types or dictates to the assistant | Enter on the focused confirm bar (it takes focus when a hold lands) | `role=status` announcements: arrival, 30 s / 10 s marks, the strip, the record (`role=log`); spoken line with sound on | — |
| **Cannot hear** | Types to the assistant | Enter, or the palm | Everything is text-first: strip, row state, card, record; no step depends on sound | — |
| **Cannot speak** | Types to the page ("Say it to the page"), or **five hand shapes** — and the person decides what each means: the defaults are *yes / no / stop / the first one / another one*; the legend lets them assign whole requests (thumbs up = "hold me the earliest appointment", two fingers = "cancel my appointment"), kept in their browser. `clinic_wait_for_request` hands the agent the phrase | Enter, or the palm | The panel shows "Signed “…”" and the strip shows "heard you: “…” (sign)" when the agent takes it | **Sign language is not in this product.** Five canned shapes are five labelled keys, not a language; the panel says so. |
| **Tremor / imprecise movement** | Any of the above | The palm with a dwell (hold ~1 s, grace for flicker), or a switch | The camera window shows the hand and prints "Seeing: an open palm" so they know the page sees them | — |
| **A mouse user** | The same page, by hand | Click Book, fill the form once, Confirm | The same card and record | — |

## Why the assistant lives in the client and not in the page

WebMCP's whole idea: the clinic ships one web page, and every assistant that can open a page gets
the tools. The page does not run a model, does not hold a key, does not hear or watch anything but
the one act. That is what makes it deployable by a clinic tomorrow, and it is why "talk to the page"
is the wrong mental model: you talk to your assistant, in its own window, and the page shows you
what it did.

## What tonight's physical tests found and fixed

- The page never announced the assistant's acts where a person is looking → the strip, the scroll, the pulse.
- The camera reading went stale with no hand in view → live "Seeing:" line, `no hand` included.
- Chrome stops the camera loop for a hidden tab → "Paused: bring this window to the front".
- The assistant paths booked for nobody → patient on file.
- A first visitor had no idea what to say → the guide with three sentences.
