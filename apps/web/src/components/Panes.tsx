'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { session, type SessionSnapshot } from '@/lib/terminal/session';
import { forge, type ForgedTool } from '@/lib/webmcp/forge';
import { ledger, type LedgerRow } from '@/lib/webmcp/ledger';
import { FIXED_TOOL_NAMES } from '@/lib/webmcp/schemas';
import type { RegistrationState } from '@/lib/webmcp/register';
import { tryAsAgent } from './ForgeCard';

const EMPTY: never[] = [];

export function useSession(): SessionSnapshot {
  return useSyncExternalStore((fn) => session.subscribe(fn), () => session.snapshot(), () => session.snapshot());
}
export function useLedger(): LedgerRow[] {
  return useSyncExternalStore((fn) => ledger.subscribe(fn), () => ledger.snapshot(), () => EMPTY);
}
export function useForged(): ForgedTool[] {
  return useSyncExternalStore((fn) => forge.subscribe(fn), forgedSnapshot, () => EMPTY);
}
let forgedCache: { key: string; value: ForgedTool[] } = { key: '', value: [] };
function forgedSnapshot(): ForgedTool[] {
  const tools = forge.tools();
  const key = tools.map((t) => `${t.name}:${t.hash}:${t.visible}:${t.pinned}:${t.runs}:${t.stats.length}`).join('|');
  if (key !== forgedCache.key) forgedCache = { key, value: tools };
  return forgedCache.value;
}

