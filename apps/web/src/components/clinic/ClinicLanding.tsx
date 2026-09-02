/**
 * `/` and `/clinic` — the practice's home page.
 *
 * A server component with two client islands, because the only things here that move are the two
 * things that are actually true right now: the countdown to the next release, and the times the
 * roster reads out of it. Everything else is set once.
 *
 * The page is one column of stacked sections — hero, what you can book, the doctors, how released
 * appointments work, getting here — with every other section on a light grey field. Nothing on it
 * is decorative: if a line of type is on this page, a patient needs it to book or to get here.
 */
import Link from 'next/link';
import { Band, ClinicFooter, ClinicNav, ClinicPhoneLink, Masthead, PracticeCard, CLINIC_PHONE } from './ClinicFrame.tsx';
import { BoardPreview } from './BoardPreview.tsx';
import { ClinicianRoster } from './ClinicianRoster.tsx';
import { NextWaveClock } from './NextWaveClock.tsx';
import { HOLD_TTL_SECONDS } from './wave-clock.ts';
import './clinic-tokens.css';
import './clinic.css';

export function ClinicLanding() {
  return (
    <div className="clinic" data-clinic-route="landing">
      {/* Outside <main>, so this <header> is the page's banner landmark. */}
      <Masthead
        bar
        nav={<ClinicNav />}
        aside={
          <>
            <ClinicPhoneLink />
            <Link className="cl-cta cl-cta--sm" href="/clinic/book" data-clinic-cta="header">
              Book an appointment
            </Link>
          </>
        }
      />

      <main className="cl-shell">
        <Band open aside={<PracticeCard />}>
          <h1 className="cl-thesis">Book a cancelled appointment today</h1>
          <p className="cl-thesis__tail">
            When a patient cancels, their appointment goes back on our list at the next release.
            Choose a time and we hold it for you for {HOLD_TTL_SECONDS} seconds while you check the
            date.
          </p>
          <p className="cl-hero-cta">
            <Link className="cl-cta" href="/clinic/book" data-clinic-cta="hero">
              Book an appointment
            </Link>
          </p>
          <p className="cl-prose cl-prose--sm">
            Or call reception on{' '}
            <a className="cl-link" href={`tel:+44${CLINIC_PHONE.replace(/\D/g, '').slice(1)}`}>
              {CLINIC_PHONE}
            </a>
            , Monday to Friday from 8:00.
          </p>
        </Band>

        <Band label="Available now" id="available" wide>
          <h2 className="cl-lead">Available now</h2>
          <BoardPreview />
        </Band>

        <Band label="Appointments" id="appointments" tone="grey" wide>
          <h2 className="cl-lead">Appointments you can book online</h2>
          <ul className="cl-strip">
            <li>
              <h3>General practice</h3>
              <p>Something new — an illness, a pain, or a worry you want looked at today.</p>
            </li>
            <li>
              <h3>Follow-ups</h3>
              <p>A review after treatment, your test results, or a question about a repeat prescription.</p>
            </li>
            <li>
              <h3>New patients</h3>
              <p>Your first appointment with us. Bring photo ID and something with your address on it.</p>
            </li>
          </ul>
          <p className="cl-prose">
            Vaccinations, the travel clinic and minor surgery are booked by phone on {CLINIC_PHONE}. If
            you need help today and the list is empty, call 111.
          </p>
        </Band>

        <Band label="Clinicians" id="clinicians" wide>
          <h2 className="cl-lead">Our doctors</h2>
          <ClinicianRoster />
          <p className="cl-prose">
            Times are read from the list as it stands now. Any of our doctors can see you about
            anything — a special interest is what they are the one to ask about.
          </p>
        </Band>

        <Band label="Releases" tone="grey">
          <h2 className="cl-lead">How released appointments work</h2>
          <ol className="cl-steps">
            <li>
              <h3>A patient cancels</h3>
              <p>Their appointment comes off the book and waits for the next release.</p>
            </li>
            <li>
              <h3>Everything free goes back at once</h3>
              <p>
                Cancellations are released together, on the clock, so nobody has to sit refreshing
                the page to catch one. What is on the list is first come.
              </p>
            </li>
            <li>
              <h3>You choose a time and confirm it</h3>
              <p>
                The time you choose is held while you confirm — long enough to check the date, not
                long enough to sit on.
              </p>
            </li>
          </ol>
          <NextWaveClock />
        </Band>

        <Band label="Access">
          <h2 className="cl-lead">Getting here, and getting in</h2>
          <p className="cl-prose">
            Step-free entrance on Marlow Row, a hearing loop at reception, and an accessible toilet
            on the ground floor. Tell us when you book if you need an interpreter — we can arrange
            one for most languages with a day&rsquo;s notice.
          </p>
          <p className="cl-prose">
            Booking works from the keyboard alone: every control has a visible focus ring, and the
            confirm button answers Space as well as Enter. With reduced motion turned on, the page
            keeps its countdowns and drops everything else.
          </p>
        </Band>
      </main>

      <ClinicFooter
        aside={
          <p className="cl-footer__cta">
            <Link className="cl-cta cl-cta--sm" href="/clinic/book" data-clinic-cta="foot">
              Book an appointment
            </Link>
          </p>
        }
      />
    </div>
  );
}
