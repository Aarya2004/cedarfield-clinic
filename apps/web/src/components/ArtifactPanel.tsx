'use client';

/**
 * The artifact panel (ticket #5): one run's output, rendered. It opens as a third region beside the
 * run feed and the terminal — the browser doing the one thing the terminal beside it cannot, while
 * the raw bytes stay untouched below. Quiet on purpose: the design budget is spent on the birth
 * pulse, so this is hairlines, mono data and no motion.
 *
 * SECURITY — this component renders untrusted command output and therefore:
 *   - never executes or embeds anything: no iframe, no `dangerouslySetInnerHTML`, no <img>/<script>
 *     built from output, no fetching of detected URLs (no titles, no favicons, no previews);
 *   - renders Markdown with the small parser below, which emits React elements only. Every byte it
 *     does not recognise as one of its few inline forms becomes a React text node, i.e. escaped —
 *     raw HTML in the output is shown as characters, never parsed;
 *   - links are plain <a> with rel="noopener noreferrer", and only after `safeUrl` has confirmed an
 *     http/https scheme; anything else stays literal text;
 *   - the text arrived through RunFeedStore, which already stripped C0/C1 controls and Unicode
 *     format characters (bidi overrides) — this file adds no markup path back in.
 */
import { useState, type ReactNode } from 'react';
import { safeUrl, type Artifact, type JsonValue, type OpenArtifact, type RokanCard, type TableShape } from '@/lib/terminal/artifacts';
import { ProvenanceChip, type ProvenanceKind } from './Provenance';
import { Chip } from './Chip';

const LINK = 'rounded-sm underline decoration-line underline-offset-2 hover:decoration-ink';

