'use client';

/**
 * Registers the six fixed tools (PLAN §3 rows 1–4 + forge_create + forge_list) against the
 * current `TerminalAdapter` and the forge engine. One AbortController for the fixed set; the
 * returned disposer unregisters them and disposes every forged tool.
 * No tool here can reach the PTY: proposals only ghost-type.
 */
import { getModelContext } from './types';
import {
  FIXED_TOOL_NAMES,
  FORGE_CREATE_DESCRIPTION,
  FORGE_LIST_DESCRIPTION,
  OUTPUT_BUDGET_CHARS,
  READ_SCREEN_DEFAULT_LINES,
  READ_SCREEN_MAX_LINES,
  TERMINAL_PROPOSE_DESCRIPTION,
  TERMINAL_READ_SCREEN_DESCRIPTION,
  TERMINAL_STATUS_DESCRIPTION,
  TERMINAL_WAIT_DESCRIPTION,
  WAIT_DEFAULT_MS,
  forgeCreateSchema,
  forgeListSchema,
  terminalProposeSchema,
  terminalReadScreenSchema,
  terminalStatusSchema,
  terminalWaitSchema,
  validateProposedCommand,
  isDangerous,
  type TerminalProposeInput,
  type TerminalProposeResult,
  type TerminalReadScreenInput,
  type TerminalReadScreenResult,
  type TerminalStatusResult,
  type TerminalWaitInput,
  type TerminalWaitResult,
} from './schemas';
import { getTerminalAdapter } from './adapter';
import { proposals } from './proposals';
import { forge } from './forge';
import { coerceInput } from './forge-spec';
import { redactForAgent } from './redact';
import { ledger } from './ledger';
import { note } from './fieldnotes';

export { WAIT_DEFAULT_MS, FIXED_TOOL_NAMES };

export type RegistrationState =
  | { kind: 'unsupported' }
  | { kind: 'registered'; names: string[] }
  | { kind: 'error'; message: string };

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

    await mc.registerTool(
      {
        name: 'terminal_propose',
        title: 'Propose a command (never executes)',
        description: TERMINAL_PROPOSE_DESCRIPTION,
        inputSchema: terminalProposeSchema,
        annotations: { readOnlyHint: false },
        async execute(raw: unknown): Promise<TerminalProposeResult | { error: string; active_invocation_id?: string }> {
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
          const why = typeof input.why === 'string' ? input.why.slice(0, 200) : undefined;
          const prev = proposals.pending();
          if (prev) proposals.resolve(prev.id, 'dismissed', 'superseded'); // one ghost text at a time; its terminal_wait resolves
          const p = getTerminalAdapter().ghostType(command, why, { dangerous: isDangerous(command) });
          void ledger.append('proposed', { proposal_id: p.id, command, why: why ?? null, dangerous: p.dangerous ?? false });
          note('terminal_propose.called', { proposal_id: p.id, command_len: command.length, handler_ms: Math.round((performance.now() - t) * 100) / 100 });
          return { proposal_id: p.id, status: 'awaiting_human' };
        },
      },
      { signal: ac.signal },
    );

    await mc.registerTool(
      {
        name: 'terminal_read_screen',
        title: 'Read the screen (if shared)',
        description: TERMINAL_READ_SCREEN_DESCRIPTION,
        inputSchema: terminalReadScreenSchema,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        async execute(raw: unknown): Promise<TerminalReadScreenResult> {
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
      { signal: ac.signal },
    );

    await mc.registerTool(
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
            // cwd is buffer-derived information: gated like the screen (Opus review P2)
            cwd: a.shareScreen() ? (st?.cwd ?? null) : null,
            running: st?.running ?? null,
            last_exit_code: st?.last_exit_code ?? null,
            last_command_ms: st?.last_command_ms ?? null,
            measured: st?.integration ?? false,
          };
        },
      },
      { signal: ac.signal },
    );

    await mc.registerTool(
      {
        name: 'terminal_wait',
        title: 'Wait for the human to act on a proposal',
        description: TERMINAL_WAIT_DESCRIPTION,
        inputSchema: terminalWaitSchema,
        annotations: { readOnlyHint: true },
        async execute(raw: unknown, options): Promise<TerminalWaitResult> {
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
          const inv = p.invocation_id ? forge.active() : null;
          const next = nextStepId(pid);
          if (p.status === 'dismissed') {
            note('terminal_wait.returned', { status: 'dismissed', waited_ms, reason: p.reason });
            return { status: 'dismissed', waited_ms, reason: p.reason ?? 'dismissed_by_human', ...(p.invocation_id ? { invocation_id: p.invocation_id } : {}) };
          }
          if (p.status !== 'accepted') return { status: 'still_waiting', waited_ms };
          const shared = a.shareScreen();
          const [tail] = fitBudget(redactForAgent(shared ? (p.tail ?? []) : []).lines, 200);
          note('terminal_wait.returned', { status: 'executed', waited_ms, exit_code: p.exit_code ?? undefined });
          void inv;
          return {
            status: 'executed',
            waited_ms,
            exit_code: p.exit_code ?? null,
            ms: p.ms ?? null,
            tail,
            shared,
            ...(p.invocation_id ? { invocation_id: p.invocation_id, next_proposal_id: next } : {}),
          };
        },
      },
      { signal: ac.signal },
    );

    await mc.registerTool(
      {
        name: 'forge_create',
        title: 'Forge a new tool (needs human approval)',
        description: FORGE_CREATE_DESCRIPTION,
        inputSchema: forgeCreateSchema,
        annotations: { readOnlyHint: false },
        async execute(raw: unknown) {
          const input = coerceInput(raw);
          const t = performance.now();
          const card = forge.openCard(input, { origin: 'agent' });
          if ('error' in card) {
            note('forge_create.rejected', { error: card.error });
            return card;
          }
          note('forge_create.called', { handler_ms: Math.round((performance.now() - t) * 100) / 100, kind_overridden: card.kindOverridden, dangerous: card.dangerous });
          return {
            card_id: card.card_id,
            status: 'awaiting_human' as const,
            will_register_as: `forged_${card.spec.name}`,
            kind: card.spec.kind,
            ...(card.kindOverridden ? { note: 'kind was set to "write" because a command changes state' } : {}),
            ...(card.dangerous ? { warning: 'a command matches a hard-blocked pattern; the human sees a red banner' } : {}),
            ...(card.previousHash ? { replaces_hash: card.previousHash } : {}),
          };
        },
      },
      { signal: ac.signal },
    );

    await mc.registerTool(
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
      { signal: ac.signal },
    );

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

/** For a step of a forged invocation, the id of the following step (or null when last / not a step). */
function nextStepId(pid: string): string | null {
  const p = proposals.get(pid);
  if (!p?.invocation_id || p.step === undefined) return null;
  const next = proposals.snapshot().find((x) => x.invocation_id === p.invocation_id && x.step === (p.step as number) + 1);
  return next?.id ?? null;
}
