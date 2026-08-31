# DEMO.md — the 2:40 video and the live-judge script (PLAN §8, forge-first order per §0.9)

> **Historical — pre-pivot.** This document describes *Rokan Terminal*, which now lives at
> `/terminal` and is not the submitted product. The submission is **The Drop** — start at
> [`docs/README.md`](README.md).

## Pre-stage checklist (tick every line before recording; the April 23 rule)
- [ ] `pnpm gate` green on the commit being demoed; commit hash written here: `________`
- [ ] Vercel **production** alias opens in ChatGPT desktop (GPT-5.6 Sol/Terra) → Site tools arrow shows **7** (the seven fixed tools in `apps/web/src/lib/webmcp/schemas.ts` `FIXED_TOOL_NAMES`; FIELD-NOTES T3's "6" predates `terminal_history`)
- [ ] Same URL in Chrome 152 + `chrome://flags/#enable-webmcp-testing`; DevTools → Application → WebMCP lists 7
- [ ] `npx rokan-terminal` from a **fresh clone**, pairing link opened, status bar `paired · zsh`
- [ ] Judge sandbox: "Try it now" → paired in < 15 s (measured chip visible)
- [x] `rokan do` beats measured on the video path (FIELD-NOTES V5–V7): seeded site → `347ms ⚡` (0 calls); HN → real titles `2186ms` (1 model call, not seedable — R7). Say which one you are showing
- [ ] Share screen **off**; ledger empty; forged tools none; 1440×900; Dock hidden; second laptop mirrors
- [x] backup one keypress away: `docs/evidence/demo-backup.gif` (9 captioned frames from the automated real-PTY dry-run, 3 s each; open it in a browser tab, `F` for fullscreen). A camera-recorded `demo-backup.mp4` of the live run is still better — record it at rehearsal #3 (homebrew ffmpeg is currently broken on this Mac: missing `libxcb`; QuickTime screen recording works). Trigger written on a sticky note (below)

## Shot list (narration recorded separately; on-screen numbers are the measured ones)
| t | shot | say |
| --- | --- | --- |
| 0:00–0:20 | Terminal shows a command already run (`rokan do "what is the current status at githubstatus.com"` or `git log --oneline -5`). Select the line → **Forge this** → card (`status_of`, one param **`site`**, example `githubstatus.com` — the shape in `App.tsx:135-139`) → Approve → cut to ChatGPT's Site tools: **8** (was 7); DevTools WebMCP panel shows `forged_status_of` appear | "I did this once. Now it's a tool — registered live, it didn't exist when the page loaded." |
| 0:20–0:35 | "now check Vercel" → agent calls `forged_status_of({site:"www.vercel-status.com"})` → ghost text `rokan do "what is the current status at www.vercel-status.com"` at the prompt → Enter → output → ledger `invoked … executed exit 0 · N ms` | "The agent calls it with a different site. My Enter runs it. Every millisecond is measured by the page." |
| 0:35–0:55 | "what's in this repo, are the tests passing?" → `ls` ghost → Enter → `pytest -q` ghost → Enter → agent reads the screen → answer | "Every command it wants is a proposal. It can't type Enter." |
| 0:55–1:10 | Share screen off → `{shared:false}`; on → `export AWS_SECRET_ACCESS_KEY=…` on screen → agent sees `[redacted]` | "It reads what I let it read. Secrets never leave the tab." |
| 1:10–1:40 | `rokan do …` beat (D3) or the judge sandbox beat: open the live URL on the second laptop → "Try it now" → paired in N s | "Nothing to install. A throttled sandbox on Cloudflare, 30 minutes, one per IP." |
| 1:40–2:05 | Agent-initiated birth: three approved commands → agent calls `forge_create` → card `deploy` (kind write, CONSEQUENTIAL) → Approve → invoke → Enter | "It forged its own workflow after I approved it three times. Writes are marked. Still my Enter." |
| 2:05–2:25 | Recovery: forged tool exits non-zero → `prior_step_failed` → agent reads the redacted tail → proposes the fix → Enter | "When it breaks, it reads, proposes, and I decide." |
| 2:25–2:40 | Ledger scroll: registered / proposed / executed / forged / invoked with ms; `countersigned by bridge N/N`; export | "Every tool, who made it, who called it, what it cost. Do it once. Now it's a tool." |

## Backup trigger (say it plainly on camera if live)
Switch to `demo-backup.mp4` if: pairing not green in 10 s · any tool call not visible in ChatGPT within 15 s · Site tools count does not change after Approve within 5 s (then show DevTools' panel instead and say so).

## Rehearsal log (5 runs with a stopwatch before recording)
| run | date/time PT | total | failed beat | fix |
| --- | --- | --- | --- | --- |
| 0 (automated) | 2026-08-28 17:10 | 47 harness steps, 0 failed, real PTY | none | `evals/cases/terminal-demo-dryrun.json` → `docs/evidence/demo/beat*.png` (every §8 beat except ChatGPT's own UI) |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

## Seeded `rokan do` beat — use a seeded question (measured 2026-08-28, FIELD-NOTES R2–R4)

Hacker News is **not** in rokan-do's seed pack. For the `calls:0 ⚡` beat type one of the seeded questions verbatim, e.g.
`rokan do "what is the current status at githubstatus.com"` or
`rokan do "what is the latest version of pydantic at pypi.org/project/pydantic"` (312 ms replay measured for the docs.github.com seed).
For the **model-call** contrast beat pick a site that is *not* in the pack — `rokan-seed-ops.json` holds 52 ops over 49 hosts and `example.org` is not one of them — e.g. `rokan do "what is the main heading at example.org"`: that is the planning path (`calls:null`, needs the key) or an honest abstention without one. `githubstatus.com` is **seeded**, so it replays at ⚡ `calls:0` and is the wrong command for that beat. Say which of the two you are showing.

## Freeze rule — judge Worker

A `wrangler deploy` of `infra/sandbox` replaces the container fleet and drops every live judge session (measured 2026-08-28). No Worker deploys from the Sun 08-31 evening freeze (submit Mon 09-01 end of day) until results. Web-only redeploys (Vercel) are safe for judge sessions.

## Demo shell: the key for the `rokan do` model beat (builder mode only)

The live key is Keychain service `rokan-anthropic-key` (account `rokan`); the `ANTHROPIC_API_KEY` Keychain entry is dead (401). Before starting the bridge in the demo shell:

```
export ANTHROPIC_API_KEY="$(security find-generic-password -s rokan-anthropic-key -a rokan -w)"
node packages/bridge/bin/rokan-terminal.js
```

The PTY inherits the env, so an **unseeded** question plans (1 model call) — e.g. `rokan do "what is the main heading at example.org"`, since `example.org` is absent from `infra/sandbox/container/seed/rokan-seed-ops.json` — while the seeded questions (`githubstatus.com`, `www.vercel-status.com`, … 49 hosts) replay at ⚡ `calls:0` with no key needed. Never in the judge container (no key by design).

## v3 — the two measured beats to add to the cut (COMPOSE thesis; numbers from `docs/measurements/2026-08-29-ab.md`)

These are the Impact beats §15 #2/#3 asks for. On-screen numbers are the measured ones — never a rounder,
nicer number. Shoot both in builder mode (the beats need the model/browser the judge sandbox lacks; say so).

| slot | shot | on-screen (measured) | narration |
|---|---|---|---|
| **thesis, first 10 s** | Split screen: left = a forged/compiled tool being called; right = the ledger row landing `⚡ 0 calls`. No terminal chrome yet — just the tool answering instantly. | whatever the ledger row actually shows (`calls:0 … ms ⚡`; rokan-do's internal clock read 79 ms in the A/B) | "A thing I did once, now answered with the model out of the loop — zero calls." |
| **Impact (D2)** | Same live question three ways, **one stopwatch discipline for all three** — wall clock around the whole command. Cut the wait times side by side. | Rokan `0 calls · 546 ms` · Codex `23 164 ms` · Claude Code `15 780 ms` (compiled task, wall means). Caption: "N=5 warm / N=3 agents; they re-plan every run." | "The agents re-enter the model every single run. Rokan replays — 29 to 42 times faster end to end, at zero calls, and it stays free every time after." |
| **drift refusal** | A storefront 'redesigns' (v1→v2). The cached script still runs and prints a price; Rokan re-checks and retires the op. | Cached script: `{"answer":"$75","refused":false}` (wrong; true price `$140`) with no warning · `recheck`: `DEAD   127.0.0.1:8099   Wander Boot   replayed 0 ms · drift_detected` then `0 alive · 1 dead` · re-ask: `status:error · verification:refused · answer:null`. Verbatim from `docs/evidence/ab/drift-run-1.txt`. | "A cached scrape lies quietly. Rokan verifies, and when the page drifts it refuses out loud — dead op, refused answer, no guess." |

**Honesty on camera (say these, don't hide them):** the compiled replay is browserless (546 ms wall, 79 ms on
rokan-do's own clock — quote the wall number whenever you compare against an agent, because that is how the
agents are timed); consuming a site's *own* WebMCP tool re-drives a live browser (2983 ms wall) and is
builder-mode only; the drift 'refuse' is Rokan's `recheck` (verified-or-refused), and the naive-script-lies
half is the reproduced failure mode. Every number traces to `docs/evidence/ab/arm-c.json`,
`docs/evidence/ab/arm-agents.json` and `docs/measurements/2026-08-29-ab.md`.
