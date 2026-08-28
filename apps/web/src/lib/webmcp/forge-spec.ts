/**
 * Forge contracts — pure, dependency-free, shared by the engine, the card UI and the tests.
 * Part of the shared contract surface (change via `contract:` commits). See docs/FORGE-PLAN.md §3–4.
 */
import { validateProposedCommand, isDangerous, PROPOSE_COMMAND_MAX } from './schemas.ts';

export type ForgeKind = 'read' | 'write';

export interface ForgeParam {
  name: string;
  description: string;
  example: string;
}

export interface ForgeSpec {
  name: string;
  description: string;
  commands: string[];
  params: ForgeParam[];
  kind: ForgeKind;
}

export interface ForgeError {
  error:
    | 'invalid_name'
    | 'invalid_description'
    | 'invalid_command'
    | 'invalid_params'
    | 'unknown_placeholder'
    | 'unused_param'
    | 'placeholder_in_quotes'
    | 'invalid_kind'
    | 'invalid_param'
    | 'too_long'
    | 'too_many_pending'
    | 'unpin_one'
    | 'needs_confirmation'
    | 'unknown_card'
    | 'unknown_tool'
    | 'unregistered'
    | 'unsupported';
  detail?: string;
  param?: string;
}

export const FORGE_NAME_RE = /^[a-z][a-z0-9_]{1,28}$/;
export const PARAM_NAME_RE = /^[a-z][a-z0-9_]{0,19}$/;
export const FORGE_DESCRIPTION_MAX = 300;
export const PARAM_DESCRIPTION_MAX = 150;
export const PARAM_EXAMPLE_MAX = 80;
export const PARAM_VALUE_MAX = 200;
export const MAX_COMMANDS = 5;
export const MAX_PARAMS = 6;
export const MAX_FORGED_VISIBLE = 5;
export const MAX_PENDING_CARDS = 5;
export const STEP_TIMEOUT_MS = 10 * 60_000;
export const STATS_WINDOW = 50;
export const FORGED_PREFIX = 'forged_';

const PLACEHOLDER_RE = /\{\{\s*([a-z][a-z0-9_]{0,19})\s*\}\}/g;
/** Values that read cleanly without quoting. Anything else is single-quoted (POSIX). */
const BARE_VALUE_RE = /^[A-Za-z0-9_./:@%+=,-]{1,80}$/;
/** Verbs that make a command mutating regardless of what the agent declared. */
const MUTATING_RE =
  /(\b(rm|mv|dd|mkfs|git\s+push|git\s+reset|git\s+checkout|deploy|publish|kill|killall|chmod|chown|shutdown|reboot|curl\s+-X\s*(POST|PUT|DELETE|PATCH)|npm\s+publish|uv\s+publish|docker\s+(rm|push))\b|(?<![0-9])>>?\s*(?!&)\S)/i;

export function isMutating(command: string): boolean {
  return isDangerous(command) || MUTATING_RE.test(command);
}

/** Every placeholder name in a command, in order (duplicates kept). */
export function placeholdersIn(command: string): string[] {
  const out: string[] = [];
  for (const m of command.matchAll(PLACEHOLDER_RE)) out.push(m[1]);
  return out;
}

/**
 * True when any `{{…}}` sits inside a '…' or "…" region. The engine owns quoting, so a
 * placeholder inside author quotes would defeat it (a single-quoted value inside double quotes
 * still expands `$(…)`). Single-pass quote-state scan; backslash escapes honoured.
 */
export function placeholderInQuotes(command: string): boolean {
  let q: "'" | '"' | null = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === '\\' && q !== "'") {
      i++;
      continue;
    }
    if (q === null && (c === "'" || c === '"')) q = c;
    else if (q !== null && c === q) q = null;
    else if (q !== null && c === '{' && command[i + 1] === '{') return true;
  }
  return false;
}

