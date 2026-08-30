# VIDEO-SCRIPT.md — the ≤ 3:00 submission video (wayfinder #15)

> Supersedes the shot lists in `docs/DEMO.md` §"Shot list" and `docs/COMPOSE-PLAN.md` §12 for the
> **recorded** video. `DEMO.md` stays authoritative for the live-judge script, the pre-stage
> checklist, the backup trigger and the rehearsal log.
> Written 2026-08-30 against the measured state in `docs/PROGRESS.md` (top two build-log blocks),
> `docs/measurements/2026-08-29-ab.md` and `docs/evidence/`.

## The four rules this script obeys

1. **Judges may never open the app** (Devpost FAQ). The thesis, a forged tool being born, and the
   ⚡ 0-call replay all land **before 0:15**. A judge who stops at 0:15 has the pitch; a judge who
   stops at **1:02** has seen everything scoring-relevant (Leverage, Execution, Impact, Creativity).
   Everything after 1:02 is corroboration.
2. **Honest numbers only** (PLAN §0.6). Every figure spoken or shown traces to a row in §5. The ms
   in this script are the **measured priors from the same path** — the take's own on-screen number
   always wins. If a take reads a different ms, **re-read the line to the take**; never overdub a
   prior onto a different number.
3. **The Enter gate is one line, not the headline** (PLAN §0.10). It is spoken exactly once, at
   0:08 ("My Enter runs it"), and shown as a mechanism thereafter. The pitch is
   compile-once / replay-free + provenance.
4. **The demo path is the real judge path**: `rokan-terminal.vercel.app` → **Try it now** → judge
   sandbox. Builder mode is used only for the three beats the judge sandbox cannot do (A/B, drift,
   native) and is **labelled on screen** when it is.

Target runtime **2:50**. Hard ceiling 3:00.

---

## 1. Cold open — 0:00–0:15, word for word

No logo, no title card, no "hi, I'm". Frame one is the product already mid-thought.

**0:00–0:03 — the thing already done**
On screen: judge sandbox, dark theme. The Runs feed holds one row —
`you  rokan do "what is the current status at githubstatus.com"` — expanded to
`All Systems Operational   799ms ⚡` with the chip **`⚡ compiled · 799 ms · 0 calls`**.
The cursor drags across the line; the **Forge this** button appears.

> **"I did this once."**

**0:03–0:08 — the birth**
Cut to the Forge card: name `status_of`, one param `site` (example `githubstatus.com`), kind
**READ**, content hash visible. Click **Approve**. The header counter ticks **Site tools · 7 → 8**;
`forged_status_of` slides into the Forged tools list; the Ledger gains
`forged  forged_status_of  4bfdbeaff4d5  read ✓`. No reload, no navigation.

> **"Now it's a tool — born at runtime, in WebMCP's own format, no reload."**

**0:08–0:15 — the payoff**
The agent pane calls `forged_status_of({site:"www.vercel-status.com"})`. Ghost text appears at the
prompt: `rokan do "what is the current status at www.vercel-status.com"`. A finger presses **Enter**.
Output: `All Systems Operational   1184ms ⚡`; the run row chips **`⚡ compiled · 1184 ms · 0 calls`**.

> **"My agent calls it on a different status page. My Enter runs it. One-point-two seconds, zero
> model calls — the model is out of the hot path."**

*Read length: 43 words ≈ 15.2 s at 170 wpm. If the read runs long, the designated cut is
"no reload" — it is already visible on screen. Nothing else in this block may be cut.*

---

## 2. Beat table — 0:15 → 2:50

