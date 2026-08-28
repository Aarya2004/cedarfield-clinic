# DEMO.md — the 2:40 video and the live-judge script (PLAN §8, forge-first order per §0.9)

## Pre-stage checklist (tick every line before recording; the April 23 rule)
- [ ] `pnpm gate` green on the commit being demoed; commit hash written here: `________`
- [ ] Vercel **production** alias opens in ChatGPT desktop (GPT-5.6 Sol/Terra) → Site tools arrow shows **6**
- [ ] Same URL in Chrome 152 + `chrome://flags/#enable-webmcp-testing`; DevTools → Application → WebMCP lists 6
- [ ] `npx rokan-terminal` from a **fresh clone**, pairing link opened, status bar `paired · zsh`
- [ ] Judge sandbox: "Try it now" → paired in < 15 s (measured chip visible)
- [ ] `rokan do "top 5 HN titles"` seeded (calls:0 on replay) — D3; if not seeded, the beat uses `seq`/`git log` honestly
- [ ] Share screen **off**; ledger empty; forged tools none; 1440×900; Dock hidden; second laptop mirrors
- [x] backup one keypress away: `docs/evidence/demo-backup.gif` (9 captioned frames from the automated real-PTY dry-run, 3 s each; open it in a browser tab, `F` for fullscreen). A camera-recorded `demo-backup.mp4` of the live run is still better — record it at rehearsal #3 (homebrew ffmpeg is currently broken on this Mac: missing `libxcb`; QuickTime screen recording works). Trigger written on a sticky note (below)

## Shot list (narration recorded separately; on-screen numbers are the measured ones)
| t | shot | say |
| --- | --- | --- |
| 0:00–0:20 | Terminal shows a command already run (`rokan do "top 5 HN titles"` or `git log --oneline -5`). Select the line → **Forge this** → card (`hn_top`, param `n`) → Approve → cut to ChatGPT's Site tools: **7** (was 6); DevTools WebMCP panel shows `forged_hn_top` appear | "I did this once. Now it's a tool — registered live, it didn't exist when the page loaded." |
| 0:20–0:35 | "top 3 now" → agent calls `forged_hn_top({n:3})` → ghost text at the prompt → Enter → output → ledger `invoked … executed exit 0 · N ms` | "The agent calls it. My Enter runs it. Every millisecond is measured by the page." |
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
`rokan do "top 5 HN titles"` is honest too — it is the model-call path (`calls:null`, needs the key) or an abstention; say which one you are showing.
