/**
 * Pure helpers for the Forge card's command previews. Display only — the validator in
 * `forge-spec.ts` stays the authority on what a placeholder is; this mirrors its grammar so the
 * highlighted span is exactly the span the engine will substitute.
 */
import type { ForgeError } from '@/lib/webmcp/forge-spec';

/** Same grammar as `PLACEHOLDER_RE` in forge-spec.ts (`{{ name }}`, lower-snake, ≤ 20 chars). */
const PLACEHOLDER_RE = /\{\{\s*([a-z][a-z0-9_]{0,19})\s*\}\}/g;

export type CommandSegment = { kind: 'text'; text: string } | { kind: 'param' | 'unknown'; text: string; name: string };

/**
 * Split a command into literal text and `{{param}}` spans. A span whose name is not in
 * `declared` is marked `unknown` so the card can show it in red before Approve refuses it.
 */
export function splitPlaceholders(command: string, declared: readonly string[]): CommandSegment[] {
  const known = new Set(declared);
  const out: CommandSegment[] = [];
  let last = 0;
  for (const m of command.matchAll(PLACEHOLDER_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: 'text', text: command.slice(last, at) });
    out.push({ kind: known.has(m[1]) ? 'param' : 'unknown', text: m[0], name: m[1] });
    last = at + m[0].length;
  }
  if (last < command.length) out.push({ kind: 'text', text: command.slice(last) });
  return out;
}

/** True when any command carries a placeholder (the preview line is only worth drawing then). */
export function hasPlaceholders(commands: readonly string[]): boolean {
  return commands.some((c) => {
    PLACEHOLDER_RE.lastIndex = 0;
    return PLACEHOLDER_RE.test(c);
  });
}

/** One sentence per engine error code, in the card's voice; falls back to the code + detail. */
export function explainForgeError(e: ForgeError): string {
  const detail = e.detail ? `: ${e.detail}` : '';
  switch (e.error) {
    case 'unpin_one':
      return '5 forged tools are visible and all are pinned. Unpin one under Site tools, then Approve.';
    case 'needs_confirmation':
      return 'A command matches a hard-blocked pattern. Press “Approve anyway” to confirm.';
    case 'too_many_pending':
      return `Too many cards are waiting${detail}. Approve or reject one first.`;
    case 'unsupported':
      return `This browser could not register the tool${detail}.`;
    case 'unknown_card':
      return 'This card is gone — it was approved or rejected elsewhere.';
    default:
      return `${e.error}${detail}`;
  }
}
