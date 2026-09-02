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
import { SIGN_WORDS, type PersonRequest, type RequestQueue } from '../../lib/drop/request-queue.ts';

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
  /**
   * The page's own voice agent is live: this recognizer must be off, or the agent's speech would be
   * transcribed back into the queue as the person's words (2026-09-02 review, P1-3).
   */
  disabled?: boolean;
}

export function ListenPanel({ queue, gesture, onActive, disabled = false }: ListenPanelProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [history, setHistory] = useState<readonly PersonRequest[]>([]);
  const [pending, setPending] = useState(0);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [signsOn, setSignsOn] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const wantRef = useRef(false);
  const activeRef = useRef(false);
  useEffect(() => {
    const active = listening || signsOn || pending > 0;
    if (active !== activeRef.current) {
      activeRef.current = active;
      onActive?.(active);
    }
  }, [listening, signsOn, pending, onActive]);

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
        setError('The microphone was not allowed. Type below instead.');
        wantRef.current = false;
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`Listening stopped (${e.error ?? 'error'}). Press Listen again.`);
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
      const word = SIGN_WORDS[category];
      if (word) queue.push(word, 'sign');
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
            Whatever you say, sign or type here is handed to your assistant the moment it asks — you never have to
            type into its window. Tell it once: <b>“keep helping me with what I say to the page until I say stop.”</b>
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
            Or sign it — five shapes the camera reads as words (not a language): thumbs up <b>yes</b>, thumbs down{' '}
            <b>no</b>, fist <b>stop</b>, one finger up <b>the first one</b>, two fingers <b>another one</b>.
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
