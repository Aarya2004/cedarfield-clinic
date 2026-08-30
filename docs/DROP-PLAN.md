# THE TIMED DROP — build plan (pending Arav's lock; v1, 2026-08-30 ~17:00 PT, Engineer #4)

Decision evidence: `docs/research/2026-08-30-timed-drop-verdict.md` (rivals, MediaPipe facts, per-criterion
scores: drop 26/40 vs calendar 19/40) · `docs/research/2026-08-30-build-week-and-precedents.md` (what this
rubric rewards) · `docs/research/2026-08-30-webmcp-removes-the-gesture.md` (the exclusion argument). Format
follows `optimized-mapping-tarjan.md`. **Nothing below builds until Arav says "lock".**

## The product, one sentence (the README's first line, above the fold on the page itself)
> A booking page where the agent can find a slot and hold it for ninety seconds, but cannot take it — the
> only thing that books the slot is one switch press, one key, or one held gesture from the person the
> slot is for.
No speed claim, no winning claim, no autonomy claim. This sentence is also the defence against the
Appointment-Trader read and the "Mabel's Table with a webcam" read.

## Context (why this, in five lines)
Scarce slots that drop and vanish (clinic/DMV/permit/registration) exclude by construction anyone who cannot
race a pointer — no assistive tech fixes a deadline (WCAG 2.5.7/2.5.8 are about gestures; a race is worse).
The 2021 vaccine-slot cohort proved the pain ("can't type fast enough") and only ever *notified*. Bots that
grab slots are the legislated villain (BOTS Act, NY reservation law). The inversion nobody ships: **the agent
may hold, only the human may take** — the hold freezes the race; the confirm is a human act on the page,
not a tool. Sponsor precedent for the surface: Netlify's Mabel's Table (holds, no gate, no contention, no
accessibility); OpenAI's examples are all builder-made task apps shown through the visitor's agent.

## The three design facts that make it ours (from the hostile verdict — these ARE the entry)
1. **`confirm` is not a registered tool.** `hold_slot` is a tool; confirming is a page act (switch/key/held
   gesture). The agent watches the TTL burn and structurally cannot finish. Leverage = the tool list itself
   changes with the state (`toolchange`): while a hold is live, `hold_slot` for that slot vanishes for
   everyone else's agents.
2. **Contention on screen.** Slots visibly vanish when you are slow — a second browser (or the seeded rival
   agent, labelled "simulated rival") takes one mid-demo. Mabel's never shows losing; we show losing, then
   show the held lane where losing stops.
3. **Switch/keyboard is the PRIMARY commit; the camera is a progressive enhancement.** WCAG 2.5.1/2.5.4:
   motion actuation must have an alternative and be disableable; tremor/spasticity fire false positives.
   Held Open_Palm / Thumb_Up (MediaPipe canonical labels) with a visible per-user threshold + dwell bar;
   blink is a trap (5.6–46.5 % FP). If ChatGPT desktop denies `getUserMedia` (likely — Electron default
   denies; `/probe/camera` answers it), the judging-surface flow is one keypress and the camera shot is
   filmed in Chrome. Never gesture-only.

