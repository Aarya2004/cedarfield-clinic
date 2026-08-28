'use client';

/**
 * Session store — one per tab. Consumes the pairing hash, owns the BridgeClient, creates the
 * live TerminalAdapter once the xterm instance exists, and mirrors client state for React.
 * When unpaired, the prompt-line adapter (`gateAAdapter`) stays installed so every tool works.
 */
import { BridgeClient, type ClientState, type HelloFrame } from '@/lib/ws/client';
import { consumePairingHash, type BridgeStatus } from '@/lib/ws/protocol';
import { gateAAdapter, getGateAShare, setGateAShare, setTerminalAdapter } from '@/lib/webmcp/adapter';
import { ledger } from '@/lib/webmcp/ledger';
import { forge } from '@/lib/webmcp/forge';
import { note } from '@/lib/webmcp/fieldnotes';
import { createTerminalAdapter, type LiveTerminalAdapter, type TermLike } from './adapter';

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
      this.set({ mode: 'unpaired', state: 'unpaired', share: getGateAShare() });
      return;
    }
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
        ledger.setForward((row) => void client.forwardLedger(row));
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
    client.on('hello', (h) => this.set({ hello: h }));
    this.set({ mode: 'live', state: 'connecting', host });
    client.connect();
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
