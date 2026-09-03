# Codex re-audit on production `1576c91` — pass 1 of 2 (2026-09-02 ~18:30 PT)

Codex desktop app, in-app browser pane, the 14-item prompt in `docs/CODEX-REAUDIT.md`.

| # | Item | Result | Observed |
|---|---|---|---|
| 1 | Fresh first call ×3 | PASS | `ok:true`, no stale error, open_count 3/3/3 |
| 2 | 12 tools on 3 fresh loads | PASS | all twelve callable incl. `clinic_wait_for_request` and both queue verbs |
| 3 | Protocol sentence | PASS | `tool_that_books:null`; "No booking tool by default … one-use, ten-minute clinic_book_slot. Cancel and move are never delegated." |
| 4 | Profile validation + saved | BLOCKED (storage not inspectable in that browser); every visible half PASS | alert "One field needs attention", field error, aria-invalid true, focus on the date, "Booking as … Apr 12, 1990 … Saved." |
| 5 | Grant with no profile | PASS | "That press did not come from you — the browser marked it as scripted. Press the button yourself to grant." |
| 6 | Typed handoff, voice not disabled | PASS | Typed "…", "One request waiting", "Voice is ready…" |
| 7 | Wait tool, count exact | PASS | via typed, seconds_ago 6.7, loop instruction; strip immediate |
| 8 | Speech fallback line | PASS | "This browser has no speech recognition. Type below, or use the camera signs." |
| 9 | Voice agent live 10 s, exclusion, teardown | BLOCKED (no recognizer in that browser); every visible half PASS | "Voice is ready…" → "Listening…" → recognizer "Paused while you are talking to Cedarfield…" → "The voice session ended." |
| 10 | Covered camera 15 s | BLOCKED (no hand available); visible half PASS | "Seeing: no hand yet", no Signed line |
| 11 | Custom sign phrase + reset | BLOCKED (storage); visible half PASS | legend "hold me the earliest appointment" → "yes" |
| 12 | Grant with profile | PASS-GUARD | scripted press announced; `clinic_book_slot` not registered |
| 13 | Hold then press | PASS-GUARD | held 9:00 AM Dr. Duarte; strip announced; "That did not confirm. Press Enter…"; released; "9:00 AM open again" |
| 14 | Availability consistency ×2 | PASS | 3 = 3, 3 = 3, no rollover |

Additional findings: **no P1, no P2, no P3.**
The two storage checks Codex could not read are asserted by `clinic-patient.json` and `clinic-signs.json`,
both green on this build in two production rounds.
