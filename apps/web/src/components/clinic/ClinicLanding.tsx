/**
 * `/` and `/clinic` — the practice's home page (SPEC-V3 §3).
 *
 * A server component with two client islands, because the only things here that move are the two
 * things that are actually true right now: the countdown to the next release, and the times the
 * roster reads out of it. Everything else is set once.
 *
 * The page keeps the site's one grid — `[gutter][body]` — and spends the gutter on the three words
 * the nav offers, so the column a visitor learns here is the same column that names the state of
 * every row on the booking board. The hero is one sentence at display size; the only cedar on the
 * page is the clause that is the visitor's ("held for you") and the one button that acts.
 */
import Link from 'next/link';
import { Band, ClinicFooter, ClinicNav, Masthead } from './ClinicFrame.tsx';
import { ClinicianRoster } from './ClinicianRoster.tsx';
import { NextWaveClock } from './NextWaveClock.tsx';
import { HOLD_TTL_SECONDS } from './wave-clock.ts';
import './clinic-tokens.css';
import './clinic.css';

export function ClinicLanding() {
  return (
    <div className="clinic" data-clinic-route="landing">
      {/* Outside <main>, so this <header> is the page's banner landmark. */}
      <Masthead bar nav={<ClinicNav />} />

      <main className="cl-shell">
        <Band open>
          <h1 className="cl-thesis cl-rise" data-step="1">
            Same-day cancellations, released fairly.
          </h1>
          <p className="cl-thesis__tail cl-rise" data-step="2">
            When a patient cancels, their time goes back on the list at the next release — not to
            whoever happens to be refreshing the page. Choose one and it is <em>held for you</em> for{' '}
            {HOLD_TTL_SECONDS} seconds while you check the date.
          </p>
          <p className="cl-rise cl-hero-cta" data-step="3">
            <Link className="cl-cta" href="/clinic/book" data-clinic-cta="hero">
              Book an appointment
              <span aria-hidden="true">→</span>
            </Link>
          </p>
        </Band>

        <Band label="Appointments" id="appointments">
          <h2 className="cl-lead">What you can book yourself.</h2>
          <ul className="cl-strip">
            <li>
              <b>General practice</b>
              <span>Something new — an illness, a pain, or a worry you want looked at today.</span>
            </li>
            <li>
              <b>Follow-ups</b>
              <span>A review after treatment, your test results, or a question about a repeat prescription.</span>
            </li>
            <li>
              <b>New patients</b>
              <span>Your first appointment with us. Bring photo ID and something with your address on it.</span>
            </li>
          </ul>
          <p className="cl-prose">
            Vaccinations, the travel clinic and minor surgery are booked by phone on 01632 960 118.
            If you need help today and the list is empty, call 111.
          </p>
        </Band>

        <Band label="Clinicians" id="clinicians" wide>
          <h2 className="cl-lead">The doctors taking appointments.</h2>
          <ClinicianRoster />
          <p className="cl-prose">
            Times are read from the release that is on the board now. Any of our doctors can see you
            about anything — a special interest is what they are the one to ask about.
          </p>
        </Band>

        <Band label="Releases">
          <h2 className="cl-lead">Cancellations go back on the list.</h2>
          <NextWaveClock />
          <p className="cl-prose">
            Every time that came free since the last release goes back at the same moment, so nobody
            has to sit refreshing the page to catch one. What is on the list is first come. The time
            you choose is held while you confirm it — long enough to check the date, not long enough
            to sit on.
          </p>
        </Band>

        <Band label="Access">
          <h2 className="cl-lead">Getting here, and getting in.</h2>
          <p className="cl-prose">
            Step-free entrance on Marlow Row, a hearing loop at reception, and an accessible toilet
            on the ground floor. Tell us when you book if you need an interpreter — we can arrange
            one for most languages with a day&rsquo;s notice.
          </p>
          <p className="cl-prose">
            Booking works from the keyboard alone: every control has a visible focus ring, and the
            confirm key answers Space as well as Enter. With reduced motion turned on, the page keeps
            its countdowns and drops everything else.
          </p>
        </Band>
      </main>

      <ClinicFooter
        aside={
          <p className="cl-footer__cta">
            <Link className="cl-quiet" href="/clinic/book" data-clinic-cta="foot">
              Book an appointment
            </Link>
          </p>
        }
      />
    </div>
  );
}
