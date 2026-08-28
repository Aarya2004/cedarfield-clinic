/**
 * The seam between the `terminal_*` WebMCP tools (Arav's lane, `register.ts`) and the terminal
 * UI (Aarya's lane: xterm pane, ghost text, Share-screen toggle, WS client).
 *
 * The UI installs its adapter with `setTerminalAdapter()`; until then the in-memory
 * `gateAAdapter` keeps the page and the tools working with no shell attached.
 */
import type { BridgeMode, BridgeStatus } from '@/lib/ws/protocol';
import { proposals, type Proposal, type ProposeOptions } from './proposals.ts';

export interface ResolvedProposal extends Proposal {
  /** Set by the real terminal once the command that followed Enter finished. */
  exit_code?: number | null;
  ms?: number | null;
  /** Raw (un-redacted) lines printed after Enter. `register.ts` redacts before returning. */
  tail?: string[];
  /** the bridge disconnected before the command's end marker arrived */
  interrupted?: boolean;
  /** the human inserted the ghost text (Tab) and edited before running */
  edited?: boolean;
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
  ghostType(command: string, why?: string, opts?: ProposeOptions): Proposal;
  /** Resolve when the human hits Enter/Esc on that proposal (with exit info when available). */
  waitProposal(id: string, ms: number, signal?: AbortSignal): Promise<ResolvedProposal | null>;
}

let gateAShare = false;
/** Gate A page's Share-screen toggle (no shell: the "screen" is the prompt history). */
export function setGateAShare(on: boolean): void {
  gateAShare = on;
}
export function getGateAShare(): boolean {
  return gateAShare;
}

/** No shell, no bridge: proposals live in memory; Enter/Esc come from the page's key handler. */
export const gateAAdapter: TerminalAdapter = {
  mode: 'builder',
  shareScreen: () => gateAShare,
  screenLines: (n) =>
    proposals
      .snapshot()
      .filter((p) => p.status !== 'queued')
      .slice(-n)
      .map((p) => `~ $ ${p.command}  # ${p.status}${p.status === 'accepted' ? ' (Gate A build: no shell attached)' : ''}`),
  status: () => null,
  ghostType: (command, why, opts) => proposals.propose(command, why, opts),
  waitProposal: (id, ms, signal) => proposals.wait(id, ms, signal),
};

let current: TerminalAdapter = gateAAdapter;

export function setTerminalAdapter(a: TerminalAdapter): void {
  current = a;
}

export function getTerminalAdapter(): TerminalAdapter {
  return current;
}
