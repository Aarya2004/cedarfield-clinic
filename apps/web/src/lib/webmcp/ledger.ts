/**
 * Client-side ledger: append-only, one row per proposal / keypress-execution / screen read /
 * forge / forged invocation. Each row is HMAC-SHA256-chained with a per-session WebCrypto key
 * held in memory only (never persisted, never exported by default) — that makes the chain
 * *tamper-evident within the tab*. The proof a third party can check is the **bridge
 * countersignature**: when paired, every row is forwarded as `{type:'ledger'}`, the bridge signs
 * it with a key the page never sees and answers `ledger_ack {seq, sig}`, stored as `bridge_sig`.
 * Say "tamper-evident, countersigned by the bridge" — never "tamper-proof".
 *
 * Every `ms` / `calls` value stored here is measured by the caller that observed it.
 */
/**
 * Must stay a subset of `CLIENT_LEDGER_KINDS` (ws/protocol.ts): `executed` is bridge-only.
 * Exception: `invoke_failed` is page-local (not in the contract yet) — session.ts filters forwarding
 * by `CLIENT_LEDGER_KINDS`, so it is never sent to the bridge and never countersigned.
 */
export type LedgerKind =
  | 'proposed'
  | 'dismissed'
  | 'executed_step'
  | 'screen_read'
  | 'registered'
  | 'unregistered'
  | 'forge_requested'
  | 'forge_rejected'
  | 'forged'
  | 'invoked'
  | 'invoke_failed'
  | 'restored'
  | 'pinned'
  | 'paired'
  | 'disconnected'
  | 'reconnected';

export interface LedgerRow {
  seq: number;
  t: string;
  session: string;
  kind: LedgerKind;
  fields: Record<string, string | number | boolean | null>;
  prev: string;
  sig: string;
  /** HMAC by the bridge (key on the user's disk, never in the page); set on `ledger_ack`. */
  bridge_sig?: string;
  bridge_seq?: number;
}

export interface LedgerExport {
  session: string;
  /** present only when exported with `{ includeKey: true }` (tests / self-check) */
  key_hex?: string;
  rows: LedgerRow[];
  countersigned: number;
  /** oldest rows evicted at `maxRows`; the export's first `prev` is then the last evicted row's sig */
  dropped: number;
}

const STORAGE_KEY = 'rokan-terminal.ledger.v1';
/** Rows kept in memory; older ones are evicted (their sigs stay chained through `prev`). */
export const LEDGER_MAX_ROWS = 2000;
/** localStorage writes coalesce to at most one per window (trailing). */
export const PERSIST_THROTTLE_MS = 200;
const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function canonical(row: Omit<LedgerRow, 'sig'>): string {
  return JSON.stringify({ seq: row.seq, t: row.t, session: row.session, kind: row.kind, fields: row.fields, prev: row.prev });
}

async function hmac(keyHex: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(keyHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

type Listener = () => void;
type Forward = (row: LedgerRow) => void;

export class Ledger {
  readonly session: string;
  private keyHex: string;
  private rows: LedgerRow[] = [];
  private prev = '';
  private seq = 0;
  private _dropped = 0;
  private readonly maxRows: number;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private forward: Forward | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(opts: { maxRows?: number } = {}) {
    this.maxRows = opts.maxRows ?? LEDGER_MAX_ROWS;
    const rnd = new Uint8Array(16);
    crypto.getRandomValues(rnd);
    this.session = hex(rnd.buffer).slice(0, 12);
    const k = new Uint8Array(32);
    crypto.getRandomValues(k);
    this.keyHex = hex(k.buffer);
  }

  snapshot(): LedgerRow[] {
    return this.rows;
  }

  /** Rows evicted from memory at the cap (seq numbers stay honest: the first kept row's seq is dropped+1). */
  get dropped(): number {
    return this._dropped;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Called by the WS client once paired; rows appended afterwards are also sent to the bridge. */
  setForward(fn: Forward | null): void {
    this.forward = fn;
  }

  /** Append is serialised so `prev` chains are never interleaved. Resolves with the signed row. */
  append(kind: LedgerKind, fields: LedgerRow['fields'] = {}): Promise<LedgerRow> {
    let out!: LedgerRow;
    const step = this.chain.then(async () => {
      const base = { seq: ++this.seq, t: new Date().toISOString(), session: this.session, kind, fields, prev: this.prev };
      let sig: string;
      try {
        sig = await hmac(this.keyHex, this.prev + canonical(base));
      } catch (e) {
        // No WebCrypto (e.g. plain http:// on a LAN): keep the ledger alive, mark the row unsigned.
        sig = 'unsigned:' + (e instanceof Error ? e.name : 'error');
      }
      out = { ...base, sig };
      this.rows = this.rows.length >= this.maxRows ? [...this.rows.slice(this.rows.length - this.maxRows + 1), out] : [...this.rows, out];
      this._dropped = this.seq - this.rows.length;
      this.prev = sig;
      this.schedulePersist();
      try {
        this.forward?.(out);
      } catch {
        /* bridge forward must never break the chain */
      }
      this.listeners.forEach((fn) => fn());
    });
    // A rejected step must never poison the chain for later appends (Opus review P2).
    this.chain = step.catch(() => undefined);
    return step.then(() => out);
  }

  /** Attach the bridge's countersignature to a row (from a `ledger_ack` frame). */
  countersign(seq: number, bridgeSeq: number, sig: string): void {
    const i = this.rows.findIndex((r) => r.seq === seq);
    if (i === -1 || this.rows[i].bridge_sig) return;
    const next = { ...this.rows[i], bridge_sig: sig, bridge_seq: bridgeSeq };
    this.rows = this.rows.map((r, j) => (j === i ? next : r));
    this.schedulePersist();
    this.listeners.forEach((fn) => fn());
  }

  export(opts: { includeKey?: boolean } = {}): LedgerExport {
    return {
      session: this.session,
      ...(opts.includeKey ? { key_hex: this.keyHex } : {}),
      rows: this.rows,
      countersigned: this.rows.filter((r) => r.bridge_sig).length,
      dropped: this._dropped,
    };
  }

  /** Trailing throttle: the first change arms one write PERSIST_THROTTLE_MS later; later ones ride it. */
  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, PERSIST_THROTTLE_MS);
  }

  private persist(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.export()));
    } catch {
      /* storage unavailable — memory only */
    }
  }
}

/** Re-computes the chain of an export. `{ok:true}` or the first bad seq. */
export async function verifyExport(x: LedgerExport): Promise<{ ok: boolean; rows: number; firstBad: number | null }> {
  if (!x.key_hex) return { ok: false, rows: 0, firstBad: null };
  // An export that evicted its head cannot start from '': it starts from the last evicted row's sig.
  let prev = x.dropped ? (x.rows[0]?.prev ?? '') : '';
  for (const r of x.rows) {
    if (r.prev !== prev) return { ok: false, rows: r.seq - 1, firstBad: r.seq };
    const { sig, ...rest } = r;
    const expect = await hmac(x.key_hex, prev + canonical(rest));
    if (expect !== sig) return { ok: false, rows: r.seq - 1, firstBad: r.seq };
    prev = sig;
  }
  return { ok: true, rows: x.rows.length, firstBad: null };
}

export const ledger: Ledger = new Ledger();
