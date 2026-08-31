/**
 * The chrome both clinic routes share: the honesty banner, the masthead, and the band grid.
 *
 * `Band` is the whole layout system. Every horizontal section of both pages is one band, and the
 * band's label sits in a gutter that answers the same question everywhere on the site: whose is
 * this? On the landing it names the actor in a step; on the booking sheet it names the state of an
 * appointment. Because it is one component, the two pages cannot drift apart.
 */
import type { ReactNode } from 'react';

export const CLINIC_NAME = 'Cedarfield Clinic';

/** Placeholder brand, pure content (SPEC-V1 §1) — no product identity has landed yet. */
export const CLINIC_STANDFIRST = 'Appointments · cancellations released in waves';

export function ClinicBanner() {
  return (
    <p className="cl-banner" data-clinic-banner>
      <b>Demo inventory.</b>
      <span>Simulated rival, labelled as one. Nothing real is booked and no payment is taken.</span>
    </p>
  );
}

export function Masthead({ aside }: { aside?: ReactNode }) {
  return (
    <header className="cl-masthead">
      <p className="cl-wordmark">
        {CLINIC_NAME}
        <span>{CLINIC_STANDFIRST}</span>
      </p>
      {aside ? <div className="cl-masthead__aside">{aside}</div> : null}
    </header>
  );
}

export interface BandProps {
  /** The gutter word. Omit for a band that runs full width (the thesis). */
  label?: string;
  /** Marks the one gutter word that is the human's: it is the only cedar word on the landing. */
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
 * The tool manifest — the specimen this site's whole argument rests on, set in the margin where a
 * reference belongs. Five verbs your agent can call, and one it cannot because it does not exist.
 * The struck line is the design: an absence is the load-bearing part of the contract, so it is
 * printed rather than described.
 */
export function ToolManifest({ absent = false }: { absent?: boolean }) {
  const tools = ['clinic_list_drops()', 'clinic_hold_slot(slot_id)', 'clinic_hold_status()', 'clinic_release_hold()', 'clinic_explain_confirm()'];
  return (
    <div className="cl-manifest" data-clinic-manifest={absent ? 'absent' : 'present'}>
      <p className="cl-manifest__title">{absent ? 'Not on this page' : 'Published to your agent'}</p>
      <ul className="cl-manifest__list">
        {absent ? (
          <li data-tool="absent">
            <s>clinic_book_slot(slot_id)</s>
          </li>
        ) : (
          tools.map((tool) => <li key={tool}>{tool}</li>)
        )}
      </ul>
      <p className="cl-manifest__note">
        {absent
          ? 'There is no tool that books. The verb was never registered, so there is nothing for an agent to find, and nothing for a jailbreak to reach.'
          : 'Five tools, registered on the booking page only. Each description carries the same sentence: one keypress on the page books it — you cannot.'}
      </p>
    </div>
  );
}
