/**
 * The chrome both clinic routes share: the header, the site nav, the section wrapper, and the footer.
 *
 * There is no clever grid here on purpose. A practice website is a single content column, 1120px
 * wide, with sections stacked down it and every other one sitting on a light grey field so the eye
 * can find the edges. `Section` is that wrapper — a heading, then content — and the `label` it
 * takes is written to `data-clinic-band` for the harness rather than drawn as a gutter word.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';

export const CLINIC_NAME = 'Cedarfield Clinic';

/** Under the wordmark. One line, sentence case, no tracking. */
export const CLINIC_STANDFIRST = 'General practice';

/**
 * The practice's own details. Deliberately unreachable: 01632 960 118 is inside the range Ofcom
 * reserves for drama so that a number printed on a page like this one can never ring a real
 * household, and CF4 2QN is not a live postcode. Kept here rather than in the footer's JSX so the
 * calendar file and the page cannot disagree about where the clinic is.
 */
export const CLINIC_ADDRESS_LINES = ['14 Marlow Row', 'Cedarfield', 'CF4 2QN'] as const;
export const CLINIC_PHONE = '01632 960 118';

/** `tel:` form of the reception number, built once so no two call links can disagree. */
export const CLINIC_PHONE_HREF = `tel:+44${CLINIC_PHONE.replace(/\D/g, '').slice(1)}`;

/** The three places on this site. Hidden below 900px, where the button and the number take over. */
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

/** Reception's number, as a call link. Stays visible at every width — it is the fallback route. */
export function ClinicPhoneLink({ className = 'cl-phone' }: { className?: string }) {
  return (
    <a className={className} href={CLINIC_PHONE_HREF} data-clinic-phone={CLINIC_PHONE}>
      <span className="cl-phone__label">Reception</span> {CLINIC_PHONE}
    </a>
  );
}

/**
 * The practice at a glance: where it is, when it is open, and the number to ring. It sits beside the
 * hero because those three facts are what a patient who is not booking came to the front page for,
 * and repeating them in the footer is how every practice website already works.
 */
export function PracticeCard() {
  return (
    <aside className="cl-card" aria-label="Cedarfield Clinic details">
      <h2 className="cl-card__head">Opening hours</h2>
      <p className="cl-card__lines">
        <span>
          <b>Monday to Thursday</b> 8:00 – 18:30
        </span>
        <span>
          <b>Friday</b> 8:00 – 17:00
        </span>
        <span>
          <b>Saturday</b> 8:30 – 12:00, pre-booked
        </span>
        <span>
          <b>Sunday</b> closed
        </span>
      </p>
      <h2 className="cl-card__head cl-card__head--sep">Find us</h2>
      <p className="cl-card__lines">
        <span>{CLINIC_ADDRESS_LINES.join(', ')}</span>
        <span>
          Reception{' '}
          <a className="cl-link" href={CLINIC_PHONE_HREF}>
            {CLINIC_PHONE}
          </a>
        </span>
      </p>
    </aside>
  );
}

export interface MastheadProps {
  /** The site nav. Present on the home page; the booking page is a single task and carries none. */
  nav?: ReactNode;
  /** Anything that belongs at the right-hand end of the bar — the phone number and the button. */
  aside?: ReactNode;
  /**
   * Draw it as the page's top bar: full-bleed, ruled underneath, its contents held to the page
   * measure. Used when the header sits OUTSIDE `<main>` and is therefore the banner landmark.
   * Without it the header is an inline block inside `.cl-shell`, which is what /clinic/book uses.
   */
  bar?: boolean;
}

export function Masthead({ nav, aside, bar = false }: MastheadProps) {
  return (
    <header className="cl-masthead" data-masthead={bar ? 'bar' : 'inline'}>
      <div className="cl-masthead__inner">
        <p className="cl-wordmark">
          <Link href="/clinic" data-clinic-nav="home">
            {CLINIC_NAME}
          </Link>
          <span>{CLINIC_STANDFIRST}</span>
        </p>
        {nav ?? null}
        {aside ? <div className="cl-masthead__aside">{aside}</div> : null}
      </div>
    </header>
  );
}

export interface SectionProps {
  /** Written to `data-clinic-band`. Not drawn — the section's own heading names it on screen. */
  label?: string;
  /** Kept for callers that still mark the visitor's own section. Not drawn. */
  actor?: 'you';
  /** No top border — for the first section under the header. */
  open?: boolean;
  /** Tighter top padding, for a section that follows its own heading. */
  flush?: boolean;
  /** Sits on the light grey field instead of white. */
  tone?: 'grey';
  /** Anything that belongs beside the section body rather than inside its measure. */
  aside?: ReactNode;
  /** Let the body run the full content width instead of holding to the reading measure. */
  wide?: boolean;
  id?: string;
  children: ReactNode;
}

/**
 * One section of a page: a full-bleed field, with its content held to the 1120px column. Sections
 * do not draw rules between themselves — the grey/white alternation is the separation.
 */
export function Section({
  label,
  actor,
  open = false,
  flush = false,
  tone,
  aside,
  wide = false,
  id,
  children,
}: SectionProps) {
  const classes = [
    'cl-band',
    open ? 'cl-band--open' : '',
    flush ? 'cl-band--flush' : '',
    tone === 'grey' ? 'cl-band--grey' : '',
    aside ? 'cl-band--aside' : '',
    wide ? 'cl-band--wide' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes} id={id} data-clinic-band={label ?? 'full'} data-clinic-actor={actor}>
      <div className="cl-band__inner">
        <div className="cl-band__body">{children}</div>
        {aside ? <div className="cl-band__aside">{aside}</div> : null}
      </div>
    </section>
  );
}

/** The name the two routes have always imported. */
export const Band = Section;

/**
 * The footer, and the site's Contact section — the two are the same thing on a clinic page, so the
 * nav's third word points here rather than at a section that would repeat it. Three columns, in the
 * order a person needs them: where we are, how to reach us, when we are open.
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
                Reception{' '}
                <a className="cl-link" href={CLINIC_PHONE_HREF}>
                  {CLINIC_PHONE}
                </a>
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
