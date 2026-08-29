/**
 * Artifacts (ticket #5): the one thing the browser can do that the terminal beside it cannot —
 * take the output a run already printed and *render* it. A run whose tail parses as structured
 * content (JSON, a delimited table, Markdown, a list of links) can be opened as an artifact in a
 * panel next to the terminal; a `rokan do` run can be opened as its result card.
 *
 * Nothing here fetches, executes or transforms — it classifies text that already exists in the run
 * feed and hands the panel a model to paint. Detection is deliberately CONSERVATIVE: commands are
 * not CSV, logs are not JSON, prose is not Markdown. A false negative costs one un-offered button;
 * a false positive puts a nonsense table in front of a judge. When in doubt, return null.
 *
 * Confidence is a second, stricter bar: `confident` detections earn a quiet marker on the collapsed
 * run row (the output is unambiguously this thing — e.g. the whole tail parses as one JSON value);
 * everything else is only offered inside the expanded run, where the human asked for detail.
 *
 * SECURITY (the panel that renders these models is bound by the same rules):
 *   - no artifact is ever executed, fetched or embedded: no iframes, no `dangerouslySetInnerHTML`,
 *     no <img>/<script>/<link> built from output, no title/preview fetching of detected URLs;
 *   - the Markdown model is TEXT, never HTML — the renderer is a small self-written one that emits
 *     React elements, so every byte it did not itself recognise is escaped as a text node;
 *   - only `http:`/`https:` URLs survive detection (a `javascript:` or `data:` line is not a link),
 *     and links are rendered as plain anchors with `rel="noopener noreferrer"`;
 *   - run text arrived through RunFeedStore, which already strips C0/C1 controls and Unicode format
 *     characters (bidi overrides); this module never re-introduces markup.
 *
 * Cost: a tail is ≤ 200 lines and each line ≤ 2000 chars (runfeed.ts), and every scan below is a
 * single linear pass over that — no regex backtracking over the joined text, no quadratic work.
 * `detectionFor` memoises per Run object, which is immutable, so the feed can ask on every render.
 */
import type { Run } from './runfeed';

export type ArtifactKind = 'json' | 'csv' | 'tsv' | 'markdown' | 'urls' | 'rokan';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** A rectangle of already-stringified cells. The panel paints it; it never re-parses it. */
export interface TableShape {
  columns: string[];
  rows: string[][];
  /** true when rows or columns were cut to the caps below — the panel says so rather than lying. */
  truncated: boolean;
}

/**
 * A `rokan do` run as a card. Every field is copied from something that was measured or printed:
 * `ms` is the bridge's parse of the result line, `calls` is 0 only when the line carried `⚡`
 * (a replay spends no model call) and null otherwise — unknown is never rendered as zero.
 * `site`/`tool` are filled only when the result line carries the `⚙ native:<site>:<tools>` token
 * (COMPOSE-PLAN §"trailer"); today's CLI usually omits it, and then they stay null.
 */
export interface RokanCard {
  /** the quoted task from `rokan do "…"`, when the command shows one */
  question: string | null;
  command: string | null;
  /** the answer as rokan printed it, trimmed */
  answer: string | null;
  /** speed of the step, measured by rokan and parsed by the bridge */
  ms: number;
  /** what the shell measured for the whole command; null when nothing measured it */
  totalMs: number | null;
  replayed: boolean;
  /** 0 when replayed; null = nobody counted them */
  calls: number | null;
  site: string | null;
  tool: string | null;
  exit_code: number | null;
  /** the other lines rokan printed, for context under the card */
  lines: string[];
}

export type Artifact =
  | { kind: 'json'; value: JsonValue; table: TableShape | null }
  | { kind: 'csv' | 'tsv'; table: TableShape }
  | { kind: 'markdown'; text: string }
  | { kind: 'urls'; urls: string[] }
  | { kind: 'rokan'; card: RokanCard };

export interface Detection {
  artifact: Artifact;
  /** the action in the expanded run — active voice, sentence case */
  action: string;
  /** the type, for the panel header and the collapsed-row marker */
  type: string;
  /** unambiguous enough to advertise before the human opens the run */
  confident: boolean;
}