/** Full validation of a spec. Returns null when valid. */
export function validateForgeSpec(spec: unknown): ForgeError | null {
  if (!spec || typeof spec !== 'object') return { error: 'invalid_name', detail: 'spec must be an object' };
  const s = spec as Partial<ForgeSpec>;
  if (typeof s.name !== 'string' || !FORGE_NAME_RE.test(s.name)) return { error: 'invalid_name', detail: 'name must match ^[a-z][a-z0-9_]{1,28}$' };
  if (typeof s.description !== 'string' || s.description.trim().length === 0 || s.description.length > FORGE_DESCRIPTION_MAX)
    return { error: 'invalid_description', detail: `description must be 1–${FORGE_DESCRIPTION_MAX} chars` };
  if (!Array.isArray(s.commands) || s.commands.length < 1 || s.commands.length > MAX_COMMANDS)
    return { error: 'invalid_command', detail: `1–${MAX_COMMANDS} commands required` };
  for (let i = 0; i < s.commands.length; i++) {
    const reason = validateProposedCommand(s.commands[i]);
    if (reason) return { error: 'invalid_command', detail: `command ${i + 1}: ${reason}` };
  }
  const params = s.params ?? [];
  if (!Array.isArray(params) || params.length > MAX_PARAMS) return { error: 'invalid_params', detail: `0–${MAX_PARAMS} params` };
  const names = new Set<string>();
  for (const p of params) {
    if (!p || typeof p !== 'object') return { error: 'invalid_params', detail: 'param must be an object' };
    if (typeof p.name !== 'string' || !PARAM_NAME_RE.test(p.name)) return { error: 'invalid_params', detail: `param name must match ^[a-z][a-z0-9_]{0,19}$`, param: String(p.name) };
    if (names.has(p.name)) return { error: 'invalid_params', detail: 'duplicate param name', param: p.name };
    names.add(p.name);
    if (typeof p.description !== 'string' || p.description.length === 0 || p.description.length > PARAM_DESCRIPTION_MAX)
      return { error: 'invalid_params', detail: `param description 1–${PARAM_DESCRIPTION_MAX} chars`, param: p.name };
    if (typeof p.example !== 'string' || p.example.length === 0 || p.example.length > PARAM_EXAMPLE_MAX)
      return { error: 'invalid_params', detail: `param example 1–${PARAM_EXAMPLE_MAX} chars`, param: p.name };
  }
  const used = new Set<string>();
  for (const c of s.commands as string[]) {
    for (const ph of placeholdersIn(c)) {
      if (!names.has(ph)) return { error: 'unknown_placeholder', detail: `{{${ph}}} is not a declared param`, param: ph };
      used.add(ph);
    }
  }
  for (const n of names) if (!used.has(n)) return { error: 'unused_param', detail: `param ${n} is never used in a command`, param: n };
  if (s.kind !== 'read' && s.kind !== 'write') return { error: 'invalid_kind', detail: 'kind must be "read" or "write"' };
  // Dry run with the examples: a card must never approve a spec that cannot produce a valid line.
  const example: Record<string, string> = {};
  for (const p of params) example[p.name] = p.example;
  const dry = substituteParams(s.commands as string[], params, example);
  if ('error' in dry) return { error: dry.error, detail: `dry run with examples failed: ${dry.detail ?? ''}`, param: dry.param };
  return null;
}

/** Coerce + validate one param value (no quoting; see `substituteLine`). */
export function coerceParamValue(name: string, raw: unknown): { value: string } | ForgeError {
  let v: string;
  if (typeof raw === 'string') v = raw;
  else if (typeof raw === 'number' && Number.isFinite(raw)) v = String(raw);
  else if (typeof raw === 'boolean') v = String(raw);
  else return { error: 'invalid_param', param: name, detail: 'value must be a string, finite number or boolean' };
  if (v.length === 0) return { error: 'invalid_param', param: name, detail: 'value is empty' };
  if (v.length > PARAM_VALUE_MAX) return { error: 'invalid_param', param: name, detail: `value exceeds ${PARAM_VALUE_MAX} chars` };
  const reason = validateProposedCommand(v);
  if (reason) return { error: 'invalid_param', param: name, detail: reason };
  return { value: v };
}

