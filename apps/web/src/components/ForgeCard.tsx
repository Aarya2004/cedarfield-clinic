'use client';

/**
 * The Forge card: the human's review of a tool before it is born. Editable name, description,
 * commands, params and kind; validation from `validateForgeSpec`; dangerous needs "Approve anyway".
 * Approve calls the engine; the engine registers the tool; nothing runs.
 */
import { useEffect, useMemo, useState } from 'react';
import { forge, type ForgeCard as Card } from '@/lib/webmcp/forge';
import { forgedInputSchema, isMutating, validateForgeSpec, type ForgeParam, type ForgeSpec } from '@/lib/webmcp/forge-spec';
import { isDangerousIn } from '@/lib/webmcp/schemas';
import { session } from '@/lib/terminal/session';
import { getModelContext } from '@/lib/webmcp/types';
import { note } from '@/lib/webmcp/fieldnotes';

export function ForgeCardView({ card }: { card: Card }) {
  const [spec, setSpec] = useState<ForgeSpec>(card.spec);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSpec(card.spec), [card.card_id, card.spec]);

  const validation = useMemo(() => validateForgeSpec(spec), [spec]);
  const dangerous = spec.commands.some((c) => isDangerousIn(c, session.snapshot().hello?.mode === 'judge' ? 'judge' : 'builder'));
  const mutating = spec.commands.some(isMutating);
  const kindForced = spec.kind === 'read' && mutating;

  const approve = async () => {
    setBusy(true);
    const r = await forge.approve(card.card_id, spec, { confirmDangerous: confirm });
    setBusy(false);
    if ('error' in r) {
      if (r.error === 'needs_confirmation') setConfirm(true);
      setErr(`${r.error}${r.detail ? ': ' + r.detail : ''}`);
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

  return (
    <section data-card={card.card_id} className={`rounded-md border-2 bg-white p-4 text-sm ${dangerous ? 'border-danger' : 'border-accent'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">
          Forge <code className="mono">forged_{spec.name || '…'}</code>
          <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${spec.kind === 'write' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{spec.kind}</span>
        </h3>
        <span className="text-xs text-muted">
          from {card.origin} · hash <code className="mono" data-card-hash>{hash}</code>
          {card.previousHash ? ` · replaces ${card.previousHash} →` : ''}
        </span>
      </div>
      {dangerous && <p className="mt-1 text-xs text-danger">⚠ A command matches a hard-blocked pattern. Approve twice to confirm.</p>}
      {(card.kindOverridden || kindForced) && <p className="mt-1 text-xs text-muted">kind is “write” because a command changes state.</p>}

      <label className="mt-3 block text-xs text-muted">
        name
        <input value={spec.name} onChange={(e) => setSpec({ ...spec, name: e.target.value })} className="mono mt-0.5 w-full rounded border border-line px-2 py-1 text-sm text-ink" spellCheck={false} />
      </label>
      <label className="mt-2 block text-xs text-muted">
        description (what the agent reads)
        <input value={spec.description} onChange={(e) => setSpec({ ...spec, description: e.target.value })} className="mt-0.5 w-full rounded border border-line px-2 py-1 text-sm text-ink" />
      </label>
      <div className="mt-2 text-xs text-muted">commands — each needs your Enter; use {'{{param}}'} for values</div>
      {spec.commands.map((c, i) => (
        <div key={i} className="mt-1 flex gap-1">
          <span className="mono pt-1 text-xs text-muted">{i + 1}.</span>
          <input value={c} onChange={(e) => setCommand(i, e.target.value)} className="mono w-full rounded border border-line px-2 py-1 text-sm text-ink" spellCheck={false} />
          {spec.commands.length > 1 && (
            <button onClick={() => setSpec({ ...spec, commands: spec.commands.filter((_, j) => j !== i) })} className="text-xs text-muted">
              ✕
            </button>
          )}
        </div>
      ))}
      {spec.commands.length < 5 && (
        <button onClick={() => setSpec({ ...spec, commands: [...spec.commands, ''] })} className="mt-1 text-xs text-muted underline">
          + command
        </button>
      )}
      <div className="mt-2 text-xs text-muted">params</div>
      {spec.params.map((p, i) => (
        <div key={i} className="mt-1 grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,4.5rem)_1rem] gap-1">
          <input value={p.name} onChange={(e) => setParam(i, { name: e.target.value })} placeholder="name" title="param name" className="mono min-w-0 rounded border border-line px-1.5 py-1 text-xs" spellCheck={false} />
          <input value={p.description} onChange={(e) => setParam(i, { description: e.target.value })} placeholder="description" title="what the agent reads" className="min-w-0 rounded border border-line px-1.5 py-1 text-xs" />
          <input value={p.example} onChange={(e) => setParam(i, { example: e.target.value })} placeholder="e.g." title="example value" className="mono min-w-0 rounded border border-line px-1.5 py-1 text-xs" spellCheck={false} />
          <button onClick={() => setSpec({ ...spec, params: spec.params.filter((_, j) => j !== i) })} className="text-xs text-muted" title="remove param">
            ✕
          </button>
        </div>
      ))}
      {spec.params.length < 6 && (
        <button onClick={() => setSpec({ ...spec, params: [...spec.params, { name: '', description: '', example: '' }] })} className="mt-1 text-xs text-muted underline">
          + param
        </button>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs">
        <span className="text-muted">kind</span>
        <label className="flex items-center gap-1">
          <input type="radio" checked={spec.kind === 'read'} disabled={mutating} onChange={() => setSpec({ ...spec, kind: 'read' })} /> read
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={spec.kind === 'write'} onChange={() => setSpec({ ...spec, kind: 'write' })} /> write (CONSEQUENTIAL)
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">The agent can call this. Each command still needs your Enter.</p>
      <details className="mt-1 text-xs text-muted">
        <summary>schema the agent will see</summary>
        <code className="mono block whitespace-pre-wrap break-all" data-card-schema>{schemaPreview}</code>
      </details>
      {validation && (
        <p className="mt-1 text-xs text-danger" data-card-error>
          {validation.error}
          {validation.detail ? `: ${validation.detail}` : ''}
        </p>
      )}
      {err && !validation && <p className="mt-1 text-xs text-danger">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button data-approve onClick={approve} disabled={!!validation || busy} className="rounded bg-ink px-3 py-1 text-xs text-white disabled:opacity-40">
          {confirm ? 'Approve anyway' : 'Approve'}
        </button>
        <button data-reject onClick={() => forge.reject(card.card_id)} className="rounded border border-line px-3 py-1 text-xs">
          Reject
        </button>
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
