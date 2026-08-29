/**
 * Theme state. Dark is the default and is also the CSS default (globals.css `:root`), so the
 * server-rendered `<html data-theme="dark">` and the first paint agree and nothing flashes —
 * there is no inline theme script, because the nonce CSP forbids one.
 * `localStorage['rokan-theme']` is the human's choice and always wins. The system preference is
 * deliberately NOT consulted: first paint must be dark for every visitor (the judge/demo frame is
 * the product decision), and honouring a light system pref here would repaint after hydration —
 * the exact flash the dark CSS default exists to prevent.
 */
export type Theme = 'light' | 'dark';

const KEY = 'rokan-theme';
const listeners = new Set<() => void>();

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null; // storage blocked (private mode / partitioned): fall back to dark
  }
}

function apply(t: Theme): Theme {
  document.documentElement.dataset.theme = t;
  for (const fn of listeners) fn();
  return t;
}

/** The theme in force right now, read from the element that carries it. */
export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** A human choice: applied and persisted. */
export function setTheme(t: Theme): void {
  apply(t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage blocked: the choice holds for this page, which is better than refusing it */
  }
}

/** Called once on mount. Stored choice, else dark — never the system preference (see file top). */
export function initTheme(): Theme {
  return apply(stored() ?? 'dark');
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
