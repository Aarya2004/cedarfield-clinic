'use client';

/**
 * The xterm pane. Keystrokes go to the bridge; bridge bytes go to xterm. A pending proposal is
 * drawn as a decoration at the cursor (never written to the PTY). Enter on an empty line sends
 * exactly the proposal's bytes; Tab inserts them for editing; Esc dismisses. Dangerous proposals
 * need Enter twice.
 */
import { useEffect, useRef, useState } from 'react';
import type { Terminal as XTerm, IDecoration, IMarker } from '@xterm/xterm';
import { session } from '@/lib/terminal/session';
import { LineBuffer } from '@/lib/terminal/linebuffer';
import { PromptDetector } from '@/lib/terminal/osc';
import { proposals, type Proposal } from '@/lib/webmcp/proposals';
import { note } from '@/lib/webmcp/fieldnotes';

const THEME = {
  background: '#fafaf6',
  foreground: '#18181b',
  cursor: '#d97706',
  cursorAccent: '#fafaf6',
  selectionBackground: 'rgba(217,119,6,0.25)',
  black: '#18181b',
  red: '#b91c1c',
  green: '#047857',
  yellow: '#b45309',
  blue: '#1d4ed8',
  magenta: '#7e22ce',
  cyan: '#0e7490',
  white: '#e4e4e0',
  brightBlack: '#71717a',
  brightRed: '#dc2626',
  brightGreen: '#059669',
  brightYellow: '#d97706',
  brightBlue: '#2563eb',
  brightMagenta: '#9333ea',
  brightCyan: '#0891b2',
  brightWhite: '#fafaf6',
};

