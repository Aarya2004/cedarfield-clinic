# DEMO-OPTIONS — structure brainstorm, rubric-scored (Aarya's Claude, 2026-08-29)

> Input to the D4 recording decision. Evaluates *narrative structures* for the ≤3:00 video
> against the four Devpost criteria (25% each; tiebreak #1 WebMCP Leverage, #2 Execution).
> Beats referenced are all built + measured (FIELD-NOTES) unless marked OPEN.
> Principle applied throughout: **we have two demo surfaces** — the video and the judge's own
> first 60 s on the live URL (`?tour=1`). The video should not do double duty as a catalog;
> the tour is the catalog.

## The rubric, restated as questions a judge asks

| Criterion | The question | What earns it |
| --- | --- | --- |
| WebMCP Leverage (tiebreak 1) | "Did they use the API non-trivially?" | Runtime `registerTool` birth on camera · `toolchange` refresh without reload · annotations (`readOnlyHint`, `untrustedContentHint`, CONSEQUENTIAL) · `AbortController` lifecycle · DevTools panel proof |
| Execution (tiebreak 2) | "Is this a product or a PoC?" | A coherent arc, no dead air, measured numbers on screen, error/recovery shown, judge can reproduce it live |
| Potential Impact | "Whose real problem, credibly solved?" | A specific developer job-to-be-done completed end-to-end, not features enumerated |
| Creativity & Ambition | "Have I seen this before?" | The birth (nobody else has it) · self-forge · MCP parity · compile-to-zero-calls |

## Option A — current DEMO.md shot list (forge-first feature catalog, 8 beats, 2:40)

Birth → invoke → propose/Enter → redaction → sandbox → self-forge → recovery → ledger.

- Leverage **9** — every API surface shown.
- Execution **6.5** — 8 context-switches in 160 s; beats don't cause each other; feels like a tour. Judges watch ~100 tours.
- Impact **6** — features asserted, no job completed. "What problem did I just watch get solved?" has no one-sentence answer.
- Creativity **8** — birth + self-forge land, but their impact is diluted by the catalog around them.
- **Mean 7.4** — consistent with SELF-REVIEW's simulated 6.4–7.6 band. The structure is the ceiling.

## Option B — one continuous story: "red CI to forged deploy" ⭐ recommended

One dev task, start to finish; every feature appears *because the story needs it*. The failing-test
demo project already staged in the judge image (`169024a`) becomes the spine.

Arc: cold-open flash-forward to the birth (the differentiated frame in the first 10 s) → "why is
CI red?" → agent proposes `pytest -q`, ghost, Enter, reads the redacted screen (Share-screen +
redaction happen *mid-debug*, not as a segment) → fix lands, tests green → select the history →
**Forge** → `run_checks` born, tools 6→7 without reload → agent invokes it, 0-call replay for the
`rokan do` status check → agent forges `deploy` (CONSEQUENTIAL) from three approved proposals →
10 s Codex-CLI clip calling the same forged tool over MCP → judge-URL B-roll → ledger close.

