'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { session, type SessionSnapshot } from '@/lib/terminal/session';
import { getTheme, setTheme, subscribeTheme, type Theme } from '@/lib/theme';
import { forge, type ForgedTool } from '@/lib/webmcp/forge';
import { LEDGER_MAX_ROWS, ledger, type LedgerRow } from '@/lib/webmcp/ledger';
import { FIXED_TOOL_NAMES } from '@/lib/webmcp/schemas';
import type { RegistrationState } from '@/lib/webmcp/register';
import { tryAsAgent } from './ForgeCard';
import { Chip, KindBadge } from './Chip';
import { ProvenanceChip, type Provenance } from './Provenance';

const EMPTY: never[] = [];

/** How a stranger enables WebMCP; one sentence, reused wherever the browser lacks it. */
const UNSUPPORTED_LINE = 'No WebMCP in this browser. Open this page in Chrome 149+ with chrome://flags/#enable-webmcp-testing, or in ChatGPT desktop (GPT-5.6 Sol/Terra). The terminal works without it.';

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

const LINK = 'rounded-sm underline decoration-line underline-offset-2 hover:decoration-ink';

export function StatusBar({ reg }: { reg: RegistrationState | { kind: 'pending' } }) {
  const s = useSession();
  const st = s.lastStatus;
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-line pb-2" data-statusbar>
      <h1 className="serif text-2xl leading-none text-ink">Rokan Terminal</h1>
      <span className="text-xs text-muted">Do it once. Now it&apos;s a tool. Now every agent can call it.</span>
      <span className="ml-auto flex flex-wrap items-center gap-2 text-xs">
        {s.mode === 'unpaired' && !s.pairError && <Chip tone="muted" title="No terminal is paired. Proposals still land on the prompt line; the tools already work.">no shell</Chip>}
        {s.state === 'connecting' && <Chip tone="accent">pairing…</Chip>}
        {s.state === 'paired' && (
          <Chip tone="ok" title={s.hello?.integration ? 'Shell integration on: exit codes and durations are measured by the shell.' : 'No shell integration: durations are not measured.'}>
            {`${s.hello?.mode === 'judge' ? 'judge sandbox' : 'paired'} · ${s.hello?.shell ?? 'shell'}${s.hello?.integration ? '' : ' · no shell integration'}`}
          </Chip>
        )}
        {s.state === 'paired' && s.hello?.expires_at && <Countdown until={s.hello.expires_at} />}
        {s.state === 'disconnected' && (s.reconnectAt ? <RetryChip at={s.reconnectAt} /> : <Chip tone="danger">disconnected</Chip>)}
        {s.state === 'ended' && <Chip tone="muted">session ended · start a new one below</Chip>}
        {s.state === 'busy' && <Chip tone="danger">another tab is paired</Chip>}
        {s.state === 'unauthorized' && <Chip tone="danger">link not valid</Chip>}
        {s.pairError && s.state === 'unpaired' && (
          <Chip tone="danger" title={s.pairError}>
            pairing refused · see below
          </Chip>
        )}
        {s.host && <span className="mono text-muted">{s.host}</span>}
        {s.share && st?.cwd && <span className="mono text-muted">{st.cwd}</span>}
        {st && st.last_exit_code !== null && (
          <span className="mono text-muted" data-last-exit title="Last command, as reported by the shell">
            exit {st.last_exit_code} · {st.last_command_ms ?? '–'} ms{s.hello?.integration ? '' : ' (unmeasured)'}
          </span>
        )}
        {reg.kind === 'registered' ? (
          <Chip tone="ok" title="Tools registered with document.modelContext right now: fixed + visible forged">{`tools · ${FIXED_TOOL_NAMES.length + forge.visibleCount()}`}</Chip>
        ) : reg.kind === 'unsupported' ? (
          <Chip tone="muted" title={UNSUPPORTED_LINE}>
            no WebMCP in this browser
          </Chip>
        ) : reg.kind === 'error' ? (
          <Chip tone="danger" title={reg.message}>
            tool registration failed
          </Chip>
        ) : null}
        <label className="flex cursor-pointer items-center gap-1" title="Off: terminal_read_screen and terminal_history return {shared:false}. On: the agent reads the screen and this session's recorded runs, with secrets redacted.">
          <input type="checkbox" checked={s.share} onChange={(e) => session.setShare(e.target.checked)} data-share className="accent-amber-600" />
          Share screen
        </label>
        <ThemeToggle />
        {(s.state === 'disconnected' || s.state === 'busy' || s.state === 'unauthorized') && (
          <button onClick={() => session.reconnectNow()} className="rounded border border-line bg-surface px-2 py-0.5 hover:border-ink" data-reconnect>
            Reconnect
          </button>
        )}
      </span>
    </header>
  );
}

