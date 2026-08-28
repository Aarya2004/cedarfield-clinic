/**
 * Client-side ledger: append-only, one row per proposal / keypress-execution / screen read /
 * forge / forged invocation. Each row is HMAC-SHA256-chained with a per-session WebCrypto key
 * so an export can be checked for tampering (`verifyExport`). Mirrored to localStorage and,
 * when a bridge is paired, forwarded as `{type:'ledger'}` frames so the same row also lands in
 * `~/.rokan-terminal/ledger.jsonl`.
 *
 * Every `ms` / `calls` value stored here is measured by the caller that observed it.
 */
export type LedgerKind =
  | 'proposed'
  | 'dismissed'
  | 'executed'
  | 'screen_read'
  | 'registered'
  | 'unregistered'
  | 'forge_requested'
  | 'forge_rejected'
  | 'forged'
  | 'invoked'
  | 'restored'
  | 'pinned';

export interface LedgerRow {
  seq: number;
  t: string;
  session: string;
  kind: LedgerKind;
  fields: Record<string, string | number | boolean | null>;
  prev: string;
  sig: string;
}

export interface LedgerExport {
  session: string;
  key_hex: string;
  rows: LedgerRow[];
}

const STORAGE_KEY = 'rokan-terminal.ledger.v1';
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
  private listeners = new Set<Listener>();
  private forward: Forward | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor() {
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
    this.chain = this.chain.then(async () => {
      const base = { seq: this.rows.length + 1, t: new Date().toISOString(), session: this.session, kind, fields, prev: this.prev };
      const sig = await hmac(this.keyHex, this.prev + canonical(base));
      out = { ...base, sig };
      this.rows = [...this.rows, out];
      this.prev = sig;
      this.persist();
      this.forward?.(out);
      this.listeners.forEach((fn) => fn());
    });
    return this.chain.then(() => out);
  }

  export(): LedgerExport {
    return { session: this.session, key_hex: this.keyHex, rows: this.rows };
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
  let prev = '';
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