/** Render a value for an unquoted position: bare when clean, else POSIX single-quoted. */
export function renderParamValue(name: string, raw: unknown): { value: string } | ForgeError {
  const c = coerceParamValue(name, raw);
  if ('error' in c) return c;
  return { value: BARE_VALUE_RE.test(c.value) ? c.value : "'" + c.value.replace(/'/g, "'\\''") + "'" };
}

/**
 * Substitute placeholders in one line with quote-context awareness (single-pass scan):
 *  - outside quotes: bare when clean, else '…' single-quoted;
 *  - inside "…": bare when clean, else the double-quoted region is closed, the value inserted
 *    single-quoted, and the region reopened ("a "'$(x)'" b") — literal in sh/bash/zsh;
 *  - inside '…': `'` becomes `'\''`; everything else is already literal.
 * Unknown placeholders are left untouched (validation rejects them earlier).
 */
export function substituteLine(command: string, values: Record<string, string>): string {
  let out = '';
  // q: current quote context. "$'" = ANSI-C string (backslash escapes are interpreted inside).
  let q: "'" | '"' | "$'" | null = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === '\\' && q !== "'") {
      // in "…", $'…' and bare context a backslash escapes the next char (incl. a quote)
      out += c + (command[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '{' && command[i + 1] === '{') {
      const m = /^\{\{\s*([a-z][a-z0-9_]{0,19})\s*\}\}/.exec(command.slice(i));
      if (m && m[1] in values) {
        const v = values[m[1]];
        if (q === "'") out += v.replace(/'/g, "'\\''");
        else if (q === "$'") out += v.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); // ANSI-C: \\ and \' are literal
        else if (q === '"') out += BARE_VALUE_RE.test(v) ? v : '"' + "'" + v.replace(/'/g, "'\\''") + "'" + '"';
        else out += BARE_VALUE_RE.test(v) ? v : "'" + v.replace(/'/g, "'\\''") + "'";
        i += m[0].length - 1;
        continue;
      }
    }
    if (q === null && c === '$' && command[i + 1] === "'") {
      q = "$'";
      out += "$'";
      i++;
      continue;
    }
    if (q === null && (c === "'" || c === '"')) q = c;
    else if (q === "$'" && c === "'") q = null;
    else if ((q === "'" || q === '"') && c === q) q = null;
    out += c;
  }
  return out;
}

/**
 * Substitute `{{param}}` placeholders in every command. Values are validated and quoted by
 * `renderParamValue`; the resulting line is re-validated (≤ 400, no control/format chars).
 */
export function substituteParams(
  commands: readonly string[],
  params: readonly ForgeParam[],
  input: Record<string, unknown>,
): { lines: string[]; dangerous: boolean[] } | ForgeError {
  const values: Record<string, string> = {};
  for (const p of params) {
    const r = coerceParamValue(p.name, input?.[p.name]);
    if ('error' in r) return r;
    values[p.name] = r.value;
  }
  const lines: string[] = [];
  const dangerous: boolean[] = [];
  for (const c of commands) {
    const line = substituteLine(c, values);
    if (line.length > PROPOSE_COMMAND_MAX) return { error: 'too_long', detail: `substituted command exceeds ${PROPOSE_COMMAND_MAX} chars` };
    const reason = validateProposedCommand(line);
    if (reason) return { error: 'invalid_param', detail: reason };
    lines.push(line);
    dangerous.push(isDangerous(line));
  }
  return { lines, dangerous };
}

function canonicalSpec(spec: ForgeSpec): string {
  return JSON.stringify({
    commands: spec.commands,
    description: spec.description,
    kind: spec.kind,
    name: spec.name,
    params: spec.params.map((p) => ({ description: p.description, example: p.example, name: p.name })),
  });
}

/** 12-hex content hash (SHA-256) binding name + description + params + commands + kind. */
export async function contentHash(spec: ForgeSpec): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalSpec(spec));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

/** The WebMCP description for a forged tool (≤ 500 chars total). */
export function forgedDescription(spec: ForgeSpec): string {
  const prefix = spec.kind === 'write' ? 'CONSEQUENTIAL: ' : '';
  const suffix = ` Ghost-types ${spec.commands.length} command${spec.commands.length === 1 ? '' : 's'} into the human's terminal; each runs only when the human presses Enter. Then call terminal_wait with the returned proposal id.`;
  const room = 500 - prefix.length - suffix.length;
  const body = spec.description.length > room ? spec.description.slice(0, room - 1) + '…' : spec.description;
  return prefix + body + suffix;
}

/** JSON Schema for a forged tool's input. */
export function forgedInputSchema(spec: ForgeSpec): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const p of spec.params) properties[p.name] = { type: 'string', description: p.description, examples: [p.example] };
  return { type: 'object', properties, required: spec.params.map((p) => p.name), additionalProperties: false };
}

/** Chrome 152 may hand `execute` a JSON string (FIELD-NOTES #6); normalise to an object. */
export function coerceInput(input: unknown): Record<string, unknown> {
  if (typeof input === 'string') {
    try {
      const parsed: unknown = JSON.parse(input);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}
