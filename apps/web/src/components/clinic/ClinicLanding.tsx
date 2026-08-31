/**
 * `/clinic` — the landing (SPEC-V1 §2).
 *
 * A server component with one client island (the countdown), because the only thing on this page
 * that moves is the clock. The argument is carried by type: one sentence at display size, then a
 * three-band ladder whose gutter names WHO ACTS at each step — your agent, the clock, you. The
 * third label is the only cedar word above the fold, which is the whole thesis in one word in the
 * margin. There are no illustrations (§6) and no numbered markers: the steps are a cast, not a
 * checklist, and the actor changing is the information.
 */
import Link from 'next/link';
import { Band, ClinicBanner, Masthead, ToolManifest } from './ClinicFrame.tsx';
import { NextWaveClock } from './NextWaveClock.tsx';
import { HOLD_TTL_SECONDS, WAVE_PERIOD_MS } from './wave-clock.ts';
import './clinic-tokens.css';
import './clinic.css';

const WAVE_SECONDS = WAVE_PERIOD_MS / 1000;

export function ClinicLanding() {
  return (
    <div className="clinic" data-clinic-route="landing">
      <ClinicBanner />
      <main className="cl-shell">
        <Masthead
          aside={
            <Link className="cl-quiet" href="/clinic/book" data-clinic-nav="book">
              Book an appointment
            </Link>
          }
        />

        <Band open>
          <h1 className="cl-thesis cl-rise" data-step="1">
            Every task on the web is a number of interactions.
          </h1>
          <p className="cl-thesis__tail cl-rise" data-step="2">
            For millions of people, each one is expensive. This page hands the structure to your
            agent — and leaves you <em>the one act that must stay yours</em>.
          </p>
          <p className="cl-rise" data-step="3" style={{ marginTop: '2rem' }}>
            <Link className="cl-cta" href="/clinic/book" data-clinic-cta="hero">
              Open the booking page
              <span aria-hidden="true">→</span>
            </Link>
          </p>
        </Band>

        <Band label="Next release">
          <NextWaveClock />
          <p className="cl-prose">
            Cedarfield releases its cancellations in waves. Six appointments land every{' '}
            {WAVE_SECONDS} seconds and the fastest bookers clear the good ones first — which is why
            a page like this one is worth handing to an agent at all.
          </p>
        </Band>

        <Band label="Your agent" aside={<ToolManifest />}>
          <p className="cl-lead">It finds the slot and holds it.</p>
          <p className="cl-prose">
            The booking page publishes its appointments as tools your agent can call — list what is
            open, hold one, check the hold, give it back. Your agent takes a{' '}
            <strong>{HOLD_TTL_SECONDS}-second hold</strong> on the time you asked for. No account,
            no scraping, no form.
          </p>
        </Band>

        <Band label="The clock">
          <p className="cl-lead">The hold burns in the open.</p>
          <p className="cl-prose">
            The seconds run under the appointment time on the page and along the top of the dock —
            one rule, retreating. Let it lapse and the hold is gone; the appointment is anyone&rsquo;s
            again at the next release. Nothing is reserved quietly and nothing is held on your behalf
            without the page saying so.
          </p>
        </Band>

        <Band label="You" actor="you" aside={<ToolManifest absent />}>
          <p className="cl-lead">One keypress books it.</p>
          <p className="cl-prose">
            There is <strong>no booking tool on this site</strong> — there is nothing for an agent to
            call. An appointment is made only by a keypress the browser marks as trusted, which no
            script, extension or tool can forge. The page counts every synthetic press that tries and
            shows you the number.
          </p>
          <ul className="cl-trust" data-clinic-trust>
            <li>Your own agent</li>
            <li>Your own booking</li>
            <li>No resale</li>
            <li>Only a human books</li>
          </ul>
        </Band>

        <Band label="Honestly">
          <p className="cl-prose">
            The appointments are generated on your machine and the rival is a seeded simulation,
            labelled as one wherever it appears. Every interaction count on the booking page was
            measured by the page while you used it — no number here was written by hand. Nothing
            books a real appointment and nothing takes a payment.
          </p>
        </Band>

        <Band label="Access">
          <p className="cl-prose">
            Every control is reachable by keyboard with a visible focus ring, and the confirm key
            answers Space as well as Enter so switch access works. A hold announces itself when it
            arrives and again at 30 and 10 seconds — never on every tick. With reduced motion turned
            on, the page drops the animation and keeps the countdown, because the countdown is
            information.
          </p>
          <p>
            <Link className="cl-quiet" href="/clinic/book" data-clinic-cta="foot">
              Open the booking page
            </Link>
          </p>
        </Band>
      </main>
    </div>
  );
}
