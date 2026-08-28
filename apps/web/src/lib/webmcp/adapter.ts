/**
 * The seam between the `terminal_*` WebMCP tools (Arav's lane, `register.ts`) and the terminal
 * UI (Aarya's lane: xterm pane, ghost text, Share-screen toggle, WS client).
 *
 * The UI installs its adapter with `setTerminalAdapter()`; until then the in-memory
 * `gateAAdapter` keeps the page and the tools working with no shell attached.
 */
import type { BridgeMode, BridgeStatus } from '@/lib/ws/protocol';
import { proposals, type Proposal } from './proposals';

export interface ResolvedProposal extends Proposal {
  /** Set by the real terminal once the command that followed Enter finished. */
  exit_code?: number | null;
  ms?: number | null;
  /** Raw (un-redacted) lines printed after Enter. `register.ts` redacts before returning. */
  tail?: string[];
}

export interface TerminalAdapter {
  mode: BridgeMode;
  /** Share-screen toggle. OFF by default; the human turns it on per session (PLAN §4). */
  shareScreen(): boolean;
  /** Last `n` visible lines of the terminal buffer as plain text, oldest first. */
  screenLines(n: number): string[];
  /** Latest honest status frame from the bridge, or null when not paired. */
  status(): (BridgeStatus & { integration: boolean }) | null;
  /** Show `command` as ghost text on the prompt line. Never types Enter. */
  ghostType(command: string, why?: string): Proposal;
  /** Resolve when the human hits Enter/Esc on that proposal (with exit info when available). */
  waitProposal(id: string, ms: number, signal?: AbortSignal): Promise<ResolvedProposal | null>;
}

/** No shell, no bridge: proposals live in memory; Enter/Esc come from the page's key handler. */
export const gateAAdapter: TerminalAdapter = {
  mode: 'builder',
  shareScreen: () => false,
  screenLines: () => [],
  status: () => null,
  ghostType: (command, why) => proposals.propose(command, why),
  waitProposal: (id, ms, signal) => proposals.wait(id, ms, signal),
};

let current: TerminalAdapter = gateAAdapter;

export function setTerminalAdapter(a: TerminalAdapter): void {
  current = a;
}

export function getTerminalAdapter(): TerminalAdapter {
  return current;
}
