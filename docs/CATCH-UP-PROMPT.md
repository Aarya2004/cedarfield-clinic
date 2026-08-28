# Paste this into the Claude session in `~/dev/webmcp-private`

---

New research landed in this repo while you were working. Pull first, then read
it before you touch the plan.

```
git pull
```

Read **`docs/WEBMCP-RESEARCH.md` §6b–6d** (new, commit `1520962`). It was
measured on day 4 of 10 against the live field — ~379 repos created after the
hackathon opened — not against the pre-hackathon demos that §6's saturated-lane
list came from. **The two lists disagree, and §6b is the one that decides how a
judge files us.**

## The finding, in one paragraph

~48% of live entries are the **"governed human-agent workspace"** — a shared
surface where the agent proposes and a human approves. ~29% use approval/gating
language; ~28% use the shared-surface metaphor (workspace, canvas, desk, board,
studio, **console**). Competitor descriptions, verbatim: *"An agent may propose
any screening decision and may never enact one"*, *"Every write is a costed
proposal that blocks until a human decides"*. Our one-liner — *"a terminal you
and your agent share, your Enter is the trust boundary"* — is the same sentence.
**We dodged the retrofit lane and landed in the most crowded lane in the event.**

Separately: the **retrofit / wrapper-generation lane is contested, not open** —
ten entries in four days, verified against the GitHub API, and the only two repos
in the whole field with meaningful stars (★15, ★12) are both in it. `PLAN.md`
§0.1 was right to keep DOM-driving out of the WebMCP layer. Do not drift back.

## What I want you to do with it

**Nothing in the plan is wrong. The order of the pitch is.** The argument in
§6c is that `forge_create` — registering a **new, named tool at runtime**, made
by the user, that did not exist at page load — is the differentiator, where
nearly every other entry registers a fixed list at load. That is the strongest
reading of criterion #1 (*WebMCP Leverage: thorough, skillful, non-trivial*),
which is also **tiebreak #1**. The governance lane **gates an existing surface;
we grow the surface.**

If you accept that, three things change and I want each decided explicitly:

1. **`PLAN.md` §11 rule 1** currently reads *"Terminal + ghost-typing is the
   product. Forge is the second beat."* Inverting it makes the terminal the
   vehicle and the forge the story.
2. **§10 risk 3's kill rule** currently drops forge to "buttons only" on a red
   Gate B and ships terminal + ghost-typing + ledger — i.e. it **drops the
   differentiator and keeps the commodity**, into a field that is half commodity.
   Consider killing terminal polish instead.
3. **§8's 15-second hero moment** should probably end on a tool being *born and
   immediately called*, not on a command being approved.

**Argue with all three if you disagree** — you have context on the build that
this research does not. But decide them on the record and write the decision into
`PLAN.md` §0 so it is not re-litigated. If you reject the reordering, say in §0
*why*, because the next person will ask.

## Do not silently inherit these caveats

* Lane shares are **one agent's classification, ±5pp**, not independently
  re-counted. The GitHub repo table in §6b **was** verified directly.
* **No submission count exists.** Devpost's gallery is unpublished until judging.
  Any "N submissions" figure is an interpolation — say so if you use one.
* **"Quiet on social" is absence of evidence, not evidence of absence.** X has no
  fetchable route since nitter.net and xcancel.com were shut by an X Corp C&D on
  2026-08-24, and Reddit was uncrawlable. Meanwhile ~150 live deploys at a median
  of 8 commits say the field is busy and simply not posting. **Do not conclude
  the field is asleep.**
* Explicitly **unverified, do not quote**: `webmcpdirectory.com` "115 sites live";
  the Sarah Drasner "genuinely useful implementations, not just demos" line
  (second-hand, no primary source); spec issue #256's near-zero-invocation report
  (single-author, self-reported).

## The cheapest edge, restated because the field will not all have it

Already locked in §0.4, and worth acting on **day one**: the declarative API
**silently does not work in ChatGPT**; iframe tools are not discovered;
`navigator.modelContext` was renamed to `document.modelContext` around
2026-08-10 **with the old name kept as an alias**, so broken code keeps working
locally and fails only in the judge's ChatGPT. Google's own docs push
declarative. **A large share of submissions will be non-functional on judging
day.** Testing in the real ChatGPT in-app browser on day one may separate this
entry from the field more cheaply than any feature will.

## Where the rest of the context lives

* `docs/PLAN.md` — the execution plan. §0 locked decisions are binding.
* `docs/PROGRESS.md` — what is green *right now*. Start every standup here.
* The Rokan repo (`~/dev/Rokan`) carries the engine: `packages/rokan-do`,
  `scripts/regression_gate.py` (must stay **PASS 8/8**), and
  `plans/HANDOFF-TO-FABLE-2026-08-28.md`, which holds the graveyard of dead ends
  so they are not re-dug.
