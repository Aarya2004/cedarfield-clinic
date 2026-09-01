'use client';

/**
 * ClinicTools — the nine WebMCP tools of the booking page, mounted (SPEC-V1 §3, SPEC-V2 §2).
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
 * so it is safe in a footer, a status rail, or beside the counter. On mount it registers the nine
 * tools with `document.modelContext`; on unmount it aborts the one AbortController, which
 * unregisters all nine. It owns no state and changes no board state: every tool reads and writes
 * through the `driver` and `session` you pass, which are the same objects the UI renders from.
 *
 * Optional `nextWaveAt`: the clock ms of the next drop wave, in `session.now`'s units, if the page
 * ever knows one. Leave it out and `clinic_list_drops` reports `next_wave_seconds: null` — we do
 * not invent numbers.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ──────────────────────────────────────────────────────────────
 * There is no booking, cancelling or moving tool among the nine; this component never calls
 * `driver.confirm()`, `driver.cancel()` or `driver.move()` — the prepare_* tools only ARM the dock.
 * Booking stays where it belongs: the human's own key press, on the page, gated on a trusted event.
 *
 * ── WHY IT RENDERS NOTHING (SPEC-V3 §1) ─────────────────────────────────────────────────────────
 * It used to print "Site tools · N" in the masthead. A clinic booking page does not narrate its own
 * integrations to a patient, so the line is gone. The element stays — hidden, empty — because the
 * registration state is still worth exposing to the harness and to anyone with dev tools open:
 * `data-clinic-tools` (registered | unsupported | error) and `data-clinic-tool-count`.
 */

import { useEffect, useRef, useState } from 'react';
import type { DropDriver } from '../../lib/drop/types.ts';
import {
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
  /**
   * SPEC-V2 arming seams. `clinic_prepare_cancel` / `clinic_prepare_move` call these to arm the
   * dock for a HUMAN act; return false to refuse (the tool then answers honestly). Omitted ⇒ the
   * two prepare tools answer `dock_not_wired`. Neither callback may cancel or move anything itself.
   */
  onPrepareCancel?: (slotId: string) => boolean;
  onPrepareMove?: (fromSlotId: string, toSlotId: string) => boolean;
  /** The act the dock is armed for right now — so clinic_hold_status never misdescribes the press. */
  armedAct?: 'cancel' | 'move' | null;
}

export function ClinicTools({ driver, session, nextWaveAt = null, onPrepareCancel, onPrepareMove, armedAct = null }: ClinicToolsProps) {
  const [state, setState] = useState<ClinicRegistrationState>({ kind: 'unsupported' });

  // The tools must read the LIVE board, and `session` is a new object every frame — so they read a
  // ref that each render refreshes, never the values captured when they were registered.
  const view = useRef<ClinicToolsView>({ driver, session, nextWaveAt, armedAct });
  const seams = useRef({ onPrepareCancel, onPrepareMove });
  useEffect(() => {
    view.current = { driver, session, nextWaveAt, armedAct };
    seams.current = { onPrepareCancel, onPrepareMove };
  });

  useEffect(() => {
    // Registration is async; if the effect is torn down before it resolves (StrictMode's
    // double-invoke, or a fast navigation), dispose on arrival rather than leak nine tools.
    let disposed = false;
    let dispose: (() => void) | null = null;
    void registerClinicTools(
      () => view.current,
      (s) => {
        if (!disposed) setState(s);
      },
      {
        // Live seams: registration happens once, the page's callbacks change every render.
        onPrepareCancel: (slotId) => seams.current.onPrepareCancel?.(slotId) ?? false,
        onPrepareMove: (fromId, toId) => seams.current.onPrepareMove?.(fromId, toId) ?? false,
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

  // `hidden` rather than a class: this mount point has no stylesheet of its own, and the attribute
  // takes it out of the accessibility tree as well as the layout while leaving the hooks queryable.
  return (
    <span
      hidden
      data-clinic-tools={state.kind}
      data-clinic-tool-count={state.kind === 'registered' ? state.names.length : 0}
    />
  );
}

export default ClinicTools;
