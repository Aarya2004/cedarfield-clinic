/**
 * The one status chip. Every state on the page (paired, disconnected, busy, unsupported, kind
 * badges) speaks through this so a judge learns the language once. Tones pair colour with
 * meaning: ok = live, accent = in progress / needs you, danger = blocked, muted = inert.
 */
import type { ReactNode } from 'react';

export type ChipTone = 'ok' | 'muted' | 'danger' | 'accent';

const TONES: Record<ChipTone, string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  danger: 'bg-red-100 text-red-800',
  accent: 'bg-amber-100 text-amber-900',
  muted: 'bg-line text-muted',
};

export function Chip({ tone, children, title, className = '' }: { tone: ChipTone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] leading-4 ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Kind badge for a forged tool: read is green, write is red and says CONSEQUENTIAL on hover. */
export function KindBadge({ kind }: { kind: 'read' | 'write' }) {
  return (
    <span
      title={kind === 'write' ? 'write — marked CONSEQUENTIAL to the agent; still needs your Enter' : 'read — does not change state; still needs your Enter'}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${kind === 'write' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}
    >
      {kind}
    </span>
  );
}
