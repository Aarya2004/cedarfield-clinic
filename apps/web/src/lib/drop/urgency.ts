// Shared urgency thresholds — T1 (confirm surface) and T2 (TTL bar) must agree on these.
export type Urgency = 'calm' | 'attention' | 'critical';

export function urgencyOf(secondsLeft: number): Urgency {
  if (secondsLeft <= 10) return 'critical';
  if (secondsLeft <= 30) return 'attention';
  return 'calm';
}

// Components reference tokens with fallbacks: `var(--drop-calm, <fallback>)`.
// The playground (T8) owns the themed definitions; the brand pass swaps them post-name.
export const URGENCY_TOKEN: Record<Urgency, string> = {
  calm: 'var(--drop-calm, #4a7c59)',
  attention: 'var(--drop-attention, #d97706)',
  critical: 'var(--drop-critical, #b91c1c)',
};
