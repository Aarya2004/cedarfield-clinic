/**
 * Line-level secret redaction for the bridge — a plain-JS MIRROR of
 * `apps/web/src/lib/webmcp/redact.ts` (`RULES`, `redactLine`, `stripAnsi`, `REDACTED`).
 *
 * KEEP IN SYNC: the two files must agree rule-for-rule and token-for-token, so a command the tab
 * would show the agent as `export AWS_SECRET_ACCESS_KEY=[redacted]` lands in the bridge ledger as
 * exactly that. The ledger row is signed AFTER redaction, so signed bytes == served bytes and no
 * secret is ever on disk or on `terminal://ledger` (review P0-1, 2026-08-29). A rule added on one
 * side without the other is a bug; `test/redact.test.mjs` pins the shared cases.
 *
 * Only the single-line surface is ported (the ledger stores one command line per row); the
 * multi-line PEM handling of `redactForAgent` stays in the web file.
 */
export const REDACTED = '[redacted]';

// Order matters: specific tokens first, the broad hex rule last. (Same order as redact.ts.)
const RULES = [
  { kind: 'aws_access_key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'sk_token', re: /\bsk-[A-Za-z0-9_-]{8,}\b/g },
  { kind: 'stripe_key', re: /\b[sprk]k_(?:live|test)_[A-Za-z0-9]{8,}\b/g },
  { kind: 'google_api_key', re: /\bAIza[0-9A-Za-z_-]{20,}\b/g },
  { kind: 'npm_token', re: /\bnpm_[A-Za-z0-9]{20,}\b/g },
  // Judge-sandbox session credential `<24 hex>.<exp seconds>.<16 hex>` (infra/sandbox/src/sid.ts):
  // the `/ws/<sid>` path IS the bearer for that container, so it never reaches a ledger row or the agent.
  { kind: 'sandbox_sid', re: /\b[a-f0-9]{24}\.\d{1,13}\.[a-f0-9]{16}\b/g },
  // scheme://user:password@host — keep the user, drop the password
  { kind: 'url_credentials', re: /(:\/\/[^/\s:@]+:)[^@\s]+(@)/g, repl: `$1${REDACTED}$2` },
  // psql --password x · curl -u user:pw · mysql -p'x' · --token x
  { kind: 'cli_password_flag', re: /(\s(?:--?(?:password|passwd|pass|token|api-key|apikey)|-p|-u)[=\s]+)(?:([^\s:'"]+:)?)(["']?)([^\s"']+)\3/gi, repl: `$1$2$3${REDACTED}$3` },
  { kind: 'github_token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { kind: 'slack_token', re: /\bxox[abpr]-[A-Za-z0-9-]{8,}\b/g },
  { kind: 'jwt', re: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g },
  {
    kind: 'kv_secret',
    // PREFIX_TOKEN=…, "password": "…", api_key='…', MYSQL_PWD=… — keep the key, drop the value.
    // The keyword may sit anywhere inside the identifier (AWS_SECRET_ACCESS_KEY, PGPASSWORD, npm_token).
    re: /(["']?)\b([A-Za-z0-9_.-]*(?:pass(?:word|wd)?|pwd|token|secret|(?<![a-z])key(?![a-z])|credential)[A-Za-z0-9_.-]*)\1(\s*[=:]\s*)(?:"([^"]*)"|'([^']*)'|([^\s"';&|)]+))/gi,
    repl: (_m, q, key, sep, dq, sq) =>
      `${q}${key}${q}${sep}${dq !== undefined ? `"${REDACTED}"` : sq !== undefined ? `'${REDACTED}'` : REDACTED}`,
  },
  {
    kind: 'authorization_header',
    re: /\b(Authorization\s*:\s*)(?:(Bearer|Basic|Token|ApiKey)\s+)?(\S+)/gi,
    repl: `$1$2 ${REDACTED}`,
  },
  {
    kind: 'high_entropy_value',
    // `=<24+ chars of base64-ish with ≥2 upper, ≥2 lower, ≥1 digit>` — the value shape of a
    // secret whose NAME we cannot see. Paths (`/…`), locales and plain words never satisfy the mix.
    re: /(=|:\s*)(["']?)([A-Za-z0-9+/][A-Za-z0-9+/_-]{23,}={0,2})\2(?=[\s;|&)'"]|$)/g,
    repl: (m, sep, q, v, offset, whole) => {
      const upper = (v.match(/[A-Z]/g) ?? []).length;
      const lower = (v.match(/[a-z]/g) ?? []).length;
      const digits = (v.match(/[0-9]/g) ?? []).length;
      // the identifier left of `=`: ids, hashes, builds and versions are values worth seeing, not secrets
      const name = /([A-Za-z0-9_.-]*)$/.exec(whole.slice(0, offset))?.[1] ?? '';
      const plain = /(^|[_.-])(id|sha|sha\d*|hash|commit|build|version|digest|etag|uuid|guid|ref)$/i.test(name);
      return upper >= 2 && lower >= 2 && digits >= 1 && !v.startsWith('/') && !plain ? `${sep}${q}${REDACTED}${q}` : m;
    },
  },
  // PLAN §4: 32+ hex runs. Also hides git SHAs (40 hex) — a missed 64-hex API key costs more than a SHA.
  { kind: 'hex_run', re: /\b[0-9a-fA-F]{32,}\b/g },
];

/** The rule kinds, in order — exported so the sync test can compare against redact.ts. */
export const RULE_KINDS = RULES.map((r) => r.kind);

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][0-9A-Za-z]|\x1b[=>]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/** Remove CSI/OSC/charset escapes and stray control bytes (raw PTY text → plain text). */
export function stripAnsi(s) {
  return s.replace(ANSI, '');
}

/** Redact one line. Returns {text, kinds}; `kinds` lists every rule that changed something. */
export function redactLine(line) {
  const kinds = [];
  let text = line;
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    if (!rule.re.test(text)) continue;
    rule.re.lastIndex = 0;
    const next = text.replace(rule.re, rule.repl ?? REDACTED);
    if (next === text) continue; // matched but changed nothing → redacted nothing
    kinds.push(rule.kind);
    text = next;
  }
  return { text, kinds };
}

/**
 * Redact a ledger-bound string field: strips terminal escapes first (a command line can carry
 * them via a pasted prompt), then applies every rule. Non-strings pass through unchanged so a
 * `null` last_command stays `null` in the row.
 */
export function redactField(value) {
  if (typeof value !== 'string') return value;
  return redactLine(stripAnsi(value)).text;
}