/** What the panel is showing: one artifact, and where it came from. */
export interface OpenArtifact {
  runId: string;
  command: string | null;
  detection: Detection;
}

/** Caps. A tail is small; these only bound pathological single lines (a minified JSON array). */
const MAX_CHARS = 262144;
const MAX_COLUMNS = 40;
const MAX_ROWS = 500;
const CELL_MAX = 300;

/* ------------------------------------------------------------------ JSON */

function parseWholeJson(text: string): { value: JsonValue } | null {
  const t = text.trim();
  // Only containers: a tail that is just `42`, `null` or `"ok"` is output, not a document.
  if (t.length === 0 || t.length > MAX_CHARS || (t[0] !== '{' && t[0] !== '[')) return null;
  try {
    return { value: JSON.parse(t) as JsonValue };
  } catch {
    return null;
  }
}

function isPlainObject(v: JsonValue): v is { [k: string]: JsonValue } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cell(v: JsonValue): string {
  if (v === null) return '';
  if (typeof v === 'string') return v.slice(0, CELL_MAX);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v).slice(0, CELL_MAX);
}

/** An array of objects is a table; anything else is a tree. Column order = first appearance. */
export function tableFromJson(value: JsonValue): TableShape | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every(isPlainObject)) return null;
  const columns: string[] = [];
  const seen = new Set<string>();
  let moreColumns = false;
  for (const row of value as { [k: string]: JsonValue }[]) {
    for (const k of Object.keys(row)) {
      if (seen.has(k)) continue;
      if (columns.length >= MAX_COLUMNS) {
        moreColumns = true;
        continue;
      }
      seen.add(k);
      columns.push(k);
    }
  }
  if (columns.length === 0) return null;
  const kept = (value as { [k: string]: JsonValue }[]).slice(0, MAX_ROWS);
  return {
    columns,
    rows: kept.map((r) => columns.map((c) => (c in r ? cell(r[c]) : ''))),
    truncated: moreColumns || kept.length < value.length,
  };
}

function detectJson(lines: string[]): Detection | null {
  let parsed = parseWholeJson(lines.join('\n'));
  let confident = true;
  // A tail often carries the echoed command as its first line (`cat data.json`). Dropping exactly
  // one leading non-JSON line still finds the document, but it is no longer unambiguous.
  if (!parsed && lines.length > 1) {
    const first = lines[0].trim();
    if (first.length > 0 && first[0] !== '{' && first[0] !== '[') {
      parsed = parseWholeJson(lines.slice(1).join('\n'));
      confident = false;
    }
  }
  if (!parsed) return null;
  const table = tableFromJson(parsed.value);
  return {
    artifact: { kind: 'json', value: parsed.value, table },
    action: table ? 'Open as JSON table' : 'Open as JSON',
    type: 'JSON',
    confident,
  };
}

/* ------------------------------------------------- delimited (CSV / TSV) */

