# Hostile evaluation — Workbench pivot vs absorbed plan vs ship-as-is (2026-08-30 ~04:00 PT)

Independent Opus 5 evaluator, read-only, instructed to distrust every document and check evidence files, git
history and live endpoints. Commissioned by Arav ("give me the real pessimistic meaning"). Reproduced here
verbatim in substance; the engineer's responses are marked **[E4]**.

## Verification pass — what it checked

Verified true: prod live (1.87 s); probe page live; judge suite 15/15 real; drift evidence reproduced twice;
A/B harness "unusually honest" (self-filed `Math.round` correction); `next_step` probe contract real.

Verified false or unsupported — load-bearing:
1. **No video exists** (two GIFs; ffmpeg broken on the demo Mac). Stage-1 pass/fail.
2. **Repo is private**; `docs/SUBMISSION.md` prints it as the submission link. Stage-1 requires public source.
3. `npm rokan-terminal` → 404; README hedges, SUBMISSION led a bullet with `npx`. **[E4]** README:92 fixed;
   SUBMISSION:25 already conditional.
4. **The 226/233 ms live-invoke numbers were not in the cited evidence files** (each held only the `list`
   line). **[E4]** True — my extraction truncated the record. Standard-3 file now carries the full invoke
   (`elapsed_ms: 226`); the new-image file is marked partial in FIELD-NOTES until the 0.0.3 run replaces it.
5. Honest two-store cost is ~8.5 s wall cold (993 + 2 265 ms tool), not 226 ms. **[E4]** Agreed; 226 ms is
   warm single-site tool time and must be labelled as such wherever it appears.
6. The 15/15 artifact predated the deployed config. **[E4]** Re-run since: 15/15, 0 retries on standard-3 +
   0.1.3 image (`docs/evidence/sandbox/2026-08-30-judge-suite-15-of-15-standard-3.txt`).
7. **Caps still at testing values** (`10/10min, 5 concurrent`, "REVERT to 3/3 before freeze") on standard-3 ×
   20 instances. **[E4]** Freeze item; Worker vars only.
8. Branch `workbench` contains zero canvas code. True.
9. `arm-c.json` proves cross-site native consumption already ships (native warm ×5, 0 calls, 08-29).
10. The 42.4× headline rests on n=3 with a 6.6–55.7 s spread (one 55 s outlier). "Weakest number in the repo."

## Scores (hostile)

| | Leverage | Execution | Impact | Creativity | Mean | Top-10 | #1 |
|---|---|---|---|---|---|---|---|
| **A** full canvas pivot by Mon 22:00 | 4 | 3 | 4 | 3 | **3.5** | ~6 % | ~1 % |
| **B** absorbed plan | 7 (8 w/ ChatGPT run) | 7 | 6 | 6 | **6.5** | ~29 % | ~5 % |
| **C** ship as-is | 7 | 7.5 | 6 | 6 | **6.6** | ~26 % | ~3 % |

Skimming judge, A: *"n8n for WebMCP — cardea did this four days ago with 818 tests."* B/C: *"A terminal you
share with your agent, where anything you approve becomes a live WebMCP tool — deep API use, honest numbers,
developer-shaped."*

Judge one-liners for A: Rushing "this executes in your daemon, not my browser"; Drasner "you quoted 'tools, not
DOM' and shipped a CDP browser-driver with a diagram on top"; Grigorik "a product-comparison widget on my ten
tools" (his written no-column verbatim); Nahas "cross-origin aggregation is a known vulnerability class on my
own wiki"; Galloni "standard-3 × 20 with testing caps is a bill"; Gao "where are the evals for the canvas? I
deleted my own storefront tools"; Roberts "browser-driving is the wrong way; nice UI for it."

## "Is the Workbench the same thing minus the compile engine?"

**As a capability: yes, almost exactly — and that is the fatal part.** `arm-c.json` (08-29, before the idea):
the product already consumes another site's declared tools natively at 0 calls, Enter-gated, in the ledger.
The Workbench adds a diagram of it and removes the compile fallback.

Where Arav is right: (1) he picked executor (a) and the first self-eval argued against (c) — a position he
never held; (2) the best asset (cross-site native) was buried in FIELD-NOTES and paragraph four of the README;
(3) "reliability layer, not capability layer" is better copy than anything written; (4) judges may never open
the app and a terminal screenshots badly — the hero first paint is a storyboard and an empty shell.

Where he is wrong: (1) the subtraction (compile = "any website", the best stranger artifact) is bigger than the
addition (a canvas with zero code vs cardea's five-day head start); (2) the canvas is the worst-scoring shape
on the criterion that asks "does it differ from existing concepts?" — seven canvas entries, zero terminals;
(3) commerce cosplay by architecture, judged by the two people who own/deleted those tools; (4) "measured in
the hosted sandbox" was one-third supported at the time; (5) demoting the terminal deletes the only empty column.

## What it would ship: **B−**

Cut D3 (step-strip view: zero code, 14–16 h, +0.3, risks the one page judges touch). Freeze the sandbox
config and re-run 15/15 on it **[E4: done]**; set caps to the judging row. Keep D2 (one composed cross-site
forged tool, measured; fallback = `rokan do` phrasing). Then, in order — the items presently at zero and
collectively worth ~3 points:
1. **Make the video tonight; fix ffmpeg first.**
2. **Make the repo public; fix the submission link; rename it** (a repo called `webmcp-private` is a bad first frame).
3. **The ChatGPT desktop run** — one hour of Arav's keyboard; caps Rushing on all four criteria.
4. **Re-lead the pitch on drift, not speed** — drop 42.4× from the headline; "a tool that lies quietly is worse
   than no tool; ours refuses out loud" turns "reliability layer" from a claim into a demonstration.
5. Fix the cited-but-absent records **[E4: done]** and delete "works in ChatGPT desktop, measured" until true
   **[E4: done, FORGE-PLAN §17.1]**.

*"None of the three beats a stripped B. Option A is the worst by a clear three points and should not start.
The founder's architecture instinct was right and his product conclusion was wrong — and neither decides this
submission. The video, the public repo, and one hour in ChatGPT desktop decide it, and all three are at zero
with 57 hours to freeze."*
