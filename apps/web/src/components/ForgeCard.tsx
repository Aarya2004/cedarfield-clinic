'use client';

/**
 * The Forge card: the human's review of a tool before it is born. Editable name, description,
 * commands, params and kind; validation from `validateForgeSpec`; dangerous needs "Approve anyway".
 * Approve calls the engine; the engine registers the tool; nothing runs.
 */
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { forge, type ForgeCard as Card } from '@/lib/webmcp/forge';
import { forgedInputSchema, isMutating, substituteParams, validateForgeSpec, type ForgeParam, type ForgeSpec } from '@/lib/webmcp/forge-spec';
import { isDangerousIn } from '@/lib/webmcp/schemas';
import { session } from '@/lib/terminal/session';
import { getModelContext } from '@/lib/webmcp/types';
import { note } from '@/lib/webmcp/fieldnotes';
import { KindBadge } from './Chip';
import { explainForgeError, hasPlaceholders, splitPlaceholders } from './forge/forge-preview';

const FIELD = 'mt-0.5 w-full rounded border border-line bg-white px-2 py-1 text-sm text-ink placeholder:text-muted/70 focus:border-accent';
const SMALL_FIELD = 'min-w-0 rounded border border-line bg-white px-1.5 py-1 text-xs text-ink placeholder:text-muted/70 focus:border-accent';
const ICON_BTN = 'rounded px-1 text-xs text-muted hover:text-danger';
const LINK_BTN = 'mt-1 rounded-sm text-xs text-muted underline decoration-line underline-offset-2 hover:decoration-ink';

/** Enter inside a card field must never approve — Approve is a click, by design. */
const noEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.preventDefault();
};