/** RFC-4180-ish split: quotes group, `""` is a literal quote. One linear pass. */
export function splitDelimited(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch !== '"') cur += ch;
      else if (line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"' && cur === '') quoted = true;
    else if (ch === d) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const WORDS = /\s+/;

function detectDelimited(lines: string[], d: ',' | '\t'): Detection | null {
  const body = trimBlank(lines);
  if (body.length < 2) return null;
  // A blank line inside means this is output with structure, not one table.
  if (body.some((l) => l.trim() === '')) return null;
  // A prompt echo is not a header.
  if (/^[$%>❯#]\s/.test(body[0])) return null;
  const rows = body.map((l) => splitDelimited(l, d));
  const n = rows[0].length;
  if (n < 2 || n > MAX_COLUMNS) return null;
  if (!rows.every((r) => r.length === n)) return null;
  for (const r of rows) {
    for (const c of r) {
      // Prose ("Fetching the index, please wait") is not a row: real cells are short values.
      if (c.length > CELL_MAX) return null;
      if (c.trim().split(WORDS).length >= 8) return null;
      // Comma-prose always writes ", " — real CSV cells start where the delimiter ended.
      if (d === ',' && c !== c.trimStart()) return null;
    }
  }
  const columns = rows[0].map((c, i) => (c.trim() === '' ? `col ${i + 1}` : c.trim()));
  const kept = rows.slice(1, 1 + MAX_ROWS);
  const kind = d === ',' ? 'csv' : 'tsv';
  return {
    artifact: { kind, table: { columns, rows: kept, truncated: kept.length < rows.length - 1 } },
    action: d === ',' ? 'Open as CSV table' : 'Open as TSV table',
    type: d === ',' ? 'CSV' : 'TSV',
    // Header plus a single row could be anything; two rows make it a table.
    confident: rows.length >= 3,
  };
}

function trimBlank(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && lines[a].trim() === '') a++;
  while (b > a && lines[b - 1].trim() === '') b--;
  return lines.slice(a, b).map((l) => l.replace(/\r$/, ''));
}

/* -------------------------------------------------------------- Markdown */

const MD_HEADING = /^ {0,3}#{1,6} +\S/;
const MD_FENCE = /^ {0,3}(```|~~~)/;
const MD_LIST = /^ {0,3}([-*+]|\d{1,9}[.)]) +\S/;
const MD_LINK = /\[[^\]\n]{1,200}\]\(https?:\/\/[^\s)]{1,2000}\)/;
/** A unified diff wears `-`/`+` lines that read exactly like a list. Never Markdown. */
const DIFF = /^(\+\+\+ |--- |@@ |diff --git |index [0-9a-f]{7,})/;
const PROMPT = /^[$%>❯]\s/;

function detectMarkdown(lines: string[]): Detection | null {
  let headings = 0;
  let fences = 0;
  let lists = 0;
  let links = 0;
  let prompts = 0;
  for (const l of lines) {
    if (DIFF.test(l)) return null;
    if (PROMPT.test(l)) prompts++;
    if (MD_FENCE.test(l)) fences++;
    else if (MD_HEADING.test(l)) headings++;
    else if (MD_LIST.test(l)) lists++;
    if (MD_LINK.test(l)) links++;
  }
  if (prompts >= 2) return null;
  const ok = (headings >= 1 && (lists >= 1 || fences >= 2 || links >= 1)) || (fences >= 2 && (lists >= 1 || links >= 1));
  if (!ok) return null;
  return {
    artifact: { kind: 'markdown', text: trimBlank(lines).join('\n') },
    action: 'Open as Markdown',
    type: 'Markdown',
    confident: headings >= 1 && (fences >= 2 || lists >= 2),
  };
}

/* ------------------------------------------------------------------ URLs */

const URL_LINE = /^https?:\/\/[^\s<>"'`]{1,2000}$/;

/** http/https only — a `javascript:` or `data:` line is text, not a link. */
export function safeUrl(raw: string): string | null {
  if (!URL_LINE.test(raw)) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

function detectUrls(lines: string[]): Detection | null {
  const body = trimBlank(lines);
  const nonEmpty = body.filter((l) => l.trim() !== '');
  if (nonEmpty.length === 0) return null;
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const l of nonEmpty) {
    const u = safeUrl(l.trim());
    if (u && !seen.has(u) && urls.length < MAX_ROWS) {
      seen.add(u);
      urls.push(u);
    }
  }
  // "Mostly links" — one URL buried in thirty lines of npm output is not a link list.
  const urlLines = nonEmpty.filter((l) => safeUrl(l.trim()) !== null).length;
  if (urls.length === 0 || urlLines * 2 < nonEmpty.length) return null;
  return {
    artifact: { kind: 'urls', urls },
    action: urls.length === 1 ? 'Open the link' : `Open the ${urls.length} links`,
    type: urls.length === 1 ? 'Link' : 'Links',
    confident: urlLines === nonEmpty.length,
  };
}

/* ----------------------------------------------------------------- rokan */

/** The bridge's own result-line shape (packages/bridge/src/rokan-trailer.js), plus its answer. */
const ROKAN_RESULT = /^ {2}(\S.*?) {3}(\d{1,7})ms( {2}⚡)?\s*$/;
/** The optional native trailer token: `⚙ native:<site>:<tool[,tool]>` (COMPOSE-PLAN). */
const NATIVE_TOKEN = /⚙\s*native:([A-Za-z0-9.\-_]{1,120}):([A-Za-z0-9_,\-]{1,200})/;
/** `rokan do "…"` / `rokan do '…'` — the task, in the human's words. */
const ROKAN_QUESTION = /\brokan\s+(?:do|run)\s+(?:"([^"]{1,400})"|'([^']{1,400})')/;

/**
 * A rokan run as a card. Returns null for every other run: the card exists because the bridge
 * measured a rokan result line, and without that trailer there is nothing honest to show.
 */
export function rokanArtifact(run: Run): Detection | null {
  if (!run.rokan) return null;
  let answer: string | null = null;
  let site: string | null = null;
  let tool: string | null = null;
  const rest: string[] = [];
  // Last matching line wins, exactly like the bridge's parser.
  for (let i = run.tail.length - 1; i >= 0; i--) {
    // annotated: `answer` is assigned from `m` below, which would otherwise infer circularly
    const m: RegExpExecArray | null = answer === null ? ROKAN_RESULT.exec(run.tail[i]) : null;
    if (m) {
      const native = NATIVE_TOKEN.exec(m[1]);
      if (native) {
        site = native[1];
        tool = native[2].split(',')[0];
      }
      answer = m[1].replace(NATIVE_TOKEN, '').trim();
    } else rest.unshift(run.tail[i]);
  }
  const q = run.command ? ROKAN_QUESTION.exec(run.command) : null;
  const card: RokanCard = {
    question: q ? (q[1] ?? q[2]) : null,
    command: run.command,
    answer,
    ms: run.rokan.ms,
    totalMs: run.ms,
    replayed: run.rokan.replayed,
    calls: run.rokan.replayed ? 0 : null,
    site,
    tool,
    exit_code: run.exit_code,
    lines: rest.slice(-40),
  };
  return { artifact: { kind: 'rokan', card }, action: 'Open result card', type: 'rokan result', confident: true };
}

/* ------------------------------------------------------------- the entry */

/**
 * A shell with no integration paints its next prompt into the captured tail (measured on a live
 * bash bridge, 2026-08-29: `["printf …", "[{…}]", "aarya@box:~$ "]`). One trailing line that ends
 * in a bare prompt sigil is shell chrome, not content — a real last cell ending in `$` has no space
 * before it, so this stays conservative.
 */
const PROMPT_TAIL = /(?:^|[^\p{L}\p{N}])[$%#❯➜]\s*$/u;

function stripShellFrame(lines: string[]): string[] {
  const body = trimBlank(lines);
  return body.length > 1 && PROMPT_TAIL.test(body[body.length - 1]) ? body.slice(0, -1) : body;
}

/**
 * Classify a run's captured output. Order is by specificity: a JSON document is never also a CSV,
 * a Markdown page that happens to list links is Markdown.
 *
 * `command` is the run's own command line, when the shell recorded one: a terminal without shell
 * integration echoes the command into the capture, and a first line that IS the command, byte for
 * byte, is chrome rather than output. Stripping it is exact, not a guess, so it costs no confidence
 * — and without it an agent's run (echo + rows) is never a table at all.
 */
export function detect(tail: string[], command?: string | null): Detection | null {
  if (tail.length === 0) return null;
  let lines = stripShellFrame(tail.length > 400 ? tail.slice(-400) : tail);
  if (command && lines.length > 1 && lines[0].trim() === command.trim()) lines = lines.slice(1);
  if (lines.length === 0) return null;
  return detectJson(lines) ?? detectDelimited(lines, ',') ?? detectDelimited(lines, '\t') ?? detectMarkdown(lines) ?? detectUrls(lines);
}

const cache = new WeakMap<Run, { d: Detection | null }>();

/** Memoised per Run (records are immutable), so the feed may ask on every render. */
export function detectionFor(run: Run): Detection | null {
  const hit = cache.get(run);
  if (hit) return hit.d;
  const d = detect(run.tail, run.command);
  cache.set(run, { d });
  return d;
}