| t | on-screen action | spoken line | measured number shown | evidence |
|---|---|---|---|---|
| **0:15–0:30** | Same judge sandbox. Type a page nobody seeded: `rokan do "what is the default port at www.postgresql.org/docs/current/runtime-config-connection.html"` → answer, `planned · 9 019 ms`. Type the identical question again → `⚡ compiled · 783 ms · 0 calls`. | "This isn't a canned demo — that page isn't in anything we shipped. First run plans: nine seconds, one model call. Second run replays in seven hundred eighty-three milliseconds at zero calls. Compile once, replay free." | `planned · 9 019 ms` → `⚡ compiled · 783 ms · 0 calls` | `docs/evidence/stranger/2026-08-29-prod-open-net-cold-then-replay.jpg` |
| **0:30–0:47** | Three panes, **one stopwatch discipline** — wall clock around the whole command in each. Left Rokan `0 calls · 546 ms`; middle Codex CLI `23 164 ms`; right Claude Code `15 780 ms`. Burned-in caption: *"wall clock, N=5 warm / N=3 agents — they re-plan every run."* | "Same live question, three tools, one stopwatch. The agents re-enter the model on every single run. Rokan doesn't — twenty-nine to forty-two times faster end to end, at zero model calls, and it stays free every run after." | `546 ms` vs `23 164 ms` / `15 780 ms` → **28.9×–42.4×** | `docs/measurements/2026-08-29-ab.md`; `docs/evidence/ab/arm-c.json`, `arm-agents.json` |
| **0:47–1:02** | A storefront "redesigns" (v1→v2). Left: the cached script a coding agent wrote still runs and prints `{"answer":"$75","refused":false}` — the truth is `$140`. Right: `recheck` → `DEAD   127.0.0.1:8099   Wander Boot   replayed 0 ms · drift_detected` → `0 alive · 1 dead`; the re-ask → `status:error · verification:refused · answer:null`. | "A cached scrape lies quietly — seventy-five dollars when the price is a hundred and forty. Rokan re-verifies, retires the dead operation, and refuses out loud. Verified, or refused." | `$75` vs `$140`; `drift_detected`; `verification:refused` | `docs/evidence/ab/drift-run-1.txt` (and `-2.txt`) |
| **1:02–1:20** | Builder mode, labelled on screen. `rokan do` on `allbirds.com`: the site's **own** ten WebMCP tools are listed, then `search_catalog` is invoked directly — no DOM, no re-registration. | "Sites that already ship WebMCP get called natively — Allbirds declares ten tools and we call its own search_catalog in four hundred sixty-nine milliseconds at zero model calls. We only compile where a site has none, and we retire the compiled version when the site ships its own." | 10 tools; `search_catalog` **469 ms** tool time (1 300 ms wall) · 0 model calls | `docs/evidence/probe/2026-08-30-native-invoke-local-image.jsonl` |
| **1:20–1:38** | Second laptop, clean Chrome, `rokan-terminal.vercel.app` → **Try it now** → `paired 239 ms` → `rokan do "what is the current status at www.netlifystatus.com"` → ⚡ 0 calls → same for `www.shopifystatus.com`. Caption: *"judge suite 15/15, 0 retries, 96 s."* | "Nothing to install. A throttled Cloudflare sandbox — thirty minutes, non-root, no API key in the container. Twenty-four status pages are seeded, including yours." | `paired 239 ms`; ⚡ `0 calls`; 24 seeded status pages; `15/15` | `docs/evidence/stranger/2026-08-29-prod-forged-tools8.jpg`; `infra/sandbox/container/seed/rokan-seed-ops.json`; `docs/evidence/sandbox/2026-08-29-judge-suite-15-of-15.txt` |
| **1:38–1:58** | The agent proposes `pytest -q`; ghost text at the prompt, nothing runs. Toggle **Share screen** on; the shell prints `export AWS_SECRET_ACCESS_KEY=…`; the agent's read comes back `[redacted]`. Pan the Site tools list: seven fixed, five forge slots. | "Everything the agent wants is a proposal, ghost-typed at the prompt. It reads only what I share, and secrets are redacted before anything leaves the tab. Seven fixed tools, five slots for the ones we make." | 7 fixed + ≤ 5 forged = 12 | `apps/web/src/lib/webmcp/schemas.ts` (`FIXED_TOOL_NAMES`); `docs/evidence/gate-b/rehearsal-3-share-redacted.jpg` |
| **1:58–2:18** | Codex CLI in a terminal beside the page: a fresh session lists the same tools, calls `forged_status_of`, the ghost text lands on the page, the human presses Enter, the ledger row appears. | "Same page, second protocol. Codex over stdio lists the same tools and calls the same content hash. The page stays the single source of truth — the MCP process can never type." | same content hash across both consumers | `docs/evidence/gate-b/codex-3-card-hash-schema.jpg` … `codex-6-forged-ran.jpg`; FIELD-NOTES C1–C6 |
| **2:18–2:38** | Ledger column scrolls: `registered · paired · proposed · executed · forged · invoked`, each with ms, provenance chips (`from human` / `from agent`), `countersigned by bridge N/N`, then **export** → JSON. | "Every tool: who made it, who called it, what it cost. Chained in the tab, countersigned by the bridge, exportable." | `countersigned by bridge N/N` (live count) | `docs/evidence/stranger/2026-08-29-prod-forged-tools8.jpg` (Ledger · 4, countersigned 3/4) |
| **2:38–2:50** | Static end card on the app's own background: **Do it once. Now it's a tool. Now every agent can call it.** · `rokan-terminal.vercel.app` · repo URL · one line of small type: *"Every number in this video is measured by the code that shows it."* | "Do it once. Now it's a tool. Now every agent can call it." | — | — |

