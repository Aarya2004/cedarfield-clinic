'use client';

/**
 * ClinicTools — the five WebMCP tools of the booking page, mounted (SPEC-V1 §3).
 *
 * PROVISIONAL SCHEMA — Arav red-lines before lock. The tools themselves live in
 * `lib/drop/clinic-tools.ts`; this file is only the mount point and a two-line status indicator.
 *
 * ── HOW TO USE IT (the whole API) ───────────────────────────────────────────────────────────────
 *
 *     const session = useDropSession(driver, { running: true, clock });
 *     …
 *     <ClinicTools driver={driver} session={session} />
 *
 * Mount it once, anywhere inside /clinic/book — it renders one small line of text and nothing else,
 * so it is safe in a footer, a status rail, or beside the counter. On mount it registers the five
 * tools with `document.modelContext`; on unmount it aborts the one AbortController, which
 * unregisters all five. It owns no state and changes no board state: every tool reads and writes
 * through the `driver` and `session` you pass, which are the same objects the UI renders from.
 *
 * Optional `nextWaveAt`: the clock ms of the next drop wave, in `session.now`'s units, if the page
 * ever knows one. Leave it out and `clinic_list_drops` reports `next_wave_seconds: null` — we do
 * not invent numbers.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ──────────────────────────────────────────────────────────────
 * There is no booking tool among the five, and this component never calls `driver.confirm()`.
 * Booking stays where it belongs: the human's own key press, on the page, gated on a trusted event.
 *
 * The indicator is intentionally quiet — one muted mono line, `data-clinic-tools` on it for the
 * headless drive, `title` carrying the tool names for a curious human. It says what is true: the
 * count when registration succeeded, and plain language when this browser has no model context.
 */

import { useEffect, useRef, useState } from 'react';
import type { DropDriver } from '../../lib/drop/types.ts';
import {
  CLINIC_TOOL_NAMES,
  registerClinicTools,
  type ClinicRegistrationState,
  type ClinicToolsView,
} from '../../lib/drop/clinic-tools.ts';
import type { DropSession } from './useDropSession.ts';

export interface ClinicToolsProps {
  /** The seam. `hold` / `release` are what the tools call; `confirm` is the human path. */
  driver: DropDriver;
  /** The live fold from `useDropSession` — the tools read the board through this. */
  session: DropSession;
  /** Clock ms of the next wave, if known. Omitted ⇒ the tools report `next_wave_seconds: null`. */
  nextWaveAt?: number | null;
}

// Same fallbacks as the rest of the drop skin (components/drop/drop-tokens.css), so this line is
// legible with or without that stylesheet and identical to the board when both are present.
const MUTED = 'var(--drop-muted, #555c62)';
const MONO = 'var(--drop-font-mono, var(--font-mono), ui-monospace, monospace)';

function label(state: ClinicRegistrationState): string {
  switch (state.kind) {
    case 'registered':
      return `Site tools · ${state.names.length}`;
    case 'unsupported':
      // Honest: nothing is listening, so we do not print a count as if something were.
      return 'Site tools · not offered by this browser';
    case 'error':
      return 'Site tools · registration failed';
  }
}

export function ClinicTools({ driver, session, nextWaveAt = null }: ClinicToolsProps) {
  const [state, setState] = useState<ClinicRegistrationState>({ kind: 'unsupported' });

  // The tools must read the LIVE board, and `session` is a new object every frame — so they read a
  // ref that each render refreshes, never the values captured when they were registered.
  const view = useRef<ClinicToolsView>({ driver, session, nextWaveAt });
  useEffect(() => {
    view.current = { driver, session, nextWaveAt };
  });

  useEffect(() => {
    // Registration is async; if the effect is torn down before it resolves (StrictMode's
    // double-invoke, or a fast navigation), dispose on arrival rather than leak five tools.
    let disposed = false;
    let dispose: (() => void) | null = null;
    void registerClinicTools(
      () => view.current,
      (s) => {
        if (!disposed) setState(s);
      },
    ).then((d) => {
      if (disposed) d();
      else dispose = d;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);

  return (
    <p
      data-clinic-tools={state.kind}
      data-clinic-tool-count={state.kind === 'registered' ? state.names.length : 0}
      title={
        `WebMCP tools published by this page: ${CLINIC_TOOL_NAMES.join(', ')}. ` +
        'None of them can book — only you can.' +
        (state.kind === 'error' ? ` Registration failed: ${state.message}` : '')
      }
      style={{
        margin: 0,
        font: `400 0.75rem/1.4 ${MONO}`,
        letterSpacing: '0.02em',
        color: MUTED,
      }}
    >
      {label(state)}
    </p>
  );
}

export default ClinicTools;