## Honesty rails (organisers' one don't: never overstate)
- "Simulated rival" labelled on screen. Fictional inventory labelled (sponsor norm: Mabel's is fictional).
- The four-part legal/optics sentence in the first ten seconds: *your own agent, your own account, no resale,
  the consequential act is performed by the human.* MediaPipe `.task` models self-hosted (ToS phones home).
- Every ms on screen measured by the code that shows it (hold latency, TTL, time-to-confirm). No fabricated
  counters — the page may count switch presses (it receives them); it never counts words spoken.
- Camera denied ≠ hidden: the page says "camera unavailable here — keyboard/switch mode".

## Map — what we reuse (from `2026-08-30-pivot-reuse-inventory.md`) vs build
```
REUSE VERBATIM: ledger.ts (HMAC chain) · redact.ts · kept.ts · proposals.ts (the approval queue) ·
  types.ts (modelContext detect) · Chip/Provenance/ForgeCard UI atoms · eval harness (webmcp-cdp.mjs) ·
  Worker rails (sid.ts, origin.ts, caps discipline) · deploy rails (wrangler, Vercel)
ADAPT (~1 line each): forge.ts (inject dangerPolicy; steps = booking specs, JSON dialect) ·
  forgedDescription template
BUILD NEW: slot board DO (shared state: slots, drops, holds w/ TTL, bookings; ~200 LOC + tests) ·
  page tools (below) · confirm surface (DOM-native, ARIA live, large target, keyboard/switch; gesture
  module lazy-loaded) · drop scheduler (seeded waves) · rival bot (labelled) · the UI (Aarya)
NOT USED: PTY bridge · terminal · rokan wheels · model proxy (NO model calls anywhere — the visitor's
  agent does the reasoning; our page spends $0 and has no key)
```

## WebMCP tools (all page-scoped, ≤ 8, domain verbs; consequential = none — by design)
- `list_drops()` — upcoming waves, their times, scarcity. readOnly.
- `watch_slots({date?})` — current open slots + the board's live state. readOnly, untrustedContent n/a.
- `hold_slot({slot_id})` — instant TTL hold (90 s) for THIS visitor; returns hold + expiry; fails honestly
  if taken. readOnly:false but non-consequential by construction (auto-releases, books nothing).
- `release_hold({hold_id})`.
- `hold_status()` — ttl remaining, what the human must do to confirm. readOnly.
- `explain_confirm()` — how confirmation works and why the agent cannot do it. readOnly.
- `save_usual({label})` → forge: registers `book_my_usual_<label>` (kept, re-approved on reload) whose run =
  watch → hold my recurring pattern; confirm stays human. The forge engine does this; Understudy ships
  show-once→tool, so the claim is "kept + hash + re-approval + the human gate", not "first".
- NO `confirm_booking` tool. That absence is the pitch.

## Schedule (PT; lock assumed Sun evening; freeze Tue 12:00; submit Wed by 18:00; hard close Thu 13:00)
- **Sun eve:** Arav: `/probe/camera` in ChatGPT desktop (60 s) + ffmpeg fix + name chosen by humans (Devpost:
  don't let AI name it) + repo public/rename timing. Me: DO + tool contract + state machine + tests.
- **Mon AM:** me: tools live on a bare page, eval cases (hold/expire/race/agent-cannot-confirm), rival bot.
  Aarya: UI (board, drop wave, confirm surface, TTL bar), gesture module behind a flag.
- **Mon 22:00 KILL RULE:** core loop (drop → agent holds → human key-confirms → booked; agent blocked from
  confirm; race visibly lost without hold) green on the deployed URL in ChatGPT desktop, or we revert to
  shipping Rokan as-is (main is untouched; zero-items already partly closed).
- **Tue:** video (first 15 s: the race lost, then the held lane), README/description (the honest sentence,
  the four-part legal line, the WCAG citations as *additional operable path*), evals in repo, freeze 12:00,
  office hours 11:00 (Arav asks the getUserMedia + toolchange questions).
- **Wed:** submit by 18:00. Touch nothing after.

## Kill rules
- Camera dead in ChatGPT desktop → keyboard/switch primary everywhere; camera filmed in Chrome, labelled.
- DO/state not green Mon 12:00 → single-browser mode with the labelled simulated rival (no shared board).
- Anything not green Mon 22:00 → revert to Rokan as-is; this branch never merges.

## Branch & lanes
Branch `drop` from `main` (the `workbench` branch keeps its docs; main = shipped Rokan, untouched fallback).
Aarya: `apps/web` UI + gesture module. Me: DO/Worker, tools, state machine, forge/ledger adaptation, evals,
deploy, docs. Contract file: the tool schemas (one `contract:` commit before UI work starts).