**If a take runs long:** trim beat 1:38–1:58 first, then 1:58–2:18. Never trim before 1:02.

---

## 3. Where ChatGPT-desktop footage slots — *if* it exists on recording day

As of 2026-08-30 the ChatGPT desktop (GPT-5.6 Sol/Terra) run is **unmeasured and blocked on Arav**
(`docs/PROGRESS.md`: "Still blocked (Arav): ChatGPT Sol/Terra run"). **This script must ship without
it.** Do not shoot around a hole; shoot the version below and only swap if the footage exists.

- **Primary slot (highest value): 0:03–0:08, inside the cold open.** Replace the app's own
  `Site tools · 7 → 8` counter with a two-shot: Approve on the card → hard cut to ChatGPT's Site
  tools list going 7 → 8 with `forged_status_of` appearing → cut back to the prompt. Same VO, same
  length. This is the strongest available reading of tiebreak #1 (a runtime registration a judge
  can see inside the consumer).
- **Secondary slot: 1:58–2:18**, as a third pane beside Codex CLI — "ChatGPT, Codex, Claude Code,
  one hash."
- **Fallback that is being shot regardless (and is honest on its own):** the app's own Site tools
  counter 7 → 8 plus **DevTools → Application → WebMCP** showing one `toolsAdded` per runtime
  `registerTool` (measured on Chrome 152, PLAN §0.9). The VO says "in Chrome's WebMCP panel", never
  "in ChatGPT". **Never imply footage we do not have.**

---

## 4. Recording-day shot checklist

**Before anything rolls (the April 23 rule)**
- [ ] `pnpm typecheck && pnpm lint && pnpm build` in `apps/web`; `pnpm gate` green. Write the commit
      hash on the whiteboard and into `docs/DEMO.md`'s pre-stage line.
- [ ] **Prod is stale until deployed** — after *any* `apps/web` merge run `cd apps/web && vercel --prod --yes`.
      Vercel has no git auto-deploy on this project (PROGRESS, 2026-08-29 19:15 block). Verify the
      alias serves HEAD by observable diff: header shows **Site tools · 7**, Runs panel present,
      hero example is `status_of` (not `hn_top`).
- [ ] Open the **First 60 seconds** card and read line 4. If it still says the sandbox "can only
      reach a few demo hosts", **prod is stale** — the open-net sandbox shipped 2026-08-29 20:25 and
      that copy was removed. Redeploy before recording; the retired claim must not appear on camera.
- [ ] **No `wrangler deploy` of `infra/sandbox` on recording day.** A Worker deploy replaces the
      container fleet and drops every live judge session (DEMO.md freeze rule).

**Machine + capture**
- [ ] Screen 1440×900 logical, 2× DPR, browser zoom 100%, 60 fps capture.
- [ ] macOS: Dock hidden (⌥⌘D), menu bar auto-hide, **Focus / Do Not Disturb on**, all notifications
      off, desktop wallpaper plain, no clock or Stats overlay, second display mirrored off.
