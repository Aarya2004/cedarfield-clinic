'use client';

/**
 * One tool registry, two protocols.
 *  - WebMCP: every definition below is registered with `document.modelContext` (one
 *    AbortController for the fixed set; forged tools carry their own — see forge.ts).
 *  - MCP relay: the same definitions are published to the bridge (`agent_tools`) and calls
 *    arriving as `agent_call` frames are dispatched by `callAgentTool()`. The page stays the
 *    single source of truth; nothing here can reach the PTY — proposals only ghost-type.
 */
import { getModelContext, type ModelContextTool } from './types.ts';
import {
  FIXED_TOOL_NAMES,
  FORGE_CREATE_DESCRIPTION,
  FORGE_LIST_DESCRIPTION,
  OUTPUT_BUDGET_CHARS,
  READ_SCREEN_DEFAULT_LINES,
  READ_SCREEN_MAX_LINES,
  TERMINAL_HISTORY_DESCRIPTION,
  TERMINAL_PROPOSE_DESCRIPTION,
  TERMINAL_READ_SCREEN_DESCRIPTION,
  TERMINAL_STATUS_DESCRIPTION,
  TERMINAL_WAIT_DESCRIPTION,
  WAIT_DEFAULT_MS,
  clampLastN,
  forgeCreateSchema,
  forgeListSchema,
  terminalHistorySchema,
  terminalProposeSchema,
  terminalReadScreenSchema,
  terminalStatusSchema,
  terminalWaitSchema,
  validateProposedCommand,
  isDangerousIn,
  type TerminalHistoryInput,
  type TerminalHistoryResult,
  type TerminalHistoryRun,
  type TerminalProposeInput,
  type TerminalProposeResult,
  type TerminalReadScreenInput,
  type TerminalReadScreenResult,
  type TerminalStatusResult,
  type TerminalWaitInput,
  type TerminalWaitResult,
} from './schemas.ts';
import { getTerminalAdapter } from './adapter.ts';
import { proposals } from './proposals.ts';
import { forge } from './forge.ts';
import { coerceInput, FORGED_PREFIX } from './forge-spec.ts';
import { redactForAgent } from './redact.ts';
import { ledger } from './ledger.ts';
import { note } from './fieldnotes.ts';
// Relative, with the extension, like every other import here: this module is loaded verbatim by
// `node --experimental-strip-types` in register.test.ts, which cannot resolve the `@/` alias.
import { runFeed, type Run } from '../terminal/runfeed.ts';

export { WAIT_DEFAULT_MS, FIXED_TOOL_NAMES };

export type RegistrationState =
  | { kind: 'unsupported' }
  | { kind: 'registered'; names: string[] }
  | { kind: 'error'; message: string };

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>;
}

/** Keep the newest lines that fit the output budget; returns [lines, truncated]. */
export function fitBudget(lines: string[], overhead: number): [string[], boolean] {
  let kept = lines.map((l) => (l.length > 200 ? l.slice(0, 197) + '…' : l));
  let truncated = kept.length !== lines.length || kept.some((l, i) => l !== lines[i]);
  while (kept.length > 0 && JSON.stringify(kept).length + overhead > OUTPUT_BUDGET_CHARS) {
    kept = kept.slice(1);
    truncated = true;
  }
  return [kept, truncated];
}

/** `why` is rendered beside the command: strip C0/C1 controls and Unicode format chars (bidi), cap 200. */
export function sanitiseWhy(why: unknown): string | undefined {
  if (typeof why !== 'string') return undefined;
  const clean = why.replace(/[\x00-\x1f\x7f-\x9f]|\p{Cf}/gu, '').trim().slice(0, 200);
  return clean.length ? clean : undefined;
}

/** Envelope allowance for `shared` / `truncated` / `redactions` around the runs array. */
const HISTORY_ENVELOPE_CHARS = 60;

