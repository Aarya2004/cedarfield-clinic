# SPEC-V10 — Hands-free: the page under macOS Voice Control

Aarya, 2026-09-02: "spec out voice control." Context that fixes the shape of this spec:

- The judged client is the **Codex desktop app**: an in-app browser pane beside a composer that
  offers **dictation + Send only — no Voice Mode** (`docs/evidence/clinic/2026-09-02-chatgpt-desktop-transcript.md`).
- **The page never listens.** Voice does not confirm anything in-page (PLAN; SECURITY §10): the
  assistant has a voice, a speaker in the room has a voice, and an injected "yes" is byte-identical
  to a real one. No Web Speech API, no wake word, no in-page microphone. Ever.
- So the hands-free path is the **operating system's**: macOS **Voice Control** drives the browser
  the way a switch or a head pointer does — its clicks and key presses arrive as OS input events,
  which the browser marks `isTrusted`. That is the same trust root every assistive technology has,
  and the one the confirm gate was built for. This spec makes the page a first-class target for it.

## 1. What must be true (acceptance)

1. **Every interactive control has a unique, speakable accessible name** on `/`, `/clinic`, and
   `/clinic/book` in every state (board · form · held · booked · cancel armed · move armed · grant
   standing). "Click ‹name›" in Voice Control hits exactly one thing without falling back to
   "Show numbers". Names ≤ 6 words, plain English, no symbols, no times spelled as `8:40` only —
   the visible time is fine because Voice Control reads the accessible name, and "eight forty" is
   how a person says it.
2. **Label in Name (WCAG 2.5.3).** Wherever a control has visible text, that text is the start of its
   accessible name. A Voice Control user says what they see.
