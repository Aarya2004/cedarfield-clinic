# FORGE-PLAN — complete specification and build plan (approved by Arav 2026-08-28 03:30 PT)

Status: plan for approval. Scope discipline = Handset (PLAN §11): everything below is required for
the hero shot in §8 or for a scored criterion; nothing else. Every external fact cites where it was
verified. "Measured" = produced by our code on this machine (FIELD-NOTES). "Unverified" = must be
measured before it is relied on.

---

## 0. Context — why this, why now

- PLAN §0.9 (decided 2026-08-28 02:30 PT): **forge leads; terminal is the vehicle.** Hero shot = a
  WebMCP tool born at runtime from something the human did, then called by the agent. Gate C is
  decoupled from Gate B: forge must demo on the prompt-line page with **no PTY** by **Sat 08-29
  22:00 PT** with headless-Chrome evidence, and on the live terminal by Sun 08-30 22:00 PT.
- Field (RESEARCH §6b, day 4, ±5pp): ~48% of live entries = "agent proposes, human approves";
  nearly all register a fixed tool list at load. Runtime registration of a **user-made** tool is
  the one shot no one else has. Retrofit lane is contested (★15, ★12 repos) — stays out (§0.1).
- **Lane (Arav, 03:10 PT): C builds everything — nothing is left for Aarya.** Engine, card UI,
  "Forge this", ghost-text overlay, xterm + WS client, adapter, sandbox, evals, docs. Aarya joins
  by reading PROGRESS and taking the *next unstarted* item there — never a stale one. To make that
  conflict-free: every push updates PROGRESS "Now / Next / Done" with commit hashes; work is done
  in small commits on `main`; a file being actively edited by C is listed under "In flight".
- **Continuous sprint rule (Arav):** finishing a feature is not a stopping point. After forge is
  verified at every level (§7), C immediately writes the **terminal plan** in this same style (in
  chat), then executes it, then the next (§15). Stop only for a decision only Arav can make.
- What exists and is reused (all measured green tonight): `register.ts` (4 `terminal_*` tools),
  `proposals.ts` (ghost-text store + `wait`), `adapter.ts` (`TerminalAdapter` seam), `ledger.ts`
  (HMAC chain), `redact.ts`, `schemas.ts` (`validateProposedCommand`, `isDangerous`,
  `OUTPUT_BUDGET_CHARS`), `fieldnotes.ts`, `evals/harness/webmcp-cdp.mjs`, `packages/bridge`.

---

## 1. The hackathon truth this must satisfy (RESEARCH §5, Devpost rules read 2026-08-28)

**Must-submit (all four; forge touches each):**
1. Live URL working in ChatGPT desktop built-in browser **or** Chrome 149+ with WebMCP enabled.
2. Text: why WebMCP fits · how UX improves · what humans + agents accomplish together that was
   difficult/impossible before · implementation approach. Forge is the answer to bullet 3.
3. Video < 3:00, public YouTube, audio. §8 cold open = forge birth (0:00–0:35).
4. Public repo, OSS license visible in About, demonstrable `document.modelContext.registerTool()`
   with name/description/inputSchema/execute. Forge = many such calls, at runtime.

