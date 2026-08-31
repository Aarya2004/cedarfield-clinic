'use client';

/**
 * The drop bench — the clickable 60-second arc (T8).
 *
 * WHAT THIS PAGE IS: a rig. Two founders point it at a question tonight — is the drop worth
 * locking? — and it answers by running the same race twice, by hand and by agent, and putting both
 * measured costs on screen at the same time. It is not the product and it is not a pitch. The
 * components mounted on it (T1–T5, T7) are the specimens; the bench is the graphite rack, the
 * transport controls and the event trace.
 *
 * WHAT THIS PAGE IS NOT: WebMCP. There is no `navigator.modelContext` on this route, no tool is
 * registered, and nothing here is a tool call. The agent's turn is a labelled button that says so.
 *
 * THE SEAM: all board state comes from `useDropSession`, which folds `DropEvent`s and knows no
 * concrete driver. See the header of that file — that is where the real contract plugs in.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmSurface } from './ConfirmSurface.tsx';
import { CounterBadge } from './CounterBadge.tsx';
import { GestureConfirm } from './GestureConfirm.tsx';
import { DropCountdown } from './DropCountdown.tsx';
import { ManualBookingFlow, type ManualReceipt } from './ManualBookingFlow.tsx';
import { SlotBoard } from './SlotBoard.tsx';
import { TtlBar } from './TtlBar.tsx';
import { firstComeDriver, firstOpenSlot, useDropSession } from './useDropSession.ts';
import {
  createCounter,
  emptyBreakdown,
  type CounterSnapshot,
  type InteractionBreakdown,
  type InteractionCounter,
} from '../../lib/drop/interaction-counter.ts';
import { createMockDriver, RIVAL_LABEL, type ScenarioName } from '../../lib/drop/mock-driver.ts';
import type { DropEvent, Slot } from '../../lib/drop/types.ts';
import './drop-tokens.css';
import './drop-bench.css';

/**
 * The wave is held back a few seconds so the countdown is a beat you can watch rather than a frame
 * you miss. Every scenario preset ships `waveDelayMs: 0`; this is the playground's own staging.
 */
const WAVE_DELAY_MS = 4000;

/**
 * The presets ship six slots and, in `lose`, a rival budget of six — so by hand you end with an
 * empty board and no receipt at all. True, and useless as a measurement: the by-hand cost is the
 * number act II is compared against, so the run has to be able to finish. Eight slots against the
 * scenario's own unchanged rival budget keeps both halves honest: in `lose` the rival still takes
 * six, still takes the 9:00 out from under you mid-form, and leaves two stragglers you can actually
 * book. The rival is never given fewer takes, and never a different schedule.
 */
const WAVE_SLOT_COUNT = 8;

/** The trace window. Long enough for the slowest scenario (expire: 12s TTL + a 1.6s sweep). */
const TRACE_SPAN_MS = 30000;

/**
 * T6's camera dwell, off unless the build asked for it. Read once at module scope: Next inlines
 * `NEXT_PUBLIC_*` at build time, so with the flag unset the whole gesture module — including its
 * dynamic import of 200KB of MediaPipe JS — is unreachable from this page.
 */
const GESTURE_ENABLED = process.env.NEXT_PUBLIC_DROP_GESTURE === '1';

const NO_SLOTS: Slot[] = [];

type Mode = 'manual' | 'agent';

interface Act {
  id: string;
  numeral: string;
  title: string;
  blurb: string;
  mode: Mode;
  scenario: ScenarioName;
}

/**
 * The arc, as three acts. They are numbered because they genuinely are a sequence — act II only
 * means anything once you have watched act I lose — not because numbering looks tidy.
 */
const ACTS: readonly Act[] = [
  {
    id: 'hand',
    numeral: 'I',
    title: 'By hand',
    blurb:
      'Fill the clinic’s form while a seeded rival takes the board — including the slot you picked. The count is what it cost.',
    mode: 'manual',
    scenario: 'lose',
  },
  {
    id: 'agent',
    numeral: 'II',
    title: 'By agent',
    blurb: 'The agent holds a slot. The hold burns. You press one key and it is booked.',
    mode: 'agent',
    scenario: 'hold-and-book',
  },
  {
    id: 'miss',
    numeral: 'III',
    title: 'Miss the window',
    blurb: 'Hold it and press nothing. The hold lapses, and the rival sweeps what you let go.',
    mode: 'agent',
    scenario: 'expire',
  },
];

