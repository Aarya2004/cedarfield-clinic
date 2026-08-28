'use client';

/**
 * Session store — one per tab. Consumes the pairing hash, owns the BridgeClient, creates the
 * live TerminalAdapter once the xterm instance exists, and mirrors client state for React.
 * When unpaired, the prompt-line adapter (`gateAAdapter`) stays installed so every tool works.
 */
import { BridgeClient, type ClientState, type HelloFrame } from '@/lib/ws/client';
import { CLIENT_LEDGER_KINDS, configuredBridgeHosts, consumePairingHash, isAllowedBridgeUrl, type BridgeStatus } from '@/lib/ws/protocol';
import { clearJudgePairing, loadJudgePairing, saveJudgePairing } from './judge-resume';
import { gateAAdapter, getGateAShare, setGateAShare, setTerminalAdapter } from '@/lib/webmcp/adapter';
import { ledger } from '@/lib/webmcp/ledger';
import { forge } from '@/lib/webmcp/forge';
import { note } from '@/lib/webmcp/fieldnotes';
import { createTerminalAdapter, type LiveTerminalAdapter, type TermLike } from './adapter';
import { attachAgentRelay } from './agent-relay';

export interface SessionSnapshot {
  mode: 'unpaired' | 'live';
  state: ClientState | 'unpaired';
  host: string | null;
  hello: HelloFrame | null;
  lastStatus: BridgeStatus | null;
  share: boolean;
  reconnectAt: number | null;
  reconnects: number;
  pairMs: number | null;
  judge?: 'starting' | 'paired' | 'failed';
  /** why the last pairing attempt could not even start (shown by the pairing card) */
  pairError?: string | null;
}

function safeHost(ws: string): string {
  try {
    return new URL(ws).host;
  } catch {
    return 'invalid';
  }
}

type Listener = () => void;

class SessionStore {
  private client: BridgeClient | null = null;
  private adapter: LiveTerminalAdapter | null = null;
  private snap: SessionSnapshot = { mode: 'unpaired', state: 'unpaired', host: null, hello: null, lastStatus: null, share: false, reconnectAt: null, reconnects: 0, pairMs: null };
  private listeners = new Set<Listener>();
  private started = false;

  snapshot(): SessionSnapshot {
    return this.snap;
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  getClient(): BridgeClient | null {
    return this.client;
  }
  getAdapter(): LiveTerminalAdapter | null {
    return this.adapter;
  }

  /** Call once on mount. Reads and removes `#ws=…&t=…`; starts pairing when present. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const p = consumePairingHash();
    if (!p) {
      // A judge session from before a reload: resume it (takeover on the bridge wins over the old socket).
      const stored = loadJudgePairing(typeof sessionStorage === 'undefined' ? null : sessionStorage);
      if (stored) {
        note('judge.resumed', { expires_in_s: Math.round((stored.expires_at - Date.now()) / 1000) });
        this.set({ judge: 'paired' });
        this.startWith({ ws: stored.ws, token: stored.token });
        return;
      }
      this.set({ mode: 'unpaired', state: 'unpaired', share: getGateAShare() });
      return;
    }
    this.startWith(p);
  }

  /** Pair with an explicit target (judge sandbox response). Refuses hosts outside the allowlist. */
  startWith(p: { ws: string; token: string }): boolean {
    if (this.client) return false;
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && p.ws.startsWith('ws://')) {
      // Browsers block ws:// from an https page (mixed content) and never say why (Fable VERIFY P2).
      note('pairing.mixed_content', { host: safeHost(p.ws) });
      this.set({ mode: 'unpaired', state: 'unpaired', pairError: 'an insecure ws:// link cannot open from an https page — use the tunnel link the bridge prints, or open this app on http://localhost' });
      return false;
    }
    if (!isAllowedBridgeUrl(p.ws, configuredBridgeHosts())) {
      note('pairing.refused', { host: safeHost(p.ws) });
      this.set({ mode: 'unpaired', state: 'unpaired', pairError: `bridge host not allowed: ${safeHost(p.ws)}` });
      return false;
    }
    this.set({ pairError: null });
    this.started = true;
    const host = new URL(p.ws).host;
    const client = new BridgeClient({
      ws: p.ws,
      token: p.token,
      cols: 100,
      rows: 30,
      onCountersign: (clientSeq, bridgeSeq, sig) => ledger.countersign(clientSeq, bridgeSeq, sig),
    });
    this.client = client;
    client.on('state', (s) => {
      if (s === 'paired') {
        ledger.setForward((row) => {
          if (CLIENT_LEDGER_KINDS.has(row.kind)) client.forwardLedger(row);
        });
        void ledger.append(client.reconnects > 0 ? 'reconnected' : 'paired', { host, pair_ms: client.pairMs, shell: client.hello?.shell ?? null, integration: client.hello?.integration ?? false });
        note(client.reconnects > 0 ? 'bridge.reconnected' : 'bridge.paired', { pair_ms: client.pairMs ?? undefined });
      } else if (s === 'disconnected' || s === 'closed') {
        ledger.setForward(null);
        if (forge.active()) forge.cancelActive('invocation_cancelled');
        void ledger.append('disconnected', { host, reconnect_at: client.reconnectAt });
        note('bridge.disconnected');
      }
      this.set({ state: s, hello: client.hello, reconnectAt: client.reconnectAt, reconnects: client.reconnects, pairMs: client.pairMs });
    });
    client.on('status', (st) => this.set({ lastStatus: st }));
    client.on('error', (f) => {
      if (f.code === 'timeout' || f.code === 'unauthorized') clearJudgePairing(typeof sessionStorage === 'undefined' ? null : sessionStorage);
    });
    client.on('hello', (h) => this.set({ hello: h }));
    this.set({ mode: 'live', state: 'connecting', host });
    attachAgentRelay(client);
    client.connect();
    return true;
  }

