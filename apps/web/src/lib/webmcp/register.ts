'use client';

/**
 * Registers the four fixed `terminal_*` tools (PLAN §3 rows 1–4) against the current
 * `TerminalAdapter`. One AbortController for the set; the returned disposer unregisters.
 * No tool here can reach the PTY: `terminal_propose` only ghost-types.
 */
import { getModelContext } from './types';
import {
  OUTPUT_BUDGET_CHARS,
  READ_SCREEN_DEFAULT_LINES,
  READ_SCREEN_MAX_LINES,
  TERMINAL_PROPOSE_DESCRIPTION,
  TERMINAL_READ_SCREEN_DESCRIPTION,
  TERMINAL_STATUS_DESCRIPTION,
  TERMINAL_WAIT_DESCRIPTION,
  WAIT_DEFAULT_MS,
  terminalProposeSchema,
  terminalReadScreenSchema,
  terminalStatusSchema,
  terminalWaitSchema,
  validateProposedCommand,
  type TerminalProposeInput,
  type TerminalProposeResult,
  type TerminalReadScreenInput,
  type TerminalReadScreenResult,
  type TerminalStatusResult,
  type TerminalWaitInput,
  type TerminalWaitResult,
} from './schemas';
import { getTerminalAdapter } from './adapter';
import { redactForAgent } from './redact';
import { ledger } from './ledger';
import { note } from './fieldnotes';

export { WAIT_DEFAULT_MS };

export const TERMINAL_TOOL_NAMES = ['terminal_propose', 'terminal_read_screen', 'terminal_status', 'terminal_wait'] as const;

export type RegistrationState =
  | { kind: 'unsupported' }
  | { kind: 'registered'; names: string[] }
  | { kind: 'error'; message: string };

/** Keep the newest lines that fit the output budget; returns [lines, truncated]. */
function fitBudget(lines: string[], overhead: number): [string[], boolean] {
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
  try {
    await mc.registerTool(
      {
        name: 'terminal_propose',
        title: 'Propose a command (never executes)',
        description: TERMINAL_PROPOSE_DESCRIPTION,
        inputSchema: terminalProposeSchema,
        annotations: { readOnlyHint: false },
        async execute(input: TerminalProposeInput): Promise<TerminalProposeResult | { error: string }> {
          const t = performance.now();
          const reason = validateProposedCommand(input?.command);
          if (reason) {
            note('terminal_propose.rejected', { reason });
            return { error: reason };
          }
          const why = typeof input.why === 'string' ? input.why.slice(0, 200) : undefined;
          const p = getTerminalAdapter().ghostType(input.command, why);
          void ledger.append('proposed', { proposal_id: p.id, command: input.command, why: why ?? null });
          note('terminal_propose.called', { proposal_id: p.id, command_len: input.command.length, handler_ms: Math.round((performance.now() - t) * 100) / 100 });
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
        async execute(input: TerminalReadScreenInput): Promise<TerminalReadScreenResult> {
          const a = getTerminalAdapter();
          if (!a.shareScreen()) {
            void ledger.append('screen_read', { shared: false });
            note('terminal_read_screen.refused');
            return { shared: false, reason: "The human has not turned on 'Share screen with agent'." };
          }
          const n = Math.min(READ_SCREEN_MAX_LINES, Math.max(1, Number(input?.lines) || READ_SCREEN_DEFAULT_LINES));
          const raw = a.screenLines(n);
          const { lines, redactions } = redactForAgent(raw);
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
            cwd: st?.cwd ?? null,
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
        async execute(input: TerminalWaitInput, options): Promise<TerminalWaitResult> {
          const a = getTerminalAdapter();
          const start = performance.now();
          const signal = options?.signal;
          if (!signal) note('terminal_wait.no_signal_from_consumer');
          let aborted = false;
          signal?.addEventListener(
            'abort',
            () => {
              aborted = true;
              // The consumer's per-call budget — measured, not quoted.
              note('terminal_wait.aborted_by_consumer', { after_ms: Math.round(performance.now() - start) });
            },
            { once: true },
          );
          const p = await a.waitProposal(String(input?.proposal_id ?? ''), WAIT_DEFAULT_MS, signal);
          const waited_ms = Math.round(performance.now() - start);
          if (p === null) {
            note('terminal_wait.returned', { status: aborted ? 'aborted' : 'still_waiting', waited_ms });
            return { status: 'still_waiting', waited_ms };
          }
          if (p.status === 'dismissed') {
            note('terminal_wait.returned', { status: 'dismissed', waited_ms });
            return { status: 'dismissed', waited_ms };
          }
          if (p.status !== 'accepted') {
            return { status: 'still_waiting', waited_ms };
          }
          const shared = a.shareScreen();
          const tailRaw = shared ? (p.tail ?? []) : [];
          const [tail] = fitBudget(redactForAgent(tailRaw).lines, 160);
          note('terminal_wait.returned', { status: 'executed', waited_ms, exit_code: p.exit_code ?? undefined });
          return { status: 'executed', waited_ms, exit_code: p.exit_code ?? null, ms: p.ms ?? null, tail, shared };
        },
      },
      { signal: ac.signal },
    );

    const ms = Math.round(performance.now() - t0);
    note('register.ok', { ms, tools: TERMINAL_TOOL_NAMES.length });
    void ledger.append('registered', { tools: TERMINAL_TOOL_NAMES.join(','), ms });
    onState({ kind: 'registered', names: [...TERMINAL_TOOL_NAMES] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    note('register.error', { message });
    onState({ kind: 'error', message });
  }
  return () => {
    ac.abort();
    void ledger.append('unregistered', { tools: TERMINAL_TOOL_NAMES.join(',') });
  };
}
