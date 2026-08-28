/**
 * Append-only JSONL ledger with a per-session HMAC chain.
 * Row = {seq, t, session, kind, ...fields, prev, sig};  sig = HMAC-SHA256(key, prev + canonical(row sans sig)).
 * The session key is written once to ~/.rokan-terminal/keys/<session>.key (0600) so an export
 * can be verified later with `verifyLedger()`.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const LEDGER_DIR = join(homedir(), '.rokan-terminal');
export const LEDGER_FILE = join(LEDGER_DIR, 'ledger.jsonl');

/**
 * Canonical JSON: keys sorted recursively at every depth. (A replacer *array* in JSON.stringify
 * is a recursive allowlist, not a sorter — nested keys absent from the top level would be dropped
 * from the digest. Found by the Opus review 2026-08-28; covered by smoke check "nested tamper".)
 */
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value === undefined ? null : value);
}

export class Ledger {
  constructor({ session, dir = LEDGER_DIR } = {}) {
    this.session = session;
    this.dir = dir;
    this.file = join(dir, 'ledger.jsonl');
    this.seq = 0;
    this.prev = '';
    mkdirSync(join(dir, 'keys'), { recursive: true, mode: 0o700 });
    this.key = randomBytes(32);
    writeFileSync(join(dir, 'keys', `${session}.key`), this.key.toString('hex'), { mode: 0o600 });
  }

  /** Appends one row and returns it (with sig). `fields` must be JSON-serialisable. */
  append(kind, fields = {}) {
    // Reserved keys are set last so no caller-supplied field can override them (Fable review F7).
    const row = { ...fields, seq: ++this.seq, t: new Date().toISOString(), session: this.session, kind, prev: this.prev };
    delete row.sig;
    const sig = createHmac('sha256', this.key).update(this.prev + canonical(row)).digest('hex');
    const signed = { ...row, sig };
    appendFileSync(this.file, JSON.stringify(signed) + '\n');
    this.prev = sig;
    return signed;
  }
}

/** Verifies every row of `session` in a ledger file against its key. Returns {ok, rows, firstBad}. */
export function verifyLedger(session, { dir = LEDGER_DIR } = {}) {
  const keyPath = join(dir, 'keys', `${session}.key`);
  if (!existsSync(keyPath)) return { ok: false, rows: 0, firstBad: 'no key' };
  const key = Buffer.from(readFileSync(keyPath, 'utf8').trim(), 'hex');
  const lines = readFileSync(join(dir, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean);
  let prev = '';
  let rows = 0;
  for (const line of lines) {
    const r = JSON.parse(line);
    if (r.session !== session) continue;
    const { sig, ...rest } = r;
    if (rest.prev !== prev) return { ok: false, rows, firstBad: `seq ${r.seq}: chain break` };
    const expect = createHmac('sha256', key).update(prev + canonical(rest)).digest('hex');
    if (expect !== sig) return { ok: false, rows, firstBad: `seq ${r.seq}: bad sig` };
    prev = sig;
    rows++;
  }
  return { ok: true, rows, firstBad: null };
}
