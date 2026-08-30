/**
 * Model proxy — pure policy for `POST /api/model/:sid/v1/messages` (unit-tested with node:test).
 *
 * Why it exists: the judge's PTY inherits the bridge's whole env (packages/bridge/src/shell-integration.js
 * spreads process.env), so a real key in the container is one `echo` away. The container therefore gets
 * only `ANTHROPIC_BASE_URL=https://<worker>/api/model/<sid>` and the dummy `ANTHROPIC_API_KEY=judge-sandbox-proxy`
 * (rokan-do's planner only checks that the key is non-empty; the anthropic SDK honours the base URL). The
 * Worker holds the real key as a secret, verifies the sid, enforces the budget, and forwards ONE fixed
 * upstream path. The sid is readable from the judge's shell, so the caps in gate-logic.ts — not secrecy —
 * are what bound the spend.
 */

/** The only upstream this proxy ever contacts. Never built from the request. */
export const UPSTREAM_MESSAGES = 'https://api.anthropic.com/v1/messages';
/** Exactly one path shape; `count_tokens` is deliberately absent — nothing in rokan-do calls it. */
export const MODEL_PATH_RE = /^\/api\/model\/([a-f0-9]{24}\.\d{1,13}\.[a-f0-9]{16})\/v1\/messages$/;
/** rokan-do's shipped ladder (planner.py LADDER). Anything else is a judge's `ROKAN_LADDER` override → 400. */
export const ALLOWED_MODELS: readonly string[] = ['claude-haiku-4-5-20251001', 'claude-sonnet-5'];
export const MAX_TOKENS_CAP = 8192;
/** rokan-do bodies are < 20 KB (2 000 chars of page text + rules); 256 KB leaves room, bounds input cost. */
export const MAX_BODY_BYTES = 256 * 1024;
export const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';
/** The literal the container carries instead of a key. Documented in SECURITY §6; never compared, always dropped. */
export const DUMMY_API_KEY = 'judge-sandbox-proxy';

const ALLOWED_KEYS = new Set(['model', 'max_tokens', 'messages', 'system', 'metadata', 'stop_sequences', 'temperature', 'top_p', 'top_k', 'output_config', 'output_format', 'thinking']);
// Deliberately absent from ALLOWED_KEYS: stream, tools, tool_choice, mcp_servers, container, service_tier,
// context_management, inference_geo, betas, fallbacks, speed.

export type Validated =
  | { ok: true; body: Record<string, unknown>; model: string; maxTokens: number }
  | { ok: false; status: number; message: string };

/** The sid when `pathname` is the one allowed path, else null. */
export function allowedPath(pathname: string): string | null {
  const m = MODEL_PATH_RE.exec(pathname);
  return m ? m[1] : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Every content block in `messages`/`system` must be `text` (no free vision / documents on our key). */
function onlyTextBlocks(content: unknown): boolean {
  if (typeof content === 'string') return true;
  if (!Array.isArray(content)) return false;
  return content.every((b) => isRecord(b) && b.type === 'text' && typeof b.text === 'string');
}

/**
 * Strict allowlist of top-level keys; model must be on the ladder (400, never rewritten — a silent rewrite
 * would falsify a `ROKAN_LADDER` experiment); `max_tokens` is clamped (it is only an upper bound);
 * streaming, tools and non-text blocks are refused.
 */
export function validateModelRequest(raw: unknown): Validated {
  if (!isRecord(raw)) return { ok: false, status: 400, message: 'body must be a JSON object' };
  for (const k of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(k)) return { ok: false, status: 400, message: `field not allowed through the sandbox proxy: ${k}` };
  }
  const model = raw.model;
  if (typeof model !== 'string' || !ALLOWED_MODELS.includes(model)) return { ok: false, status: 400, message: 'model not allowed through the sandbox proxy' };
  const mt = raw.max_tokens;
  if (typeof mt !== 'number' || !Number.isInteger(mt) || mt <= 0) return { ok: false, status: 400, message: 'max_tokens must be a positive integer' };
  const maxTokens = Math.min(mt, MAX_TOKENS_CAP);
  if (raw.stream === true) return { ok: false, status: 400, message: 'streaming is not available through the sandbox proxy' };
  const messages = raw.messages;
  if (!Array.isArray(messages) || messages.length === 0) return { ok: false, status: 400, message: 'messages must be a non-empty array' };
  for (const m of messages) {
    if (!isRecord(m) || !onlyTextBlocks(m.content)) return { ok: false, status: 400, message: 'only text content is allowed through the sandbox proxy' };
  }
  if ('system' in raw && raw.system !== undefined && !onlyTextBlocks(raw.system)) return { ok: false, status: 400, message: 'only text content is allowed through the sandbox proxy' };
  const body: Record<string, unknown> = { ...raw, max_tokens: maxTokens };
  // Sonnet 5 runs adaptive thinking when `thinking` is omitted; thinking tokens count against max_tokens, so
  // rokan-do's structured plan (max_tokens 4000) came back truncated after 48 s / 4 000 output tokens
  // (measured live 2026-08-29). Planning is a structured extraction, not reasoning: pin thinking off unless
  // the client set it explicitly. Bounded output cost is the other reason.
  if (model.startsWith('claude-sonnet-5') && body.thinking === undefined) body.thinking = { type: 'disabled' };
  return { ok: true, body, model, maxTokens };
}

