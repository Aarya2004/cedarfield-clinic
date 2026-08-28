/**
 * BridgeClient — the browser side of protocol v1. One socket, auth-first, typed frames,
 * reconnect with backoff, ping keep-alive, ledger forwarding with bridge countersignatures.
 * The socket is injectable so the state machine is unit-tested without a browser.
 */
import { AUTH_TIMEOUT_MS, CLOSE_CODES, type AgentToolDef, type BridgeFrame, type BridgeStatus, type ClientFrame, type ClientLedgerRow } from './protocol.ts';

export type ClientState = 'idle' | 'connecting' | 'paired' | 'busy' | 'unauthorized' | 'disconnected' | 'closed';
export type HelloFrame = Extract<BridgeFrame, { type: 'hello' }>;
export type ErrorFrame = Extract<BridgeFrame, { type: 'error' }>;

export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface BridgeClientOptions {
  ws: string;
  token: string;
  cols: number;
  rows: number;
  makeSocket?: (url: string) => WebSocketLike;
  /** reconnect delays in ms; the last value repeats */
  backoffMs?: number[];
  /** stop reconnecting this long after the first disconnect */
  giveUpMs?: number;
  pingMs?: number;
  /** called on `ledger_ack` so the ledger can store the bridge countersignature */
  onCountersign?: (clientSeq: number, bridgeSeq: number, sig: string) => void;
}

type Events = {
  state: ClientState;
  hello: HelloFrame;
  data: string;
  status: BridgeStatus;
  exit: number;
  error: ErrorFrame;
  pong: undefined;
  agent_call: { call_id: string; tool: string; input: Record<string, unknown> };
};

const OPEN = 1;
/** Client-side close code for "auth sent, no hello in time" — retried with backoff. */
export const NO_HELLO_CLOSE_CODE = 4499;

export class BridgeClient {
  readonly ws: string;
  private readonly token: string;
  private cols: number;
  private rows: number;
  private readonly makeSocket: (url: string) => WebSocketLike;
  private readonly backoff: number[];
  private readonly giveUpMs: number;
  private readonly pingMs: number;
  private readonly onCountersign?: BridgeClientOptions['onCountersign'];

  private socket: WebSocketLike | null = null;
  private _state: ClientState = 'idle';
  private _hello: HelloFrame | null = null;
  private _lastStatus: BridgeStatus | null = null;
  private listeners = new Map<keyof Events, Set<(v: never) => void>>();
  private queue: string[] = [];
  private attempt = 0;
  private firstDisconnectAt: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private authTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  /** set after the first hello; keystrokes queued during a *re*-pair are dropped, not replayed into a new shell */
  private everPaired = false;
  /** last close event (code + reason) — surfaced for diagnostics */
  lastClose: { code: number; reason: string; at: string } | null = null;
  /** last 12 frame types sent (diagnostics only) */
  sentTypes: string[] = [];
  private closedByUs = false;
  /** measured: ms from connect() to hello, last successful pairing */
  pairMs: number | null = null;
  reconnectAt: number | null = null;
  reconnects = 0;

  constructor(opts: BridgeClientOptions) {
    this.ws = opts.ws;
    this.token = opts.token;
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.makeSocket = opts.makeSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
    this.backoff = opts.backoffMs ?? [1000, 2000, 4000, 8000, 15000];
    this.giveUpMs = opts.giveUpMs ?? 10 * 60_000;
    this.pingMs = opts.pingMs ?? 20_000;
    this.onCountersign = opts.onCountersign;
  }

  get state(): ClientState {
    return this._state;
  }
  get hello(): HelloFrame | null {
    return this._hello;
  }
  get lastStatus(): BridgeStatus | null {
    return this._lastStatus;
  }
  get paired(): boolean {
    return this._state === 'paired';
  }

  on<K extends keyof Events>(event: K, fn: (v: Events[K]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(fn as (v: never) => void);
    this.listeners.set(event, set);
    return () => set.delete(fn as (v: never) => void);
  }

  private emit<K extends keyof Events>(event: K, v: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => (fn as (x: Events[K]) => void)(v));
  }

  private setState(s: ClientState): void {
    if (this._state === s) return;
    this._state = s;
    this.emit('state', s);
  }

  connect(): void {
    if (this._state === 'connecting' || this._state === 'paired' || this.closedByUs) return;
    this.clearReconnect();
    this.setState('connecting');
    const t0 = performance.now();
    let sock: WebSocketLike;
    try {
      sock = this.makeSocket(this.ws);
    } catch {
      this.onClosed({ code: 1006, reason: 'socket constructor failed' });
      return;
    }
    this.socket = sock;
    sock.onopen = () => {
      this.sendRaw({ type: 'auth', token: this.token, cols: this.cols, rows: this.rows });
      this.authTimer = setTimeout(() => {
        // No hello in time is a slow/lost link (cold judge proxy), not a rejected token: close with a
        // non-terminal code so onClosed schedules a retry instead of showing "link not valid".
        if (this._state === 'connecting') sock.close(NO_HELLO_CLOSE_CODE, 'no hello');
      }, AUTH_TIMEOUT_MS);
    };
    sock.onmessage = (ev) => this.onFrame(String(ev.data), t0);
    sock.onerror = () => {
      /* onclose follows */
    };
    sock.onclose = (ev) => this.onClosed(ev);
  }

