/**
 * Shared tool contracts (PLAN §3). Change only via a `contract:` commit + ping in PROGRESS.md.
 * v0 — Gate A: `terminal_propose` only.
 */
export const PROPOSE_COMMAND_MAX = 400;
export const PROPOSE_WHY_MAX = 200;

export const terminalProposeSchema = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      maxLength: PROPOSE_COMMAND_MAX,
      description: 'One shell command line to suggest. No newlines. It is shown, not run.',
    },
    why: {
      type: 'string',
      maxLength: PROPOSE_WHY_MAX,
      description: 'One sentence shown beside the suggestion so the human can judge it.',
    },
  },
  required: ['command'],
  additionalProperties: false,
} as const;

export interface TerminalProposeInput {
  command: string;
  why?: string;
}

export interface TerminalProposeResult {
  proposal_id: string;
  status: 'awaiting_human';
}

export const TERMINAL_PROPOSE_DESCRIPTION =
  "Suggest one shell command by typing it as ghost text into the human's terminal prompt. " +
  'This tool NEVER executes anything: the command only runs if the human reads it and presses ' +
  'Enter themselves; they may edit or dismiss it. Returns a proposal_id. Use it whenever you ' +
  "want something run on the human's machine.";

/**
 * Reject C0/C1 control chars (incl. ESC/CR/LF) and Unicode format chars (bidi overrides etc.)
 * so the bytes the human sees are the bytes that would run. Returns a reason or null.
 */
export function validateProposedCommand(command: unknown): string | null {
  if (typeof command !== 'string') return 'command must be a string';
  if (command.length === 0) return 'command is empty';
  if (command.length > PROPOSE_COMMAND_MAX) return `command exceeds ${PROPOSE_COMMAND_MAX} chars`;
  if (/[\n\r]/.test(command)) return 'one command per proposal — newlines are not allowed';
  if (/[\x00-\x1f\x7f-\x9f]/.test(command)) return 'control characters are not allowed';
  if (/\p{Cf}/u.test(command)) return 'invisible format characters are not allowed';
  return null;
}