  /** Judge mode: request a sandbox session from the Worker, then pair. Measured cold start. */
  async startJudge(workerUrl: string): Promise<{ ok: true; cold_ms: number } | { ok: false; error: string; retry_after_s?: number }> {
    const t0 = performance.now();
    this.set({ judge: 'starting' });
    try {
      const r = await fetch(`${workerUrl.replace(/\/$/, '')}/api/session`, { method: 'POST' });
      const body = (await r.json().catch(() => ({}))) as { ws?: string; token?: string; ttl_ms?: number; cold_ms?: number; error?: string; retry_after_s?: number };
      if (!r.ok || !body.ws || !body.token) {
        this.set({ judge: 'failed' });
        note('judge.session_failed', { status: r.status, error: body.error });
        return { ok: false, error: body.error ?? `HTTP ${r.status}`, retry_after_s: body.retry_after_s };
      }
      const ok = this.startWith({ ws: body.ws, token: body.token });
      if (ok) saveJudgePairing(typeof sessionStorage === 'undefined' ? null : sessionStorage, { ws: body.ws, token: body.token }, body.ttl_ms ?? 0);
      const cold_ms = Math.round(performance.now() - t0);
      note('judge.session_started', { cold_ms, worker_cold_ms: body.cold_ms });
      this.set({ judge: ok ? 'paired' : 'failed' });
      return ok ? { ok: true, cold_ms } : { ok: false, error: 'bridge host not allowed' };
    } catch (e) {
      this.set({ judge: 'failed' });
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** The xterm instance exists: build the live adapter and make the tools use it. */
  attachTerm(term: TermLike): void {
    if (!this.client) return;
    this.adapter?.destroy();
    this.adapter = createTerminalAdapter({ term, client: this.client, share: () => this.snap.share });
    setTerminalAdapter(this.adapter);
  }

  detachTerm(): void {
    this.adapter?.destroy();
    this.adapter = null;
    setTerminalAdapter(gateAAdapter);
  }

  setShare(on: boolean): void {
    setGateAShare(on);
    note('share_screen', { on });
    this.set({ share: on });
  }

  reconnectNow(): void {
    this.client?.reconnectNow();
  }

  private set(patch: Partial<SessionSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((fn) => fn());
  }
}

export const session: SessionStore = new SessionStore();