- [ ] Audio: VO recorded **separately**, one take per beat, quiet room, pop filter. Never overdub a
      number the frame does not show at that instant (rule 2).

**Browser profile**
- [ ] Brand-new Chrome profile `rokan-demo`: no extensions, no bookmarks bar, no profile avatar, no
      password-manager prompts, signed out, `chrome://flags/#enable-webmcp-testing` **Enabled** +
      relaunch (measured on Chrome 152; the app footer states 149+).
- [ ] Tabs, in this order, pre-opened and pre-warmed:
      1. `https://rokan-terminal.vercel.app` — **judge mode**, a fresh sandbox already paired
         (cold start burns ~5 s; do not record it).
      2. Same URL in a second window — **builder mode** (bridge + quick tunnel) for the A/B, drift
         and native beats.
      3. DevTools undocked to the side on tab 1, **Application → WebMCP**, for the birth close-up.
      4. The A/B split-screen render / drift terminal panes.
      5. `docs/evidence/demo-backup.gif` — background tab, `F` for fullscreen, **one keypress away**.

**App state at frame one of every take**
- [ ] Theme **dark** (the header toggle reads "Light" when dark is active). Terminal canvas always dark.
- [ ] Share screen **off**. Forged tools: none. Ledger: only `registered` + `paired`. Runs feed empty.
- [ ] `clear` in the shell before every take; prompt is `judge@rokan:~ %`.
- [ ] The rokan-do first-run disclosure must not appear — the judge image pre-touches `~/.do-disclosed`.
      If a 12-line disclosure prints, you are on an old image: stop and rebuild.

**Command hygiene (measured, do not improvise on camera)**
- [ ] Seeded hosts that replay at ⚡ 0 calls: `githubstatus.com`, `www.vercel-status.com`,
      `www.netlifystatus.com`, `www.shopifystatus.com`, `status.anthropic.com` (24 status pages in
      the pack). Type the seeded phrasing **byte-exact**: `rokan do "what is the current status at <host>"`.
- [ ] **Do not record** `status.openai.com` or `www.cloudflarestatus.com` — both measured to abstain
      (FIELD-NOTES J19: the status sentence carries no label→value shape). Do not record Hacker News
      or `example.org` on the ⚡ beat — not seeded.
- [ ] Builder-mode beats need a key in the demo shell, never in the judge container:
      `export ANTHROPIC_API_KEY="$(security find-generic-password -s rokan-anthropic-key -a rokan -w)"`
      before starting the bridge. (The `ANTHROPIC_API_KEY` Keychain entry is dead — 401.)

**Backup (CLAUDE.md: recorded backup one keypress away)**
- [ ] `docs/evidence/demo-backup.gif` (9 captioned frames from the automated real-PTY dry-run) open
      in tab 5. Trigger written on a sticky note on the bezel.
- [ ] Record a **QuickTime** screen capture of rehearsal #3 as `docs/evidence/demo-backup.mp4` — a
      camera-recorded run of the live path beats the GIF. (Homebrew ffmpeg is broken on the demo Mac:
      missing `libxcb`. QuickTime works.)
- [ ] Rehearse **5×** with a stopwatch; log each run in `docs/DEMO.md`'s rehearsal table with the
      failed beat and the fix.

**Delivery**
- [ ] Final export ≤ 3:00, 1080p, no music under the VO in beats 0:00–1:02.
- [ ] Unlisted YouTube; paste the link into `docs/SUBMISSION.md` (`**Video:** <YouTube URL, < 3:00>`).

---

## 5. Numbers ledger — every figure → its evidence