  private onFrame(raw: string, t0: number): void {
    let f: BridgeFrame;
    try {
      f = JSON.parse(raw) as BridgeFrame;
    } catch {
      return;
    }
    switch (f.type) {
      case 'hello':
        if (this.authTimer) clearTimeout(this.authTimer);
        this._hello = f;
        this.pairMs = Math.round(performance.now() - t0);
        if (this.firstDisconnectAt !== null) this.reconnects++;
        this.attempt = 0;
        this.firstDisconnectAt = null;
        this.reconnectAt = null;
        this.setState('paired');
        const queued = this.queue.splice(0);
        if (!this.everPaired) for (const q of queued) this.socket?.send(q);
        this.everPaired = true;
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.sendRaw({ type: 'ping' }), this.pingMs);
        this.emit('hello', f);
        break;
      case 'data':
        this.emit('data', f.data);
        break;
      case 'status': {
        const { type: _t, ...status } = f;
        void _t;
        this._lastStatus = status;
        this.emit('status', status);
        break;
      }
      case 'exit':
        this.emit('exit', f.code);
        break;
      case 'error':
        this.emit('error', f);
        if (f.code === 'busy') this.setState('busy');
        else if (f.code === 'replaced') this.closedByUs = true; // a newer tab took over: never reconnect over it
        else if (f.code === 'unauthorized' || f.code === 'timeout') this.setState('unauthorized');
        break;
      case 'ledger_ack':
        if (f.client_seq !== null && this.onCountersign) this.onCountersign(f.client_seq, f.seq, f.sig);
        break;
      case 'pong':
        this.emit('pong', undefined);
        break;
      case 'agent_call':
        this.emit('agent_call', { call_id: f.call_id, tool: f.tool, input: f.input ?? {} });
        break;
      default:
        break;
    }
  }

  private onClosed(ev: { code: number; reason: string }): void {
    this.lastClose = { code: ev.code, reason: ev.reason, at: new Date().toISOString() };
    if (this.authTimer) clearTimeout(this.authTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.socket = null;
    this.queue.length = 0; // whatever was typed at a dead link never reaches a different shell
    if (this.closedByUs) {
      this.setState('closed');
      return;
    }
    // terminal states never auto-retry
    if (this._state === 'busy' || this._state === 'unauthorized') return;
    if (ev.code === CLOSE_CODES.REPLACED) {
      this.closedByUs = true;
      this.setState('closed');
      return;
    }
    if (ev.code === CLOSE_CODES.BUSY) {
      this.setState('busy');
      return;
    }
    if (ev.code === CLOSE_CODES.UNAUTHORIZED || ev.code === CLOSE_CODES.BAD_FRAME) {
      this.setState('unauthorized');
      return;
    }
    if (this.firstDisconnectAt === null) this.firstDisconnectAt = Date.now();
    this.setState('disconnected');
    if (Date.now() - this.firstDisconnectAt > this.giveUpMs) {
      this.reconnectAt = null;
      return;
    }
    const delay = this.backoff[Math.min(this.attempt, this.backoff.length - 1)];
    this.attempt++;
    this.reconnectAt = Date.now() + delay;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /** Human pressed "Reconnect now". */
  reconnectNow(): void {
    if (this.closedByUs) return;
    this.clearReconnect();
    this.attempt = 0;
    if (this._state === 'busy' || this._state === 'unauthorized') this.setState('disconnected');
    this.connect();
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAt = null;
  }

  private sendRaw(frame: ClientFrame): boolean {
    const s = JSON.stringify(frame);
    if (this.socket && this.socket.readyState === OPEN && (this._state === 'paired' || frame.type === 'auth')) {
      this.socket.send(s);
      if (frame.type !== 'ping') this.sentTypes = [...this.sentTypes.slice(-11), frame.type === 'ledger' ? `ledger:${frame.row.kind}` : frame.type];
      return true;
    }
    if (frame.type === 'input' && this._state === 'connecting') {
      if (this.queue.length < 100) this.queue.push(s);
      return false;
    }
    return false;
  }

  /** The only path to the PTY: bytes from the human's tab. */
  sendInput(data: string): boolean {
    return this.sendRaw({ type: 'input', data });
  }

  resize(cols: number, rows: number): void {
    // A collapsed pane reports 0/1 rows mid-layout; the bridge refuses < 2 and there is nothing to draw anyway.
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2 || cols > 1000 || rows > 1000) return;
    this.cols = cols;
    this.rows = rows;
    this.sendRaw({ type: 'resize', cols, rows });
  }

  forwardLedger(row: ClientLedgerRow): boolean {
    return this.sendRaw({ type: 'ledger', row });
  }

  /** MCP relay: publish the tool list the bridge hands to an agent process. */
  publishAgentTools(tools: AgentToolDef[]): boolean {
    return this.sendRaw({ type: 'agent_tools', tools });
  }

  sendAgentResult(call_id: string, result?: unknown, error?: string): boolean {
    return this.sendRaw({ type: 'agent_result', call_id, result, error });
  }

  close(): void {
    this.closedByUs = true;
    this.clearReconnect();
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.socket?.close(CLOSE_CODES.SHUTDOWN, 'tab closed');
    this.socket = null;
    this.setState('closed');
  }
}