const DARK_SNAPSHOT = 'dark' as Theme;

/** Labelled with the theme it switches to. Dark is the default; the terminal canvas ignores both. */
function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => DARK_SNAPSHOT);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button onClick={() => setTheme(next)} className="rounded border border-line bg-surface px-2 py-0.5 hover:border-ink" data-theme-toggle title="Switch this page between the light and dark theme; the terminal stays dark either way">
      {next === 'light' ? 'Light' : 'Dark'}
    </button>
  );
}

function RetryChip({ at }: { at: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.ceil((at - now) / 1000));
  return <Chip tone="danger">{s > 0 ? `disconnected · retrying in ${s} s` : 'disconnected · retrying…'}</Chip>;
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return (
    <span className="mono text-muted" data-expires title="This sandbox session ends at the bridge's expires_at">
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
  // A rail section, not a card: the rail draws the one border, sections divide with a hairline.
  return (
    <section className="max-h-[40%] shrink-0 overflow-y-auto border-b border-line p-2.5 text-sm" data-tools-pane>
      <h2 className="text-xs font-medium">Site tools · {reg.kind === 'registered' ? FIXED_TOOL_NAMES.length + visible : 0}</h2>
      <p className="text-xs text-muted">
        {reg.kind === 'registered' ? `Registered this session: ${registeredThisSession} · forged visible ${visible}/5` : reg.kind === 'unsupported' ? UNSUPPORTED_LINE : reg.kind === 'error' ? `registerTool failed: ${reg.message}` : 'Detecting document.modelContext…'}
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
        <p className="text-xs text-muted">None yet — the first takes about fifteen seconds. Forge one from lines you ran, from your agent, or from the hero’s example card.</p>
      ) : (
        <ul className="mt-1 space-y-1.5 text-xs">
          {forged.map((t) => {
            const entry = forge.list().tools.find((x) => x.name === t.name);
            return (
              <li key={t.name} className="rounded border border-line bg-bg px-2 py-1.5" data-forged={t.name}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <code className="mono break-all text-ink">{t.tool}</code>
                  <KindBadge kind={t.spec.kind} />
                  {!t.visible && (
                    <Chip tone="danger" title="Evicted to keep ≤ 5 forged tools visible; the agent cannot call it until you restore it.">
                      evicted
                    </Chip>
                  )}
                  {t.pinned && (
                    <Chip tone="muted" title="Pinned: never evicted by a newer tool.">
                      pinned
                    </Chip>
                  )}
                </div>
                <div className="mono mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted">
                  <span title="sha-256 of the canonical spec, first 12 hex">{t.hash}</span>
                  <span>·</span>
                  <span title="Runs recorded by the shell, this device">{entry?.runs ?? 0} runs</span>
                  {entry?.median_ms != null && (
                    <>
                      <span>·</span>
                      <span title="Median duration of the recorded runs, measured by the shell">median {entry.median_ms} ms</span>
                    </>
                  )}
                  {entry?.last_exit != null && (
                    <>
                      <span>·</span>
                      <span className={entry.last_exit === 0 ? 'text-ok' : 'text-danger'} title="Exit code of the last run">
                        exit {entry.last_exit}
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                  <button onClick={() => forge.pin(t.name, !t.pinned)} className={LINK} title={t.pinned ? 'Let a newer tool evict this one' : 'Keep this tool visible even when five are forged'}>
                    {t.pinned ? 'unpin' : 'pin'}
                  </button>
                  {!t.visible && (
                    <button onClick={() => void forge.restore(t.name)} className={LINK} title="Register it with the browser again">
                      restore
                    </button>
                  )}
                  {t.visible && t.registered && (
                    <button onClick={() => void tryAsAgent(t.name).then(setTryOut)} className={LINK} data-try={t.name} title="Call the registered tool with its example values — it ghost-types; your Enter still runs it">
                      try as agent
                    </button>
                  )}
                  <button onClick={() => forge.unforge(t.name)} className={`${LINK} text-danger`} title="Unregister and forget this tool">
                    unforge
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {tryOut && (
        <p className="mono mt-2 break-all text-[11px] text-muted" aria-live="polite">
          executeTool → {tryOut}
        </p>
      )}
    </section>
  );
}

/** Rows painted in the rail; the rest is one line ("N older rows") — the export still holds them. */
const LEDGER_SHOWN = 200;

export function LedgerPane() {
  const rows = useLedger();
  const countersigned = rows.filter((r) => r.bridge_sig).length;
  const shown = rows.length > LEDGER_SHOWN ? rows.slice(-LEDGER_SHOWN) : rows;
  const older = rows.length - shown.length;
  const download = () => {
    const blob = new Blob([JSON.stringify(ledger.export(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rokan-ledger-${ledger.session}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  // The rail's one growing section: the ledger scrolls, the rail itself does not.
  return (
    <section className="flex min-h-0 flex-1 flex-col p-2.5 text-sm" data-ledger-pane>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-medium">Ledger · {rows.length}</h2>
        <span className="text-[11px] text-muted">
          <span title="Rows the bridge signed with a key that stays on your disk — the page cannot forge them">countersigned by bridge {countersigned}/{rows.length}</span> ·{' '}
          <button onClick={download} className={LINK} title="Download the signed ledger as JSON">
            export
          </button>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">
          Nothing yet. Ask your agent to propose <code className="mono">ls</code> — every proposal, keypress and tool birth lands here, hash-chained.
        </p>
      ) : (
        <ol className="mono mt-1 min-h-0 flex-1 space-y-1 overflow-auto text-[11px] leading-4">
          {[...shown].reverse().map((r) => (
            <li key={r.seq} className="flex gap-1.5" title={`${r.kind} · ${new Date(r.t).toLocaleTimeString()}`}>
              <span className="w-5 shrink-0 text-right text-muted tabular-nums">{r.seq}</span>
              <span className="min-w-0 break-words">
                <span className={r.kind === 'forged' ? 'text-accent-ink' : r.kind === 'executed_step' ? 'text-ok' : r.kind === 'dismissed' ? 'text-muted' : 'text-ink'}>{r.kind}</span> <span className="text-muted">{summarise(r)}</span>
                {r.kind === 'executed_step' && typeof r.fields.rokan_ms === 'number' && <ProvenanceChip p={stepProvenance(r.fields)} />}
                {r.bridge_sig && (
                  <span className="ml-1 text-ok" title="countersigned by the bridge — HMAC with a key that never leaves your disk" aria-label="countersigned by the bridge">
                    ✓
                  </span>
                )}
              </span>
            </li>
          ))}
          {older > 0 && (
            <li className="text-muted" data-ledger-older>
              {older} older rows{ledger.dropped > 0 ? ` · ${ledger.dropped} evicted from memory at the ${LEDGER_MAX_ROWS}-row cap` : ''}
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

/**
 * An `executed_step` row's provenance, read from the fields the bridge measured.
 * `rokan_site` is present only when the site's own WebMCP tools served the answer, so it decides the
 * kind before the call count does — a native answer also costs zero model calls, and reading
 * `rokan_calls` first labelled every native step "compiled" (contract, 2026-08-29). Only fields the
 * row actually carries are passed on: an uncounted run has no `calls`, not a zero.
 */
function stepProvenance(f: LedgerRow['fields']): Provenance {
  const site = typeof f.rokan_site === 'string' && f.rokan_site ? f.rokan_site : undefined;
  const tool = typeof f.rokan_tool === 'string' && f.rokan_tool ? f.rokan_tool : undefined;
  return {
    kind: site ? 'native' : f.rokan_calls === 0 ? 'compiled' : 'planned',
    ...(site ? { site } : {}),
    ...(tool ? { tool } : {}),
    ...(typeof f.rokan_ms === 'number' ? { ms: f.rokan_ms } : {}),
    ...(f.rokan_calls === 0 ? { calls: 0 } : {}),
  };
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
    case 'invoke_failed':
      return `${f.tool} · ${f.param ? `${f.param}: ` : ''}${f.detail ?? f.error}`;
    case 'executed_step':
      return `${f.tool ?? ''} · step ${f.step ?? ''} · exit ${f.exit_code ?? '–'} · ${f.ms ?? '–'} ms`;
    case 'screen_read':
      // terminal_history reads the same gated surface and rides the same kind; it names its runs.
      return f.shared ? `${f.runs !== undefined ? `${f.runs} runs · ` : ''}${f.lines} lines, ${f.redactions} redacted` : 'refused (share off)';
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
/**
 * The Worker enforces the real caps (infra/sandbox/wrangler.jsonc: SESSIONS_PER_IP_PER_10MIN,
 * MAX_CONCURRENT_PER_IP); this page only repeats what the deploy told it, e.g. "10/10min,5 concurrent".
 */
const SANDBOX_CAPS = (process.env.NEXT_PUBLIC_SANDBOX_CAPS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .join(' · ');

export function PairingCard() {
  const s = useSession();
  const cmd = 'node packages/bridge/bin/rokan-terminal.js'; // `npx rokan-terminal` once published
  const [judgeErr, setJudgeErr] = useState<string | null>(null);
  const [coldMs, setColdMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (s.judge !== 'starting') return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [s.judge]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const tryJudge = async () => {
    setJudgeErr(null);
    setTick(0);
    const r = await session.startJudge(SANDBOX_URL);
    if (!r.ok) setJudgeErr(r.retry_after_s ? `${r.error} (retry in ${r.retry_after_s} s)` : r.error);
    else setColdMs(r.cold_ms);
  };
  const copy = () => {
    const c = navigator.clipboard;
    if (!c) return;
    void c.writeText(cmd).then(() => setCopied(true));
  };
  const title =
    s.state === 'busy' ? 'Another tab is already paired with this bridge' : s.state === 'unauthorized' ? 'This pairing link is not valid' : s.state === 'ended' ? 'Session ended — start a new one' : 'Pair your terminal';
  return (
    <section className={`rounded-md border bg-surface p-4 text-sm ${s.state === 'busy' || s.state === 'unauthorized' ? 'border-danger/60' : 'border-line'}`} data-pairing>
      <h2 className="font-medium">{title}</h2>
      {s.state === 'busy' && <p className="mt-1 text-xs text-muted">Close the other tab, or start a new bridge and use its link.</p>}
      {s.state === 'unauthorized' && <p className="mt-1 text-xs text-muted">Run the bridge again and open the new link it prints. Links carry a one-time token.</p>}
      {s.state === 'ended' && <p className="mt-1 text-xs text-muted">The bridge closed this session (a sandbox lives 30 minutes). Your forged tools and ledger stay in this tab.</p>}
      {s.pairError && s.state === 'unpaired' && (
        <p className="wash-danger mt-1 rounded border border-danger/40 px-2 py-1 text-xs text-danger" data-pair-error>
          Pairing refused: {s.pairError}
        </p>
      )}
      {SANDBOX_URL && (s.state === 'unpaired' || s.state === 'ended') && (
        <div className="wash-accent mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-accent/40 p-2 text-xs">
          <button data-judge onClick={tryJudge} disabled={s.judge === 'starting'} aria-busy={s.judge === 'starting'} className="btn-ink rounded px-3 py-1 disabled:opacity-40">
            {s.judge === 'starting' ? `starting a sandbox… ${tick} s` : 'Try it now — judge sandbox, nothing to install'}
          </button>
          <span className="text-muted">{SANDBOX_CAPS ? `A throttled 30-minute Linux container on Cloudflare; ${SANDBOX_CAPS} per IP.` : 'A Linux container on Cloudflare; rate-limited per IP; a sandbox lives 30 minutes.'}</span>
          {coldMs !== null && (
            <span className="text-muted">
              sandbox issued in {coldMs} ms{s.pairMs !== null ? ` · paired in ${s.pairMs} ms` : ''}
            </span>
          )}
          {judgeErr && (
            <p className="basis-full text-danger" role="alert">
              Could not start a sandbox: {judgeErr}
            </p>
          )}
        </div>
      )}
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>
          On your machine: <code className="mono select-all rounded bg-bg px-1 text-ink">{cmd}</code>{' '}
          <button onClick={copy} className={LINK} aria-label="copy the bridge command">
            {copied ? 'copied' : 'copy'}
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
    <main className="mx-auto max-w-md px-6 py-10 text-sm">
      <h1 className="serif text-3xl leading-none">Rokan Terminal</h1>
      <p className="serif mt-3 text-xl">
        Do it once. Now it&apos;s a tool. <span className="text-accent-ink">Now every agent can call it.</span>
      </p>
      <p className="mt-4 text-muted">A terminal where anything you approve becomes a live WebMCP tool your agent can call — born at runtime, run only by your Enter.</p>
      <p className="mt-4 rounded-md border border-line bg-surface p-3 text-ink">Open this on a desktop browser — ChatGPT desktop (GPT-5.6 Sol/Terra) or Chrome 149+ with WebMCP — to pair a terminal. This screen is too narrow for a shell and a tools pane side by side.</p>
    </main>
  );
}
