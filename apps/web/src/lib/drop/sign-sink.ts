/**
 * Where a camera shape goes (2026-09-02). Normally to the request queue as the person's phrase.
 * While a scanning keyboard is open, the shapes are its two switches instead, and nothing reaches
 * the queue — a person typing their name must not also be sending "yes" to their assistant.
 * One sink at a time, page-wide, no framework: the keyboard sets it on open and clears it on close.
 */
let sink: ((category: string) => void) | null = null;

export function setSignSink(fn: ((category: string) => void) | null): void {
  sink = fn;
}

/** True when a sink took the shape (the caller must not queue it). */
export function routeSign(category: string): boolean {
  if (sink === null) return false;
  sink(category);
  return true;
}

export function hasSignSink(): boolean {
  return sink !== null;
}
