'use client';

/**
 * "Say it to the page" — the person's channel to whichever agent is listening (2026-09-02).
 *
 * The browser's own speech recognizer (no key, no server of ours), five canned hand signs from the
 * same gesture module that books, and a typed line — all land in one queue, and the agent takes
 * them through `clinic_wait_for_request`. The person never touches the agent's window. The panel
 * shows what was heard, in words, and whether an agent has taken it yet.
 *
 * Honest limits, said on the panel: speech recognition needs a browser that has it (Chromium does;
 * it sends audio to the browser vendor while listening); the signs are five shapes, not a language.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureConfirm } from '../drop/GestureConfirm.tsx';
import type { PersonRequest, RequestQueue } from '../../lib/drop/request-queue.ts';
import { routeSign } from '../../lib/drop/sign-sink.ts';
import { DEFAULT_SIGN_MAP, SIGNS_CHANGED, SIGN_PHRASE_MAX, SIGN_SHAPES, loadSignMap, phraseFor, saveSignMap, type SignMap, type SignShape } from '../../lib/drop/sign-map.ts';

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function recognizerFactory(): (new () => RecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface ListenPanelProps {
  queue: RequestQueue;
  /** The build has the camera module (the signs need it). */
  gesture: boolean;
  /** True while the page listens or a request is waiting — the page births the wait tool on it. */
  onActive?: (active: boolean) => void;
  /** What is actually capturing right now: the recognizer, the sign camera, or nothing (the voice agent's exclusion). */
  onMicChange?: (capturing: 'off' | 'microphone' | 'camera') => void;
  /**
   * The page's own voice agent is live: this recognizer must be off, or the agent's speech would be
   * transcribed back into the queue as the person's words (2026-09-02 review, P1-3).
   */
  disabled?: boolean;
}

