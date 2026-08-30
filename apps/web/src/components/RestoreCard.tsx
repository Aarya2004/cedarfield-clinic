'use client';

/**
 * Kept tools, offered back after a reload (COMPOSE-PLAN §3).
 *
 * A quiet rail section, not a modal and not a hero: it sits directly under Site tools, so a judge
 * who reloads sees the tools this browser kept next to the tools it currently has — and a judge who
 * has never forged anything sees nothing at all (the section renders `null` on an empty store).
 *
 * Loading the store registers nothing. `Restore` walks the entries one at a time through the same
 * `openCard` → `approve` path the Forge card uses, so the human's one click is the approval; a spec
 * that trips a hard-blocked pattern is NOT confirmed here — its card is left open in the Forge pane
 * for a deliberate second look. `Not now` only hides the section: the store is never cleared by a
 * dismissal, and the same tools are offered again on the next reload.
 *
 * Every hash on screen is the hash the entry was stored with, recomputed against this engine by
 * `verifyKeptHashes`; a mismatch is labelled, never hidden and never silently trusted.
 */
import { useEffect, useMemo, useState } from 'react';
import { forge } from '@/lib/webmcp/forge';
import { loadKept, verifyKeptHashes, type KeptTool } from '@/lib/webmcp/kept';
import { ledger } from '@/lib/webmcp/ledger';
import { note } from '@/lib/webmcp/fieldnotes';
import { pendingKept, restoreKept, restoreRows, restoreSummary, type RestoreRow } from '@/lib/webmcp/restore';
import { Chip } from './Chip';
import { useForged } from './Panes';

const LINK = 'rounded-sm underline decoration-line underline-offset-2 hover:decoration-ink';

export function RestoreCard() {
  const forged = useForged();
  const [loaded, setLoaded] = useState<KeptTool[] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  // name → true when the stored hash no longer matches what this engine computes.
  const [drift, setDrift] = useState<Record<string, boolean>>({});

  // Read once, on the client: `loadKept` is sync, validated, and registers nothing.
  useEffect(() => {
    setLoaded(loadKept(typeof window === 'undefined' ? null : window.localStorage));
  }, []);

  const pending = useMemo(() => (loaded ? pendingKept(loaded, forged) : []), [loaded, forged]);

  useEffect(() => {
    if (pending.length === 0) return;
    let live = true;
    void verifyKeptHashes(pending, (spec) => forge.hashOf(spec)).then((v) => {
      if (!live) return;
      setDrift(Object.fromEntries(v.map((x) => [x.entry.spec.name, x.changed])));
    });
    return () => {
      live = false;
    };
  }, [pending]);

  if (dismissed || pending.length === 0) return null;

  // Until the hashes come back, nothing is claimed to have drifted — an unknown is not a warning.
  const rows: RestoreRow[] = restoreRows(pending.map((entry) => ({ entry, changed: drift[entry.spec.name] === true })));
  const drifted = rows.filter((r) => r.changed).length;

  const restore = async () => {
    setBusy(true);
    setResult(null);
    const out = await restoreKept(pending, { engine: forge, ledger });
    setBusy(false);
    setResult(restoreSummary(out));
    note('kept.restored', { asked: out.length, restored: out.filter((o) => o.status === 'restored').length, drifted });
  };

  const dismiss = () => {
    setDismissed(true);
    note('kept.dismissed', { pending: pending.length });
  };

  return (
    <section className="shrink-0 border-b border-line p-2.5 text-sm" data-restore-card aria-labelledby="restore-title">
      <h2 id="restore-title" className="text-xs font-medium">
        Kept tools · {pending.length}
      </h2>
      <p className="mt-0.5 text-xs text-muted">
        Forged here before, kept in this browser. Restore re-approves each one under the hash it was kept with. Nothing runs — every command still waits for your Enter.
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {rows.map((r) => (
          <li key={r.name} className="rounded border border-line bg-bg px-2 py-1.5" data-kept={r.name}>
            <div className="flex flex-wrap items-center gap-1.5">
              <code className="mono break-all text-ink">{r.tool}</code>
              {r.changed && (
                <Chip tone="accent" title="The stored spec no longer hashes to the hash it was kept with. Read its commands on the card before you approve it.">
                  needs a fresh look
                </Chip>
              )}
            </div>
            <div className="mono mt-1 text-[11px] text-muted" title="sha-256 of the canonical spec as it was kept, first 12 hex">
              {r.hash}
            </div>
          </li>
        ))}
      </ul>
      {drifted > 0 && (
        <p className="mt-1.5 text-[11px] text-muted">
          {drifted === 1 ? 'One spec no longer matches its stored hash.' : `${drifted} specs no longer match their stored hashes.`} Read the commands on the card before you approve.
        </p>
      )}
      {result && (
        <p className="mt-1.5 text-[11px] text-muted" data-restore-result aria-live="polite">
          {result}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          data-restore-approve
          onClick={() => void restore()}
          disabled={busy}
          aria-busy={busy}
          className="btn-ink rounded px-3 py-1 text-xs disabled:opacity-40"
          title="Registers each kept tool again through the forge's approval path. A command that matches a hard-blocked pattern stops and waits in Forge."
        >
          {busy ? 'Restoring…' : pending.length === 1 ? 'Restore' : `Restore all ${pending.length}`}
        </button>
        <button data-restore-dismiss onClick={dismiss} disabled={busy} className={`${LINK} text-[11px] text-muted disabled:opacity-40`} title="Hides this. The tools stay kept in this browser and are offered again on the next reload.">
          Not now
        </button>
      </div>
    </section>
  );
}
