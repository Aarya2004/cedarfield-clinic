# Map: Drop UI spike — pre-lock green-list components (local tracker)

> LOCAL TRACKER. This map and its tickets live on branch `worktree-drop-ui-spike`, pushed to remote
> `drop-ui-spike` (Aarya's call 2026-08-30; Arav already pushed the pivot publicly on workbench).
> Tickets are files in `tickets/T*.md`; status/assignee/blocked-by in each file's frontmatter.
> Frontier = `status: open`, empty `assignee`, all `blocked-by` tickets `closed`.

## Destination

Every lock-independent Drop UI component built, tested, and wired into one clickable playground
prototype on this spike branch — transplant-ready (isolated, props-driven, no tool-contract
dependency) so that the moment Arav locks, the ~24-hour sprint is wiring, not building.

## Notes

**Execution rides this map** (Aarya, 2026-08-30: these are build tickets, matching maps #1/#10 convention).
Skills: `frontend-design` for every component ticket. Implementers: Opus 5 subagents by default.
Standing constraints: components live in `apps/web/src/components/drop/` + logic in
`apps/web/src/lib/drop/` (relative `.ts` imports so the node test runner loads them; files importing
`@/…` cannot be unit-tested); playground route `apps/web/src/app/drop-spike/page.tsx`; skin via
swappable tokens (product name/brand pending — no hardcoded Rokan-or-new identity); every interactive
element gets a `data-*` hook; gate before any commit: `cd apps/web && pnpm typecheck && pnpm lint &&
pnpm build && pnpm test` (suite baseline 228). Do NOT touch existing Rokan components, `main`, or any
contract file. Honest numbers: the counter measures, never scripts. NEVER push this branch.

## Decisions so far

Charter decisions (chat, 2026-08-30 evening, pre-map):
- Pre-lock scope = the green list only: pure UI, props-driven, zero dependency on Arav's DO state
  machine or tool contract (both undecided until lock).
- Local markdown tracker, unpushed branch: repo is public; pivot tickets stay off GitHub issues.
- Components transplant into whatever app shape Arav scaffolds; the playground page is the demo
  vehicle and the lock-decision aid, not the product.
- Keyboard/switch is the primary confirm path; camera gesture is a flagged progressive enhancement
  (WCAG 2.5.4 — motion actuation must have a UI alternative and be disableable).

## Not yet specified

- Video script skeleton for the drop demo (act structure stable: lose → hold → press → forge; lines
  wait on the name + measured numbers).
- The "10–30× interaction cost" citation hunt (soften to "many times" if unsourced).
- Post-lock ticket set: tool wiring, forge/kept integration, waitlist-cascade UI, real adapter
  replacing the mock driver, deployed-URL evals — graduates the moment Arav locks.
- Brand/skin pass once the humans pick the name.

## Out of scope

- Tool registration and the tool contract (Arav's lane, post-lock).
- The Durable Object state machine and waitlist cascade (Arav's lane; cascade is layer two, cuttable).
- Anything on `main` or the future `drop` branch (cut by Arav after lock).
- Pushing this branch or mirroring these tickets to GitHub before lock.
- Rokan submission surfaces (map #10 owns those until the lock invalidates them).
