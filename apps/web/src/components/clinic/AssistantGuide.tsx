'use client';

/**
 * The guide a first visitor with an assistant needs (2026-09-02, Arav: "for the judges to properly
 * use this stuff and feel the experience"). It says what to open, gives three sentences to say —
 * each with a copy button — and names the one press that is theirs. Dismissible; the choice is
 * remembered per browser. In clinic voice: the page never says "demo", "judge" or "WebMCP" here.
 */
import { useEffect, useState } from 'react';

const KEY = 'cedarfield.assistant-guide.dismissed';

const SAY = [
  { id: 'open', text: 'What appointments are open today?', why: 'It reads the board.' },
  { id: 'hold', text: 'Hold me the earliest appointment.', why: 'It holds one for three minutes. Then the confirm bar rises for you.' },
  { id: 'book', text: 'Yes, book it.', why: 'Only works after you press "Let my assistant book for me" below the list.' },
] as const;

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function AssistantGuide() {
  const [hidden, setHidden] = useState(true); // neutral first render; decided after mount
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setHidden(readDismissed()), []);

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      /* private mode: the guide simply returns next visit */
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  };

  if (hidden) return null;
  return (
    <section className="cl-guide" aria-labelledby="cl-guide-head" data-clinic-guide>
      <div className="cl-guide__row">
        <h2 id="cl-guide-head" className="cl-guide__head">
          Using an assistant? Three things to say.
        </h2>
        <button type="button" className="cl-link" data-clinic-guide-dismiss onClick={dismiss} aria-label="Hide this guide">
          Hide
        </button>
      </div>
      <p className="cl-prose cl-guide__intro">
        Open this page inside your assistant’s browser (the Codex app, or Chrome 152 with WebMCP on) and say one of these.
      </p>
      <ol className="cl-guide__list">
        {SAY.map((s) => (
          <li key={s.id} className="cl-guide__item">
            <button
              type="button"
              className="cl-guide__say"
              data-clinic-guide-say={s.id}
              aria-label={`Copy “${s.text}”`}
              onClick={() => void copy(s.id, s.text)}
            >
              <span className="cl-guide__quote">“{s.text}”</span>
              <span className="cl-guide__copy" aria-hidden="true">
                {copied === s.id ? 'Copied' : 'Copy'}
              </span>
            </button>
            <span className="cl-guide__why">{s.why}</span>
          </li>
        ))}
      </ol>
      <details className="cl-fold">
        <summary>How it works</summary>
        <p className="cl-prose cl-guide__judge" data-clinic-judge-door>
        Trying this out? <a className="cl-link" href="/clinic/book?test=1">Open the seeded board</a> — the same wave every
        time, a labelled sample patient, nothing shared with anyone; this page is the live board every visitor shares.
      </p>
      <p className="cl-prose cl-guide__foot">
          The tools register on their own; the line under the list confirms it. The booking is yours:{' '}
          <b>Enter</b> on the confirm bar, or an open palm to the camera. The assistant cannot press it.
          Everything it does is listed under the times. Cannot type into your assistant’s window? Use
          “Say it to the page” below, or talk to Cedarfield directly.
        </p>
      </details>
    </section>
  );
}
