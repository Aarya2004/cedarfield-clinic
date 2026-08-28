/**
 * Local approximation of "has the human typed anything on the current shell line?".
 * Counts printable keys since the last prompt marker; Backspace decrements; Enter, Ctrl-C,
 * Ctrl-U, Ctrl-D and a new prompt reset. Anything that can fill the line without a countable key
 * — history recall (↑ ↓ PgUp PgDn, Ctrl-R/P/N/Y, Alt-.) or a pasted / IME payload — marks the line
 * *dirty* (not empty) until the next reset (Fable F5). The shell's real line is never parsed —
 * this only decides whether ghost text is shown and whether Enter may send a proposal; when in
 * doubt it says "not empty".
 */
const ESC = String.fromCharCode(27);
const HISTORY_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']);
const HISTORY_CTRL = new Set(['r', 'p', 'n', 'y']);
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  type?: string;
}

export class LineBuffer {
  private n = 0;
  private dirty = false;
  private listeners = new Set<() => void>();

  get length(): number {
    return this.n;
  }
  get empty(): boolean {
    return this.n === 0 && !this.dirty;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset(): void {
    if (this.n !== 0 || this.dirty) {
      this.n = 0;
      this.dirty = false;
      this.emit();
    }
  }

  private soil(): boolean {
    if (!this.dirty) {
      this.dirty = true;
      this.emit();
    }
    return true;
  }

  /** Feed a keydown. Returns true when the key changed the estimate. */
  feedKey(ev: KeyLike): boolean {
    if (ev.type && ev.type !== 'keydown') return false;
    if (ev.ctrlKey) {
      if (ev.key === 'c' || ev.key === 'u' || ev.key === 'd') {
        this.reset();
        return true;
      }
      if (HISTORY_CTRL.has(ev.key)) return this.soil(); // reverse-search / history / yank
      return false;
    }
    if (ev.altKey && ev.key === '.') return this.soil(); // insert last argument
    if (ev.metaKey || ev.altKey) return false;
    if (HISTORY_KEYS.has(ev.key)) return this.soil();
    if (ev.key === 'Enter') {
      this.reset();
      return true;
    }
    if (ev.key === 'Backspace') {
      if (this.n > 0) {
        this.n--;
        this.emit();
      }
      return true;
    }
    if (ev.key.length === 1) {
      this.n++;
      this.emit();
      return true;
    }
    return false; // arrows, Tab, Escape, Shift…
  }

  /** Text pasted or inserted (Tab-insert of ghost text) counts as typed. */
  feedText(text: string): void {
    if (!text.length) return;
    this.n += text.replace(/[\r\n]/g, '').length;
    this.emit();
  }

  /**
   * Raw `term.onData` payload. A multi-byte payload that is not a key escape sequence is a paste,
   * an IME commit or a middle-click — the line is dirty. Bracketed paste (ESC[200~…) counts too.
   * Returns true when the estimate changed.
   */
  feedData(data: string): boolean {
    if (data.length <= 1) return false;
    if (data.startsWith(ESC) && !data.startsWith(ESC + '[200~')) return false; // arrow/function key sequence
    return this.soil();
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}