**Judging (Stage 2, 4 × 25%) → what forge must visibly deliver:**
| criterion | forge evidence the judge must be able to see in ≤ 60 s |
| --- | --- |
| **WebMCP Leverage** (tiebreak #1) — thorough, skillful, non-trivial, working | dynamic `registerTool` with per-tool `AbortSignal` unregistration, `toolchange`, annotations (`readOnlyHint` from `kind`), `additionalProperties:false` schemas, ≤ 12 visible with pin/evict, `forge_list` introspection, DevTools WebMCP panel filling up live |
| **Execution** (tiebreak #2) — complete product, not PoC | card with edit/approve/reject/pin; stats (`runs`, `median_ms`, `last_exit`) measured; ledger rows for every birth/call; errors are typed and shown; nothing crashes when WebMCP is absent |
| **Potential Impact** | developers whose ChatGPT/Codex needs to act on their machine (Provencher: "Codex is your customer"); the library grows as they work |
| **Creativity & Ambition** | the tool did not exist at page load; the human taught it by doing; second birth is agent-initiated after three approvals (§8 1:40) |

**Judge lenses to honour explicitly (RESEARCH §5):** Nahas — read / navigation / write taxonomy,
human-approved writes, **hash tools**, scope trust with a TTL → `kind`, `CONSEQUENTIAL:` prefix,
content hash on the card and in every ledger row, session-scoped registration (tools vanish when
the tab closes — that *is* the TTL). Drasner — observability → DevTools panel shot + ledger.
Roberts — recover → §8 2:05 recovery beat needs `exit_code` per step. Gao — `evals/` folder +
`AGENTS.md`. Rushing — "Codex does this" → forged tools are portable WebMCP, any machine.

**Rules we must not break:** no tool executes (§0.3); imperative, top-level, ≤ 12 tools (§0.4);
honest numbers (§0.6); WebMCP-touching code public; timestamped commits after 08-25 (all ours).

---

## 2. Product specification — Forge (feature level)

### 2.1 Vocabulary
- **Spec**: `{name, description, commands[1..5], params[0..6], kind}` — what a forged tool is.
- **Card**: a pending spec awaiting the human (edit → Approve / Reject). One card visible at a
  time; others queue FIFO (max 5 pending; 6th `forge_create` → `{error:'too_many_pending'}`).
- **Forged tool**: an approved spec registered as WebMCP tool `forged_<name>`.
- **Visible**: currently registered (≤ 5 forged visible; 6 fixed + 5 = 11 ≤ the §0.4 cap of 12; `sandbox_status` was never built).
- **Pinned**: exempt from eviction. **Evicted**: unregistered by budget, still listed, restorable.
- **Hash**: 12-hex prefix of SHA-256 over canonical `{name, description, params, commands, kind}`.
- **Invocation**: one call of a forged tool → 1..5 sequential proposals (steps).

### 2.2 Two ways a tool is born
1. **Agent-initiated** — `forge_create` tool → card prefilled → human edits/approves → registered.
2. **Human-initiated** ("Forge this") — select 1–5 history lines → card prefilled from selection
   → same approve path. **UI is Aarya's (D2)**; the engine exposes `forge.openCard(spec, {origin:'human'})` so it costs him one call.

### 2.3 Card behaviour (engine-side rules the UI must obey)
- Fields editable: `name`, `description`, each command, each param (`name`, `description`,
  `example`), `kind`. Re-validated on Approve with the same validators as `forge_create`.
- Placeholders `{{param}}` are highlighted; a placeholder with no param, or a param with no
  placeholder, blocks Approve with a message.
- `kind` defaults: `write` when any command matches `isDangerous` **or**
  `/\b(rm|mv|dd|mkfs|git\s+push|deploy|publish|kill|chmod|chown|curl\s+-X\s*(POST|PUT|DELETE))\b/`
  (agent-declared `kind:'read'` is overridden to `write` + card shows why). Human may flip back.
- Dangerous commands (`isDangerous`) → red banner on the card; Approve needs a second click
  ("Approve anyway") — same double-confirm rule as proposals (PLAN §4).
- Re-forge of an existing name → card shows `old hash → new hash`; Approve replaces the tool.
- Shows: hash (12 hex), the exact WebMCP name `forged_<name>`, the JSON schema preview, and the
  sentence "The agent can call this. Each command still needs your Enter."
- Approve when 5 visible and none unpinned → `{error:'unpin_one'}`; UI shows which to unpin.

### 2.4 Forged tool behaviour when the agent calls it
- Params → substituted (§4.3) → step 1 ghost-typed with why = `forged_<name> · step 1/N`;
  steps 2..N pre-minted as `queued` proposals (visible in the ledger as queued) and promoted one at
  a time after the prior step is **executed** (real terminal: after the command exits; Gate A page:
  at Enter). Dismiss (Esc) on any step dismisses the rest (`reason:'dismissed_by_human'`);
  non-zero exit on a step dismisses the rest (`reason:'prior_step_failed'`) — `&&` semantics.
- One active invocation at a time across all forged tools; a second call returns
  `{status:'busy', active_invocation_id, proposal_ids}` — ghost texts never stack.
- The agent follows with `terminal_wait(proposal_id)` per step; `terminal_wait` on an executed
  step returns `next_proposal_id` so the agent can chain without guessing.
- Every step's `exit_code`/`ms` (from bridge `status` frames via the adapter) lands in the ledger
  and in the tool's stats.

### 2.5 Tools pane (UI, Aarya; placeholder by C tonight)
- "Site tools · N" where N = fixed + visible forged (measured from engine state, not hard-coded).
- "Tools registered this session: K" (count of `registered`+`forged` ledger rows) — §13 add.
- Forged list: name, kind badge, hash, pin toggle, runs / median ms / last exit, Unforge, Restore.

### 2.6 Limits (numbers; all enforced in code, all in `schemas.ts`)
| limit | value | source |
| --- | --- | --- |
| tool name | `^[a-z][a-z0-9_]{1,28}$` → `forged_` + name ≤ 35 chars (spec allows 128; Chrome guide says ≤ 30 for *readability* — we accept up to 35 because the prefix is ours) | PLAN §3, RESEARCH §1 |
| description | ≤ 300 chars user text; final ≤ 500 incl. suffix | Chrome secure-tools guide |
| commands | 1–5, each `validateProposedCommand` (≤ 400, no CR/LF/C0/C1/Cf) | PLAN §3/§4 |
| params | 0–6, name `^[a-z][a-z0-9_]{0,19}$`, description ≤ 150, example ≤ 80 | Chrome guide (param desc ≤ 150) |
| param value at call | string/number/boolean → string ≤ 200 | memo §1 |
| visible forged | 5 (12 total) | §0.4 |
| pending cards | 5 | new |
| output per tool | ≤ 1 500 chars (`OUTPUT_BUDGET_CHARS`) | Chrome guide |
| queue step wait | 10 min per step, then `dismissed {reason:'step_timeout'}` | new |
| stats window | last 50 runs per tool | new |

---

## 3. WebMCP contracts — exact (`schemas.ts`, `contract:` commit)

### 3.1 `forge_create`
- `annotations: { readOnlyHint: false }`
- description (exact): `Propose a new, named tool built from 1–5 shell commands the human has run or will approve. Opens a Forge card the human must review and approve before anything registers; nothing runs. Use {{param}} placeholders in commands and declare each param. kind is "read" if the commands only observe, else "write". Returns a card_id; the tool appears as forged_<name> only after approval.`
- inputSchema:
```json
{"type":"object","properties":{
 "name":{"type":"string","pattern":"^[a-z][a-z0-9_]{1,28}$","description":"Tool name; becomes forged_<name>."},
 "description":{"type":"string","maxLength":300,"description":"What the tool does, for the agent that will call it."},
 "commands":{"type":"array","minItems":1,"maxItems":5,"items":{"type":"string","maxLength":400},"description":"Shell command lines, run in order, each needing the human's Enter. Use {{param}} placeholders."},
 "params":{"type":"array","maxItems":6,"items":{"type":"object","properties":{
   "name":{"type":"string","pattern":"^[a-z][a-z0-9_]{0,19}$"},
   "description":{"type":"string","maxLength":150},
   "example":{"type":"string","maxLength":80}},
   "required":["name","description","example"],"additionalProperties":false}},
 "kind":{"type":"string","enum":["read","write"],"description":"read = only observes; write = changes state (marked CONSEQUENTIAL)."}},
 "required":["name","description","commands","kind"],"additionalProperties":false}
```
- result: `{card_id, status:'awaiting_human', will_register_as:'forged_<name>', hash}` or
  `{error: 'invalid_name'|'invalid_command'|'unknown_placeholder'|'unused_param'|'too_many_pending', detail}`.

### 3.2 `forged_<name>` (dynamic)
- `annotations: { readOnlyHint: kind === 'read' }`
- description: `(kind==='write' ? 'CONSEQUENTIAL: ' : '') + spec.description + ' Ghost-types ' + N + ' command(s) into the human\'s terminal; each runs only when the human presses Enter. Then call terminal_wait with the returned proposal id.'` (truncate user part so total ≤ 500).
- inputSchema: `{type:'object', properties:{ [p.name]: {type:'string', description: p.description, examples:[p.example]} }, required:[all param names], additionalProperties:false}`.
- result: `{invocation_id, proposal_ids:[id1..idN], active:id1, queued:N-1, hash}` ·
  `{status:'busy', active_invocation_id, proposal_ids}` · `{error:'invalid_param', param, reason}` ·
  `{error:'unregistered'}` (closure outlives abort).

### 3.3 `forge_list`
- `annotations: { readOnlyHint: true }`; input `{}`.
- description: `List every forged tool (visible or evicted) with its hash, kind, params, pin state and measured stats: runs, median_ms, last_exit. Visible tools are callable as forged_<name>.`
- result: `{visible: n, budget: 5, tools:[{name, tool:'forged_'+name, kind, hash, pinned, visible, params:[{name,description}], runs, median_ms, last_exit, forged_at}]}` trimmed to the output budget (drop `params` first, then oldest evicted entries; set `truncated:true`).

### 3.4 `terminal_wait` — contract additions (same file, same commit)
- `{status:'unknown_proposal'}` when the id was never issued (fix memo §5 #4).
- On `executed` of a queued step: `next_proposal_id` (or `null` when last) and `invocation_id`.
- On `dismissed`: `reason` ∈ `dismissed_by_human | prior_step_failed | step_timeout`.

### 3.5 Registration order and budget
Fixed 7 (`terminal_propose`, `terminal_read_screen`, `terminal_status`, `terminal_wait`,
`forge_create`, `forge_list`, **reserved slot for judge-mode `sandbox_status` on D2**) + ≤ 5 forged
= 12. (If the reserve is unused, still cap forged at 5 — the picker-noise argument in §0.4.)

---

## 4. Engine technical specification — `apps/web/src/lib/webmcp/forge.ts` (C's lane)

### 4.1 Types (exported)
```ts
type ForgeKind = 'read' | 'write';
interface ForgeParam { name: string; description: string; example: string }
interface ForgeSpec { name: string; description: string; commands: string[]; params: ForgeParam[]; kind: ForgeKind }
interface ForgeCard { card_id: string; spec: ForgeSpec; origin: 'agent'|'human'; dangerous: boolean; kindOverridden: boolean; previousHash?: string; createdAt: number }
interface ForgedTool { name: string; spec: ForgeSpec; hash: string; ac: AbortController | null; pinned: boolean; forgedAt: number; runs: RunStat[] }
interface RunStat { t: string; invocation_id: string; step: number; exit_code: number|null; ms: number|null }
interface Invocation { invocation_id: string; tool: string; hash: string; proposal_ids: string[]; activeIndex: number; ac: AbortController; startedAt: number }
type ForgeError = { error: string; detail?: string; param?: string }
```
### 4.2 State + API (singleton `forge`, `useSyncExternalStore`-compatible like `proposals`)
- `cards(): ForgeCard[]`, `tools(): ForgedTool[]`, `active(): Invocation|null`, `subscribe(fn)`.
- `openCard(spec, {origin}) : ForgeCard | ForgeError` — validates (§4.4), computes `dangerous`,
  applies kind default (§2.3), sets `previousHash` if name exists, ledger `forge_requested`.
- `approve(card_id, edited?: Partial<ForgeSpec>, {confirmDangerous?: boolean}) : Promise<ForgedTool | ForgeError>`
  — merge + re-validate; `dangerous && !confirmDangerous` → `{error:'needs_confirmation'}`;
  budget check → `{error:'unpin_one'}`; `register(spec)`; remove card; ledger `forged`.
- `reject(card_id)` → ledger `forge_rejected`.
- `pin(name, bool)`, `unforge(name)` (abort + delete + ledger `unregistered {reason:'unforged'}`),
  `restore(name)` (re-register same hash; no re-approval; budget applies).
- `invoke(name, input): Promise<result>` — used by the registered `execute` and by tests.
- `dispose()` — aborts every controller (tools + invocations); called by the component unmount
  path alongside the fixed tools' disposer.

### 4.3 Substitution + quoting (pure, in `schemas.ts` so both lanes share it)
- Grammar: `{{name}}` only (`/\{\{\s*([a-z][a-z0-9_]{0,19})\s*\}\}/g`). Validation at forge time:
  every placeholder declared; every param used at least once. A placeholder **inside** author
  quotes is allowed and substituted context-aware (what the code does — `substituteLine`): outside
  quotes → bare when clean, else `'…'`; inside `'…'` → the region is closed, the value inserted
  single-quoted, the region reopened; inside `"…"` → same close/insert/reopen so `$(…)` in a value
  never expands; `$'…'` / `$"…"` templates are rejected at forge time (`invalid_command`). The old
  `placeholder_in_quotes` rejection was dropped in favour of this (Fable pass-1 P2).
- Value coercion at call: `string | finite number | boolean` → `String(v)`; else `invalid_param`;
  ≤ 200 chars; `validateProposedCommand(v)` must pass (kills CR/LF/ESC/bidi).
- Rendering: bare if `/^[A-Za-z0-9_./:@%+=,-]{1,80}$/`, else POSIX single-quote:
  `"'" + v.replace(/'/g, "'\\''") + "'"`. Neutralises `; | & $ \` * ? ~ # ! < > ( ) { }` and
  whitespace in sh/bash/zsh (documented: POSIX shells only; PowerShell out of scope).
- Final line: `validateProposedCommand` again (≤ 400) → else `invalid_param {reason:'too_long'}`;
  `isDangerous(line)` → proposal flagged `dangerous:true` (overlay red banner, double Enter).
- Known non-goal, stated in SECURITY.md: option injection (`dir="-rf"` stays `-rf`). The keyboard
  is the boundary; the overlay colours substituted spans so the human sees them.
- Forge-time dry run: substitute every command with each param's `example`; must validate — a
  card can never approve a spec that cannot produce a valid proposal.

### 4.4 Validation (`validateForgeSpec(spec): ForgeError | null`)
name regex · description 1–300 · commands 1–5 each `validateProposedCommand` · params ≤ 6, unique
names, regex, description ≤ 150, example ≤ 80 · placeholder rules (§4.3) · kind enum.

### 4.5 Hash
`contentHash(spec)` = SHA-256 (WebCrypto `crypto.subtle.digest`) over
`JSON.stringify({name, description, params:[{name,description,example}…], commands, kind})` with
sorted keys; 12-hex prefix. Included in: card, `forge_create` result, `forged_*` results,
`forge_list`, ledger rows `forged`/`invoked`/`executed`. A different hash for the same name = new
approval required (`previousHash` on the card).

### 4.6 Registration
```ts
async register(spec): { const old = tools.get(spec.name); old?.ac?.abort();  // never reuse an aborted AC
  const ac = new AbortController(); const t0 = performance.now();
  await mc.registerTool({ name:'forged_'+spec.name, description, inputSchema, annotations, execute: (input, options?) => this.invoke(spec.name, coerceInput(input)) }, { signal: ac.signal });
  note('forge.registered', { ms: round(performance.now()-t0), name }); }
```
- `coerceInput`: `typeof input === 'string' ? JSON.parse(input) : input ?? {}` (FIELD-NOTES #6).
- `execute` guard: `if (tool.ac?.signal.aborted) return {error:'unregistered'}`.
- Budget: after register, while `visible > 5`: evict oldest `forgedAt` with `pinned:false`
  (abort, `ac = null`, ledger `unregistered {reason:'evicted'}`, `note('forge.evicted')`).
- `toolchange` is the browser's; we additionally `note('forge.toolchange', …)` from an
  `ontoolchange` listener installed once in `register.ts` (evidence for the DevTools/ChatGPT beat).
- **Unverified, measure first (harness step):** Chrome 152 emits `WebMCP.toolsRemoved` on abort;
  Chrome's behaviour on duplicate names without abort (we always abort first, so moot).

### 4.7 Invocation queue
- Pre-mint: `proposals.propose(cmd_i, why_i, {queued: i>0, invocation_id, step:i, dangerous})` for
  all steps; step 0 is `awaiting_human` (ghost-typed via `adapter.ghostType`), others `queued`.
- Runner (async, owns `Invocation.ac`): loop `p = await adapter.waitProposal(id_i, 600_000, ac.signal)`;
  `null` → `step_timeout` → dismiss rest; `dismissed` → dismiss rest (`dismissed_by_human`);
  `accepted` → ledger `executed {tool, invocation_id, step, exit_code, ms}` + push `RunStat`;
  if `exit_code` is a number ≠ 0 → dismiss rest (`prior_step_failed`); else `proposals.promote(id_{i+1})`
  + `adapter.ghostType` for it (the adapter's `ghostType` must accept an existing id — add
  `ghostTypeExisting(id)` to `TerminalAdapter`, default implementation = `proposals.promote`).
- Real terminal semantics: the adapter resolves `accepted` **after the command exits** (from the
  bridge `status` frame) so step k+1 never types over streaming output; Gate A adapter resolves
  at Enter with `exit_code: null`.
- `terminal_propose` during an active invocation is unguarded today → engine exposes
  `forge.active()`; `terminal_propose` returns `{error:'busy', active_invocation_id}` while a
  queue is active (one-line change in `register.ts`).

### 4.8 Stats
`runs` = count of `invoked` for the tool; `median_ms` over `RunStat.ms` non-null of the **last
step** per invocation (the human-visible "how long did the tool take"), `last_exit` = last step's
exit code; `measured:false` when all null (Gate A adapter). Window: last 50.

### 4.9 Ledger rows (client `ledger.ts` kinds extended; all forwarded to the bridge when paired)
`forge_requested {card_id, name, origin, dangerous}` · `forge_rejected {card_id}` ·
`forged {name, hash, kind, commands, params, previous_hash}` · `invoked {tool, hash, invocation_id, steps}` ·
`executed {tool, invocation_id, step, exit_code, ms}` · `dismissed {invocation_id, step, reason}` ·
`unregistered {name, hash, reason: evicted|unforged}` · `restored {name, hash}` · `pinned {name, pinned}`.
Bridge `protocol.js` `ledger` frame already accepts any `kind` (no bridge change).

### 4.10 Field notes emitted (measured)
`forge.registered {ms}` · `forge.evicted {age_ms}` · `forge.toolchange {visible}` ·
`forged.invoked {steps, substitution_ms}` · `forged.busy` · `forge.approve_latency_ms` (card open →
approve, human decision time).

### 4.11 `proposals.ts` changes (C's file)
`status` gains `'queued'`; `propose(cmd, why, opts?: {queued?, invocation_id?, step?, dangerous?})`;
`promote(id)` (`queued → awaiting_human`, sets `proposedAt`); `has(id)`; `wait` treats `queued` as
pending; `pending()` ignores `queued`; `resolve` accepts a `reason`. Existing Gate A key handler
keeps resolving the newest `awaiting_human` — there is exactly one at a time by construction.

### 4.12 Test hooks — `apps/web/src/lib/webmcp/testhooks.ts`
Installed only when `location.search` has `test=1` **or** `location.hash` has `hooks=1` **or**
`localStorage['rokan.test']==='1'`. Ships in prod (same-origin JS already has this power; the
keyboard is the boundary) — judges never see it; harness runs against the prod alias (§7 golden
rule). Shape (all returns JSON-serialisable):
```ts
window.__rokan = { forge: { cards(), approve(card_id, edits?, confirmDangerous?), reject(card_id), list(), pin(name, bool), unforge(name), restore(name), active() },
                   proposals: { pending(), all(), resolve(id, 'accepted'|'dismissed') },
                   ledger: () => ledger.export(), share: (on: boolean) => void }
```

### 4.13 `register.ts` changes
Register `forge_create` + `forge_list` after the four fixed tools (same AbortController);
`terminal_wait`: `unknown_proposal`, `next_proposal_id`, `invocation_id`, `reason`;
`terminal_propose`: `busy` while an invocation is active; install `ontoolchange` note; export
`FIXED_TOOL_NAMES` (6) and `MAX_VISIBLE_TOOLS = 12`.

### 4.14 Placeholder UI (in `TerminalTools.tsx`, C tonight, announced; Aarya replaces)
Forge card (fields read-only except Approve/Reject/"Approve anyway"; shows hash, dangerous banner,
kind badge, `forged_<name>`), Forged tools list (pin, unforge, restore, stats), Tools pane counts
("Site tools · N", "registered this session: K"), a Share-screen checkbox (drives
`gateAAdapter.shareScreen`) so `read_screen` can be demoed ON with the Gate A "screen" = the ledger
text. Rokan palette, no new deps.

---

## 5. External software and services — what we depend on, exactly

| component | version / setting | role | verified how | failure → action |
| --- | --- | --- | --- | --- |
| **ChatGPT desktop** (built-in browser, Site tools) | needs **GPT-5.6 Sol or Terra**; Luna has site tools off; Enterprise/Edu excluded; declarative + iframe ignored; per-call safety review | primary consumer; the judge's browser | RESEARCH §2, learn.chatgpt.com/docs/webmcp | Free tier may lack Sol/Terra (**unverified — Arav checks the model picker**) → Plus/Pro tonight or kill rule §10.1 (Chrome primary). **Unverified:** Site tools list refresh on `toolchange` without reload → measure first hour; if no, hero shot uses DevTools panel + reload, stated honestly |
| **Chrome 152.0.7977.65** (this Mac) + `--enable-features=WebMCP` / `chrome://flags/#enable-webmcp-testing` | test bench + secondary consumer; DevTools → Application → WebMCP panel; CDP `WebMCP` domain | measured tonight (FIELD-NOTES) | `navigator.modelContext` gone in 152 (measured) — feature-detect both |
| Model Context Tool Inspector (Chrome extension, drives `gemini-3-flash-preview`) | optional third consumer for a screenshot | RESEARCH §2 | skip if > 30 min |
| `GoogleChromeLabs/webmcp-tools/evals-cli` | Gao reads `evals/`; ordered/unordered expected-call assertions | RESEARCH §3/§9 | our CDP harness is the working substitute; add evals-cli cases only if it installs in < 30 min (D3) |
| **WebMCP spec 2026-08-26** | `registerTool(tool, {signal})`, `getTools`, `executeTool(tool, string)`, `ontoolchange`, annotations `{readOnlyHint, untrustedContentHint}`; no `unregisterTool` — abort the signal | RESEARCH §1 | `execute(input)` gets **no options** in Chrome 152; `executeTool` needs a **string** (measured) |
| **Next.js 15.5.24**, React 19.1, TypeScript 5 strict, Tailwind 4 | client | built tonight | — |
| **Vercel** (team `medportgeneral-7293s-projects`, hobby) | live URL | CLI **not logged in** (device flow pending) | `! vercel login` → `vercel link --project rokan-terminal` → `vercel --prod`; Root Directory `apps/web` |
| **cloudflared 2026.5.1** quick tunnel | builder mode WS transport | measured: WS upgrade OK, DNS ~12–18 s via DoH | negative-DNS trap handled in bridge |
| **Cloudflare Workers Paid + `@cloudflare/sandbox`**, wrangler 4.127.0 | judge mode (D2) | wrangler **not logged in** | `! wrangler login`; Cloudflare plugin installed → `/reload-plugins` |
| **node-pty 1.1.0**, **ws 8**, Node 25 (engines ≥ 20) | bridge | smoke 14/14 | pnpm strips exec bit on `spawn-helper` — self-healed at startup |
| **xterm.js** (+fit, +webgl) | terminal UI (Aarya) | — | webgl fallback to canvas |
| **WebCrypto** (`crypto.subtle`) | hashes + HMAC | tests pass in Node 25 + browser | secure context only (https/localhost) — fine |
| **DoH 1.1.1.1** | tunnel DNS readiness | measured | — |
| **rokan-do** wheels + `SKILL.md` + seeded ops (`~/dev/Rokan`, side branch; uncommitted work present — do not touch) | the star command to forge (D3) | — | kill rule §10.4: demo never depends on it |
| **Anthropic API key** (Keychain `ANTHROPIC_API_KEY`) | not wired into the judge sandbox (by design: seeds replay only, nothing can spend) | present in Keychain | spend cap to be set (Worker secret) |
| GitHub Actions CI | typecheck/lint/build/bridge check on code paths | fixed tonight | path-filtered, cancel-in-progress |

---

## 6. Security specification for forge (extends PLAN §4; goes into `docs/SECURITY.md`)

| threat | mitigation (code) |
| --- | --- |
| Injected text in `terminal_read_screen` output tells the agent to forge `rm -rf` as `kind:'read'` | `forge_create` never registers — a card + human approval; `kind` auto-overridden to `write` on dangerous/mutating verbs; `isDangerous` → red banner + second confirmation; every forged step still needs Enter |
| Param value smuggles shell metacharacters / newlines / bidi into a ghost-typed line | §4.3: control/format chars rejected, POSIX single-quoting for anything non-bare, re-validation of the final line, `{{}}` inside quotes substituted context-aware (never expanded), `$'…'`/`$"…"` templates rejected at forge time, overlay highlights substituted spans |
| Tool framing / hijack (arXiv 2606.06387): a re-forge silently softens a description or flips read→write | content hash covers name+description+params+commands+kind; changed hash → new approval; hash on card and in every ledger row |
| Registration races / AbortSignal abuse | one controller per tool, aborted before any re-register; `execute` guarded by `signal.aborted`; `dispose()` aborts all |
| Runaway tool count / picker noise | 12-cap with pin/evict; `forge_list` still lists evicted |
| Agent floods cards | ≤ 5 pending, one visible; `too_many_pending` |
| Two ghost texts at once (Enter misrouted) | one active invocation; `terminal_propose` busy while queue active |
| Agent-declared `readOnlyHint` trusted by the consumer | we set it only from `kind`, which the human approved; `CONSEQUENTIAL:` prefix on writes |
| Tool descriptions as security boundary | never — the keyboard is (submission text) |

---

## 7. Verification protocol (binary, evidence paths; nothing is "done" without these)

### 7.1 Unit (`apps/web`, `pnpm test` → `node --experimental-strip-types --test src/**/*.test.ts`)
`forge.test.ts` (≥ 14 cases): name regex accept/reject · description/commands/params limits ·
unknown placeholder · unused param · placeholder inside quotes · dry-run with examples ·
substitution bare vs quoted (`3`, `main`, `a b`, `'; rm -rf /`, `$(id)`, `` `id` ``, `~`) ·
CR/LF/ESC/bidi in value rejected · hash stable across key order / changes with kind or description
· eviction picks oldest unpinned; all-pinned → `unpin_one` · re-forge aborts old controller (fake
`modelContext` records signal aborted) · queue: 3 steps happy path; dismiss at step 2 dismisses 3
(`dismissed_by_human`); exit 1 at step 1 → `prior_step_failed`; busy on concurrent invoke ·
`coerceInput` string vs object · stats median. Fake adapter + fake `modelContext` in the test.
Existing 14 tests stay green.

### 7.2 Headless (harness; steps JSON in `evals/cases/`)
- `forge-birth.json` (the hero, no PTY): `list` → `invoke forge_create {name:'hn_top', …, commands:['rokan do "top {{n}} HN titles"'], params:[{name:'n',…,example:'5'}], kind:'read'}` → `eval __rokan.forge.approve(<card_id>)` → `expect {tool:'forged_hn_top'}` + `list` asserts `readOnly:true` and the **ms between approve and `toolsAdded`** (printed) → `invoke forged_hn_top {n:3}` → `eval` prompt shows `rokan do "top 3 HN titles"` → `key Enter` → `invoke terminal_wait` → `executed` → `invoke forge_list` → `runs:1`. Screenshot → `docs/evidence/gate-c/forge-birth.png`.
- `forge-injection.json`: `invoke forged_hn_top {n:'3; rm -rf /'}` → prompt shows the single-quoted value; `{n:'‮3'}` → `invalid_param`; `forge_create` with `{{x}}` undeclared → `unknown_placeholder`; with `"{{n}}"` in quotes → `placeholder_in_quotes`; `forge_create` `kind:'read'` with `rm` → card `kindOverridden:true`.
- `forge-queue.json`: 3-step tool → Enter, Enter, Esc → step 3 `dismissed {reason}`; busy on re-invoke mid-queue; `terminal_wait` returns `next_proposal_id`.
- `forge-budget.json`: forge 6 → `expect {noTool:'forged_t1'}`; pin `t2`, forge 6 more → `t2` survives; `restore('t1')` → back; measure `toolsRemoved` on abort (**first thing** — if Chrome 152 doesn't emit it, `expect noTool` uses `getTools()` via `eval` instead).
- Harness additions: `{"eval":…,"equals":…}` assertion; `{"expect":{"noTool"}}` via `getTools()` fallback; print `toolsAdded`/`toolsRemoved` timestamps.
- Gate A case must remain 14/14.

### 7.3 Headed (Claude's Chrome extension, connected)
Open `http://localhost:3311/?test=1`, run the birth by hand, DevTools → Application → WebMCP:
screenshot the panel showing `forged_hn_top` appearing + its invocation → `docs/evidence/gate-c/`.

### 7.4 ChatGPT desktop (Arav; after Sol/Terra confirmed + Vercel prod)
1. Open prod URL → Site tools arrow → count = 6. 2. "Forge a tool called hn_top that runs `rokan do "top {{n}} HN titles"`" → card → Approve → **does the Site tools list show `forged_hn_top` without reload?** (record yes/no + seconds in FIELD-NOTES). 3. "top 3 now" → agent calls it → ghost text → Enter → agent's `terminal_wait` → summary. 4. Ask it to wait on an untouched proposal → measure `terminal_wait.aborted_by_consumer` / `still_waiting` (per-call budget). Screenshots → `docs/evidence/gate-c/chatgpt-*.png`.

### 7.5 Static + regression
`pnpm typecheck && pnpm lint && pnpm build && pnpm test` (web) · `pnpm check && pnpm smoke` (bridge, 14/14) · all `evals/cases/*.json` exit 0 · CI green on push.

### 7.6 Gate C (prompt-line half) is green iff
7.1 + 7.2 (`forge-birth`, `forge-injection`, `forge-queue`, `forge-budget`) + 7.3 pass, evidence
files exist, PROGRESS updated with measured numbers, commits pushed. Live-terminal half = same
cases against Aarya's adapter on Sun.

---

## 8. Files touched (C) — summary

| file | change |
| --- | --- |
| `apps/web/src/lib/webmcp/schemas.ts` | `contract:` — forge schemas/descriptions/limits, `validateForgeSpec`, `substituteParams`, `renderParamValue`, `contentHash`, `terminal_wait` result additions, `FIXED_TOOL_NAMES` |
| `apps/web/src/lib/webmcp/forge.ts` (new) | engine §4 |
| `apps/web/src/lib/webmcp/forge.test.ts` (new) | §7.1 |
| `apps/web/src/lib/webmcp/proposals.ts` | `queued`, `promote`, `has`, reasons |
| `apps/web/src/lib/webmcp/adapter.ts` | `ghostTypeExisting(id)`, `shareScreen` togglable in `gateAAdapter` |
| `apps/web/src/lib/webmcp/ledger.ts` | new `LedgerKind`s |
| `apps/web/src/lib/webmcp/register.ts` | `forge_create`, `forge_list`, `terminal_wait`/`terminal_propose` changes, `ontoolchange` note |
| `apps/web/src/lib/webmcp/testhooks.ts` (new) | §4.12 |
| `apps/web/src/components/TerminalTools.tsx` | placeholder card + lists (announced; Aarya's lane) |
| `evals/harness/webmcp-cdp.mjs` | `equals`, `noTool` fallback, `toolsRemoved`, timestamps |
| `evals/cases/forge-*.json` (4 new) | §7.2 |
| `docs/SECURITY.md` (new, first draft) | §6 + PLAN §4 |
| `docs/PROGRESS.md`, `docs/FIELD-NOTES.md`, `docs/PLAN.md` §3 rows 5–7 (contract text sync) | evidence + numbers |
Commits, in order: `contract: forge schemas + terminal_wait additions` → `feat(web): forge engine + tests` → `feat(web): forge placeholder card + test hooks` → `feat(evals): forge cases + harness assertions` → `docs: SECURITY.md draft, Gate C evidence`. Push after each. `graphify update .` at the end.

---

## 9. Schedule (PT) and kill rules for this plan

| when | done means |
| --- | --- |
| 03:30 | contracts + `proposals.ts` + engine core (validate, substitute, hash, register, budget) + unit tests green |
| 04:30 | queue + `register.ts` changes + test hooks; `forge-birth.json` green headless; screenshot |
| 05:30 | injection / queue / budget cases green; placeholder card usable by hand; headed DevTools screenshot |
| 06:00 | SECURITY.md draft; PROGRESS + FIELD-NOTES; all pushed; graph updated. Then: Vercel prod once logged in; ChatGPT measurements the moment Sol/Terra is confirmed |
| Sat 22:00 | **Gate C prompt-line half** must be green (this plan) — if not, kill rule: ship `forge_create` + `forged_*` without pin/restore/stats (drop §4.8, `restore`, `pinned`), never the reverse |
Vendor yak > 2 h on any row of §5 → drop that vendor for this gate.

## 10. Explicitly out of scope for *this* plan (Handset rule; all of it is C's, in the next plans — §15)
Forge card final UX + editable fields (Terminal plan), "Forge this" from history selection (Terminal
plan), xterm/WS client (Terminal plan), `rokan-do` trailer parsing and seeded ops (D3), judge sandbox (D2), MCP-parity
`rokan-terminal mcp` (§13.1), `?tour=1` (§13.6), evals-cli integration (D3, if cheap), PowerShell
quoting, multi-viewer relay, trusted auto-run (never in the demo).

## 11. Submission-text sentences forge earns (draft, for §9 of PLAN)
"Tools are born at runtime: `forge_create` opens a card; on the human's approval the page calls
`document.modelContext.registerTool()` for `forged_<name>` with its own `AbortSignal`, and the
agent's tool list changes while the page is open. Each forged tool carries a content hash; a
changed hash needs a new approval. Every forged tool still only ghost-types — the boundary is the
keyboard." (Do not claim "strongest reading of criterion #1" as fact.)

---

## 12. Environment brief for autonomous (auto-mode) operation on Arav's Mac — saved on execution to `docs/ENV-ARAV.md` + memory

**Machine / repo**
- macOS Darwin 25.3.0, Apple Silicon (arm64). Repo `~/dev/webmcp-private` (git `main`, GitHub `Aarya2004/webmcp-private`, private until Sep 1). Rokan engine at `~/dev/Rokan` (branch `feat/rokan-mcp-v1`, **uncommitted work in `packages/rokan-do` — never touch; read-only via `graphify query`**).
- Scratch: `/private/tmp/claude-501/-Users-aravkekane-dev-webmcp-private/<session>/scratchpad` (harness scripts, logs). Never `/tmp`.
- Memory: `~/.claude/projects/-Users-aravkekane-dev-webmcp-private/memory/` (MEMORY.md index).

**Toolchain (verified 2026-08-28)**
- Node **25.9.0** (engines ≥ 20; CI uses 22). Built-in `WebSocket` + `fetch` → dependency-free scripts. `node --experimental-strip-types --test` runs `.ts` tests.
- pnpm **11.1.2** — `packageManager` pinned in root `package.json`; build scripts need `allowBuilds` in `pnpm-workspace.yaml` (set for `unrs-resolver`, `node-pty`, `sharp`). **Never** add `version:` to `pnpm/action-setup` (clashes with `packageManager`).
- node-pty 1.1.0: pnpm strips the exec bit from `prebuilds/darwin-arm64/spawn-helper` → `posix_spawnp failed`; bridge self-heals (`repairSpawnHelper`). After any reinstall run `pnpm smoke`.
- cloudflared 2026.5.1 (brew), wrangler 4.127.0 (global npm), vercel CLI 50.44.0, `gh`, `graphify` (`graphify update .` after code changes; backups + cache gitignored).
- Chrome **152.0.7977.65** at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; headless + `--enable-features=WebMCP` exposes `document.modelContext` and the CDP `WebMCP` domain. Claude Chrome extension connected (headed screenshots); `chrome://flags/#enable-webmcp-testing` for headed WebMCP.
- ChatGPT.app installed; plan tier **unknown** — Sol/Terra availability is the open question.
- Anthropic key: Keychain generic password `ANTHROPIC_API_KEY` (`security find-generic-password -l ANTHROPIC_API_KEY -w`), not in env. Never print; never commit.
- Local web server for tests: `cd apps/web && pnpm build && pnpm start -p 3311` (kill: `lsof -ti :3311 | xargs kill`). Bridge test ports 7331/7332.

**Auth states (03:00 PT)**: Vercel CLI **not** logged in (`! vercel login`; team `team_zFUXxKJdD4R9mCPNEYCKVZhj`, hobby; Vercel MCP cannot create projects → 403). wrangler **not** logged in (`! wrangler login`). Cloudflare Claude plugin installed → `/reload-plugins`. GitHub push works.

**Gotchas that cost time tonight (do not repeat)**
1. Bash tool cwd resets to repo root between calls → `cd /abs/path && …` in the same command.
2. Bash tool rejects commands containing raw ESC/bidi/control bytes → write such files with the Write tool using backslash-u escapes (``, `‮`).
3. Quick-tunnel hostnames NXDOMAIN for ~12–25 s; querying the local resolver early negative-caches → resolve via DoH `1.1.1.1` (bridge does).
4. `next start` keeps serving the old build if the old process is still bound → kill by port before restart; confirm the chunk hash changed.
5. GitHub Actions floods Arav's inbox → CI runs only on code paths, cancel-in-progress; docs-only commits never trigger it.
6. Vercel MCP `deploy_to_vercel` = 403 on this account → CLI after login.
7. `vercel whoami` blocks on device flow when logged out → wrap in `spawnSync` with `timeout`.

**Only Arav can do** (ask once, in PROGRESS "Blocked on Arav"): logins (Vercel, wrangler, ChatGPT), plan tiers, spend caps, account creation, anything spending money, founder decisions (PLAN §0 edits, lane swaps), Netlify credits form (before Sep 1 12:00 PT).

**Operating loop while Arav sleeps**: pull → build → verify (typecheck/lint/build/test/smoke/harness) → commit (conventional prefix) → push → PROGRESS (state, blockers, decisions) → `graphify update .` → next item from PLAN §6 in gate order → every 30 min "does this demo well?". Reviewers (Opus 5 + Fable 5) write to `docs/reviews/` + PROGRESS "Review findings (open)"; C fixes P0s first. Every file C is editing right now is listed in PROGRESS "In flight" so Aarya never touches a stale file.

---

## 13. The seven judges — archetype, philosophy, what each scores on, what makes each say no

Sources: RESEARCH §5/§10/§11; Rokan `docs/IDEA-LEDGER.md` §S addenda (priors verified in print). Where a quote is second-hand it is marked. Four of seven name DOM-driving as the kill-shot — every sentence we write must survive that.

| judge | archetype + philosophy (in print) | scores us on | says **no** if | our exact answer |
| --- | --- | --- | --- | --- |
| **Justin Rushing** (OpenAI, browser platform lead) | Platform owner. OpenAI's frame: *"Codex is your customer. It's the one using the tools, not the user"* (Provencher). Ships Codex desktop, which already runs a terminal on the user's Mac. Wants supply for a spec OpenAI didn't author (Atlas is dead; they're buying the demand side). | Does the entry make ChatGPT/Codex more capable *through the standard*? Works in the real ChatGPT browser on Sol/Terra? | "Codex does this already" · declarative forms / iframes / alias-only code that dies in ChatGPT · tools that execute (fails per-call safety review) | Browser-platform capability, human-gated, open standard, any machine (the bridge runs anywhere Node runs — §13.2 remote-box beat). Every tool inert → passes safety review. Tested in his consumer first (FIELD-NOTES ChatGPT section). |
| **Sarah Drasner** (Chrome, engineering director) | Standards evangelist; *"give agents tools, not DOM"*. Cares about developer ergonomics + observability (DevTools WebMCP panel is her team's). Second-hand: wants "genuinely useful implementations, not just demos" (unverified — do not quote). | Idiomatic API use: `AbortSignal` lifecycle, annotations, `toolchange`, sane schemas; the DevTools panel showing it live | DOM-driving inside the WebMCP layer · a fixed tool list registered at load and never touched · fake numbers | Runtime births visible in her panel (2 s shot); per-tool `AbortController`; `FIELD-NOTES.md` — measured Chrome quirks nobody has published (citation bait). |
| **Alex Nahas** (MCP-B creator; credited for *implementation experience*, not "originator") | Security-minded pragmatist. Taxonomy: read tools = flat always-on list; navigation tools = "the system prompt of your website"; write tools = human-approved via elicitation. "Lethal trifecta"; scope trust per domain with a TTL; **hash tools**. MCP-in-browser thesis. | Trust model: are writes human-approved, are tools identity-bound, is untrusted content marked, is there a log | An agent that can execute · `readOnlyHint` lies · secrets in tool output · no tamper-evident trail | `kind` → `readOnlyHint`/`CONSEQUENTIAL:`, content hash on every forged tool + ledger row (arXiv 2606.06387 "bind tool identity"), `untrustedContentHint` on reads, redaction choke point, HMAC ledger, session-scoped registration (= TTL). MCP parity (§13.1) speaks his thesis. |
| **Ilya Grigorik** (Shopify, principal engineer; web-perf + standards veteran) | Generalist systems thinker; "does this generalise beyond the demo?"; Shopify shipped 10 tools per storefront — he knows fixed-list tooling intimately. | Whether the pattern is reusable (a *library*, not a page); performance honesty; nothing Shopify-specific re-registered | Re-registering Shopify's tools · gimmick with no reusable core · commerce cosplay | Forge = a reusable mechanism (`forge.ts` engine + `useForgedTools()` hook, §13.7); measured ms everywhere; no commerce at all. |
| **Jude Gao** (Vercel, Next.js) | Framework + evals engineer; published that `AGENTS.md` beats skills in agent evals; reads the `evals/` folder. | Code quality in a Next.js app; `evals/` cases with ordered/unordered assertions; `AGENTS.md`; framework surface | No tests · no evals · spaghetti client · alias-only registration | Chrome-style evals (our CDP harness + cases), `AGENTS.md` at root, `useForgedTools()` documented in 10 lines, TS strict, Next 15 App Router on Vercel. |
| **Andrew Galloni** (Cloudflare, agents/edge) | Infra + agent-platform builder; *"your content, your rules"*; Cloudflare is the only party composing bot-auth + WebMCP at the edge; ships Sandbox SDK + Browser Run. | Judge mode on Cloudflare Sandbox, rate-limited, egress-allowlisted, TTL — a real deployment story, not localhost | Localhost-only demo · unbounded compute for strangers · no abuse controls | Judge mode = `@cloudflare/sandbox` container, 3 sessions/IP/10 min, 30-min TTL, no API key in the container (nothing can spend), egress allowlist (Gate D). Edge bridge is *his* — we do not retrofit sites. |
| **Sean Roberts** (Netlify, agentexperience.ax) | "Agent Experience (AX)" doctrine: browser-driving agents are "the wrong way"; agents are "extensions of real users"; concedes *"the human view of the web will stay as the fallback for any site that's not supporting an agent specific view"*; values **recovery** (agents that read, propose, retry). | Is the agent a first-class user with a human present? Does it recover from failure? | DOM-driving · agent acts without the human · no failure path in the demo | Browsing happens in the shell — his conceded fallback — outside the WebMCP layer. §8 recovery beat: non-zero exit → redacted tail → proposed fix → Enter → ledger fail→fix. Netlify deploy is the consequential write beat. |

**Panel-wide psychology:** they will see ~200 "agent proposes, human approves" entries; they file in ten seconds; the tiebreak is Leverage; they distrust numbers; they reward things they can open and click *now* (stranger-proof live URL) and punish anything that doesn't open (April 23). Every judge gets one sentence in the submission text written in their vocabulary (tools-not-DOM, elicitation, AX, evals, sandbox, Codex).

---

## 14. Mistakes and ideas we never repeat (register; append, never delete)

From the outside reviews (2026-08-28), RESEARCH §6b, and our own history:
1. **Leading with governance** ("agent proposes, human approves") — 48% of the field; filed in ten seconds. Forge leads (§0.9).
2. **Retrofit / "write a site a tool surface"** — contested lane (★15, ★12), sponsor prior art (Cloudflare edge bridge), DOM-driving kill-shot for 4/7 judges. Never.
3. **Rokan Forge-on-the-page (browser replay inside the WebMCP layer)** — rejected 2026-08-28 for the same reason. Never.
4. **Declarative forms / iframe tools / `navigator.modelContext` alias only** — silently dead in ChatGPT. We feature-detect both, imperative, top-level.
5. **Tools that execute** — fails OpenAI's per-call safety review and Nahas's trust model. Ghost-type only.
6. **Fake/synthetic numbers** (Handset REDTEAM L1). Every ms/call measured; N stated.
7. **Commerce / booking / puzzle / diagram / site-scoring / MCP-bridge lanes** (RESEARCH §6) — saturated pre-hackathon demos.
8. **Warp-Workflows / `just` / `make` framing** ("commands → named alias") — 5/10 novelty; the differentiator is *runtime WebMCP registration + identity hash + agent-callable*, say that, not "aliases".
9. **"Codex does this"** — answer pre-written (§13 Rushing row); never leave it unanswered in text.
10. **Build not opening at demo (April 23 / tavril)** — verify from the *deployed* URL in both consumers before "done"; recorded backup one keypress away.
11. **Vendor yak** > 2 h (Handset) — drop the vendor.
12. **Quoting unverified lines** (Drasner "not just demos", webmcpdirectory counts, issue #256) — never in submission text.
13. **Nahas as "originator" / Shopify as "spec author"** — wrong facts; corrected wording in §9.
14. **Leaving work for a teammate who is asleep** — C does it; PROGRESS makes it resumable.
15. **CI flooding the founder's inbox** — path-filtered, cancel-in-progress.

---

## 15. What comes after forge (so nobody forgets) — the full product, in order

Forge (this plan) → **Terminal plan** (next, same style, in chat, then executed) → judge sandbox → `rokan do` inside → polish/UX → submission. Each plan ends with "next steps" pointing at the following one.

**Terminal plan (to be written after §7.6 is green) will specify, to the same depth:** xterm.js pane (+fit, +webgl with canvas fallback) · WS client against `protocol.ts` (auth, reconnect with backoff, `busy`/`unauthorized` states, resize on fit) · the real `TerminalAdapter` (screen buffer → `screenLines`, `status` frames, `waitProposal` resolving on command exit with `exit_code/ms/tail`) · ghost-text as a DOM overlay above the prompt (never through the PTY parser; diff vs current input; red banner for `isDangerous`; substituted spans coloured; Enter runs = sends the line as `input`; Esc dismisses) · Share-screen toggle + redaction highlighting in the pane · Tools pane / Forge card / Ledger column UI (Rokan palette, Instrument Serif / Geist; no AI-generic look — `ui-ux-pro-max` skill) · empty/error/reconnect states · mobile = "open on desktop" card · pairing from `#ws=&t=` · keyboard focus discipline · Gate B evidence (bridge E2E already green) · then Gate C on the live terminal.

**Then:** judge sandbox (`infra/sandbox`: Worker + `@cloudflare/sandbox`, Dockerfile with Python 3.11 + uv + node + rokan-do wheels + playwright, `/api/session`, xterm SandboxAddon, TTL/rate limits/egress allowlist, `sandbox_status` tool, `$`-capped key) → `rokan do` seeded ops + `--json` trailer parsing in the bridge → §13 score upgrades in order (MCP parity, remote box, recovery + self-forge beats scripted, identity hash done, `?tour=1`, `AGENTS.md` + `useForgedTools()`) → §7 test protocol full pass → README + GIF + LICENSE in About → 5 rehearsals + `demo-backup.mp4` → video ≤ 2:50 → Devpost by Sep 2 18:00 PT → Sep 3 09:00 re-verify.

**UI/UX** is a scored surface (Execution) and belongs to the Terminal plan; forge tonight ships a functional, palette-correct card so the birth is demoable, not the final look.

---

## 16. HARD RULE — test every baby step, past and present (the Handset discipline; non-negotiable)

**No change is complete until it is proven at the smallest level it can be proven, and everything it touches is re-proven.** Never batch a test after a big change. The loop, for *every* function, type, contract line, UI element and copy string:

1. **Before touching**: run the full existing gate (§16.3) and record it green. If it is not green, fix that first — never build on red.
2. **Write the check first** for the piece about to change: a unit case (`*.test.ts` / `smoke.mjs`), a harness step (`evals/cases/*.json` `expect`/`equals`), or — for UI — a headed screenshot criterion ("the card shows hash `abcd…`"). If a check cannot be written, the piece is not understood yet; stop and understand.
3. **Change one thing.** One function, one schema field, one component prop, one CSS token.
4. **Prove it**: the new check passes; `tsc --noEmit` clean; `eslint` clean.
5. **Re-prove the past** (the relational rule): run every test of anything that *calls*, *is called by*, or *shares a contract with* the changed piece — and the full gate on any contract file (`schemas.ts`, `protocol.ts/js`, `adapter.ts`, `proposals.ts`, `ledger.ts`, `register.ts`). Dependency map (keep current):
   `schemas.ts` → register.ts, forge.ts, TerminalTools.tsx, harness cases · `proposals.ts` → register.ts (terminal_propose/wait), forge.ts queue, adapter.ts, TerminalTools key handler · `adapter.ts` → register.ts, forge.ts, TerminalTools · `ledger.ts` → register.ts, forge.ts, TerminalTools ledger list, bridge `ledger` frame · `redact.ts` → register.ts (read_screen, wait tail) · `protocol.ts` ⇄ `protocol.js` → bridge.js, smoke.mjs, WS client · `fieldnotes.ts` → everything that notes · harness → every case.
6. **Prove the whole**: the full gate (§16.3) after every commit-sized change, not every push.
7. **Prove it for real** at the boundary the judge will touch: headless CDP for every tool change; headed Chrome (DevTools WebMCP panel) for every UI change; real PTY smoke for every bridge change; the deployed URL + ChatGPT desktop for every change to registration shape, names, descriptions or schemas.
8. **Record** what was run and what it returned (numbers) in the commit message body or PROGRESS. A claim without the command and its output is not a claim.
9. **If anything regresses**, stop feature work; find the root cause (`systematic-debugging`); add the regression check; then continue.

### 16.2 Micro → macro test ladder (every level must be green before the next)
| level | what | how | cadence |
| --- | --- | --- | --- |
| L0 static | types, lint | `pnpm typecheck && pnpm lint` (web), `pnpm check` (bridge) | every edit |
| L1 unit | pure functions: validators, substitution, quoting, hash, redaction, ledger chain, OSC parser, eviction order, queue state machine | `pnpm test` (node:test, strip-types), bridge unit tests | every function change |
| L2 component/state | store transitions (`proposals`, `forge`) with fake adapter + fake `modelContext`; React state via test hooks | `forge.test.ts`, `proposals.test.ts` | every state change |
| L3 tool contract | every tool registered with the exact name/description/schema/annotations; invocable; errors typed | harness `list` + `invoke` cases | every contract change |
| L4 flow (headless) | birth → call → ghost → Enter → wait → ledger; injection; queue; budget | `evals/cases/*.json` all exit 0 | every feature step |
| L5 transport | real PTY, token, busy, tunnel, honest status | `pnpm smoke`, tunnel E2E client | every bridge change |
| L6 visual/UX | card, lists, prompt, states, palette, focus, empty/error states | headed Chrome screenshots (extension) + DevTools WebMCP panel; compare against the previous screenshot | every UI change |
| L7 consumer | ChatGPT desktop (Sol/Terra) + Chrome flag on the **deployed** URL | manual protocol §7.4 with screenshots | every registration-shape change; every deploy |
| L8 stranger-proof | second account / clean machine opens the live URL cold and completes the hero in < 60 s | §7 L4 | daily from Gate D |

### 16.3 The full gate (one command, must be green before every commit; add to `package.json` root as `pnpm gate`)
`pnpm -r typecheck && pnpm -r lint && pnpm --filter web test && pnpm --filter web build && pnpm --filter rokan-terminal check && pnpm --filter rokan-terminal smoke && (restart :3311) && for c in evals/cases/*.json; do node evals/harness/webmcp-cdp.mjs http://localhost:3311/?test=1 $c || exit 1; done` — expected: 0 failures, harness summaries `failed:0`, smoke `14/14`. Output pasted (last lines) into the commit body.

---

## 17. Criterion-by-criterion: what a 10/10 demands, and our plan to earn it

Judging is Stage 1 pass/fail (on theme; uses the API) then four × 25%, tiebreaks: Leverage, then Execution. A 10 is "the judge cannot name a way it could have used the API/product better *for this problem*". Below: what each criterion literally asks, what the judge will probe, our evidence, and the gap we still must close.

### 17.1 WebMCP Leverage — "thorough, skillful, non-trivial, working" (25%, tiebreak #1)
- **Demands**: breadth of the API used *correctly* (registration, lifecycle, schemas, annotations, `toolchange`, `getTools`/`executeTool`), non-trivial semantics (tools that could not be a form), and proof it *works* in a real consumer.
- **Judge probes**: opens the Site tools list — count, names, descriptions read well? Calls one — does it do what it says? Opens DevTools → WebMCP — registrations and invocations visible? Reads the code — `registerTool` with `AbortSignal`? Hard-coded list?
- **Our 10**: 6 fixed + runtime-forged tools; per-tool `AbortController`; `toolchange` observed; `readOnlyHint`/`untrustedContentHint`/`CONSEQUENTIAL:` set from human-approved `kind`; `additionalProperties:false` schemas with param descriptions + examples; output budget; `forge_list` introspection; `executeTool` used by the card's "Try as agent"; MCP parity (§13.1) shows one library / two protocols; FIELD-NOTES documents measured consumer behaviour nobody else has. Works in ChatGPT desktop **and** Chrome, measured.
- **Gap to close**: ChatGPT `toolchange` refresh (unverified); Chrome `toolsRemoved` on abort (unverified); MCP parity not built.

### 17.2 Execution — "a complete product experience, not a PoC" (25%, tiebreak #2)
- **Demands**: opens cold for a stranger; every state handled (empty, error, disconnected, unsupported browser, timeouts, busy); consistent design; no dead buttons; fast; copy that explains itself; the judge completes the hero in < 60 s without help.
- **Judge probes**: clicks everything; closes the tab and reopens; uses Safari once; pastes garbage into params; triggers an error; watches the ledger.
- **Our 10**: judge mode sandbox in < 15 s cold; `?tour=1` three-step guide; every tool error typed and shown; reconnect/backoff; Safari → page works, tools hidden with a one-line note; Rokan palette + Instrument Serif/Geist, not AI-generic (`ui-ux-pro-max`); ledger export verifies; README with GIF; 5 rehearsals; backup video. Stranger test (L8) daily from Gate D.
- **Gap to close**: everything in the Terminal plan (§15) + sandbox + tour + polish.

### 17.3 Potential Impact — "a credible, specific problem for a real audience, actually addressed by what's shown" (25%)
- **Demands**: name the user, the moment, the pain, and show the shown thing fixing it — not a vision deck.
- **Judge probes**: "Who is this for? Would they use it tomorrow? What does it replace?"
- **Our 10**: audience = developers whose ChatGPT/Codex must act on *their* machine, dashboards, deploys, with a human present (OpenAI's own frame: Codex is the customer). Pain = today the agent either can't touch the machine or touches it blind; the human re-explains the same three commands every session. Shown fix = the agent proposes, the human approves, and the approved thing becomes a tool for next time — including `rokan do`, which browses behind logins and replays at zero calls (measured `calls:0`). Text names three concrete workflows (tests, deploy, data pull) and shows two on video. Honest limits stated (POSIX shells; one tab).
- **Gap to close**: `rokan do` seeded + `--json`; the "any machine" beat (§13.2) widens the audience to servers.

### 17.4 Creativity & Ambition — "differs from existing concepts" (25%)
- **Demands**: a concept the judge has not filed already; ambition with a working core (not a mock).
- **Judge probes**: "How is this not Warp workflows / Codex / a form?" "What here didn't exist at page load?"
- **Our 10**: the tool library grows while you work — tools born at runtime from things the human did, identity-hashed, agent-callable, in the web's own standard; the agent can forge its own workflow after approvals (§8 1:40); the ledger is signed. Prior-art answer pre-written (§14 #8, #9). Novelty 8.5 (Rokan ledger §S).
- **Gap to close**: the self-forge and recovery beats must be rehearsed and on video; the remote-box beat is the ambition multiplier.

### 17.5 Stage 1 (pass/fail) and hygiene the judges check before scoring
On theme (a web app with WebMCP tools driven by ChatGPT — README first line says so); `document.modelContext.registerTool()` demonstrable in public source; OSS license in About; video public < 3 min with audio; live URL up on Sep 3 09:00 re-check; commits timestamped after 08-25; Ontario eligible; one Representative named; no sponsor affiliation.
