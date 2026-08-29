/**
 * The one status chip. Every state on the page (paired, disconnected, busy, unsupported, kind
 * badges) speaks through this so a judge learns the language once. Tones pair colour with
 * meaning: ok = live, accent = in progress / needs you, danger = blocked, muted = inert.
 * Each tone is one class carrying both background and text (globals.css), so a chip can never be
 * legible in one theme and not the other.
 */
import type { ReactNode } from 'react';

export type ChipTone = 'ok' | 'muted' | 'danger' | 'accent';

const TONES: Record<ChipTone, string> = {
  ok: 'tone-ok',
  danger: 'tone-danger',
  accent: 'tone-accent',
  muted: 'tone-muted',
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
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${kind === 'write' ? 'tone-danger' : 'tone-ok'}`}
    >
      {kind}
    </span>
  );
}