/**
 * The run feed, as `terminal_history` returns it (ticket #6). Pure: no adapter, no DOM — the
 * gating decision belongs to the handler, this only redacts and fits the budget.
 *
 * Redaction: EVERY string that leaves here — command, cwd, and each tail line — goes through
 * `redactForAgent` individually (command and cwd separately, so a `-----BEGIN …-----` in one can
 * never swallow the other). `redactions` counts only the secrets removed from material that is
 * actually returned; a tail line the budget dropped is not counted, because the agent never saw it.
 *
 * Budget (`OUTPUT_BUDGET_CHARS`, the same 1.5 K cap read_screen honours): the run metadata is paid
 * for first — if even that overflows, the OLDEST runs are dropped (never the newest, which is what
 * an agent asks for). Whatever is left is spent on tails newest-run-first through `fitBudget`, so a
 * long-running session returns full output for the last command and empty tails for older ones.
 * `truncated` is true whenever the budget cut or clipped anything; asking for fewer runs with
 * `last_n` is the agent's own choice and does not set it.
 */
export function historyForAgent(all: readonly Run[], lastN: number): { runs: TerminalHistoryRun[]; truncated: boolean; redactions: number } {
  const rows = all.slice(-lastN).map((r) => {
    const cmd = redactForAgent([r.command ?? '']);
    const cwd = redactForAgent([r.cwd ?? '']);
    const tail = redactForAgent(r.tail);
    const run: TerminalHistoryRun = {
      command: r.command === null ? null : cmd.lines[0],
      exit_code: r.exit_code,
      ms: r.ms,
      cwd: r.cwd === null ? null : cwd.lines[0],
      origin: r.origin,
      t: r.t,
      tail: [],
      // measured numbers the bridge parsed from rokan-do's own result line: agent-safe, passed through
      ...(r.rokan ? { rokan: { ms: r.rokan.ms, replayed: r.rokan.replayed, calls: (r.rokan.replayed ? 0 : null) as 0 | null } } : {}),
    };
    const head = (r.command === null ? 0 : cmd.redactions.length) + (r.cwd === null ? 0 : cwd.redactions.length);
    return { run, tailLines: tail.lines, tailRedactions: tail.redactions, head };
  });

  let truncated = false;
  const metaChars = () => JSON.stringify(rows.map((x) => x.run)).length + HISTORY_ENVELOPE_CHARS;
  while (rows.length > 1 && metaChars() > OUTPUT_BUDGET_CHARS) {
    rows.shift();
    truncated = true;
  }

  let redactions = rows.reduce((n, x) => n + x.head, 0);
  let used = metaChars();
  for (let i = rows.length - 1; i >= 0; i--) {
    const [kept, cut] = fitBudget(rows[i].tailLines, used);
    rows[i].run.tail = kept;
    if (cut) truncated = true;
    const dropped = rows[i].tailLines.length - kept.length; // fitBudget only ever drops from the front
    redactions += rows[i].tailRedactions.filter((x) => x.line >= dropped).length;
    used += JSON.stringify(kept).length;
  }
  return { runs: rows.map((x) => x.run), truncated, redactions };
}

/** For a step of a forged invocation, the id of the following step (or null when last / not a step). */
function nextStepId(pid: string): string | null {
  const p = proposals.get(pid);
  if (!p?.invocation_id || p.step === undefined) return null;
  const next = proposals.snapshot().find((x) => x.invocation_id === p.invocation_id && x.step === (p.step as number) + 1);
  return next?.id ?? null;
}

