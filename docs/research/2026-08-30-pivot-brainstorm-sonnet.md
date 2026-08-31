# Pivot brainstorm — second opinion (Sonnet 5, independent, 2026-08-30 ~09:00 PT)

# Independent second-opinion brainstorm — WebMCP Challenge (read-only, no repo edits made)

Read the four cited docs plus verified externally: WebMCP Challenge rules/deadline (Sep 3 13:00 PT submit, winners Sep 23), OpenAI's own showcases (Codex Modeling Studio, WanderNote, **Margin** — confirmed Margin is literally "shared doc, agent leaves comments under its own identity," 10 tools: `add_comment`/`resolve_comment`/etc. — this pre-empts any "collaborative doc with agent comments" idea outright), and ran targeted searches for prior art on each concept below. No WebMCP-hackathon-specific prior art found for clinic-waitlist, caregiver-med, mutual-aid-claim, or field-notebook shapes; Build Week's veTriage/Dấu/Mechanica are the closest calibration matches and are noted per-concept.

## The six concepts

**1. Clinic Waitlist Backfill Coordinator ("OpenSlot")**
Pitch: front desk cancels a slot; agent proposes who to text next off a live priority queue; only a human click sends anything or books.
Population: solo/small-practice front-desk staff. Reach in 48h: founder's own MedPort clinic contacts (assumption, unverified) or a dental/optometry front-desk Facebook group.
Deterministic core: slot state machine (open/held/booked), FIFO waitlist queue, 5-min hold TTL. Agent forbidden: send message, mark booked, pick contact order.
15-sec moment: two patients' agents race for one slot; loser gets a live, honest refusal instead of a double-book.
Tools (6): `waitlist_view`, `waitlist_propose_contact` (consequential), `waitlist_hold_slot` (consequential, TTL), `waitlist_confirm_booked` (human-only), `waitlist_release_hold`, `waitlist_history`.
Reuse/new: ledger+redaction+shell reused (~7h); state machine+hold-expiry+queue UI new (~16h); seed+video (~6h) ≈ 30h.
Prior art: veTriage (closest — no-LLM-runtime vet receptionist triage, doesn't coordinate a live shared queue), Cardea, EvaluWait (different hackathon, wait-time estimation only).
Scores (pessimistic): Leverage 7, Execution 6, Impact 8, Creativity 6 → **6.75**, top-10 ~15-20%.

**2. Caregiver Med-Check Coordinator ("Second Set of Eyes")**
Pitch: shared dose ledger for a care circle; agent can flag/propose, never itself mark a dose "given" — only a present human can.
Population: family caregivers of aging parents. Reach: r/CaregiverSupport, r/AgingParents, or a personal contact.
Deterministic core: dose ledger + refractory-window double-dose guard, hard-coded, no LLM judgment on the write path.
15-sec moment: agent infers "he probably took it" from conversation → refused ("not evidence"); then correctly blocks a real double-dose live.
Tools (6): `doses_view`, `doses_flag_concern`, `doses_propose_reminder`, `doses_confirm_given` (human-only, enforced not just prompted), `doses_history`, `doses_status`.
Reuse/new: ~6h reuse + ~18h new + ~6h seed/video ≈ 30h.
Prior art: Medisafe, CareMobi, Connected Caregiver, CareMinder — all do shared reminders; none structurally bar the agent from confirming.
Scores: Leverage 6 (this is really an auth-permission design, not WebMCP-specific — a plain API enforces the same thing), Execution 7, Impact 8, Creativity 5 (crowded genre) → **6.5**, top-10 ~12-18%.

**3. Study-Session Sanity-Check ("Show Your Work")**
Pitch: physics/math study group; agent can only mark a derivation step verified if it first runs a SymPy dimensional-analysis/algebra check and shows the transcript.
Population: undergrad physics/eng study groups. Reach: r/AskPhysics, r/EngineeringStudents, or founder's own physics network.
Deterministic core: SymPy check is ground truth; refusal is a visible page state, not silent.
Tools (6): `problem_view`, `step_propose`, `step_verify_check`, `step_commit` (consequential), `step_history`, `problem_status`.
Reuse/new: ~5h + ~20h (math tooling is fiddly, real risk) + ~6h ≈ 31h.
Prior art: **structurally a re-skin of Dấu** (Build Week winner: DSP grades deterministically, LLM coaches) in a new vertical — judges who saw Build Week will clock it.
Scores: Leverage 6, Execution 5, Impact 5, Creativity 4 → **5.0**, top-10 ~8-12%.

**4. Mutual Aid Claim Race ("No Double-Claim")**
Pitch: live community-fridge/free-store inventory; two agents race for one item; loser gets an honest refusal, not a silent double-promise.
Population: mutual aid / Buy Nothing group members. Reach: a local group admin, 48h ask.
Deterministic core: optimistic-concurrency hold→claim state machine, zero ML in the claim path.
Tools (6): `fridge_browse`, `fridge_propose_hold` (TTL'd), `fridge_confirm_claim` (human tap), `fridge_release_hold`, `fridge_status`, `fridge_history`.
Reuse/new: cheapest build in the set — ~5h + ~11h + ~6h ≈ 22h.
Prior art: Buy Nothing Project (community, not software), Mutual Aid Hub (directory only) — no WebMCP-specific competitor found.
Scores: Leverage 6 (a plain "claim" button+API does the same race-safety — thin on "why an agent"), Execution 8, Impact 5 (nobody urgently needs an agent to grab a loaf of bread — undercuts the whole thesis), Creativity 6 → **6.25**, top-10 ~10-14%.

**5. Field Notebook (citizen-science ID with confidence refusal)**
Pitch: field observation log; agent's species/measurement guess only becomes data above a confidence threshold; below it, refused, needs human ID.
Population: citizen-science groups, one field-biology course section.
Deterministic core: confidence-gate + taxonomy match; external ID API reintroduces non-determinism (design risk).
Prior art: **close to Mechanica** (Build Week winner, "data is law," poison tests) in spirit, different domain; domain mismatch (field work wants mobile, this is a browser tab) undercuts the premise.
Scores: Leverage 5, Execution 5, Impact 5, Creativity 4 → **4.75**, top-10 ~6-9%.

**6. Evidence-Locker Co-Filer** (O-1/grant petition binder, citation-must-resolve-to-uploaded-exhibit gate)
Flagged for veto regardless of score: even with a different named user, this reads as self-interested given the founder's own O-1 process, and PII/legal-document correctness under 4 days is the wrong place to move fast. Scores: Leverage 6, Execution 4, Impact 6, Creativity 5 → **5.25**, top-10 ~7-10%, disproportionate downside risk.

## Top 3, deep dive

### 1. Clinic Waitlist Backfill Coordinator

## What already exists
Medisafe/CareMobi-class consumer apps do reminders; veTriage (Build Week winner) does no-LLM-runtime call triage for one vet practice; general practice-management software (many, non-agentic) already fills cancellations by phone tree.

## Why those aren't enough
None put the human and the agent looking at the *same live slot grid* with the agent structurally barred from sending, booking, or choosing contact order — veTriage triages inbound calls, it doesn't coordinate a shared queue two parties can both act on.

## Proposed idea
A front-desk page registers `waitlist_*` WebMCP tools; a cancellation opens a hold window; the agent can only propose and draft, never send or book; races between two candidates resolve with an honest, live refusal.

## Novelty score: 6/10
One reason: real gap in the calibration set (no shared-live-queue-with-hard-write-boundary entry found), but the core "agent proposes, human executes" pattern is table stakes per the research doc ("approval gating is not a differentiator") — the queue/race mechanic is what's new, not the gate itself.

## Three ways this fails
1. No real clinic contact materializes in 48h — the whole Impact score collapses to "plan," the exact loser pattern (SayAhead, Canopy, Tomok) the calibration doc names by name.
2. Hold-expiry timer races are a classic footgun; a bug here reads as "double-booked a real patient," not a cute demo glitch.
3. PHI-adjacency (patient names, phone numbers) invites exactly the compliance scrutiny the founder's own standards flag as sacred — under time pressure this is the highest-consequence place to cut a corner.

### 2. Caregiver Med-Check Coordinator

## What already exists
A dozen med-reminder apps (Medisafe, CareMobi, Connected Caregiver, CareMinder, DontForgetDad) already do shared family visibility and reminders.

## Why those aren't enough
None make it structurally impossible for an agent to write "given" — it's always just a UI convention, not an enforced boundary; none show a refusal moment live.

## Proposed idea
Dose ledger with a hard refractory-window double-dose guard and a presence-gated `doses_confirm_given` the agent literally cannot call successfully.

## Novelty score: 5/10
One reason: the domain is the most crowded of the six ("tools for people like the builder" risk is low since it's not for developers, but it's still a saturated app category — differentiation rests entirely on one enforcement detail, not the product shape).

## Three ways this fails
1. "Agent cannot write given" is an auth-permission design any REST API achieves — a sharp judge (Grigorik-style) asks "what does WebMCP add here that a normal app with a confirm button doesn't," and the honest answer is: less than the pitch implies.
2. Real caregiving households are hard to onboard cold in 48h even via subreddit — trust barrier is higher than a clinic's professional relationship.
3. A genuine miss on the double-dose guard, even in a demo, is the one failure mode that reads as reckless in front of judges from health-adjacent panels.

### 3. Mutual Aid Claim Race

## What already exists
Buy Nothing Project and Mutual Aid Hub are community/directory infrastructure, not live-claim software; no agent layer exists on either.

## Why those aren't enough
Neither solves (or needs to solve) the double-claim race an agent introduces the moment two people can query and act on the same inventory concurrently through an AI intermediary.

## Proposed idea
Optimistic-concurrency hold→claim state machine on a shared item board; agents can browse and propose holds, never finalize; the race-refusal is the entire demo.

## Novelty score: 6/10
One reason: genuinely unclaimed corner of the field (verified via search — no WebMCP mutual-aid entry found), but arguably a solution in search of a problem: nobody has expressed unmet need for an *agent* to claim a loaf of bread.

## Three ways this fails
1. Impact criterion asks for "real problem, real audience" — the audience is real, the *urgency* for an agent specifically is not, and a judge scoring "based on what's demonstrated" will ask why this needs to be agentic at all.
2. Cheapest build in the set (~22h) means it's also the least impressive Execution surface — nothing here is hard, which caps the Execution ceiling even if it works perfectly.
3. Community trust for a stranger's software to touch a mutual-aid group's real inventory in 48h is a harder cold-outreach ask than it looks, despite the low technical bar.

## Recommendation vs. keeping Rokan Terminal

**Keep Rokan Terminal.** Blunt reasoning, numbers first:

- Rokan's own hostile eval (option B, absorbed plan) already scores **6.5 mean / ~29% top-10**, sitting *above* every new concept's pessimistic mean here (best new concept: clinic waitlist at 6.75 mean but with an *unverified* real-user assumption baked into its Impact score — if that user doesn't land in 48h, its real mean is closer to 5.5-6, on par with or below Rokan).
- The path to Rokan's 29% is three bounded, already-scoped, low-technical-risk tasks the hostile eval itself named: make the video, flip the repo public, do one hour in ChatGPT desktop. None of the six new concepts have anything built — each needs 22-32h of *new* deterministic-engine code plus cold outreach to a real user with zero existing relationship (mutual aid, caregiver, physics) or one unverified relationship (clinic), inside the same shrunk window.
- Every new concept's Leverage score (5-7) is *not* higher than Rokan's current Leverage read (7-8 per the research doc's own table) — none of the six beats Rokan on the tie-break criterion, which is the one the rules say decides ties.
- A pivot now repeats exactly the failure mode the hostile eval scored at 3.5/~6% top-10 for the canvas pivot: an unbuilt idea competing against 40 hours of already-shipped, already-evidenced work, with a judge line ready-made ("cardea/veTriage did this already, with real users").

**The one legitimate hedge**: if the founder can get a genuine "yes" from a real clinic contact in the next 3-4 hours for concept #1, that's worth folding in as a *seeded demo tool inside Rokan* (a `forged_waitlist_hold` step, same pattern as the cross-site native step already flagged as underused) rather than a replacement — consistent with the hostile eval's own finding that Rokan's best unexploited asset is cross-site native consumption, not a new product. Do not restart the submission with 4 days left; that is the mistake the record already shows costing the most points.