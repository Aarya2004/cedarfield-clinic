/**
 * Local approximation of "has the human typed anything on the current shell line?".
 * Counts printable keys since the last prompt marker; Backspace decrements; Enter, Ctrl-C,
 * Ctrl-U, Ctrl-D and a new prompt reset. The shell's real line is never parsed — this only
 * decides whether ghost text is shown and whether Enter may send a proposal.
 */
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  type?: string;
}

export class LineBuffer {
  private n = 0;
  private listeners = new Set<() => void>();

  get length(): number {
    return this.n;
  }
  get empty(): boolean {
    return this.n === 0;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset(): void {
    if (this.n !== 0) {
      this.n = 0;
      this.emit();
    }
  }

  /** Feed a keydown. Returns true when the key changed the estimate. */
  feedKey(ev: KeyLike): boolean {
    if (ev.type && ev.type !== 'keydown') return false;
    if (ev.ctrlKey) {
      if (ev.key === 'c' || ev.key === 'u' || ev.key === 'd') {
        this.reset();
        return true;
      }
      return false;
    }
    if (ev.metaKey || ev.altKey) return false;
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

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}
