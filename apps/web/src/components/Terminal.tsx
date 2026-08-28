'use client';

/**
 * The xterm pane. Keystrokes go to the bridge; bridge bytes go to xterm. A pending proposal is
 * drawn as a decoration at the cursor (never written to the PTY). Enter on an empty line sends
 * exactly the proposal's bytes; Tab inserts them for editing; Esc dismisses. Dangerous proposals
 * need Enter twice.
 */
import { useEffect, useRef, useState } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
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
  const lastKeyAt = useRef(0);
  const [lineEmpty, setLineEmpty] = useState(true);
  const [pending, setPending] = useState<Proposal | undefined>(undefined);
  // true while the bridge honestly reports a command running (shell integration only): a program
  // owns stdin, so the ghost is hidden and Enter is an ordinary key (Fable F2).
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  armedRef.current = armed;
  insertedRef.current = insertedId;
  runningRef.current = running;

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
  useEffect(() => {
    const update = () => {
      const s = session.snapshot();
      setRunning(!!(s.hello?.integration && s.lastStatus?.running));
    };
    update();
    return session.subscribe(update);
  }, []);

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
      // xterm measures glyphs with a canvas font string; CSS variables do not resolve there
      // (measured 2026-08-28: letter-spaced tiny text). Resolve the family to concrete names.
      const monoVar = getComputedStyle(document.body).getPropertyValue('--font-mono').trim();
      const fontFamily = `${monoVar ? monoVar + ', ' : ''}ui-monospace, Menlo, monospace`;
      term = new XTermCtor({ cursorBlink: true, scrollback: 5000, fontFamily, fontSize: 13, lineHeight: 1.2, theme: THEME, allowProposedApi: true /* decorations API (ghost text) is proposed in xterm 6.0.0 */ });
      termRef.current = term;
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host);
      let renderer = 'dom';
      // `?renderer=dom` forces the DOM renderer (evidence screenshots, headless runs, WSL/SwiftShader).
      const forceDom = new URLSearchParams(window.location.search).get('renderer') === 'dom';
      try {
        if (forceDom) throw new Error('renderer=dom requested');
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
      note('xterm.opened', { ms: Math.round(performance.now() - t0), renderer, cols: term.cols, rows: term.rows, font: fontFamily.slice(0, 40) });

      const detector = new PromptDetector();
      cleanup.push(client.on('data', (d) => {
        term?.write(d);
        for (const ev of detector.feed(d)) if (ev.kind === 'prompt') lineBuf.current.reset();
      }));
      cleanup.push(client.on('exit', () => lineBuf.current.reset()));
      const dataDisp = term.onData((d) => {
        client.sendInput(d);
        // data within 100 ms of a printable keydown is that keystroke; anything else (paste, IME,
        // middle-click — even one character) makes the line unknown
        lineBuf.current.feedData(d, performance.now() - lastKeyAt.current < 100);
      });
      const liveAdapter = session.getAdapter();
      if (liveAdapter) {
        // a command that finished without shell integration leaves the line unknown until the human clears/submits it
        cleanup.push(liveAdapter.subscribeResults((r) => {
          if (r.measured === false) lineBuf.current.markUnknown();
        }));
      }
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
        // When we consume a key we must also stop the browser default (Tab would move focus
        // out of the terminal; measured 2026-08-28 on a real PTY).
        const consume = () => {
          ev.preventDefault();
          ev.stopPropagation();
          return false;
        };
        if (p && adapter) {
          if (ev.key === 'Escape') {
            proposals.resolve(p.id, 'dismissed');
            setArmed(null);
            return consume();
          }
          if (!runningRef.current && lineBuf.current.empty && insertedRef.current !== p.id) {
            if (ev.key === 'Enter') {
              if (p.dangerous && armedRef.current !== p.id) {
                setArmed(p.id);
                return consume();
              }
              setArmed(null);
              if (adapter.acceptProposal(p.id)) return consume();
              note('ghost.enter_refused'); // not accepted (program running / not paired): fall through as an ordinary Enter
            }
            if (ev.key === 'Tab') {
              client.sendInput(p.command);
              lineBuf.current.feedText(p.command);
              setInsertedId(p.id);
              note('ghost.tab_inserted');
              return consume();
            }
          } else if (ev.key === 'Enter' && insertedRef.current === p.id) {
            // human edited the inserted text and pressed Enter: xterm sends "\r"; record edited
            adapter.acceptProposal(p.id, { edited: true, alreadySent: true });
            setInsertedId(null);
          }
        }
        if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) lastKeyAt.current = performance.now();
        lineBuf.current.feedKey(ev, { awaitPrompt: !!session.snapshot().hello?.integration });
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

  // Ghost overlay: our own element positioned at the cursor cell. xterm's decoration API only
  // updates on render frames (measured 2026-08-28: invisible on a static prompt under WebGL), so
  // the overlay is placed from the buffer's cursor and the screen's cell size instead.
  const ghostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const term = termRef.current;
    const host = hostRef.current;
    const ghost = ghostRef.current;
    if (!term || !host || !ghost) return;
    const show = !!pending && lineEmpty && !running && insertedId !== pending.id;
    if (!show) {
      ghost.style.display = 'none';
      ghost.removeAttribute('data-ghost');
      return;
    }
    const place = () => {
      const screen = host.querySelector<HTMLElement>('.xterm-screen');
      if (!screen) return;
      const hostRect = host.getBoundingClientRect();
      const rect = screen.getBoundingClientRect();
      const cellW = rect.width / term.cols;
      const cellH = rect.height / term.rows;
      const b = term.buffer.active;
      const row = b.cursorY + b.baseY - b.viewportY;
      ghost.style.display = row >= 0 && row < term.rows ? 'block' : 'none';
      ghost.style.left = `${rect.left - hostRect.left + b.cursorX * cellW}px`;
      ghost.style.top = `${rect.top - hostRect.top + row * cellH}px`;
      ghost.style.height = `${cellH}px`;
      ghost.style.lineHeight = `${cellH}px`;
      ghost.style.maxWidth = `${rect.width - b.cursorX * cellW}px`;
    };
    ghost.textContent = pending.command;
    ghost.className = `ghost ${pending.dangerous ? 'ghost-danger' : ''}`;
    ghost.setAttribute('data-ghost', pending.id);
    ghost.setAttribute('dir', 'ltr'); // never let a leading RTL letter reorder what will be typed
    place();
    const d1 = term.onWriteParsed(place);
    const d2 = term.onResize(place);
    const d3 = term.onScroll(place);
    const d4 = term.onCursorMove(place);
    return () => {
      d1.dispose();
      d2.dispose();
      d3.dispose();
      d4.dispose();
    };
  }, [pending, lineEmpty, insertedId, running]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} data-terminal className="relative min-h-[160px] flex-1 overflow-hidden rounded-md border border-line bg-bg p-2">
        <div ref={ghostRef} className="ghost" style={{ position: 'absolute', display: 'none', zIndex: 5, overflow: 'hidden', textOverflow: 'ellipsis' }} />
      </div>
      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-3 text-xs text-muted" data-ghost-bar>
        {pending ? (
          <span className={pending.dangerous ? 'text-danger' : ''} dir="auto">
            ← {pending.why ?? 'proposed by the agent'} ·{' '}
            {running ? (
              'a command is running · the proposal waits for the prompt · Esc dismiss'
            ) : lineEmpty && insertedId !== pending.id ? (
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