3. **The confirm control names the act and the time.** Visible: *Confirm booking*. Accessible name:
   *Confirm booking 9:20 AM* (cancel: *Cancel appointment 9:00 AM*; move: *Move to 9:20 AM*). One
   phrase, unambiguous, and it doubles as the compact summary a person hears back. (This is the one
   change from GPT's review that survives contact with the code — the rest was already true.)
4. **"Press Return key" books after an assistant hold**, with no click first. Already true (the
   book dock takes focus on arm, P1-1); this spec adds the test and the sentence in the docs. The
   cancel and move docks deliberately do **not** take focus — a Voice Control user says
   "Click Cancel appointment 9:00 AM" and then "Press Return key", two utterances, on purpose.
5. **The 500 ms arming dead zone stands** for Voice Control presses too. A spoken command takes
   longer than that to recognise, so it costs a person nothing; it still blocks an agent-timed press.
6. **The form is dictatable.** "Click Full name" → dictate → "Click Date of birth" → dictate digits →
   … → "Click Review" → "Click Book". Field labels are the speakable names (they already are visible
   `<label>`s). Known soft spot: Chrome's native date input under dictation — the manual test
   decides whether we keep `type=date` or accept a text field with a format hint (the harness has the
   same trouble: `clinic-manual-tax` cannot finish the date either).
7. **Nothing about announcements changes.** The hold announces on arrival and at 30 s and 10 s; the
   activity log is a polite live region. A Voice Control user may not run a screen reader; the
   visible countdown remains the primary signal.
8. **The grant control is speakable and unique**: "Click Let my assistant book for me." The palm
   module's buttons too: "Click Enable camera", "Click Camera off".

## 2. What the page does NOT do

- No in-page speech recognition, no "say *book* to book", no microphone permission prompt. The
  keyboard, switch, Voice Control and the opt-in palm are the four confirm paths; three of them are
  the OS's business and one is ours.
- No Voice Control–specific UI (no custom command hints on screen). A clinic page does not teach
  people their own assistive technology.
- Windows Voice Access and Dragon are out of scope for the deadline; §1.1–1.3 help them anyway,
  because all three drive by accessible name.

## 3. Code changes (small; `apps/web`, Aarya's lane)

| Where | Change |
|---|---|
| `ConfirmDock.tsx` | `aria-label` on the confirm button: `${copy.key} ${slotLabelTime}` per act (§1.3). Add `aria-keyshortcuts="Enter Space"`. Visible text unchanged. |
| `SlotSheet.tsx` | Already right: each row's Book control carries the hidden label *Book 9:20 AM with Dr. Boone, Consult.* — keep; verify it is the **accessible name** (not only description) so "Click Book nine twenty" resolves. |
| `AppointmentCard.tsx` | *Add to calendar*, *Move appointment*, *Cancel appointment* are unique already; when two bookings exist, suffix the time so names stay unique (*Cancel appointment 9:00 AM*). |
| `ClinicBooking.tsx` (grant band) | No change expected; audit confirms the name. |
| Docs | SECURITY §10: one paragraph — OS-level AT events are trusted by design; a voice in the room is the OS's boundary, not the page's; the page's mitigations (dead zone, no destructive focus-steal, one hold per visitor) apply unchanged. README "Access" bullet gains the Voice Control sentence. |

## 4. The audit that gates it (evals; Arav's lane — hooks below are what it reads)

New case `evals/cases/clinic-voice-names.json`, driven on `?test=1` through the existing harness:

1. In each state (board → form → held-by-assistant → booked → cancel armed → move armed → grant
   standing) collect the accessible name of every `button`, `a[href]`, `input`, `select`,
   `textarea` (`aria-label` ?? `aria-labelledby` text ?? visible text ?? associated `<label>`).
2. Assert: no empty name; **no duplicate names** within a state; every name ≤ 6 words; where a
   control has visible text, the name starts with it (2.5.3).
3. Assert the confirm control's name matches `/^Confirm booking \d{1,2}:\d{2} (AM|PM)$/` while held,
   and the act variants while a cancel/move is armed.
4. Focus assertion: after an assistant hold arms the book dock, `document.activeElement` is the
   confirm control (this is what makes "Press Return key" work).

`node evals/a11y.mjs` stays 0 violations on all three routes.

## 5. Manual test — the recording Mac, ~6 minutes

Set-up once: System Settings → Accessibility → Voice Control → on; language English; enable
"Play sound when command recognised". Keep "Show numbers" for fallback. Codex desktop open with the
page in the browser pane and the composer beside it.

| Say | Expect |
|---|---|
| "Click Book an appointment" | `/clinic/book` opens |
| "Show numbers" · "Click ‹n›" on a row | Details form opens (fallback path proves the overlay works) |
| "Click Full name" → dictate → "Click Date of birth" → dictate → "Click Reason" → dictate → "Click Phone" → dictate → "Click Review" → "Click Book" | Booked by hand, hands never touched. Note whether the date field took dictation. |
| In the composer: dictate *"hold me anything after nine"* → "Press Return key" | The assistant holds; a card turns blue; the confirm bar rises **and has focus** |
| "Press Return key" | Booked. (If focus was in the composer, say "Click Confirm booking nine twenty" first — record which happened.) |
| "Click Cancel appointment nine twenty" → "Press Return key" | Cancel dock arms **without** taking focus; the second utterance is needed; the appointment is cancelled |
| Dictate *"yes, book it"* after "Click Let my assistant book for me" | The born tool books; the card appears; no press needed after the grant |

Write the answers into this file under **§7 Result**, including which utterance switched focus
between the composer and the pane (that phrase goes in the video notes).

## 6. Video

Optional 15-second beat after the palm: the same hold-and-confirm with the hands visibly off the
keyboard, Voice Control's command feedback on screen. Narration: *"Or no hands at all: the system's
own voice control presses the key. The page cannot hear me — it does not need to."* Only if the
manual test above passes cleanly on the first take; otherwise it is a sentence in the README, not a
shot.

## 7. Result

_Unfilled. Owner: Aarya (manual test, §5) · Arav (audit, §4)._

---

**Decisions taken in this spec (say so if any is wrong):** the confirm name carries the time
(§1.3); macOS only for the deadline (§2); the page stays deaf (§2); the audit is an eval case in
Arav's lane and the code is in Aarya's (§3–§4); the video beat is conditional (§6).