| figure as spoken/shown | beat | evidence path (committed) |
|---|---|---|
| `799 ms ⚡ · 0 calls` — `githubstatus.com` seeded replay, live prod judge sandbox | 0:00 | `docs/PROGRESS.md` → build log **2026-08-29 ~19:00 local** (real-Chrome stranger run on the live URL) |
| `Site tools · 7 → 8`, `forged_… ` content hash `4bfdbeaff4d5`, `from human` | 0:03 | `docs/evidence/stranger/2026-08-29-prod-forged-tools8.jpg` |
| `1 184 ms ⚡ · 0 calls` — `www.vercel-status.com`, run-row chip `⚡ compiled · 1184 ms · 0 calls` | 0:08 | `docs/evidence/stranger/2026-08-29-prod-runs-0calls.jpg`; `docs/PROGRESS.md` build log 2026-08-29 ~19:15 |
| `planned · 9 019 ms` → `⚡ compiled · 783 ms · 0 calls` — unseeded PostgreSQL docs page, in the judge sandbox | 0:15 | `docs/evidence/stranger/2026-08-29-prod-open-net-cold-then-replay.jpg`; `docs/PROGRESS.md` build log 2026-08-29 ~20:25 (and in-suite `terminal-rokan-open-net`) |
| Rokan warm ×5: **0 model calls · 546 ms wall** (internal 79 ms, shown beside it, never instead of it) | 0:30 | `docs/evidence/ab/arm-c.json` → `tasks[1].warm.wall.mean = 546`, `model_calls [0,0,0,0,0]`, `all_zero_calls: true` |
| Codex CLI ×3: **23 164 ms wall**, 1 turn | 0:30 | `docs/evidence/ab/arm-agents.json`; `docs/measurements/2026-08-29-ab.md` §"The table" |
| Claude Code ×3: **15 780 ms wall**, 3 turns | 0:30 | same |
| **28.9×–42.4×** wall-clock at 0 model calls | 0:30 | `docs/measurements/2026-08-29-ab.md` §"The multipliers, with the arithmetic" (23 164 ÷ 546 = 42.4; 15 780 ÷ 546 = 28.9, truncated) |
| `N = 5 warm / N = 3 agents` caption | 0:30 | `docs/measurements/2026-08-29-ab.md` (harness `evals/ab/arm-c.mjs`, `arm-agents.mjs`) |
| naive cache `{"answer":"$75","refused":false}` when the truth is `$140` | 0:47 | `docs/evidence/ab/drift-run-1.txt` lines 2, 6 (reproduced identically in `-2.txt`) |
| `DEAD   127.0.0.1:8099   Wander Boot   replayed 0 ms · drift_detected` · `0 alive · 1 dead` | 0:47 | `docs/evidence/ab/drift-run-1.txt` (`recheck_stdout`) |
| `status:error · verification:refused · answer:null` (no stale `$98`, no guessed `$140`) | 0:47 | `docs/evidence/ab/drift-run-1.txt`; `docs/measurements/2026-08-29-ab.md` §"The drift beat" |
| `allbirds.com` declares **10** native WebMCP tools | 1:02 | `docs/evidence/probe/2026-08-30-native-invoke-local-image.jsonl` (`step:list`, 10 tools / 8 866 ms); corroborated `…-live-sandbox-standard-3.jsonl` (10 tools / 8 181 ms) and FIELD-NOTES T5 |
| `search_catalog` **469 ms** tool time (1 300 ms wall) · **0 model calls** · real catalog result | 1:02 | `docs/evidence/probe/2026-08-30-native-invoke-local-image.jsonl` (`step:invoke`, `elapsed_ms: 469`, `ms: 1300`) |
| `paired 239 ms` on **Try it now** | 1:20 | `docs/evidence/stranger/2026-08-29-prod-forged-tools8.jpg` (Ledger row 2); `docs/PROGRESS.md` 19:15 block |
| **24** seeded status pages incl. vercel / netlify / shopify / anthropic (52 ops over 49 hosts) | 1:20 | `infra/sandbox/container/seed/rokan-seed-ops.json` (counted 2026-08-30: 52 ops, 49 hosts, 24 status hosts) |
| judge suite **15/15, 0 retries, 96 s** | 1:20 caption | `docs/evidence/sandbox/2026-08-29-judge-suite-15-of-15.txt` |
| 30-minute TTL, non-root, **no API key in the container** | 1:20 | `docs/SECURITY.md` §6/§9; `docs/PROGRESS.md` 20:25 block (container env: `ANTHROPIC_API_KEY=judge-sandbox-proxy`, proxy base URL) |
| redaction: `AWS_SECRET_ACCESS_KEY=…` → `[redacted]` | 1:38 | `docs/evidence/gate-b/rehearsal-3-share-redacted.jpg`; `apps/web/src/lib/webmcp/redact.ts` |
| **7** fixed tools, ≤ 5 forged (12 total) | 1:38 | `apps/web/src/lib/webmcp/schemas.ts` → `FIXED_TOOL_NAMES` (7 entries) |
| Codex CLI proposes → forges → a new session calls the same hash → human Enter | 1:58 | `docs/evidence/gate-b/codex-1-proposal-ghost.jpg` … `codex-6-forged-ran.jpg`; FIELD-NOTES C1–C6 |
| `countersigned by bridge N/N` + export | 2:18 | `docs/evidence/stranger/2026-08-29-prod-forged-tools8.jpg` (Ledger · 4, countersigned 3/4) |

