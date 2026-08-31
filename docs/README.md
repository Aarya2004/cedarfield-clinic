# docs/ — what is current, and what is history

This repo pivoted on **2026-08-30**. Both products are in the tree on purpose: the submitted one,
and the one it grew out of, which still runs and is still tested. This index exists so nobody —
judge, reviewer, or future us — has to guess which is which.

## The submitted product: **The Drop** (`/`, `/clinic`, `/clinic/book`)

A clinic that releases cancelled appointments in waves. Your agent can hold a slot; only you can
book it, because the page publishes no booking tool.

| Read | For |
|---|---|
| [`../README.md`](../README.md) | the product, the 60-second judge script, every measured number |
| [`SUBMISSION.md`](SUBMISSION.md) | the Devpost text, paste-ready |
| [`DROP-STATUS.md`](DROP-STATUS.md) | what is green right now, what blocks, who owns it |
| [`VIDEO-SCRIPT.md`](VIDEO-SCRIPT.md) | the ≤ 3:00 film, shot by shot |
| [`SECURITY.md`](SECURITY.md) **§10** | trust boundaries of the shipped product, including the residual one |
| [`../tickets/SPEC-V1.md`](../tickets/SPEC-V1.md) | the build spec Aarya wrote for the surface |
| [`research/`](research) · [`reviews/`](reviews) | the hostile evaluations and field research behind the pivot |
| [`evidence/clinic/`](evidence/clinic) | traces and screenshots for every claim in the README |

## The pre-pivot entry: **Rokan Terminal** (`/terminal`)

A shared human+agent terminal where an approved command sequence becomes a live WebMCP tool. It is
**not** the submission. It is kept because it works, because its nine eval cases still pass at
`/terminal`, and because deleting working, tested code the night before a deadline is how people
break things.

Anything below describes **Rokan**, not the submitted product: `PLAN.md`, `TERMINAL-PLAN.md`,
`FORGE-PLAN.md`, `COMPOSE-PLAN.md`, `EXECUTION-PLAN.md`, `DEMO.md`, `DESIGN-BRIEF.md`,
`SANDBOX-PLAN.md`, `SELF-REVIEW.md`, `SELF-EVAL-*.md`, `WORKBENCH-PLAN.md`, `HANDOFF*.md`,
`PROGRESS.md`, `FIELD-NOTES.md` (except its last sections), and the `evidence/` folders other than
`clinic/`. `SECURITY.md` §1–§9 covers Rokan; §10 covers The Drop.

They are left in place rather than deleted: the research and the review trail are the honest record
of how the decision was reached, and several of them are cited by the ones that are current.