export function StatusBar({ reg }: { reg: RegistrationState | { kind: 'pending' } }) {
  const s = useSession();
  const st = s.lastStatus;
  const chip = (text: string, tone: 'ok' | 'muted' | 'danger' | 'accent') => (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ${tone === 'ok' ? 'bg-emerald-100 text-emerald-800' : tone === 'danger' ? 'bg-red-100 text-red-800' : tone === 'accent' ? 'bg-amber-100 text-amber-800' : 'bg-line text-muted'}`}>{text}</span>
  );
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-line pb-2" data-statusbar>
      <h1 className="text-2xl leading-none text-ink" style={{ fontFamily: 'var(--font-serif), serif' }}>
        Rokan Terminal
      </h1>
      <span className="text-xs text-muted">Do it once. Now it&apos;s a tool.</span>
      <span className="ml-auto flex flex-wrap items-center gap-2 text-xs">
        {s.mode === 'unpaired' && chip('no shell', 'muted')}
        {s.state === 'connecting' && chip('pairing…', 'accent')}
        {s.state === 'paired' && chip(`${s.hello?.mode === 'judge' ? 'judge sandbox' : 'paired'} · ${s.hello?.shell ?? 'shell'}${s.hello?.integration ? '' : ' · no shell integration'}`, 'ok')}
        {s.state === 'paired' && s.hello?.expires_at && <Countdown until={s.hello.expires_at} />}
        {s.state === 'disconnected' && chip(s.reconnectAt ? `disconnected · retrying` : 'disconnected', 'danger')}
        {s.state === 'busy' && chip('another tab is paired', 'danger')}
        {s.state === 'unauthorized' && chip('link not valid', 'danger')}
        {s.host && <span className="mono text-muted">{s.host}</span>}
        {s.share && st?.cwd && <span className="mono text-muted">{st.cwd}</span>}
        {st && st.last_exit_code !== null && (
          <span className="mono text-muted" data-last-exit>
            exit {st.last_exit_code} · {st.last_command_ms ?? '–'} ms{s.hello?.integration ? '' : ' (unmeasured)'}
          </span>
        )}
        {reg.kind === 'registered' ? chip(`tools · ${FIXED_TOOL_NAMES.length + forge.visibleCount()}`, 'ok') : reg.kind === 'unsupported' ? chip('no WebMCP in this browser', 'muted') : null}
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={s.share} onChange={(e) => session.setShare(e.target.checked)} data-share />
          Share screen
        </label>
        {(s.state === 'disconnected' || s.state === 'busy' || s.state === 'unauthorized') && (
          <button onClick={() => session.reconnectNow()} className="rounded border border-line px-2 py-0.5" data-reconnect>
            Reconnect
          </button>
        )}
      </span>
    </header>
  );
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return (
    <span className="mono text-muted" data-expires>
      expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  );
}

export function ToolsPane({ reg }: { reg: RegistrationState | { kind: 'pending' } }) {
  const forged = useForged();
  const rows = useLedger();
  const [tryOut, setTryOut] = useState<string | null>(null);
  const visible = forged.filter((t) => t.visible).length;
  const registeredThisSession = rows.filter((r) => r.kind === 'registered' || r.kind === 'forged' || r.kind === 'restored').length;
  return (
    <section className="rounded-md border border-line bg-white p-3 text-sm" data-tools-pane>
      <h2 className="font-medium">Site tools · {reg.kind === 'registered' ? FIXED_TOOL_NAMES.length + visible : 0}</h2>
      <p className="text-xs text-muted">
        {reg.kind === 'registered' ? `Registered this session: ${registeredThisSession} · forged visible ${visible}/5` : reg.kind === 'unsupported' ? 'Agent tools need ChatGPT desktop (GPT-5.6 Sol/Terra) or Chrome 149+ with WebMCP. The terminal still works.' : reg.kind === 'error' ? `registerTool failed: ${reg.message}` : 'Detecting document.modelContext…'}
      </p>
      <ul className="mt-2 space-y-0.5 text-xs text-muted">
        {FIXED_TOOL_NAMES.map((n) => (
          <li key={n}>
            <code className="mono">{n}</code>
          </li>
        ))}
      </ul>
      <h3 className="mt-3 text-xs font-medium">Forged tools</h3>
      {forged.length === 0 ? (
        <p className="text-xs text-muted">None yet. Select lines in the terminal and press “Forge this”, or ask your agent to forge one.</p>
      ) : (
        <ul className="mt-1 space-y-1.5 text-xs">
          {forged.map((t) => {
            const entry = forge.list().tools.find((x) => x.name === t.name);
            return (
              <li key={t.name} className="flex flex-wrap items-center gap-1.5" data-forged={t.name}>
                <code className="mono">{t.tool}</code>
                <span className={`rounded px-1 text-[10px] uppercase ${t.spec.kind === 'write' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{t.spec.kind}</span>
                <span className="mono text-muted">{t.hash}</span>
                <span className="text-muted">
                  {entry?.runs ?? 0} runs{entry?.median_ms != null ? ` · ${entry.median_ms} ms` : ''}{entry?.last_exit != null ? ` · exit ${entry.last_exit}` : ''}
                </span>
                {!t.visible && <span className="text-danger">evicted</span>}
                <button onClick={() => forge.pin(t.name, !t.pinned)} className="text-muted underline">
                  {t.pinned ? 'unpin' : 'pin'}
                </button>
                {!t.visible && (
                  <button onClick={() => void forge.restore(t.name)} className="text-muted underline">
                    restore
                  </button>
                )}
                {t.visible && t.registered && (
                  <button onClick={() => void tryAsAgent(t.name).then(setTryOut)} className="text-muted underline" data-try={t.name}>
                    try as agent
                  </button>
                )}
                <button onClick={() => forge.unforge(t.name)} className="text-muted underline">
                  unforge
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {tryOut && <p className="mono mt-2 break-all text-[11px] text-muted">executeTool → {tryOut}</p>}
    </section>
  );
}

export function LedgerPane() {
  const rows = useLedger();
  const countersigned = rows.filter((r) => r.bridge_sig).length;
  const download = () => {
    const blob = new Blob([JSON.stringify(ledger.export(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rokan-ledger-${ledger.session}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="flex min-h-0 flex-col rounded-md border border-line bg-white p-3 text-sm" data-ledger-pane>
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">Ledger · {rows.length}</h2>
        <span className="text-[11px] text-muted">
          countersigned by bridge {countersigned}/{rows.length} ·{' '}
          <button onClick={download} className="underline">
            export
          </button>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">Empty. Ask your agent to propose <code className="mono">ls</code>.</p>
      ) : (
        <ol className="mono mt-1 min-h-0 flex-1 space-y-0.5 overflow-auto text-[11px]">
          {[...rows].reverse().map((r) => (
            <li key={r.seq} className="flex gap-1 whitespace-nowrap" title={summarise(r)}>
              <span className="text-muted">{r.seq}</span>
              <span className={r.kind === 'forged' ? 'text-accent' : r.kind === 'executed_step' ? 'text-ok' : r.kind === 'dismissed' ? 'text-muted' : ''}>{r.kind}</span>
              <span className="min-w-0 truncate text-muted">{summarise(r)}</span>
              {r.bridge_sig && <span title="countersigned by the bridge">✓</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function summarise(r: LedgerRow): string {
  const f = r.fields;
  switch (r.kind) {
    case 'proposed':
      return String(f.command ?? '');
    case 'forged':
      return `${f.tool} ${f.hash} ${f.kind}`;
    case 'invoked':
      return `${f.tool} ×${f.steps} ${f.hash}`;
    case 'executed_step':
      return `${f.tool ?? ''} step ${f.step ?? ''} exit ${f.exit_code ?? '–'} · ${f.ms ?? '–'} ms${f.rokan_calls === 0 ? ` · calls:0 ⚡ ${f.rokan_ms} ms` : typeof f.rokan_ms === 'number' ? ` · rokan ${f.rokan_ms} ms` : ''}`;
    case 'screen_read':
      return f.shared ? `${f.lines} lines, ${f.redactions} redacted` : 'refused (share off)';
    case 'paired':
    case 'reconnected':
      return `${f.host} · ${f.pair_ms ?? '–'} ms`;
    case 'registered':
      return `${String(f.tools ?? '').split(',').length} tools · ${f.ms ?? '–'} ms`;
    default:
      return Object.entries(f)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
  }
}

const SANDBOX_URL = process.env.NEXT_PUBLIC_SANDBOX_URL ?? '';

export function PairingCard() {
  const s = useSession();
  const cmd = 'node packages/bridge/bin/rokan-terminal.js'; // `npx rokan-terminal` once published
  const [judgeErr, setJudgeErr] = useState<string | null>(null);
  const [coldMs, setColdMs] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (s.judge !== 'starting') return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [s.judge]);
  const tryJudge = async () => {
    setJudgeErr(null);
    setTick(0);
    const r = await session.startJudge(SANDBOX_URL);
    if (!r.ok) setJudgeErr(r.retry_after_s ? `${r.error} (retry in ${r.retry_after_s} s)` : r.error);
    else setColdMs(r.cold_ms);
  };
  return (
    <section className="rounded-md border border-line bg-white p-4 text-sm" data-pairing>
      <h2 className="font-medium">
        {s.state === 'busy' ? 'Another tab is already paired with this bridge' : s.state === 'unauthorized' ? 'This pairing link is not valid' : 'Pair your terminal'}
      </h2>
      {SANDBOX_URL && s.state === 'unpaired' && (
        <div className="mt-2 rounded border border-accent/40 bg-amber-50 p-2 text-xs">
          <button data-judge onClick={tryJudge} disabled={s.judge === 'starting'} className="rounded bg-ink px-3 py-1 text-white disabled:opacity-40">
            {s.judge === 'starting' ? `starting a sandbox… ${tick} s` : 'Try it now — judge sandbox, nothing to install'}
          </button>
          <span className="ml-2 text-muted">A throttled 30-minute Linux container on Cloudflare; 3 per IP per 10 min.</span>
          {coldMs !== null && <span className="ml-2 text-muted">ready in {coldMs} ms</span>}
          {judgeErr && <p className="mt-1 text-danger">{judgeErr}</p>}
        </div>
      )}
      {s.state === 'busy' && <p className="mt-1 text-xs text-muted">Close the other tab, or start a new bridge and use its link.</p>}
      {s.state === 'unauthorized' && <p className="mt-1 text-xs text-muted">Run the bridge again and open the new link it prints. Links carry a one-time token.</p>}
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>
          On your machine: <code className="mono select-all rounded bg-bg px-1 text-ink">{cmd}</code>{' '}
          <button onClick={() => void navigator.clipboard?.writeText(cmd)} className="underline">
            copy
          </button>
        </li>
        <li>Open the link it prints. The token stays in this tab; the agent never sees it.</li>
        <li>Until then, proposals appear on the prompt line below — the tools already work.</li>
      </ol>
    </section>
  );
}

export function MobileCard() {
  return (
    <main className="mx-auto max-w-md p-6 text-sm">
      <h1 className="text-2xl" style={{ fontFamily: 'var(--font-serif), serif' }}>
        Rokan Terminal
      </h1>
      <p className="mt-2">Do it once. Now it&apos;s a tool.</p>
      <p className="mt-4 text-muted">Open this on a desktop browser — ChatGPT desktop (GPT-5.6 Sol/Terra) or Chrome 149+ with WebMCP — to pair a terminal.</p>
    </main>
  );
}
