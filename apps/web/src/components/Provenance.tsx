/**
 * The provenance chip (COMPOSE-PLAN §2.2): where a step's answer came from, in one glyph.
 * States — machine · native · <site> · compiled · <site> · ⚡ · planned · refused. Used inline
 * after terminal result lines, in Tools rows and in Ledger rows. Purely presentational: every
 * value shown must already be measured by the caller (ms/calls come from the bridge trailer,
 * site/tool from the rokan result line) — this component never invents a number.
 */
import { Chip, type ChipTone } from './Chip';

export type ProvenanceKind = 'machine' | 'native' | 'compiled' | 'planned' | 'refused';

export interface Provenance {
  kind: ProvenanceKind;
  /** Site the step touched (native/compiled), e.g. "allbirds.com". */
  site?: string;
  /** Native tool name the site's own registration served, e.g. "search_catalog". */
  tool?: string;
  /** Wall ms, measured by the code that ran the step. */
  ms?: number;
  /** Model calls spent on this step — 0 is the number we want on screen. */
  calls?: number;
}

const KIND: Record<ProvenanceKind, { tone: ChipTone; glyph: string; title: string }> = {
  machine: { tone: 'muted', glyph: '', title: 'Ran on the paired machine — your shell, your Enter.' },
  native: { tone: 'ok', glyph: '⚙', title: "Served by the site's own WebMCP tools — called natively, no DOM." },
  compiled: { tone: 'accent', glyph: '⚡', title: 'Replayed a compiled operation — retired when the site ships native tools.' },
  planned: { tone: 'muted', glyph: '', title: 'The model planned this run — the next run replays it.' },
  refused: { tone: 'danger', glyph: '', title: 'The page drifted from the compiled operation — refused instead of guessing.' },
};

export function ProvenanceChip({ p }: { p: Provenance }) {
  const k = KIND[p.kind];
  const parts = [p.kind, p.site, p.tool, p.ms != null ? `${p.ms} ms` : null, p.calls != null ? `${p.calls} calls` : null].filter((x): x is string => Boolean(x));
  return (
    <Chip tone={k.tone} title={k.title} className="mono">
      {k.glyph && <span aria-hidden>{k.glyph}</span>}
      {parts.join(' · ')}
    </Chip>
  );
}