/** Exactly the headers that reach upstream. The client's x-api-key / authorization / anthropic-beta never do. */
export function upstreamHeaders(apiKey: string, clientVersion: string | null): Record<string, string> {
  const version = clientVersion && /^\d{4}-\d{2}-\d{2}$/.test(clientVersion) ? clientVersion : DEFAULT_ANTHROPIC_VERSION;
  return { 'content-type': 'application/json', 'anthropic-version': version, 'x-api-key': apiKey };
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** USD per million tokens (Anthropic list, 2026-08; cache write ×1.25 / read ×0.1 of input). Verify in the console before raising caps. */
export const PRICE_USD_PER_MTOK: Record<string, { in: number; out: number; cacheWrite: number; cacheRead: number }> = {
  'claude-haiku-4-5-20251001': { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  'claude-sonnet-5': { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 },
};

/** Cost of a settled call in micro-dollars (integer; the DO stores integers). */
export function usdMicros(model: string, u: Usage): number {
  const p = PRICE_USD_PER_MTOK[model] ?? PRICE_USD_PER_MTOK['claude-sonnet-5'];
  const n = (x: unknown) => (typeof x === 'number' && x > 0 ? x : 0);
  const usd = (n(u.input_tokens) * p.in + n(u.output_tokens) * p.out + n(u.cache_creation_input_tokens) * p.cacheWrite + n(u.cache_read_input_tokens) * p.cacheRead) / 1_000_000;
  return Math.ceil(usd * 1_000_000);
}

/** Pessimistic pre-charge before the call: bytes/3 input tokens at full price + the whole max_tokens output. */
export function estimateUsdMicros(model: string, bodyBytes: number, maxTokens: number): number {
  return usdMicros(model, { input_tokens: Math.ceil(bodyBytes / 3), output_tokens: maxTokens });
}

/**
 * What a call finally costs. With `usage` (2xx) the real numbers; a 4xx (e.g. rokan-do's per-model temperature
 * probe, which Anthropic answers 400) produced no output, so only the input estimate is kept — measured live
 * 2026-08-29: the pessimistic reservation charged a 400 as 46 800 µ$; a network failure keeps the reservation.
 */
export function settledUsdMicros(model: string, status: number, usage: Usage | undefined, bodyBytes: number, reservedMicros: number): number {
  if (usage) return usdMicros(model, usage);
  if (status >= 400 && status < 500) return usdMicros(model, { input_tokens: Math.ceil(bodyBytes / 3) });
  return reservedMicros;
}

/** Sonnet calls count triple against the call caps (they cost ~2–3× and are the ladder's second rung). */
export function callWeight(model: string): number {
  return model.startsWith('claude-sonnet') ? 3 : 1;
}

/** The 429 the SDK maps to a rate-limit error; `x-should-retry: false` stops its one built-in retry. */
export function capError(reason: string, retryAfterS: number): { body: Record<string, unknown>; headers: Record<string, string> } {
  const s = Math.max(1, Math.floor(retryAfterS));
  return {
    body: { type: 'error', error: { type: 'rate_limit_error', message: `sandbox model budget: ${reason}` }, retry_after_s: s },
    headers: { 'retry-after': String(s), 'x-should-retry': 'false' },
  };
}

/**
 * Upstream statuses whose body the client may see: success, and the validation/limit errors whose text is
 * Anthropic's own (the planner reads a 400 to learn per-model temperature support). Auth/billing/5xx are
 * never relayed — a client must not learn our key's state.
 */
export function isPassthroughStatus(status: number): boolean {
  return (status >= 200 && status < 300) || status === 400 || status === 404 || status === 413 || status === 422 || status === 429;
}