export function ArtifactPanel({ open, onClose }: { open: OpenArtifact; onClose: () => void }) {
  const { detection, command } = open;
  const kind = detection.artifact.kind;
  // Opening does NOT take focus. The terminal keeps it, because the human's Enter is what runs a
  // command and a panel must never swallow it — measured on the live bridge, 2026-08-29: autofocus
  // here ate the next proposal's Enter. Tab reaches the panel; Esc closes it from inside.
  return (
    <section
      data-artifact-panel
      data-artifact-type={kind}
      aria-label={`${detection.type} artifact`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-lg min-[1100px]:static min-[1100px]:z-auto min-[1100px]:w-[40%] min-[1100px]:max-w-[560px] min-[1100px]:shrink-0 min-[1100px]:shadow-none"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1.5">
        <h2 className="shrink-0 text-xs font-medium">{detection.type}</h2>
        <code className="mono min-w-0 flex-1 truncate text-[11px] text-muted" dir="ltr" title={command ?? undefined}>
          {command ?? 'command not recorded by the shell'}
        </code>
        <button type="button" data-artifact-close onClick={onClose} title="Close the artifact (Esc)" className={`shrink-0 text-[11px] text-muted hover:text-ink ${LINK}`}>
          Close
        </button>
      </header>
      {/* tabIndex: a scroll box a keyboard can reach and page through. */}
      <div tabIndex={0} data-artifact-body className="min-h-0 flex-1 overflow-auto p-2.5 text-xs">
        <Body artifact={detection.artifact} />
      </div>
    </section>
  );
}

function Body({ artifact }: { artifact: Artifact }) {
  switch (artifact.kind) {
    case 'json':
      return <JsonView value={artifact.value} table={artifact.table} />;
    case 'csv':
    case 'tsv':
      return <DataTable t={artifact.table} />;
    case 'markdown':
      return <Markdown text={artifact.text} />;
    case 'urls':
      return <UrlList urls={artifact.urls} />;
    case 'rokan':
      return <RokanResult card={artifact.card} />;
  }
}

/* ------------------------------------------------------------------ JSON */

function JsonView({ value, table }: { value: JsonValue; table: TableShape | null }) {
  const [view, setView] = useState<'table' | 'tree'>(table ? 'table' : 'tree');
  return (
    <div>
      {table && (
        <div className="mb-2 flex items-center gap-1 text-[11px]" role="group" aria-label="json view">
          {(['table', 'tree'] as const).map((v) => (
            <button
              key={v}
              type="button"
              data-artifact-view={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded px-1.5 py-0.5 ${view === v ? 'tone-accent' : 'text-muted hover:text-ink'}`}
            >
              {v === 'table' ? 'Table' : 'Tree'}
            </button>
          ))}
        </div>
      )}
      {table && view === 'table' ? <DataTable t={table} /> : <JsonNode value={value} depth={0} />}
    </div>
  );
}

const CHILDREN_MAX = 200;

/** A tiny collapsible tree. <details> so expanding is keyboard-native and needs no ARIA of ours. */
function JsonNode({ name, value, depth }: { name?: string; value: JsonValue; depth: number }) {
  if (value === null || typeof value !== 'object') {
    return (
      <div className="mono leading-5">
        {name !== undefined && <span className="text-muted">{name}: </span>}
        <Scalar v={value} />
      </div>
    );
  }
  const entries: [string, JsonValue][] = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  const shown = entries.slice(0, CHILDREN_MAX);
  const brace = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`;
  return (
    <details open={depth < 2 && entries.length <= 50} className="leading-5">
      <summary className="mono cursor-pointer marker:text-muted">
        {name !== undefined && <span className="text-muted">{name}: </span>}
        <span className="text-muted">{brace}</span>
      </summary>
      <div className="ml-2 border-l border-line pl-2">
        {shown.map(([k, v]) => (
          <JsonNode key={k} name={k} value={v} depth={depth + 1} />
        ))}
        {entries.length > shown.length && <div className="text-muted">… {entries.length - shown.length} more</div>}
      </div>
    </details>
  );
}

function Scalar({ v }: { v: JsonValue }) {
  if (typeof v === 'string') return <span className="text-ink">&quot;{v}&quot;</span>;
  if (typeof v === 'number') return <span className="text-accent-ink tabular-nums">{v}</span>;
  return <span className="text-muted">{String(v)}</span>;
}

/* ----------------------------------------------------------------- table */

function DataTable({ t }: { t: TableShape }) {
  return (
    <div>
      <table className="w-full border-collapse text-left text-[11px]" data-artifact-table>
        <thead>
          <tr>
            {t.columns.map((c, i) => (
              <th key={`${c}-${i}`} className="sticky top-0 z-10 border-b border-line bg-surface px-1.5 py-1 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i} className="border-b border-line">
              {t.columns.map((_, j) => (
                <td key={j} className="mono max-w-[22ch] truncate px-1.5 py-0.5 align-top" title={r[j]}>
                  {r[j] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted">
        {t.rows.length} {t.rows.length === 1 ? 'row' : 'rows'} · {t.columns.length} columns
        {t.truncated && ' · more were captured than are shown here'}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- markdown */

type MdBlock =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'list'; ordered: boolean; items: string[] }
  | { t: 'code'; text: string }
  | { t: 'hr' };

const HEADING = /^ {0,3}(#{1,6}) +(.*)$/;
const FENCE = /^ {0,3}(```|~~~)/;
const RULE = /^ {0,3}([-*_])( *\1){2,} *$/;
const ITEM = /^ {0,3}(?:([-*+])|(\d{1,9})[.)]) +(.*)$/;
const BLOCKS_MAX = 500;

/** The whole grammar: headings, fenced code, lists, rules, paragraphs. No HTML, by construction. */
export function parseMarkdown(src: string): MdBlock[] {
  const lines = src.split('\n');
  const out: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length > 0) {
      out.push({ t: 'p', text: para.join(' ') });
      para = [];
    }
  };
  let i = 0;
  while (i < lines.length && out.length < BLOCKS_MAX) {
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) body.push(lines[i++]);
      i++; // the closing fence, if there was one
      out.push({ t: 'code', text: body.join('\n') });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flush();
      out.push({ t: 'h', level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      flush();
      out.push({ t: 'hr' });
      i++;
      continue;
    }
    const first = ITEM.exec(line);
    if (first) {
      flush();
      const ordered = first[1] === undefined;
      const items: string[] = [];
      while (i < lines.length) {
        const m = ITEM.exec(lines[i]);
        if (!m || (m[1] === undefined) !== ordered) break;
        items.push(m[3]);
        i++;
      }
      out.push({ t: 'list', ordered, items });
      continue;
    }
    if (line.trim() === '') flush();
    else para.push(line.trim());
    i++;
  }
  flush();
  return out;
}

/** `code` · **bold** · *em* · _em_ · [text](https://…). Everything else is a text node. */
const INLINE_SRC = '`([^`\\n]{1,400})`|\\*\\*([^*\\n]{1,400})\\*\\*|\\*([^*\\n]{1,400})\\*|_([^_\\n]{1,400})_|\\[([^\\]\\n]{1,200})\\]\\(([^\\s)]{1,2000})\\)';

function inline(src: string): ReactNode[] {
  const re = new RegExp(INLINE_SRC, 'g');
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push(src.slice(last, m.index));
    const key = `i${n++}`;
    if (m[1] !== undefined) {
      out.push(
        <code key={key} className="mono rounded bg-line px-1 py-0.5">
          {m[1]}
        </code>,
      );
    } else if (m[2] !== undefined) {
      out.push(
        <strong key={key} className="font-medium text-ink">
          {m[2]}
        </strong>,
      );
    } else if (m[3] !== undefined || m[4] !== undefined) {
      out.push(<em key={key}>{m[3] ?? m[4]}</em>);
    } else {
      const href = safeUrl(m[6]);
      // A link we cannot vouch for stays exactly the characters that were printed.
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={`text-accent-ink ${LINK}`}>
            {m[5]}
          </a>
        ) : (
          <span key={key}>{m[0]}</span>
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

const H_SIZE = ['text-[15px] font-medium', 'text-[14px] font-medium', 'text-[13px] font-medium', 'text-xs font-medium', 'text-xs font-medium', 'text-xs font-medium'];

function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className="space-y-2 leading-5" data-artifact-markdown>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h': {
            const H = `h${Math.min(b.level + 2, 6)}` as 'h3' | 'h4' | 'h5' | 'h6';
            return (
              <H key={i} className={`mt-3 text-ink ${H_SIZE[b.level - 1]}`}>
                {inline(b.text)}
              </H>
            );
          }
          case 'code':
            return (
              <pre key={i} className="terminal-canvas mono overflow-auto whitespace-pre-wrap break-words rounded border border-line p-2 text-[11px] leading-4">
                {b.text}
              </pre>
            );
          case 'list':
            return b.ordered ? (
              <ol key={i} className="ml-4 list-decimal space-y-0.5">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="ml-4 list-disc space-y-0.5">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </ul>
            );
          case 'hr':
            return <hr key={i} className="border-line" />;
          default:
            return (
              <p key={i} className="text-muted">
                {inline(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ URLs */

function UrlList({ urls }: { urls: string[] }) {
  return (
    <ol className="space-y-1" data-artifact-urls>
      {urls.map((u) => (
        <li key={u}>
          {/* Full URL as its own text: nothing is fetched, so the destination is the only honest label. */}
          <a href={u} target="_blank" rel="noopener noreferrer" dir="ltr" className={`mono break-all text-accent-ink ${LINK}`}>
            {u}
          </a>
        </li>
      ))}
    </ol>
  );
}

/* ----------------------------------------------------------------- rokan */

function RokanResult({ card }: { card: RokanCard }) {
  const kind: ProvenanceKind = card.site ? 'native' : card.replayed ? 'compiled' : 'planned';
  return (
    <div className="space-y-3" data-artifact-rokan>
      <p className="serif text-[17px] leading-6 text-ink">{card.question ?? card.answer ?? 'A rokan run'}</p>
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceChip
          p={{
            kind,
            ...(card.site ? { site: card.site } : {}),
            ...(card.tool ? { tool: card.tool } : {}),
            ms: card.ms,
            ...(card.calls !== null ? { calls: card.calls } : {}),
          }}
        />
        {card.exit_code !== null && (
          <Chip tone={card.exit_code === 0 ? 'ok' : 'danger'} className="mono" title="Exit code, as reported by the shell">
            exit {card.exit_code}
          </Chip>
        )}
      </div>
      {card.answer && <p className="mono rounded border border-line bg-bg p-2 text-[11px] leading-4 text-ink">{card.answer}</p>}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11px]">
        <Field label="Command" value={card.command ?? 'not recorded by the shell'} mono />
        <Field label="rokan" value={`${card.ms} ms`} mono title="Measured by rokan, parsed from its result line" />
        <Field label="Command time" value={card.totalMs === null ? 'not measured' : `${card.totalMs} ms`} mono title="Measured by the shell for the whole command" />
        <Field
          label="Model calls"
          value={card.calls === null ? 'not counted' : `${card.calls}`}
          mono
          title={card.calls === null ? 'rokan prints no call count unless the run was a replay — this page never infers one.' : 'A replay spends no model call.'}
        />
        <Field label="Transport" value={card.replayed ? 'replayed a compiled operation' : 'planned by the model'} />
      </dl>
      {card.lines.length > 0 && (
        <pre className="terminal-canvas mono max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-line p-2 text-[11px] leading-4">{card.lines.join('\n')}</pre>
      )}
    </div>
  );
}

function Field({ label, value, mono, title }: { label: string; value: string; mono?: boolean; title?: string }) {
  return (
    <>
      <dt className="text-muted" title={title}>
        {label}
      </dt>
      <dd className={`min-w-0 break-words text-ink ${mono ? 'mono' : ''}`} dir="ltr">
        {value}
      </dd>
    </>
  );
}