export function Terminal({ onForgeThis }: { onForgeThis: (lines: string[]) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const pendingRef = useRef<Proposal | undefined>(undefined);
  const armedRef = useRef<string | null>(null);
  const insertedRef = useRef<string | null>(null);
  const lineBuf = useRef(new LineBuffer());
  const [lineEmpty, setLineEmpty] = useState(true);
  const [pending, setPending] = useState<Proposal | undefined>(undefined);
  armedRef.current = armed;
  insertedRef.current = insertedId;

  // proposal subscription
  useEffect(() => {
    const update = () => {
      const p = proposals.pending();
      pendingRef.current = p;
      setPending(p);
    };
    update();
    return proposals.subscribe(update);
  }, []);

  useEffect(() => lineBuf.current.subscribe(() => setLineEmpty(lineBuf.current.empty)), []);

  // xterm lifecycle
  useEffect(() => {
    const host = hostRef.current;
    const client = session.getClient();
    if (!host || !client) return;
    let disposed = false;
    let term: XTerm | null = null;
    let cleanup: (() => void)[] = [];
    (async () => {
      const [{ Terminal: XTermCtor }, { FitAddon }, { WebglAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit'), import('@xterm/addon-webgl')]);
      if (disposed) return;
      const t0 = performance.now();
      term = new XTermCtor({ cursorBlink: true, scrollback: 5000, fontFamily: 'var(--font-mono), ui-monospace, Menlo, monospace', fontSize: 13, lineHeight: 1.2, theme: THEME, allowProposedApi: false });
      termRef.current = term;
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host);
      let renderer = 'dom';
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => {
          webgl.dispose();
          note('xterm.webgl_context_lost');
        });
        term.loadAddon(webgl);
        renderer = 'webgl';
      } catch (e) {
        note('xterm.webgl_unavailable', { message: e instanceof Error ? e.message : String(e) });
      }
      fit.fit();
      client.resize(term.cols, term.rows);
      session.attachTerm(term);
      note('xterm.opened', { ms: Math.round(performance.now() - t0), renderer, cols: term.cols, rows: term.rows });

      const detector = new PromptDetector();
      cleanup.push(client.on('data', (d) => {
        term?.write(d);
        for (const ev of detector.feed(d)) if (ev.kind === 'prompt') lineBuf.current.reset();
      }));
      cleanup.push(client.on('exit', () => lineBuf.current.reset()));
      const dataDisp = term.onData((d) => {
        client.sendInput(d);
      });
      cleanup.push(() => dataDisp.dispose());
      const selDisp = term.onSelectionChange(() => {
        const s = term?.getSelection() ?? '';
        setSelection(s.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length > 0).slice(0, 5));
      });
      cleanup.push(() => selDisp.dispose());

      term.attachCustomKeyEventHandler((ev) => {
        if (ev.type !== 'keydown') return true;
        const p = pendingRef.current;
        const adapter = session.getAdapter();
        if (p && adapter) {
          if (ev.key === 'Escape') {
            proposals.resolve(p.id, 'dismissed');
            setArmed(null);
            return false;
          }
          if (lineBuf.current.empty && insertedRef.current !== p.id) {
            if (ev.key === 'Enter') {
              if (p.dangerous && armedRef.current !== p.id) {
                setArmed(p.id);
                return false;
              }
              setArmed(null);
              adapter.acceptProposal(p.id);
              return false;
            }
            if (ev.key === 'Tab') {
              client.sendInput(p.command);
              lineBuf.current.feedText(p.command);
              setInsertedId(p.id);
              note('ghost.tab_inserted');
              return false;
            }
          } else if (ev.key === 'Enter' && insertedRef.current === p.id) {
            // human edited the inserted text and pressed Enter: xterm sends "\r"; record edited
            adapter.acceptProposal(p.id, { edited: true, alreadySent: true });
            setInsertedId(null);
          }
        }
        lineBuf.current.feedKey(ev);
        return true;
      });

      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
          if (term) client.resize(term.cols, term.rows);
        } catch {
          /* container hidden */
        }
      });
      ro.observe(host);
      cleanup.push(() => ro.disconnect());
      term.focus();
    })();
    return () => {
      disposed = true;
      cleanup.forEach((fn) => fn());
      cleanup = [];
      session.detachTerm();
      term?.dispose();
      termRef.current = null;
    };
  }, []);

  // ghost decoration
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const show = pending && lineEmpty && insertedId !== pending.id;
    if (!show) return;
    let marker: IMarker | undefined;
    let deco: IDecoration | undefined;
    const draw = () => {
      deco?.dispose();
      marker?.dispose();
      const b = term.buffer.active;
      marker = term.registerMarker(0);
      if (!marker) return;
      deco = term.registerDecoration({ marker, x: b.cursorX, layer: 'top' });
      deco?.onRender((el) => {
        el.textContent = pending.command;
        el.className = `ghost ${pending.dangerous ? 'ghost-danger' : ''}`;
        el.setAttribute('dir', 'auto');
        el.setAttribute('data-ghost', pending.id);
      });
    };
    draw();
    const d1 = term.onWriteParsed(() => draw());
    const d2 = term.onResize(() => draw());
    return () => {
      d1.dispose();
      d2.dispose();
      deco?.dispose();
      marker?.dispose();
    };
  }, [pending, lineEmpty, insertedId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} data-terminal className="min-h-0 flex-1 overflow-hidden rounded-md border border-line bg-bg p-2" />
      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-3 text-xs text-muted" data-ghost-bar>
        {pending ? (
          <span className={pending.dangerous ? 'text-danger' : ''} dir="auto">
            ← {pending.why ?? 'proposed by the agent'} ·{' '}
            {lineEmpty && insertedId !== pending.id ? (
              pending.dangerous ? (
                armed === pending.id ? 'press Enter again to confirm' : 'hard-blocked pattern: Enter twice · Esc dismiss'
              ) : (
                'Tab insert · Enter run · Esc dismiss'
              )
            ) : insertedId === pending.id ? (
              'inserted — edit, then Enter'
            ) : (
              'finish or clear your line to see the proposal · Esc dismiss'
            )}
          </span>
        ) : (
          <span>agent proposals appear at the prompt as ghost text</span>
        )}
        {selection.length > 0 && (
          <button data-forge-this onClick={() => onForgeThis(selection)} className="ml-auto rounded bg-accent px-2 py-0.5 text-white">
            Forge this ({selection.length} line{selection.length === 1 ? '' : 's'})
          </button>
        )}
      </div>
    </div>
  );
}