/** The seven fixed tools (`FIXED_TOOL_NAMES`). Built once; identical for WebMCP and the MCP relay. */
export function fixedToolDefs(): ToolDef[] {
  return [
    {
      name: 'terminal_propose',
      title: 'Propose a command (never executes)',
      description: TERMINAL_PROPOSE_DESCRIPTION,
      inputSchema: terminalProposeSchema,
      annotations: { readOnlyHint: false },
      async execute(raw): Promise<TerminalProposeResult | { error: string; active_invocation_id?: string }> {
        const input = coerceInput(raw) as Partial<TerminalProposeInput>;
        const t = performance.now();
        const reason = validateProposedCommand(input?.command);
        if (reason) {
          note('terminal_propose.rejected', { reason });
          return { error: reason };
        }
        const active = forge.active();
        if (active) {
          note('terminal_propose.busy');
          return { error: 'busy: a forged tool is mid-invocation; wait for it with terminal_wait', active_invocation_id: active.invocation_id };
        }
        const command = input.command as string;
        const why = sanitiseWhy(input.why);
        const prev = proposals.pending();
        if (prev) proposals.resolve(prev.id, 'dismissed', 'superseded'); // one ghost text at a time; its terminal_wait resolves
        const ta = getTerminalAdapter();
        const p = ta.ghostType(command, why, { dangerous: isDangerousIn(command, ta.mode) });
        void ledger.append('proposed', { proposal_id: p.id, command, why: why ?? null, dangerous: p.dangerous ?? false });
        note('terminal_propose.called', { proposal_id: p.id, command_len: command.length, handler_ms: Math.round((performance.now() - t) * 100) / 100 });
        return { proposal_id: p.id, status: 'awaiting_human' };
      },
    },
    {
      name: 'terminal_read_screen',
      title: 'Read the screen (if shared)',
      description: TERMINAL_READ_SCREEN_DESCRIPTION,
      inputSchema: terminalReadScreenSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(raw): Promise<TerminalReadScreenResult> {
        const input = coerceInput(raw) as TerminalReadScreenInput;
        const a = getTerminalAdapter();
        if (!a.shareScreen()) {
          void ledger.append('screen_read', { shared: false });
          note('terminal_read_screen.refused');
          return { shared: false, reason: "The human has not turned on 'Share screen with agent'." };
        }
        const n = Math.min(READ_SCREEN_MAX_LINES, Math.max(1, Number(input?.lines) || READ_SCREEN_DEFAULT_LINES));
        const { lines, redactions } = redactForAgent(a.screenLines(n));
        const st = a.status();
        const [kept, truncated] = fitBudget(lines, 120);
        void ledger.append('screen_read', { shared: true, lines: kept.length, redactions: redactions.length, truncated });
        note('terminal_read_screen.called', { lines: kept.length, redactions: redactions.length, truncated });
        return { shared: true, lines: kept, cwd: st?.cwd, last_exit: st?.last_exit_code ?? null, redactions: redactions.length, truncated };
      },
    },
    {
      name: 'terminal_status',
      title: 'Terminal status',
      description: TERMINAL_STATUS_DESCRIPTION,
      inputSchema: terminalStatusSchema,
      annotations: { readOnlyHint: true },
      async execute(): Promise<TerminalStatusResult> {
        const a = getTerminalAdapter();
        const st = a.status();
        note('terminal_status.called', { paired: !!st });
        return {
          mode: a.mode,
          paired: !!st,
          // cwd is buffer-derived information: gated like the screen
          cwd: a.shareScreen() ? (st?.cwd ?? null) : null,
          running: st?.running ?? null,
          last_exit_code: st?.last_exit_code ?? null,
          last_command_ms: st?.last_command_ms ?? null,
          measured: st?.integration ?? false,
          last_rokan: st?.last_rokan ? { ...st.last_rokan, calls: st.last_rokan.replayed ? 0 : null } : null,
        };
      },
    },
    {
      name: 'terminal_wait',
      title: 'Wait for the human to act on a proposal',
      description: TERMINAL_WAIT_DESCRIPTION,
      inputSchema: terminalWaitSchema,
      annotations: { readOnlyHint: true },
      async execute(raw, options): Promise<TerminalWaitResult> {
        const input = coerceInput(raw) as unknown as TerminalWaitInput;
        const a = getTerminalAdapter();
        const start = performance.now();
        const pid = String(input?.proposal_id ?? '');
        if (!proposals.has(pid)) {
          note('terminal_wait.unknown');
          return { status: 'unknown_proposal' };
        }
        const signal = options?.signal;
        if (!signal) note('terminal_wait.no_signal_from_consumer');
        let aborted = false;
        signal?.addEventListener(
          'abort',
          () => {
            aborted = true;
            note('terminal_wait.aborted_by_consumer', { after_ms: Math.round(performance.now() - start) });
          },
          { once: true },
        );
        const p = await a.waitProposal(pid, WAIT_DEFAULT_MS, signal);
        const waited_ms = Math.round(performance.now() - start);
        if (p === null) {
          note('terminal_wait.returned', { status: aborted ? 'aborted' : 'still_waiting', waited_ms });
          return { status: 'still_waiting', waited_ms };
        }
        const next = nextStepId(pid);
        if (p.status === 'dismissed') {
          note('terminal_wait.returned', { status: 'dismissed', waited_ms, reason: p.reason });
          return { status: 'dismissed', waited_ms, reason: p.reason ?? 'dismissed_by_human', ...(p.invocation_id ? { invocation_id: p.invocation_id } : {}) };
        }
        if (p.status !== 'accepted') return { status: 'still_waiting', waited_ms };
        const shared = a.shareScreen();
        const [tail] = fitBudget(redactForAgent(shared ? (p.tail ?? []) : []).lines, 200);
        note('terminal_wait.returned', { status: 'executed', waited_ms, exit_code: p.exit_code ?? undefined });
        return {
          status: 'executed',
          waited_ms,
          exit_code: p.exit_code ?? null,
          ms: p.ms ?? null,
          tail,
          shared,
          ...(p.edited ? { edited: true } : {}),
          ...(p.interrupted ? { interrupted: true } : {}),
          ...(p.measured === false ? { measured: false } : {}),
          ...(p.rokan ? { rokan: { ms: p.rokan.ms, replayed: p.rokan.replayed, calls: p.rokan.replayed ? 0 : null } } : {}),
          ...(p.invocation_id ? { invocation_id: p.invocation_id, next_proposal_id: next } : {}),
        };
      },
    },
    {
      name: 'terminal_history',
      title: 'Runs recorded this session (if shared)',
      description: TERMINAL_HISTORY_DESCRIPTION,
      inputSchema: terminalHistorySchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      // A pure read at the agent boundary: it executes nothing and proposes nothing. Gated by the
      // same Share-screen toggle as terminal_read_screen — the run feed is buffer-derived too.
      // `options` is optional on purpose: Chrome 152 calls execute() with one argument.
      async execute(raw): Promise<TerminalHistoryResult> {
        const input = coerceInput(raw) as TerminalHistoryInput;
        const a = getTerminalAdapter();
        if (!a.shareScreen()) {
          void ledger.append('screen_read', { shared: false, tool: 'terminal_history' });
          note('terminal_history.refused');
          return { shared: false, reason: "The human has not turned on 'Share screen with agent'." };
        }
        const last_n = clampLastN(input?.last_n);
        // No shell paired? The feed is simply empty — an honest `runs: []`, never a fabricated row.
        const { runs, truncated, redactions } = historyForAgent(runFeed.snapshot(), last_n);
        const lines = runs.reduce((n, r) => n + r.tail.length, 0);
        void ledger.append('screen_read', { shared: true, tool: 'terminal_history', runs: runs.length, lines, redactions, truncated });
        note('terminal_history.called', { last_n, runs: runs.length, lines, redactions, truncated });
        return { shared: true, runs, truncated, redactions };
      },
    },
    {
      name: 'forge_create',
      title: 'Forge a new tool (needs human approval)',
      description: FORGE_CREATE_DESCRIPTION,
      inputSchema: forgeCreateSchema,
      annotations: { readOnlyHint: false },
      async execute(raw) {
        const input = coerceInput(raw);
        const t = performance.now();
        const card = forge.openCard(input, { origin: 'agent' });
        if ('error' in card) {
          note('forge_create.rejected', { error: card.error });
          return card;
        }
        note('forge_create.called', { handler_ms: Math.round((performance.now() - t) * 100) / 100, kind_overridden: card.kindOverridden, dangerous: card.dangerous });
        const hash = await forge.hashOf(card.spec);
        return {
          card_id: card.card_id,
          hash,
          status: 'awaiting_human' as const,
          will_register_as: `forged_${card.spec.name}`,
          kind: card.spec.kind,
          ...(card.kindOverridden ? { note: 'kind was set to "write" because a command changes state' } : {}),
          ...(card.dangerous ? { warning: 'a command matches a hard-blocked pattern; the human sees a red banner' } : {}),
          ...(card.previousHash ? { replaces_hash: card.previousHash } : {}),
        };
      },
    },
    {
      name: 'forge_list',
      title: 'List forged tools',
      description: FORGE_LIST_DESCRIPTION,
      inputSchema: forgeListSchema,
      annotations: { readOnlyHint: true },
      async execute() {
        const l = forge.list();
        note('forge_list.called', { tools: l.tools.length });
        // Output budget: drop params first, then oldest evicted entries.
        let out: { visible: number; budget: number; tools: unknown[]; truncated?: boolean } = { ...l };
        if (JSON.stringify(out).length > OUTPUT_BUDGET_CHARS) {
          out = { ...l, tools: l.tools.map((t) => ({ ...t, params: undefined })), truncated: true };
          while (JSON.stringify(out).length > OUTPUT_BUDGET_CHARS && out.tools.length > 0) {
            const i = (out.tools as { visible: boolean }[]).findIndex((t) => !t.visible);
            out.tools.splice(i === -1 ? 0 : i, 1);
          }
        }
        return out;
      },
    },
  ];
}

