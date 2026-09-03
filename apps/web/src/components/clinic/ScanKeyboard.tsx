'use client';

/**
 * The scanning keyboard (2026-09-02): how a person with two switches types a name, a date or a
 * phone number into the patient card. The sweep highlights rows, then keys; "select" is a thumbs-up
 * to the camera, a hardware switch, Space or Enter; "back" is a fist, Escape or Backspace. Every
 * highlight is announced for a screen reader. Nothing here books anything; it only produces text
 * for the field the person chose, and they still press Save.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SCAN_ROWS, back, highlightLabel, initialScan, keyLabel, select, switchAction, tick, type ScanState } from '../../lib/drop/scan-keyboard.ts';

export interface ScanKeyboardProps {
  /** The field being typed into, by its label, and its current value. */
  fieldLabel: string;
  value: string;
  /** Every change; the host writes it into the field. */
  onChange: (text: string) => void;
  /** The "done" key: this field is finished (the host may move to the next). */
  onDone: () => void;
  /** Close keyboard / thumbs down: stop typing, keep the text, open nothing else. */
  onClose?: () => void;
  /** Sweep speed. Slower is easier; 900 ms is the common starting point in AAC products. */
  stepMs?: number;
  /** The camera's sign channel feeds shapes here while the keyboard is open. */
  registerSignSink?: (sink: ((category: string) => void) | null) => void;
  /** Which field this keyboard types into (an attribute for tests and styling). */
  fieldId?: string;
}

export function ScanKeyboard({ fieldLabel, value, onChange, onDone, onClose, stepMs = 700, registerSignSink, fieldId }: ScanKeyboardProps) {
  const [state, setState] = useState<ScanState>(() => initialScan(value));
  const stateRef = useRef(state);
  stateRef.current = state;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onCloseRef = useRef(onClose ?? onDone);
  onCloseRef.current = onClose ?? onDone;

  // The sweep. `sweepKey` restarts its clock after a manual advance, so a stepped highlight is not
  // immediately swept past.
  const [sweepKey, setSweepKey] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setState((s) => tick(s)), stepMs);
    return () => clearInterval(t);
  }, [stepMs, sweepKey]);

  const act = useCallback((action: 'select' | 'back' | 'advance') => {
    if (action === 'advance') {
      setState((s) => tick(s));
      setSweepKey((k) => k + 1);
      return;
    }
    const next = action === 'select' ? select(stateRef.current) : back(stateRef.current);
    setState(next);
    if (next.text !== stateRef.current.text) onChangeRef.current(next.text);
    if (next.done) onDoneRef.current();
  }, []);

  // Keys: a hardware switch shows up as Space or Enter; Escape / Backspace is "back".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = switchAction(e.key);
      if (action === null) return;
      // Escape always steps back, wherever focus sits (Codex re-audit 2026-09-03: Escape with focus
      // on the Select button was swallowed). Space / Enter / Backspace stay with a focused control —
      // a text field keeps its characters, a button keeps its click (or the key would select twice).
      const t = e.target;
      const onControl = t instanceof HTMLElement && t.closest('button, input, textarea, select, a[href]') !== null;
      if (e.key !== 'Escape' && onControl) return;
      e.preventDefault();
      act(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  // The camera's shapes, while this keyboard is open. Opening the keyboard asks the page for the
  // sign camera (it starts by itself if a camera was used this visit).
  useEffect(() => {
    if (!registerSignSink) return;
    const bus = (window as unknown as { __cedarfieldCameraBus?: EventTarget }).__cedarfieldCameraBus;
    bus?.dispatchEvent(new CustomEvent('want-signs'));
    registerSignSink((category) => {
      // Thumbs down closes the keyboard (the field keeps what was typed).
      if (category === 'Thumb_Down') {
        onCloseRef.current();
        return;
      }
      const action = switchAction(category);
      if (action) act(action);
    });
    return () => registerSignSink(null);
  }, [registerSignSink, act]);

  return (
    <div className="cl-scan" role="dialog" aria-modal="false" aria-label={`Scanning keyboard for ${fieldLabel}`} data-clinic-scan-field={fieldId} data-clinic-scan={state.key === null ? 'rows' : 'keys'} data-clinic-scan-row={state.row} data-clinic-scan-key={state.key ?? ''}>
      <p className="cl-scan__head">
        Typing <b>{fieldLabel}</b>: <b>thumbs up</b> (or Space) selects · <b>one finger</b> (or an arrow key) steps ahead without waiting · <b>a fist</b> (or Escape) goes back · <b>thumbs down</b> closes · <b>done</b> moves to the next field.
        For hand shapes, the camera under “Listen for me” must be on.
      </p>
      <p className="cl-scan__text" aria-label="Typed so far">
        {value === '' ? <i>nothing yet</i> : value}
      </p>
      <div className="cl-scan__rows">
        {SCAN_ROWS.map((row, r) => (
          <div key={r} className="cl-scan__row" data-clinic-scan-highlight={state.key === null && state.row === r ? 'true' : 'false'}>
            {row.map((k, i) => (
              <span
                key={k}
                className="cl-scan__key"
                data-clinic-scan-highlight={state.key !== null && state.row === r && state.key === i ? 'true' : 'false'}
              >
                {keyLabel(k)}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="cl-sr" role="status" aria-live="polite">
        {highlightLabel(state)}
      </p>
      <p className="cl-scan__actions">
        <button type="button" className="cl-quiet" data-clinic-scan-select onClick={() => act('select')}>
          Select
        </button>
        <button type="button" className="cl-quiet" data-clinic-scan-advance onClick={() => act('advance')}>
          Step
        </button>
        <button type="button" className="cl-quiet" data-clinic-scan-back onClick={() => act('back')}>
          Back
        </button>
        <button type="button" className="cl-link" data-clinic-scan-close onClick={() => onCloseRef.current()}>
          Close keyboard
        </button>
      </p>
    </div>
  );
}