const SCENARIO_LABEL: Record<ScenarioName, string> = {
  lose: 'lose — the board empties in eight seconds',
  'hold-and-book': 'hold-and-book — the rival leaves you room',
  expire: 'expire — short hold, then a sweep',
};

interface LedgerEntry {
  count: number;
  breakdown: InteractionBreakdown;
  scenario: ScenarioName;
  seed: number;
  slotsLost: number | null;
}

interface Ledger {
  hand: LedgerEntry | null;
  agent: LedgerEntry | null;
}

/** Memoised so the 60 Hz clock in the session does not re-render a form somebody is typing into. */
const ManualPane = memo(ManualBookingFlow);

export function DropBench() {
  const [config, setConfig] = useState({ scenario: 'lose' as ScenarioName, seed: 1, nonce: 0 });
  const [mode, setMode] = useState<Mode>('manual');
  const [running, setRunning] = useState(false);
  const [ledger, setLedger] = useState<Ledger>({ hand: null, agent: null });

  // A new driver is a new race. `nonce` is what a reset bumps, so the same scenario and seed can be
  // re-run and land on byte-identical timings.
  const driver = useMemo(
    () =>
      createMockDriver({
        scenario: config.scenario,
        seed: config.seed,
        overrides: { waveDelayMs: WAVE_DELAY_MS, slotCount: WAVE_SLOT_COUNT },
      }),
    [config],
  );

  // ── THE SEAM ─────────────────────────────────────────────────────────────────────────────────
  // Everything below renders from this. Swap the first argument for an adapter over the real
  // contract and drop `clock` (a real backend moves on its own) and the page is unchanged.
  const session = useDropSession(driver, { running, clock: driver });

  // The manual lane books without holding first — see `firstComeDriver` for why that needs an
  // adapter today and what the real contract should do about it.
  const manualDriver = useMemo(() => firstComeDriver(driver), [driver]);

  const held = session.held;
  const heldSlot = held === null ? undefined : session.slots.find((slot) => slot.id === held.slotId);
  const openSlot = firstOpenSlot(session.slots);
  const bookedSlot = session.slots.find((slot) => slot.state === 'booked_yours');

  // ── the agent lane's instrument ───────────────────────────────────────────────────────────────
  // Scoped to the confirm surface alone. The simulate button is deliberately OUTSIDE it: a real
  // agent call costs the human nothing, so counting our stand-in for it would inflate the number.
  const measuredRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef<InteractionCounter | null>(null);
  const capturedNonce = useRef<number | null>(null);
  const [agentTally, setAgentTally] = useState<CounterSnapshot>({ total: 0, breakdown: emptyBreakdown() });

  useEffect(() => {
    const root = measuredRef.current;
    if (root === null) return;
    const counter = createCounter(root, { onChange: setAgentTally });
    counterRef.current = counter;
    return () => {
      counter.stop();
      counterRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    counterRef.current?.reset();
    setAgentTally({ total: 0, breakdown: emptyBreakdown() });
  }, [config]);

  const agentBooked = mode === 'agent' && bookedSlot !== undefined;
  useEffect(() => {
    if (!agentBooked) return;
    if (capturedNonce.current === config.nonce) return;
    capturedNonce.current = config.nonce;
    const snapshot = counterRef.current?.snapshot() ?? { total: 0, breakdown: emptyBreakdown() };
    setLedger((current) => ({
      ...current,
      agent: {
        count: snapshot.total,
        breakdown: snapshot.breakdown,
        scenario: config.scenario,
        seed: config.seed,
        slotsLost: null,
      },
    }));
  }, [agentBooked, config]);

  // ── controls ──────────────────────────────────────────────────────────────────────────────────

  const rerun = useCallback((patch: Partial<{ scenario: ScenarioName; seed: number }> = {}) => {
    capturedNonce.current = null;
    setConfig((current) => ({ ...current, ...patch, nonce: current.nonce + 1 }));
  }, []);

  const startAct = useCallback(
    (act: Act) => {
      setMode(act.mode);
      rerun({ scenario: act.scenario });
      setRunning(true);
    },
    [rerun],
  );

  const onManualFinish = useCallback(
    (receipt: ManualReceipt) => {
      setLedger((current) => ({
        ...current,
        hand: {
          count: receipt.count,
          breakdown: receipt.breakdown,
          scenario: config.scenario,
          seed: config.seed,
          slotsLost: receipt.slotsLost,
        },
      }));
    },
    [config.scenario, config.seed],
  );

  /** One booking callback, shared by the keycap and (when flagged on) T6's camera dwell. */
  const confirmHeld = useCallback(() => {
    if (held !== null) session.confirm(held.slotId);
  }, [held, session]);

  const simulateHold = useCallback(() => {
    if (openSlot === undefined) return;
    setRunning(true);
    session.hold(openSlot.id);
  }, [openSlot, session]);

  const currentAct = ACTS.find((act) => act.mode === mode && act.scenario === config.scenario);

  return (
    <main
      className="bench"
      data-drop-bench
      data-bench-mode={mode}
      data-bench-scenario={config.scenario}
      data-bench-seed={config.seed}
      data-bench-running={running ? 'true' : 'false'}
    >
      <header className="bench__masthead">
        <div>
          <h1 className="bench__title">Drop bench</h1>
          <p className="bench__subtitle">
            The same race, twice: once by hand, once by agent. Both costs are measured on this page
            while you use it, by the rules in COUNTING.md. Nothing here is scripted.
          </p>
        </div>
        <p className="bench__claim">
          <b>No WebMCP on this page.</b> No tool is registered and{' '}
          <code>navigator.modelContext</code> is never touched. The agent’s turn is a labelled
          button.
        </p>
      </header>

      <section className="bench__transport" aria-label="Run controls">
        <div className="transport__controls">
          <div className="transport__group">
            <button
              type="button"
              className="bench-button"
              data-bench-run
              aria-pressed={running}
              onClick={() => setRunning((value) => !value)}
            >
              {running ? 'Pause' : 'Run'}
            </button>
            <button type="button" className="bench-button" data-bench-reset onClick={() => rerun()}>
              Reset
            </button>
          </div>

          <div className="transport__group">
            <label className="bench-label" htmlFor="bench-scenario">
              Scenario
            </label>
            <select
              id="bench-scenario"
              className="bench-select"
              data-bench-scenario-select
              value={config.scenario}
              onChange={(event) => rerun({ scenario: event.target.value as ScenarioName })}
            >
              {(Object.keys(SCENARIO_LABEL) as ScenarioName[]).map((name) => (
                <option key={name} value={name}>
                  {SCENARIO_LABEL[name]}
                </option>
              ))}
            </select>
          </div>

          <div className="transport__group">
            <label className="bench-label" htmlFor="bench-seed">
              Seed
            </label>
            <input
              id="bench-seed"
              className="bench-number"
              data-bench-seed-input
              type="number"
              min={0}
              step={1}
              value={config.seed}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                rerun({ seed: Number.isNaN(next) ? 0 : next });
              }}
            />
          </div>

          <div className="transport__group">
            <span className="bench-label" id="bench-mode-label">
              Lane
            </span>
            <div role="group" aria-labelledby="bench-mode-label" className="transport__group">
              <button
                type="button"
                className="bench-button"
                data-bench-mode="manual"
                aria-pressed={mode === 'manual'}
                onClick={() => setMode('manual')}
              >
                By hand
              </button>
              <button
                type="button"
                className="bench-button"
                data-bench-mode="agent"
                aria-pressed={mode === 'agent'}
                onClick={() => setMode('agent')}
              >
                By agent
              </button>
            </div>
          </div>

          <p className="transport__clock">
            <span className="transport__lamp" data-running={running ? 'true' : 'false'}>
              {running ? 'running' : 'held'}
            </span>
            <span className="transport__t" data-bench-clock>
              t+{(session.now / 1000).toFixed(2)}s
            </span>
          </p>
        </div>

        <TraceStrip log={session.log} now={session.now} />
      </section>

      <div className="bench__body">
        <aside className="rail" aria-label="Acts and measured costs">
          <div className="rail__group">
            <h2 className="bench-label">The arc</h2>
            {ACTS.map((act) => (
              <button
                key={act.id}
                type="button"
                className="act"
                data-bench-act={act.id}
                aria-current={currentAct?.id === act.id}
                onClick={() => startAct(act)}
              >
                <span className="act__n">Act {act.numeral}</span>
                <span className="act__title">{act.title}</span>
                <span className="act__blurb">{act.blurb}</span>
              </button>
            ))}
          </div>

          <div className="rail__group">
            <h2 className="bench-label">What it cost</h2>
            <div className="ledger" data-bench-ledger>
              <LedgerRow lane="hand" label="By hand" entry={ledger.hand} />
              <LedgerRow lane="agent" label="By agent" entry={ledger.agent} />
              <p className="ledger__note">
                Each number is frozen at the moment that booking was confirmed, and stamped with the
                scenario and seed it was measured under. A lane that has not been run says so.
              </p>
            </div>
          </div>

          <div className="rail__group">
            <h2 className="bench-label">Reading the bench</h2>
            <ul className="rail__notes">
              <li>The rival is seeded, not reactive: it takes slots on its own schedule whether or not you are mid-form.</li>
              <li>Same seed, same scenario, same race — the trace above is the driver’s own event log.</li>
              <li>Only events the browser marks trusted are counted. Synthetic presses are blocked and shown.</li>
            </ul>
          </div>
        </aside>

        <div className="stage">
          <div className="countdown-mount">
            <DropCountdown dropAt={WAVE_DELAY_MS} now={session.now} label="Wave lands in" />
          </div>

          {mode === 'manual' ? (
            <div className="stage-pane" data-bench-pane="manual">
              <ManualPane driver={manualDriver} slots={NO_SLOTS} onFinish={onManualFinish} />
            </div>
          ) : (
            <div className="stage-pane" data-bench-pane="agent">
              <div className="sim">
                <div className="sim__row">
                  <button
                    type="button"
                    className="sim__button"
                    data-drop-sim-hold
                    disabled={openSlot === undefined || held !== null}
                    onClick={simulateHold}
                  >
                    Simulate the agent’s hold_slot call
                  </button>
                  <span className="tally-on-bench">
                    <CounterBadge count={agentTally.total} mode="agent" />
                  </span>
                </div>
                <p className="sim__caption">
                  <b>This button stands in for the agent.</b> It is not a tool call — it calls the
                  mock driver directly, and it sits outside the measured region below, because a real
                  agent’s call costs you nothing. The only thing measured in this lane is the key you
                  press yourself.
                </p>
              </div>

              <section className="stage--sheet" aria-label="The wave">
                <SlotBoard
                  slots={session.slots}
                  rivalLabel={RIVAL_LABEL}
                  waveLabel="Wave"
                  ttlSlot={
                    held === null ? undefined : (
                      <TtlBar totalSeconds={held.ttlSeconds} secondsLeft={session.secondsLeft} label="Hold" />
                    )
                  }
                />
              </section>

              <div className="instrument">
                <div className="measured__label">
                  <span className="bench-label">
                    {agentBooked ? 'Measured region — booked, on one key press' : 'Measured region — your one act'}
                  </span>
                  <span className="bench-label" data-bench-agent-count>
                    {agentTally.total} counted
                  </span>
                </div>
                <div ref={measuredRef} className="measured" data-drop-measured="agent-confirm">
                  <ConfirmSurface
                    secondsLeft={session.secondsLeft}
                    slotLabel={
                      heldSlot === undefined
                        ? 'nothing held'
                        : `${heldSlot.timeLabel} with ${heldSlot.clinician}`
                    }
                    disabled={held === null}
                    onConfirm={confirmHeld}
                    gestureSlot={
                      GESTURE_ENABLED ? (
                        <GestureConfirm onConfirm={confirmHeld} armed={held !== null && session.secondsLeft > 0} />
                      ) : undefined
                    }
                  />
                </div>
              </div>

              {/* This run's receipt, not the ledger's memory of an earlier one — the standing
                  comparison lives in the rail, where it is stamped with its own scenario. */}
              {agentBooked && ledger.agent !== null ? (
                <div className="receipt" data-bench-agent-receipt>
                  <CounterBadge
                    count={ledger.agent.count}
                    mode="agent"
                    variant="receipt"
                    breakdown={ledger.agent.breakdown}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <footer className="bench__foot">
        <p>
          Driver: <code>
            createMockDriver({'{'} scenario: &lsquo;{config.scenario}&rsquo;, seed: {config.seed},
            overrides: {'{'} slotCount: {WAVE_SLOT_COUNT}, waveDelayMs: {WAVE_DELAY_MS} {'}'} {'}'})
          </code>. The two overrides are the bench’s staging — a countdown you can watch and a wave
          the by-hand run can finish; the rival’s budget and schedule are the scenario’s own. The
          board is folded from the driver’s events by <code>useDropSession</code> — one seam, one
          place the real contract lands.
        </p>
      </footer>
    </main>
  );
}

function LedgerRow({ lane, label, entry }: { lane: 'hand' | 'agent'; label: string; entry: LedgerEntry | null }) {
  return (
    <div className="ledger__row" data-lane={lane} data-bench-ledger-row={lane} data-bench-ledger-count={entry?.count ?? ''}>
      <span className="ledger__what">
        {label}
        <span className="ledger__where">
          {entry === null ? 'not run yet' : `${entry.scenario} · seed ${entry.seed}`}
        </span>
      </span>
      <span className="ledger__n" data-measured={entry === null ? 'false' : 'true'}>
        {entry === null ? '—' : entry.count}
      </span>
    </div>
  );
}

/**
 * The trace: every event the driver has emitted, drawn against its own seeded clock, with a
 * playhead. It is the page's one flourish and it is not decoration — it is `session.log` rendered
 * literally, so two runs on the same seed produce the same picture, and a judge can see the shape
 * of the race (aggressive early, tapering) without reading a number.
 */
function TraceStrip({ log, now }: { log: readonly DropEvent[]; now: number }) {
  const pct = (ms: number) => `${Math.min(100, Math.max(0, (ms / TRACE_SPAN_MS) * 100))}%`;

  return (
    <div className="trace" data-drop-trace data-trace-events={log.length}>
      <div className="trace__track">
        <div className="trace__grid" aria-hidden style={{ ['--trace-second' as string]: `${(1000 / TRACE_SPAN_MS) * 100}%` }} />
        {log.map((event, index) => (
          <span
            key={`${event.type}-${event.at}-${index}`}
            className="trace__mark"
            data-kind={event.type}
            style={{ left: pct(event.at) }}
            title={`${event.type} at ${(event.at / 1000).toFixed(2)}s`}
          />
        ))}
        <span className="trace__head" style={{ left: pct(now) }} aria-hidden />
      </div>

      <div className="trace__scale" aria-hidden>
        {[0, 5, 10, 15, 20, 25, 30].map((second) => (
          <span key={second} style={{ left: pct(second * 1000) }}>
            {second}s
          </span>
        ))}
      </div>

      <p className="trace__legend bench-label">
        <span style={{ color: 'var(--bench-ink)' }}>
          <i /> wave
        </span>
        <span style={{ color: 'var(--bench-clay)' }}>
          <i /> rival takes
        </span>
        <span style={{ color: 'var(--bench-yours)' }}>
          <i /> hold + ticks
        </span>
        <span style={{ color: '#f16a5f' }}>
          <i /> expired
        </span>
        <span style={{ color: 'var(--bench-live)' }}>
          <i /> booked
        </span>
      </p>

      <p className="bench-sr" role="status" aria-live="off">
        {log.length} driver events so far.
      </p>
    </div>
  );
}

export default DropBench;