export function ListenPanel({ queue, gesture, onActive, onMicChange, disabled = false }: ListenPanelProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [history, setHistory] = useState<readonly PersonRequest[]>([]);
  const [pending, setPending] = useState(0);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [signsOn, setSignsOn] = useState(false);
  // What each shape means to THIS person: defaults, or whole requests they assigned. Per browser.
  const [signMap, setSignMap] = useState<SignMap>({ ...DEFAULT_SIGN_MAP });
  const [editingSigns, setEditingSigns] = useState(false);
  const signMapRef = useRef(signMap);
  signMapRef.current = signMap;
  const [boardBy, setBoardBy] = useState<'you' | 'assistant'>('you');
  useEffect(() => {
    setSignMap(loadSignMap(window.localStorage));
    // The assistant labelled a switch (clinic_set_sign): re-read, and say who did it.
    const onChanged = (e: Event) => {
      setSignMap(loadSignMap(window.localStorage));
      if ((e as CustomEvent<{ by?: string }>).detail?.by === 'assistant') setBoardBy('assistant');
    };
    window.addEventListener(SIGNS_CHANGED, onChanged);
    return () => window.removeEventListener(SIGNS_CHANGED, onChanged);
  }, []);
  const setPhrase = (category: SignShape['category'], phrase: string) => {
    const next = { ...signMapRef.current, [category]: phrase.slice(0, SIGN_PHRASE_MAX) };
    setSignMap(next);
    setBoardBy('you');
    saveSignMap(window.localStorage, next);
  };
  const resetSigns = () => {
    setSignMap({ ...DEFAULT_SIGN_MAP });
    setBoardBy('you');
    saveSignMap(window.localStorage, { ...DEFAULT_SIGN_MAP });
  };
  const recRef = useRef<RecognitionLike | null>(null);
  const wantRef = useRef(false);
  const activeRef = useRef(false);
  const micRef = useRef<'off' | 'microphone' | 'camera'>('off');
  useEffect(() => {
    const active = listening || signsOn || pending > 0;
    if (active !== activeRef.current) {
      activeRef.current = active;
      onActive?.(active);
    }
    const capturing = listening ? 'microphone' : signsOn ? 'camera' : 'off';
    if (capturing !== micRef.current) {
      micRef.current = capturing;
      onMicChange?.(capturing);
    }
  }, [listening, signsOn, pending, onActive, onMicChange]);

  useEffect(() => setSupported(recognizerFactory() !== null), []);
  useEffect(() => {
    const sync = () => {
      setHistory([...queue.history()]);
      setPending(queue.pending());
    };
    sync();
    const off = queue.subscribe(sync);
    const tick = setInterval(sync, 1000); // `pending` drops when an agent takes one — no event for that
    return () => {
      off();
      clearInterval(tick);
    };
  }, [queue]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setInterim('');
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  const start = useCallback(() => {
    const Rec = recognizerFactory();
    if (!Rec) return;
    setError('');
    const rec = new Rec();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) {
          queue.push(r[0].transcript, 'voice');
          live = '';
        } else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('The microphone was not allowed. Type below, or sign with the camera.');
        wantRef.current = false;
      } else if (e.error === 'network') {
        // Chromium without a speech service (an app's embedded browser, say) reports this at once.
        // Say what it is; do not sit in "Listening" (Codex, in-app browser, 2026-09-02).
        setError('Speech recognition is unavailable in this browser — its speech service did not answer. Type below, or sign with the camera.');
        wantRef.current = false;
        setSupported(false);
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`Listening stopped (${e.error ?? 'error'}). Press Listen again, or type below.`);
        wantRef.current = false;
      }
    };
    rec.onend = () => {
      // Chromium ends continuous sessions on silence; keep listening until the person says stop.
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through to the stopped state */
        }
      }
      recRef.current = null;
      setListening(false);
      setInterim('');
    };
    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('Listening could not start. Type below instead.');
      wantRef.current = false;
    }
  }, [queue]);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (queue.push(typed, 'typed')) setTyped('');
  };

  const onSign = useCallback(
    (category: string) => {
      // A scanning keyboard, when open, owns the shapes as its two switches.
      if (routeSign(category)) return;
      const phrase = phraseFor(category, signMapRef.current);
      if (phrase) queue.push(phrase, 'sign');
    },
    [queue],
  );

  const last = history[0] ?? null;
  return (
    <section className="cl-listen" aria-labelledby="cl-listen-head" data-clinic-listen={listening ? 'listening' : 'idle'} data-clinic-listen-pending={pending}>
      <div className="cl-listen__row">
        <div>
          <h2 id="cl-listen-head" className="cl-listen__head">
            Say it to the page
          </h2>
          <p className="cl-prose cl-listen__intro">
            Say, sign or type here; your assistant takes it the moment it asks. Tell it once:{' '}
            <b>“keep helping me with what I say to the page until I say stop.”</b>
          </p>
        </div>
        {supported === false ? null : listening ? (
          <button type="button" className="cl-quiet" data-clinic-listen-stop onClick={stop}>
            Stop listening
          </button>
        ) : (
          <button type="button" className="cl-cta cl-cta--sm" data-clinic-listen-start onClick={start} disabled={supported === null || disabled}>
            Listen for me
          </button>
        )}
      </div>

      <p className="cl-listen__status" role="status" data-clinic-listen-status>
        {disabled
          ? 'Paused while you are talking to Cedarfield — its voice must not be heard as yours. End that call to listen here again.'
          : supported === false
          ? 'This browser has no speech recognition. Type below, or use the camera signs.'
          : error !== ''
            ? error
            : listening
              ? interim !== ''
                ? `Hearing: “${interim}”`
                : 'Listening. Speak normally; each sentence is handed over when you pause.'
              : 'Press Listen for me. Speech goes to your browser’s own recognizer while it listens.'}
      </p>

      <form className="cl-listen__typed" onSubmit={submitTyped}>
        <label htmlFor="cl-listen-typed" className="cl-sr">
          Or type what you want your assistant to do
        </label>
        <input
          id="cl-listen-typed"
          data-clinic-listen-typed
          value={typed}
          placeholder="Or type it: hold me the earliest appointment"
          onChange={(e) => setTyped(e.target.value)}
        />
        <button type="submit" className="cl-quiet" data-clinic-listen-send>
          Hand it over
        </button>
      </form>

      {gesture ? (
        <div className="cl-listen__signs">
          <p className="cl-listen__signs-head">
            Or use the camera as a switch board — five hand shapes it reads, each meaning what <b>you</b> decide (not a
            language: five switches you label, or ask your assistant to label for you; kept in this browser). Hold a
            shape steady for about a second.
          </p>
          <ol className="cl-signs" aria-label="What each hand shape means" data-clinic-signs={editingSigns ? 'editing' : 'legend'} data-clinic-signs-by={boardBy}>
            {SIGN_SHAPES.map((s) => (
              <li key={s.category} className="cl-signs__row" data-clinic-sign={s.category}>
                <span className="cl-signs__glyph" aria-hidden="true">
                  {s.glyph}
                </span>
                <span className="cl-signs__label">{s.label}</span>
                {editingSigns ? (
                  <input
                    className="cl-signs__input"
                    aria-label={`What ${s.label} means`}
                    data-clinic-sign-phrase={s.category}
                    value={signMap[s.category]}
                    maxLength={SIGN_PHRASE_MAX}
                    placeholder="leave empty to switch this shape off"
                    onChange={(e) => setPhrase(s.category, e.target.value)}
                  />
                ) : (
                  <span className="cl-signs__phrase" data-clinic-sign-phrase={s.category}>
                    {signMap[s.category] === '' ? <i>off</i> : `“${signMap[s.category]}”`}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {boardBy === 'assistant' ? (
            <p className="cl-signs__by" role="status" data-clinic-signs-by-note>
              Labelled by your assistant, at your request. Change or reset it below whenever you like.
            </p>
          ) : null}
          <p className="cl-signs__actions">
            <button type="button" className="cl-link" data-clinic-signs-edit onClick={() => setEditingSigns((e) => !e)}>
              {editingSigns ? 'Done' : 'Change what the shapes mean'}
            </button>
            {editingSigns ? (
              <button type="button" className="cl-link" data-clinic-signs-reset onClick={resetSigns}>
                Reset to yes / no / stop / the first one / another one
              </button>
            ) : null}
          </p>
          <GestureConfirm verb="sign" onConfirm={() => {}} armed={false} onSign={onSign} onRunningChange={setSignsOn} autoStart={false} />
        </div>
      ) : null}

      <ol className="cl-listen__log" aria-label="What the page heard" data-clinic-listen-log={history.length}>
        {history.slice(0, 4).map((r) => (
          <li key={`${r.at}-${r.text}`} data-clinic-heard={r.via}>
            <span className="cl-listen__via">{r.via === 'voice' ? 'Heard' : r.via === 'sign' ? 'Signed' : 'Typed'}</span> “{r.text}”
          </li>
        ))}
        {last === null ? <li className="cl-listen__empty">Nothing yet.</li> : null}
      </ol>
      {pending > 0 ? (
        <p className="cl-listen__pending" role="status">
          {pending === 1 ? 'One request' : `${pending} requests`} waiting for your assistant to ask.
        </p>
      ) : null}
    </section>
  );
}