---

## 6. Numbers deliberately **excluded** (say none of these on camera)

| excluded | why |
|---|---|
| **~200×–290×** | Retracted: it divided Rokan's *internal* 79 ms by the agents' *wall* clock. `docs/measurements/2026-08-29-ab.md` §"Comparing like with like". Use 28.9×–42.4× only. |
| **"demo hosts only"** egress claim | Retired — the judge sandbox reaches the open web (open-net proven live 2026-08-29). Also check it is gone from the First-60 card before rolling. |
| **"3 per IP"** | Retired. The shipped caps are 10 sessions / 5 concurrent per IP with a 30-min TTL (SECURITY §9). Don't state a cap number on camera at all; "throttled, thirty minutes" is enough. |
| **`search_catalog` 233 ms** | **Not traceable — excluded.** The string `233` appears nowhere in the repo. The nearest committed raw line is `elapsed_ms: 469` (local judge image). `docs/FIELD-NOTES.md` J-row narrates **226 ms** for the live `standard-3` sandbox, but the committed `…-live-sandbox-standard-3.jsonl` contains only the `list` step — the `invoke` line was never written to it. Script uses **469 ms** with raw backing. *If someone re-runs the live-sandbox probe and commits the `invoke` line, swap in that number.* |
| **"seeded status replay ~800–1200 ms"** as a range | Replaced with the two exact measured runs — **799 ms** (githubstatus.com) and **1 184 ms** (www.vercel-status.com). No range is committed anywhere; a range would be a rounder, nicer number than the evidence. |
| **"~9 s"** cold plan | Replaced with the exact **9 019 ms** from the evidence screenshot. |
| Claude Code / Codex **dollar cost** | `cost_usd.mean` in `arm-agents.json` was destroyed by `Math.round`; only min/max and bounds survive. If cost is ever mentioned it must be a range from `docs/measurements/2026-08-29-ab.md` §"Correction". Cheaper to omit — and this script omits it. |
| Any **ChatGPT desktop** timing or tool-count | Unmeasured as of 2026-08-30 (blocked on Arav). See §3. |
| `312 ms` / `347 ms` / `640 ms` from the older shot lists | Superseded builder-mode/Mac numbers from `DEMO.md` and `COMPOSE-PLAN` §12. This video shoots the judge path, so it quotes the judge-path numbers instead. Not wrong — just not what this cut shows. |

---

## 7. Honesty lines that must survive the edit

Say these plainly rather than letting an edit imply otherwise:

- The compiled replay is **browserless** (546 ms wall / 79 ms on rokan-do's own clock — quote the
  wall number whenever comparing against an agent, because that is how the agents are timed).
- Consuming a site's **own** WebMCP tool re-drives a live browser (2 983 ms wall in the A/B) and the
  Allbirds beat is **builder mode / judge image**, not the live judge sandbox — caption it.
- The drift beat's refusal is Rokan's `recheck` (verified-or-refused). **Refusal, not recovery** —
  it does not find the new `$140`.
- N = 3 for the agent arms, high variance; the caption states N.
- WebMCP tool descriptions are hints to a cooperative agent, never a security boundary. Our boundary
  is the keyboard.
