'use client';

import { getModelContext } from './types';
import {
  TERMINAL_PROPOSE_DESCRIPTION,
  terminalProposeSchema,
  validateProposedCommand,
  type TerminalProposeInput,
  type TerminalProposeResult,
} from './schemas';
import { proposals } from './proposals';
import { note } from './fieldnotes';

export const WAIT_DEFAULT_MS = 45_000;

export type RegistrationState =
  | { kind: 'unsupported' }
  | { kind: 'registered'; names: string[] }
  | { kind: 'error'; message: string };

/**
 * Registers the Gate A tool set: `terminal_propose` (inert) and `terminal_wait` (blocking,
 * used to measure the consumer's per-call budget). Returns a disposer that aborts both.
 */
export async function registerTerminalTools(
  onState: (s: RegistrationState) => void,
): Promise<() => void> {
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
          const p = proposals.propose(input.command, why);
          note('terminal_propose.called', {
            proposal_id: p.id,
            command_len: input.command.length,
            handler_ms: Math.round((performance.now() - t) * 100) / 100,
          });
          return { proposal_id: p.id, status: 'awaiting_human' };
        },
      },
      { signal: ac.signal },
    );

    await mc.registerTool(
      {
        name: 'terminal_wait',
        title: 'Wait for the human to act on a proposal',
        description:
          'Blocks until the human presses Enter (executed) or Esc (dismissed) on the given ' +
          'proposal_id, or returns status "still_waiting" after 45 s — call again with the same ' +
          'proposal_id to keep waiting. Read-only; never executes anything.',
        inputSchema: {
          type: 'object',
          properties: {
            proposal_id: { type: 'string', description: 'The id returned by terminal_propose.' },
          },
          required: ['proposal_id'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        async execute(input: { proposal_id: string }, options) {
          const start = performance.now();
          let aborted = false;
          const signal = options?.signal;
          if (!signal) note('terminal_wait.no_signal_from_consumer');
          signal?.addEventListener(
            'abort',
            () => {
              aborted = true;
              // This is the consumer's per-call budget — the number nobody has published.
              note('terminal_wait.aborted_by_consumer', {
                after_ms: Math.round(performance.now() - start),
              });
            },
            { once: true },
          );
          const p = await proposals.wait(input.proposal_id, WAIT_DEFAULT_MS, signal);
          const elapsed = Math.round(performance.now() - start);
          if (!p) {
            note('terminal_wait.returned', { status: aborted ? 'aborted' : 'still_waiting', elapsed });
            return { status: 'still_waiting', waited_ms: elapsed };
          }
          const status = p.status === 'accepted' ? 'executed' : 'dismissed';
          note('terminal_wait.returned', { status, elapsed });
          return {
            status,
            waited_ms: elapsed,
            note: 'Gate A build: no shell attached; "executed" means the human pressed Enter.',
          };
        },
      },
      { signal: ac.signal },
    );

    note('register.ok', { ms: Math.round(performance.now() - t0), tools: 2 });
    onState({ kind: 'registered', names: ['terminal_propose', 'terminal_wait'] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    note('register.error', { message });
    onState({ kind: 'error', message });
  }
  return () => ac.abort();
}