const fixed = fixedToolDefs();

/** Tool definitions for the MCP relay: the seven fixed + the visible forged tools (no executors). */
export function agentTools(): { name: string; description: string; inputSchema: Record<string, unknown>; annotations: ToolDef['annotations'] }[] {
  return [...fixed.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })), ...forge.toolDefs()];
}

/** Dispatch a relayed (MCP) call to the same code path WebMCP uses. */
export async function callAgentTool(name: string, input: unknown): Promise<unknown> {
  const t0 = performance.now();
  const def = fixed.find((d) => d.name === name);
  let result: unknown;
  if (def) result = await def.execute(input);
  else if (name.startsWith(FORGED_PREFIX)) {
    const t = forge.tool(name.slice(FORGED_PREFIX.length));
    if (!t || !t.visible) return { error: 'unknown_tool' };
    result = forge.invoke(t.name, coerceInput(input));
  } else return { error: 'unknown_tool' };
  note('agent_call', { tool: name, ms: Math.round(performance.now() - t0) });
  return result;
}

export async function registerTerminalTools(onState: (s: RegistrationState) => void): Promise<() => void> {
  const mc = getModelContext();
  if (!mc) {
    onState({ kind: 'unsupported' });
    return () => {};
  }
  const ac = new AbortController();
  const t0 = performance.now();
  const onToolChange = () => {
    note('toolchange', { forged_visible: forge.visibleCount() });
  };
  try {
    mc.addEventListener?.('toolchange', onToolChange, { signal: ac.signal });
    for (const d of fixed) {
      const tool: ModelContextTool<unknown> = { name: d.name, title: d.title, description: d.description, inputSchema: d.inputSchema, annotations: d.annotations, execute: d.execute };
      await mc.registerTool(tool, { signal: ac.signal });
    }
    const ms = Math.round(performance.now() - t0);
    note('register.ok', { ms, tools: FIXED_TOOL_NAMES.length });
    void ledger.append('registered', { tools: FIXED_TOOL_NAMES.join(','), ms });
    onState({ kind: 'registered', names: [...FIXED_TOOL_NAMES] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    note('register.error', { message });
    onState({ kind: 'error', message });
  }
  return () => {
    ac.abort();
    forge.dispose();
    void ledger.append('unregistered', { tools: FIXED_TOOL_NAMES.join(',') });
  };
}
