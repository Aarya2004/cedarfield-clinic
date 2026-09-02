# SPEC-V2 — The full conversation (voice-first tool surface + one-press acts)

> **Status: SHIPPED 2026-08-31** (`clinic-voice-tour` / `clinic-cancel` / `clinic-move` green locally and on prod). The driver layer was superseded by SPEC-V3 (the shared live board, `supabase-driver.ts`) on 2026-09-01; the tool surface and the arming pattern here are unchanged. One live-board difference: the DB caps a visitor at three active bookings rather than one.

Arav's direction 2026-08-31: the agent surface is too thin for a real voice conversation. A visitor
should be able to *say* everything — "what doctors are there?", "anything with Dr. Boone after 9?",
"cancel my appointment", "move me to 9:20" — and the agent should prepare ALL of it. What does not
change: **every consequential act costs exactly one human press.** The dock stops being a booking
dock and becomes the page's single consequential-act surface, with a mode.

## 1. The principle, extended

BOOK was never a tool. Neither are CANCEL or MOVE — they are worse to automate than booking (they
destroy something the person fought for). The agent gets *prepare* verbs; the person keeps the
press. The dock states its mode in words: "Press Enter to book 8:40" · "…to cancel 8:40" ·
"…to move 8:40 → 9:20".

## 2. Driver contract (types.ts — human verbs, never registered)

- `cancel(slotId)` — a `booked_yours` slot returns to `open`. Emits `cancelled {slotId}`.
- `move(fromSlotId, toSlotId)` — atomic: `to` (open or held_by_you) becomes `booked_yours`, `from`
  returns to `open`, any hold on `to` clears. Emits `booked {to}` then `cancelled {from}`. A round
  trip between cancel and re-book is a race the visitor loses — one call, like `book()`.
- Invariants (tested): ≤1 booking per visitor · ≤1 hold · cancel/move refused on slots that are not
  yours · the rival/waves never touch `booked_yours` (already true).

## 3. New tools (4 — total 9, all within the 30/500/150/1.5K budgets, asserted)

| Tool | readOnly | Does |
|---|---|---|
| `clinic_find_slots {clinician?, kind?, after?, before?}` | ✅ | Filter the live board (e.g. clinician "Boone", after "9:00 AM"); names the constraint that eliminated everything when empty; includes next-wave seconds |
| `clinic_clinicians {}` | ✅ | Who is on today's board, with their open times and kinds |
| `clinic_prepare_cancel {}` | ❌ | Arms the dock in CANCEL mode for the visitor's booking. Cancels nothing |
| `clinic_prepare_move {new_slot_id}` | ❌ | Holds the new slot AND arms the dock in MOVE mode. Moves nothing |

`clinic_explain_confirm` copy grows to enumerate all three acts. `FORBIDDEN_TOOL_NAMES` grows
(`clinic_cancel_booking`, `clinic_move_booking`, `cancel_booking`, …) and the guard tests grow with
it: tools may *arm*; only a trusted press *acts*.

## 4. Page wiring

- `ClinicToolsOptions` gains callbacks the page injects: `onPrepareCancel(): PrepareResult`,
  `onPrepareMove(newSlotId): PrepareResult` — tools stay pure and fake-testable; the unit fakes
  throw if a tool ever reaches `driver.cancel` / `driver.move` (same class as book/confirm).
- `ClinicBooking` holds `pendingAct: 'book' | 'cancel' | 'move'` (+ target); ConfirmDock renders the
  mode line; the trusted press dispatches the matching HUMAN verb. Esc still does nothing.
- Voice needs no new channel: ChatGPT is the voice. Gesture needs no new gesture: the mode is on
  the dock, the confirm stays one held Open_Palm / one key / one switch.

## 5. Proof (new evals, run against the deployed origin once redeployed)

- `clinic-voice-tour` — the conversation: clinicians → find by clinician+after → hold from the
  filtered result. All info answers non-vacuous (anchored on payload tokens).
- `clinic-cancel` — book (trusted press) → `prepare_cancel` arms → synthetic press BLOCKED → trusted
  press cancels → slot open again, no booking, dock disarmed. And: no cancel tool exists (negative).
- `clinic-move` — book → `prepare_move(new)` holds new + arms → trusted press → old open, new
  booked, exactly one booking ever. And: no move tool exists (negative).

## 6. Honesty rails (unchanged, restated)

Prepare-verbs never mutate bookings. Every refusal carries a reason an agent can read aloud. The
receipt's counters keep counting only trusted events. Budgets stay asserted. The README/SUBMISSION
tool tables update in the same commit that lands the tools — the docs never lead the code.
