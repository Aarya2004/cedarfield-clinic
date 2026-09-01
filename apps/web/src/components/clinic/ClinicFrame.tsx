/**
 * The chrome both clinic routes share: the masthead, the site nav, the band grid, and the footer.
 *
 * `Band` is the whole layout system. Every horizontal section of both pages is one band, and the
 * band's label sits in a gutter that answers the same question everywhere on the site: whose is
 * this? On the home page it names the part of the practice the band belongs to — the same three
 * words the nav offers — and on the booking sheet it names the state of an appointment. Because it
 * is one component, the two pages cannot drift apart.
 *
 * The strip that used to sit above the masthead is gone with SPEC-V3, and so are the manifest and
 * the trust list that hung off the home page's margin. What replaces them is what a practice
 * actually publishes: a nav, a roster, hours, and an address.
 */
import type { ReactNode } from 'react';

export const CLINIC_NAME = 'Cedarfield Clinic';

/** Under the wordmark, in the wordmark's own small caps. */
export const CLINIC_STANDFIRST = 'General practice · Same-day appointments';

/**
 * The practice's own details. Fictional, and deliberately unreachable: 01632 960 118 is inside the
 * range Ofcom reserves for drama so that a number printed on a page like this one can never ring a
 * real household, and CF4 2QN is not a live postcode. Kept here rather than in the footer's JSX so
 * the calendar file and the page cannot disagree about where the clinic is.
 */
export const CLINIC_ADDRESS_LINES = ['14 Marlow Row', 'Cedarfield', 'CF4 2QN'] as const;
export const CLINIC_PHONE = '01632 960 118';

/** The three places on this site. The gutter words of the home page are these same three. */
export function ClinicNav() {
  return (
    <nav className="cl-nav" aria-label="Cedarfield Clinic">
      <a href="#appointments" data-clinic-nav="appointments">
        Appointments
      </a>
      <a href="#clinicians" data-clinic-nav="clinicians">
        Clinicians
      </a>
      <a href="#contact" data-clinic-nav="contact">
        Contact
      </a>
    </nav>
  );
}

export interface MastheadProps {
  /** The site nav. Present on the home page; the booking page is a single task and carries none. */
  nav?: ReactNode;
  /** Anything that belongs opposite the wordmark. */
  aside?: ReactNode;
  /**
   * Draw it as the page's top bar: full-bleed, ruled underneath, its contents held to the page
   * measure. Used when the masthead sits OUTSIDE `<main>` and is therefore the banner landmark.
   * Without it the masthead is an inline block inside `.cl-shell`, which is what /clinic/book uses.
   */
  bar?: boolean;
}

export function Masthead({ nav, aside, bar = false }: MastheadProps) {
  return (
    <header className="cl-masthead" data-masthead={bar ? 'bar' : 'inline'}>
      <div className="cl-masthead__inner">
        <p className="cl-wordmark">
          {CLINIC_NAME}
          <span>{CLINIC_STANDFIRST}</span>
        </p>
        {nav ?? null}
        {aside ? <div className="cl-masthead__aside">{aside}</div> : null}
      </div>
    </header>
  );
}

export interface BandProps {
  /** The gutter word. Omit for a band that runs full width (the hero). */
  label?: string;
  /** Marks the one gutter word that is the human's: it is the only cedar word in the column. */
  actor?: 'you';
  /** No hairline above — for the first band under the masthead. */
  open?: boolean;
  /** A tighter top pad, for bands that follow their own heading. */
  flush?: boolean;
  /** The outer margin: specimen matter that belongs beside the prose, not inside it. */
  aside?: ReactNode;
  /** Let the body run the full width instead of holding to the reading measure. */
  wide?: boolean;
  id?: string;
  children: ReactNode;
}

export function Band({ label, actor, open = false, flush = false, aside, wide = false, id, children }: BandProps) {
  const classes = [
    'cl-band',
    open ? 'cl-band--open' : '',
    flush ? 'cl-band--flush' : '',
    aside ? 'cl-band--aside' : '',
    wide ? 'cl-band--wide' : '',
    label === undefined ? 'cl-band--full' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes} id={id} data-clinic-band={label ?? 'full'}>
      {label === undefined ? null : (
        <p className="cl-band__label" data-actor={actor}>
          {label}
        </p>
      )}
      <div className="cl-band__body">{children}</div>
      {aside ? <div className="cl-band__aside">{aside}</div> : null}
    </section>
  );
}

/**
 * The footer, and the site's Contact section — the two are the same thing on a clinic page, so the
 * nav's third word points here rather than at a band that would repeat it. Three columns, hairline
 * ruled, in the order a person needs them: where we are, how to reach us, when we are open.
 */
export function ClinicFooter({ aside }: { aside?: ReactNode }) {
  return (
    <footer className="cl-footer" id="contact" data-clinic-footer>
      <div className="cl-footer__inner">
        <div className="cl-footer__top">
          <p className="cl-footer__mark">{CLINIC_NAME}</p>
          {aside ?? null}
        </div>

        <div className="cl-footer__cols">
          <div className="cl-footer__col">
            <h2 className="cl-footer__head">Where we are</h2>
            <p className="cl-footer__lines">
              {CLINIC_ADDRESS_LINES.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
            <p className="cl-footer__note">
              Step-free entrance on Marlow Row. Two accessible parking bays on Ashe Street.
            </p>
          </div>

          <div className="cl-footer__col">
            <h2 className="cl-footer__head">Reaching us</h2>
            <p className="cl-footer__lines">
              <span>
                Reception <a className="cl-link" href={`tel:+44${CLINIC_PHONE.replace(/\D/g, '').slice(1)}`}>{CLINIC_PHONE}</a>
              </span>
              <span>When we are closed, call 111</span>
              <span>If it is an emergency, call 999</span>
            </p>
            <p className="cl-footer__note">Reception answers from 8:00. Repeat prescriptions take two working days.</p>
          </div>

          <div className="cl-footer__col">
            <h2 className="cl-footer__head">Opening hours</h2>
            <p className="cl-footer__lines">
              <span>Monday to Thursday · 8:00 – 18:30</span>
              <span>Friday · 8:00 – 17:00</span>
              <span>Saturday · 8:30 – 12:00, pre-booked</span>
              <span>Sunday · closed</span>
            </p>
          </div>
        </div>

        <p className="cl-footer__legal">
          © 2026 Cedarfield Clinic. Your records stay with the practice and are never shared without your
          consent.
        </p>
      </div>
    </footer>
  );
}
