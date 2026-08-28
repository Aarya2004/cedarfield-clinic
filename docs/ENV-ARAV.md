# Environment brief — Arav's Mac (for any Claude session working in this repo)

Verified 2026-08-28. Update when something changes; never guess.

## Machine / repo
- macOS Darwin 25.3.0, Apple Silicon. Repo `~/dev/webmcp-private` (`main`, GitHub `Aarya2004/webmcp-private`, private until Sep 1).
- Rokan engine at `~/dev/Rokan` (branch `feat/rokan-mcp-v1`, **uncommitted work in `packages/rokan-do` — never touch**; read via `graphify query`).
- Scratch: `/private/tmp/claude-501/-Users-aravkekane-dev-webmcp-private/<session>/scratchpad`. Never `/tmp`.

## Toolchain
- Node **25.9.0** (engines ≥ 20; CI Node 22). Built-in `WebSocket` + `fetch`. `.ts` tests: `node --experimental-strip-types --test`.
- pnpm **11.1.2**; `packageManager` pinned in root `package.json`; build scripts allowed via `allowBuilds` in `pnpm-workspace.yaml`. Never add `version:` to `pnpm/action-setup`.
- node-pty 1.1.0 — pnpm strips the exec bit from `prebuilds/darwin-arm64/spawn-helper`; bridge self-heals. After reinstall: `pnpm smoke`.
- cloudflared 2026.5.1 · wrangler 4.127.0 · vercel CLI 50.44.0 · `gh` · `graphify` (`graphify update .` after code changes).
- Chrome **152.0.7977.65** at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; headless + `--enable-features=WebMCP` exposes `document.modelContext` + CDP `WebMCP` domain. Claude Chrome extension connected. Headed flag: `chrome://flags/#enable-webmcp-testing`.
- ChatGPT.app installed; **plan tier unknown** — Sol/Terra availability is the open question.
- Anthropic key: Keychain `ANTHROPIC_API_KEY` (`security find-generic-password -l ANTHROPIC_API_KEY -w`). Never print; never commit.
- Local web server: `cd apps/web && pnpm build && pnpm start -p 3311` (kill: `lsof -ti :3311 | xargs kill`). Bridge test ports 7331/7332.

## Auth states (2026-08-28 03:00 PT)
Vercel CLI **not** logged in (`! vercel login`; team `team_zFUXxKJdD4R9mCPNEYCKVZhj`, hobby; Vercel MCP → 403 on project create). wrangler **not** logged in (`! wrangler login`). Cloudflare Claude plugin installed (`/reload-plugins`). GitHub push works.

## Gotchas (each cost time once — never again)
1. Bash tool cwd resets between calls → `cd /abs/path && …` in the same command.
2. Bash tool rejects raw ESC/bidi/control bytes → write such files with the Write tool using ``-style escapes.
3. Quick-tunnel hostnames NXDOMAIN ~12–25 s; local resolver negative-caches → resolve via DoH 1.1.1.1 (bridge does).
4. `next start` keeps the old build if the old process is bound → kill by port; confirm the chunk hash changed.
5. GitHub Actions floods the inbox → CI on code paths only, cancel-in-progress.
6. Vercel MCP `deploy_to_vercel` = 403 → CLI after login.
7. `vercel whoami` blocks on device flow when logged out → `spawnSync` with `timeout`.

## Only Arav can do
Logins (Vercel, wrangler, ChatGPT), plan tiers, spend caps, accounts, anything spending money, PLAN §0 edits, Netlify credits form (before Sep 1 12:00 PT). Ask once, in PROGRESS "Blocked on Arav".

## Operating loop
pull → build → verify (`pnpm gate`) → commit (conventional prefix, output in body) → push → PROGRESS (Now / Next / Done / In flight / Blocked) → `graphify update .` → next item in gate order → every 30 min: "does this demo well?". Reviewers (Opus 5 + Fable 5) write to `docs/reviews/` + PROGRESS "Review findings (open)"; P0s first.