- Leverage **9** — identical API surface to A, but the `toolchange` moment now has a *reason*.
- Execution **8.5** — causality replaces enumeration; measured numbers stay on screen; recovery is the plot, not a beat.
- Impact **8.5** — the credible specific problem (a dev's failing CI, fixed and turned into reusable agent tooling) is *watched being solved*. Answers the submission's own "together, newly possible" question visually.
- Creativity **8.5** — same novel beats, plus the Provencher-doctrine Codex clip ("Codex is your customer") which only we can show (measured C1–C6).
- **Mean ≈ 8.6.** Cost over A: narration rewrite + one rehearsal cycle. Zero new engineering — every beat exists.

## Option C — ecosystem demo (multi-consumer: ChatGPT + Chrome + Codex + sandbox)

Lead with birth, then the same forged tool called from every consumer.

- Leverage **9.5** — "thorough, skillful" at maximum; one registry, two protocols is the strongest tiebreak-1 card.
- Execution **6** — four consumers in 3 minutes is fragile on camera and cognitively expensive; Codex needs a fresh session per forge (measured) which reads as a stumble unless narrated carefully.
- Impact **6.5** — abstract; no job completed.
- Creativity **8.5**.
- **Mean ≈ 7.6.** Verdict: don't structure around it — *steal its best 10 seconds* (the Codex clip) into B.

## Option D — "governance-first" (the pre-§0.9 order)

Rejected by decided PLAN §0.9 (~48% of live entries are this lane, our old sentence verbatim).
Scored for completeness: Leverage 7 · Execution 7 · Impact 7 · Creativity **5** → ≈ 6.5. Confirms the inversion.

## Recommendation

**B, with C's Codex clip and A's ledger close.** The tour (`?tour=1`) + README carry the catalog
duty for anything B drops: pairing mechanics, builder install, forge_list, pin/evict, verify CLI.

### Proposed shot list v2 (2:45 target; every number = the measured one from FIELD-NOTES)

| t | shot | say |
| --- | --- | --- |
| 0:00–0:10 | Flash-forward: Site tools **7→8**, `forged_run_checks` appearing; DevTools WebMCP panel split-screen 2 s | "This tool didn't exist a minute ago. I made it by pressing Enter. Watch." |
| 0:10–0:40 | "Why is CI red?" → `pytest -q` ghost → Enter → failing test → Share-screen ON → agent reads (a stray `AWS_SECRET_ACCESS_KEY` on screen renders `[redacted]`, 2 s highlight) → agent names the failing test, proposes the fix | "Every command it wants is a proposal. It can't type Enter. It reads what I let it read." |
| 0:40–1:00 | Fix → `pytest -q` green → select both commands in history → **Forge this** → card `run_checks` → Approve → **tools 6→7, no reload** | "I did this once. Now it's a tool — born at runtime, in WebMCP's own format." |
| 1:00–1:20 | "check again" → agent calls `forged_run_checks` → ghost → Enter → `exit 0 · N ms` ledger row. Then the seeded beat: `rokan do "what is the current status at githubstatus.com"` → `347 ms ⚡ calls:0` | "Second time costs nothing. Even a *browsing* task compiles — zero model calls on replay." |
| 1:20–1:45 | Agent-initiated birth: three approved proposals → agent calls `forge_create` → card `deploy`, **CONSEQUENTIAL** → Approve → invoke → Enter | "It forged its own workflow after I approved it three times. Writes are marked. Still my Enter." |
| 1:45–2:00 | Codex CLI: `rokan-terminal mcp` session lists the same tools, calls `run_checks`, ghost appears in the same tab, Enter | "Same tools, any agent — WebMCP for the browser, MCP for the terminal. Codex is the customer." |
| 2:00–2:15 | Second laptop: live URL → **Try it now** → sandbox paired ~5 s → tour overlay visible | "Nothing to install. Try it yourself — this URL, thirty minutes, throttled." |
| 2:15–2:45 | Ledger scroll: registered/proposed/executed/forged/invoked with ms · `countersigned N/N` · export + `rokan-terminal verify` | "Every tool: who made it, who called it, what it cost — and the log is signed. Do it once. Now it's a tool." |

### Contingency matrix (decide per measurement, never on stage)

| OPEN measurement | If yes | If no |
| --- | --- | --- |
| ChatGPT Site tools refreshes on runtime `registerTool` (blocked on Sol/Terra human check) | ChatGPT is the on-camera consumer throughout | Chrome 152 + Inspector drives (measured); ChatGPT shown post-reload for discovery, stated honestly; DevTools panel carries the birth frame |
| Live `--judge` 10/10 (slot-capped) | Sandbox beat live | Use the recorded J9 8/8 run as B-roll, say so |
| Codex fresh-session quirk reads badly in rehearsal | Keep clip, narrate "a new Codex session picks it up" | Cut to 5 s tool-list shot only |

### What the video deliberately does NOT show (tour/README duty)

Pairing/install mechanics · `forge_list`/pin/evict · unforge · MCP server setup · security prose
(SECURITY.md) · builder-vs-judge architecture. Judges who want depth get it where depth belongs.

### Sponsor-clip map unchanged in spirit (PLAN §8), re-timed

OpenAI 1:45–2:00 (Codex) + 0:10–0:40 · Chrome 0:40–1:00 (birth + DevTools) · Netlify/Render 1:20–1:45
(deploy) · Cloudflare 2:00–2:15 (sandbox) · Vercel = README badge/footer.

## Addendum — synthesis with SELF-EVAL-2026-08-29 (read after pushing; convergent)

The self-eval scores today's *product surfaces* (hostile mean ≈ 6.0) and lands on the same
diagnosis this doc reached for the *video*: **Impact is the criterion that stops us** and
enumerated features are why. Its fixes and this doc's Option B are complementary, and one merge
makes both stronger:

- **Adopt its (b) any-machine beat as Option B's climax.** The story's deploy act (1:20–1:45)
  runs on a **remote box with no API key on it** — "safe agent hands on any machine you own,
  every action gated by your keypress" — which is the "impossible/dangerous before" sentence
  the Impact criterion asks for, on camera, at zero new-engine cost (judge mode already proves
  the capability). The 2:00–2:15 sandbox beat then reads as "and you can try that yourself."
- **First-paint-birth and staged hands-on** (its better-fix list) are the live-URL twins of this
  doc's cold-open principle: the differentiated frame (a born tool) must be the first thing seen
  on *both* surfaces. Fully endorsed; they carry the catalog duty this doc assigns to the tour.
- Corrections adopted from it: criteria are equal-weight on Devpost (tiebreak note is a hint);
  prize = 10 × $3,500, "#1" = spotlight; **no video exists yet** — which makes this doc's ask #1
  (lock the shot list before rehearsal #1) the critical path, and the ChatGPT Sol/Terra hour the
  highest-leverage human hour left.

Revised recommendation: **Option B + any-machine climax**, projected ≈ 8.7 on the video's four
axes, with (a) persistence and (c) export staying cut per the self-eval.

## Asks

1. Arav + C: veto or adopt v2 as DEMO.md's shot list before rehearsal #1 (rehearsals are the
   expensive resource; switching after run 2 wastes them).
2. The `deploy` beat needs its target decided (Netlify vs Render account) — same ask as ALIGNMENT Q4.
3. The failing-test project: confirm it also exists on the builder-mode demo Mac (it is staged in
   the judge image; the video records builder mode).