export function ForgeCardView({ card }: { card: Card }) {
  const [spec, setSpec] = useState<ForgeSpec>(card.spec);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSpec(card.spec), [card.card_id, card.spec]);

  const validation = useMemo(() => validateForgeSpec(spec), [spec]);
  const judge = session.snapshot().hello?.mode === 'judge';
  const dangerousAt = spec.commands.map((c, i) => (isDangerousIn(c, judge ? 'judge' : 'builder') ? i + 1 : 0)).filter(Boolean);
  const dangerous = dangerousAt.length > 0;
  const mutating = spec.commands.some(isMutating);
  const kindForced = spec.kind === 'read' && mutating;
  const paramNames = useMemo(() => spec.params.map((p) => p.name), [spec.params]);
  const showPreviews = hasPlaceholders(spec.commands);
  // What the agent's call would ghost-type with the example values — the same substitution the
  // engine runs at invocation, so the human sees the substituted span before Approve.
  const examplePreview = useMemo(() => {
    if (!showPreviews || validation) return null;
    const input: Record<string, string> = {};
    for (const p of spec.params) input[p.name] = p.example;
    const r = substituteParams(spec.commands, spec.params, input);
    return 'error' in r ? null : r.lines;
  }, [spec, showPreviews, validation]);

  const approve = async () => {
    setBusy(true);
    setErr(null);
    const r = await forge.approve(card.card_id, spec, { confirmDangerous: confirm });
    setBusy(false);
    if ('error' in r) {
      if (r.error === 'needs_confirmation') setConfirm(true);
      setErr(explainForgeError(r));
      return;
    }
    note('card.approved_ui', { edited: JSON.stringify(spec) !== JSON.stringify(card.spec) });
  };

  // Identity before approval: the hash the tool will carry and the exact schema the agent will see (SELF-REVIEW gap 6).
  const [hash, setHash] = useState<string>('…');
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => void forge.hashOf(spec).then((h) => live && setHash(h)).catch(() => live && setHash('?')), 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [spec]);
  const schemaPreview = useMemo(() => JSON.stringify(forgedInputSchema(spec)), [spec]);
  const setParam = (i: number, patch: Partial<ForgeParam>) => setSpec({ ...spec, params: spec.params.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setCommand = (i: number, v: string) => setSpec({ ...spec, commands: spec.commands.map((c, j) => (j === i ? v : c)) });

  const cardId = `card-${card.card_id}`;
  return (
    <section data-card={card.card_id} aria-labelledby={`${cardId}-title`} aria-busy={busy} className={`rounded-md border-2 bg-white p-4 text-sm ${dangerous ? 'border-danger' : 'border-accent'}`}>
      {/* identity: what will be born */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 id={`${cardId}-title`} className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
          <span className="text-muted">Forge</span>
          <code className="mono break-all text-base text-ink">forged_{spec.name || '…'}</code>
          <KindBadge kind={spec.kind} />
        </h3>
      </div>
      <div className="mono mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted">
        <span title="sha-256 of the canonical spec, first 12 hex — recomputed as you edit">
          hash <code className="text-ink" data-card-hash>{hash}</code>
        </span>
        <span>·</span>
        <span title={card.origin === 'agent' ? 'The agent asked for this via forge_create' : 'You selected these lines and pressed Forge this'}>from {card.origin}</span>
        {card.previousHash && (
          <>
            <span>·</span>
            <span title="A tool with this name exists; Approve replaces it">replaces {card.previousHash} →</span>
          </>
        )}
      </div>

      {dangerous && (
        <p className="mt-2 rounded border border-danger/50 bg-red-50 px-2 py-1.5 text-xs text-danger" role="alert">
          <strong>⚠ Hard-blocked pattern in command {dangerousAt.join(', ')}.</strong> A command matches a hard-blocked pattern. Approve twice to confirm.{confirm ? ' Press “Approve anyway” to confirm.' : ''}
        </p>
      )}
      {(card.kindOverridden || kindForced) && <p className="mt-1 text-xs text-muted">kind is “write” because a command changes state.</p>}

      <label className="mt-3 block text-xs text-muted">
        name
        <input value={spec.name} onChange={(e) => setSpec({ ...spec, name: e.target.value })} onKeyDown={noEnter} className={`mono ${FIELD}`} spellCheck={false} autoComplete="off" placeholder="lower_snake, 2–29 chars" />
      </label>
      <label className="mt-2 block text-xs text-muted">
        description (what the agent reads)
        <input value={spec.description} onChange={(e) => setSpec({ ...spec, description: e.target.value })} onKeyDown={noEnter} className={FIELD} placeholder="What this does and when to call it" />
      </label>

      <div className="mt-2 text-xs text-muted" id={`${cardId}-cmds`}>
        commands — each needs your Enter; use {'{{param}}'} for values
      </div>
      {spec.commands.map((c, i) => (
        <div key={i} className="mt-1">
          <div className="flex items-center gap-1">
            <span className="mono w-4 text-right text-xs text-muted">{i + 1}.</span>
            <input value={c} onChange={(e) => setCommand(i, e.target.value)} onKeyDown={noEnter} aria-label={`command ${i + 1}`} className={`mono ${FIELD} mt-0`} spellCheck={false} autoComplete="off" />
            {spec.commands.length > 1 && (
              <button onClick={() => setSpec({ ...spec, commands: spec.commands.filter((_, j) => j !== i) })} className={ICON_BTN} aria-label={`remove command ${i + 1}`} title="remove command">
                ✕
              </button>
            )}
          </div>
          {showPreviews && c.includes('{{') && (
            <div className="mono ml-5 mt-0.5 break-all text-[11px] leading-4 text-muted" aria-label={`command ${i + 1} with placeholders highlighted`}>
              {splitPlaceholders(c, paramNames).map((seg, k) =>
                seg.kind === 'text' ? (
                  <span key={k}>{seg.text}</span>
                ) : (
                  <span key={k} className={`rounded-sm px-0.5 ${seg.kind === 'param' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'}`} title={seg.kind === 'param' ? `param ${seg.name}` : `${seg.name} is not a declared param`}>
                    {seg.text}
                  </span>
                ),
              )}
              {examplePreview?.[i] != null && (
                <span className="block text-muted">
                  <span className="text-muted/70">with examples → </span>
                  <span className="text-ink">{examplePreview[i]}</span>
                </span>
              )}
            </div>
          )}
        </div>
      ))}
      {spec.commands.length < 5 && (
        <button onClick={() => setSpec({ ...spec, commands: [...spec.commands, ''] })} className={LINK_BTN}>
          + command
        </button>
      )}

      <div className="mt-2 text-xs text-muted">params{spec.params.length === 0 && showPreviews ? ' — every {{placeholder}} needs one' : ''}</div>
      {spec.params.map((p, i) => (
        <div key={i} className="mt-1 grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,4.5rem)_1.25rem] gap-1">
          <input value={p.name} onChange={(e) => setParam(i, { name: e.target.value })} onKeyDown={noEnter} placeholder="name" title="param name" aria-label={`param ${i + 1} name`} className={`mono ${SMALL_FIELD}`} spellCheck={false} autoComplete="off" />
          <input value={p.description} onChange={(e) => setParam(i, { description: e.target.value })} onKeyDown={noEnter} placeholder="description" title="what the agent reads" aria-label={`param ${i + 1} description`} className={SMALL_FIELD} />
          <input value={p.example} onChange={(e) => setParam(i, { example: e.target.value })} onKeyDown={noEnter} placeholder="e.g." title="example value" aria-label={`param ${i + 1} example`} className={`mono ${SMALL_FIELD}`} spellCheck={false} autoComplete="off" />
          <button onClick={() => setSpec({ ...spec, params: spec.params.filter((_, j) => j !== i) })} className={ICON_BTN} aria-label={`remove param ${p.name || i + 1}`} title="remove param">
            ✕
          </button>
        </div>
      ))}
      {spec.params.length < 6 && (
        <button onClick={() => setSpec({ ...spec, params: [...spec.params, { name: '', description: '', example: '' }] })} className={LINK_BTN}>
          + param
        </button>
      )}

      <fieldset className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <legend className="sr-only">kind</legend>
        <span className="text-muted">kind</span>
        <label className={`flex items-center gap-1 ${mutating ? 'text-muted' : ''}`} title={mutating ? 'A command changes state, so this tool is a write' : undefined}>
          <input type="radio" name={`${cardId}-kind`} checked={spec.kind === 'read'} disabled={mutating} onChange={() => setSpec({ ...spec, kind: 'read' })} className="accent-amber-600" /> read
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name={`${cardId}-kind`} checked={spec.kind === 'write'} onChange={() => setSpec({ ...spec, kind: 'write' })} className="accent-amber-600" /> write (CONSEQUENTIAL)
        </label>
      </fieldset>
      <p className="mt-2 text-xs text-muted">The agent can call this. Each command still needs your Enter.</p>
      <details className="mt-1 text-xs text-muted">
        <summary className="cursor-pointer rounded-sm">schema the agent will see</summary>
        <code className="mono block whitespace-pre-wrap break-all" data-card-schema>
          {schemaPreview}
        </code>
      </details>
      {validation && (
        <p className="mt-1 text-xs text-danger" data-card-error role="alert">
          {validation.error}
          {validation.detail ? `: ${validation.detail}` : ''}
        </p>
      )}
      {err && !validation && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {err}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          data-approve
          onClick={approve}
          disabled={!!validation || busy}
          aria-busy={busy}
          title={validation ? 'Fix the error above to approve' : confirm ? 'Registers the tool despite the hard-blocked pattern; nothing runs' : 'Registers forged_' + spec.name + ' with the browser; nothing runs'}
          className={`rounded px-3 py-1 text-xs text-white disabled:opacity-40 ${confirm ? 'bg-danger hover:bg-red-800' : 'bg-ink hover:bg-zinc-800'}`}
        >
          {busy ? 'Approving…' : confirm ? 'Approve anyway' : 'Approve'}
        </button>
        <button data-reject onClick={() => forge.reject(card.card_id)} disabled={busy} className="rounded border border-line bg-white px-3 py-1 text-xs hover:border-ink disabled:opacity-40" title="Discard this card; nothing was registered">
          Reject
        </button>
        {validation && <span className="text-[11px] text-muted">Approve unlocks when the card validates.</span>}
      </div>
    </section>
  );
}

/** "Try as agent": call the spec's own executeTool for a forged tool with its example inputs. */
export async function tryAsAgent(name: string): Promise<string> {
  const mc = getModelContext();
  const t = forge.tool(name);
  if (!mc || !t) return 'not available';
  const tools = await mc.getTools();
  const rt = tools.find((x) => x.name === t.tool);
  if (!rt) return 'tool not registered';
  const input: Record<string, string> = {};
  for (const p of t.spec.params) input[p.name] = p.example;
  const t0 = performance.now();
  // Chrome 152 wants a JSON string here (FIELD-NOTES #6).
  const out = await mc.executeTool(rt, JSON.stringify(input));
  note('try_as_agent', { tool: t.tool, ms: Math.round(performance.now() - t0) });
  return typeof out === 'string' ? out : JSON.stringify(out);
}
