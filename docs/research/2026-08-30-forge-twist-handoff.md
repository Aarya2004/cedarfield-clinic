# Forge twist — "Handoff" (product-strategist pass, Opus 5, 2026-08-30 ~06:30 PT)

Condensed from the agent's report; field facts verified by it via GitHub/web (URLs in transcript).

## Field correction (important)
Runtime tool minting is **no longer unique**: `domfelipe/ginga` (2026-08-29) records a demo → LLM-compiles →
`document.modelContext.registerTool()` at runtime, persists to Postgres and re-registers in other visitors'
browsers — **no approval, no hash, no keypress** (that is Nahas's Known Security Issue #5 verbatim: tools
appearing after initial connection). `hayashiii-ghub/teachback-webmcp` (08-28) has second-person approval on a
SHA-256 digest but mints nothing (five fixed tools). `blink-borrow-webmcp` transfers a payload between two humans
(granter approves). `authority-shift-webmcp` mints `execute_approved_purchase` on approval, single user. Codex
Record & Replay / Anthropic "Record a Skill" mint procedures, replay autonomously. **Zero** products execute a
minted procedure by a human keypress; **zero** of 697 repos mention xterm/pty/terminal/shell. 15+ entries ship
"human-approved WebMCP" — never claim novelty on the gate alone.

## Proposed twist — Handoff
*"Do it once, then send the tool. Whoever opens the link gets a new capability in their agent — and it still
can't type without their Enter."*
- **Who:** the person who answers "how do I do X?" for a living — OSS maintainer ("can't reproduce, exact
  steps?"), on-call lead, DevRel. All seven judges live in that thread.
- **Now:** select the three commands you just ran → Forge → paste a link. The receiver sees author, hash, every
  command verbatim → approves → their agent has a typed tool that structurally cannot execute. Stranger-to-
  stranger transfer of an executable procedure is normally a phishing primitive; the no-execute invariant makes
  it safe. That property we already own.
- **Reuses:** `kept.ts` envelope `{spec, hash, forged_by, forged_at}` + fail-closed `changed`; restore-approval
  card; `forge.approve()`; validators + `isDangerous`; HMAC ledger; judge sandbox.
- **New (~23 h):** `handoff.ts` encode/decode (base64url + `.rokan-tool`, same bytes) ~4 h; receive route that
  parses before first paint and opens the approval card (sender, hash, verbatim commands, red banner if
  dangerous, never auto-registers) ~6 h; attribution through `forge_list`, tools pane, `received` ledger kind
  (one `contract:` commit) ~4 h; copy/README/video ~6 h; security review ~3 h. No server state (PLAN §0 intact).
- **15-s opening:** GitHub issue "can't reproduce" → maintainer's terminal, three commands, Forge → Approve →
  `forged_repro · by @maya · hash 9f2c…` → Copy link → the reporter opens it in ChatGPT: "@maya sent you a
  tool", commands + hash, "nothing runs until you press Enter" → Approve → Site tools 7 → 8 → agent calls it,
  ghost text, Enter, ledger `exit 1 · 2 314 ms · from @maya`. Caption: *"She sent a tool, not a script. It
  still can't type."*
- **Judge script (no login):** open the README link in ChatGPT desktop / Chrome+flag → approval card → Approve →
  7 → 8 → Try it now; say "run repro for 0.1.3" → ghost → Enter per step → ledger ms + `calls: 0`; run anything,
  select, Forge, Copy link, open in a second tab → your tool, your hash, a fresh card.
- **Free rider, 0 h:** re-lead on **refusal** (Build Week praised Dấu "asks learner to retry", Mechanica's
  docent "declines when evidence is unavailable"); our drift-refusal is measured twice.

**Novelty 7/10** — both halves shipped this week (ginga, teachback); the composite (demo-mint + second-person
hash approval + per-step keypress + terminal) is unoccupied; convergent, not unprecedented. Against 697 repos
on "does it differ from existing concepts?" it reads as 9.

**Three failures:** (1) ChatGPT desktop's tool-list refresh after runtime registration is undocumented
(PROGRESS:404 flags it) — receive path registers from the URL before first read; **test in the first two hours
on Arav's keyboard**; (2) a judge who opened ginga/teachback reads "handoff" as convergence → Creativity 6; the
claim must be one sentence; (3) a link carrying shell commands into a stranger's browser *is* a phishing
primitive — verbatim commands, dangerous banner + second click, no auto-approve from any URL param, sanitized
`forged_by` as untrusted text, ledger rows, SECURITY section — must ship *with* the feature; and it spends 23 h
while video / public repo / ChatGPT run are at zero. **Hard gate: those three closed by Sun 22:00 PT or kill
Handoff and ship the refusal reframe alone.**

**Runner-ups:** live cross-session push (needs shared mutable state, banned; link already delivers the beat);
incident-room/runbook costume (7+ entries; zero added leverage).

**On "synthetic tools = WebMCP isn't enough":** delete the phrase everywhere. Say: *"Where a site ships WebMCP
we call its own tools natively and never touch its DOM; where it hasn't yet, the person using the site can mint
the missing tool themselves — and ours retires itself the moment that site ships its own."* Never let
"compiled" sound headless; never frame it as a substitute. **[E4: in judge mode the planner is off — native or
honest refusal; the compile rung is builder-mode-only, on the person's own machine.]**
