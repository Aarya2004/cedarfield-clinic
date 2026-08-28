'use client';

/**
 * `window.__rokan` — approve/reject/pin/resolve without the UI so the headless harness
 * (`evals/harness/webmcp-cdp.mjs`) can prove the birth of a tool end to end.
 * Installed only when `?test=1`, `#…hooks=1…` or `localStorage['rokan.test']==='1'`.
 * Same-origin JS already has this power; the boundary is the keyboard, not this object.
 */
import { forge } from './forge';
import { proposals } from './proposals';
import { ledger } from './ledger';
import { getGateAShare } from './adapter';
import { fieldNotes } from './fieldnotes';
import { session } from '@/lib/terminal/session';
import { agentTools, callAgentTool } from './register';
import { forgeFromLines } from './forge-this';
import type { ForgeSpec } from './forge-spec';

export function testHooksEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('test') === '1') return true;
    if (/(^#|&)hooks=1(&|$)/.test(window.location.hash)) return true;
    if (window.localStorage.getItem('rokan.test') === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function installTestHooks(): boolean {
  if (!testHooksEnabled()) return false;
  const w = window as Window & { __rokan?: unknown };
  w.__rokan = {
    forge: {
      cards: () => forge.cards(),
      open: (spec: ForgeSpec) => forge.openCard(spec, { origin: 'human' }),
      approve: (card_id: string, edits?: Partial<ForgeSpec>, confirmDangerous?: boolean) => forge.approve(card_id, edits, { confirmDangerous }),
      reject: (card_id: string) => forge.reject(card_id),
      list: () => forge.list(),
      tools: () => forge.tools(),
      pin: (name: string, pinned: boolean) => forge.pin(name, pinned),
      unforge: (name: string) => forge.unforge(name),
      restore: (name: string) => forge.restore(name),
      active: () => forge.active(),
      cancel: () => forge.cancelActive(),
    },
    proposals: {
      pending: () => proposals.pending() ?? null,
      all: () => proposals.snapshot(),
      resolve: (id: string, status: 'accepted' | 'dismissed') => proposals.resolve(id, status),
    },
    ledger: () => ledger.export(),
    fieldNotes: () => fieldNotes(),
    share: (on?: boolean) => {
      if (typeof on === 'boolean') session.setShare(on);
      return getGateAShare();
    },
    session: () => session.snapshot(),
    lastClose: () => session.getClient()?.lastClose ?? null,
    agentTools: () => agentTools(),
    agentCall: (tool: string, input: unknown) => callAgentTool(tool, input),
    forgeThis: (lines: string[]) => forgeFromLines(lines),
    screen: (n = 40) => session.getAdapter()?.screenLines(n) ?? null,
    reconnect: () => session.reconnectNow(),
  };
  return true;
}
