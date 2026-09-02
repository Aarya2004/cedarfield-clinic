/**
 * Your appointment — the reference, the calendar file, and the date arithmetic behind them.
 *
 * Pure and clock-free (every function that needs "now" is handed it), relative `.ts` imports only,
 * so the whole file runs under `node --test` without a browser (tickets/MAP.md). `AppointmentCard`
 * is the only component that reads it; everything hard lives here so it can be tested rather than
 * driven.
 *
 * THE REFERENCE is derived, not drawn from a random source: the same slot booked at the same
 * instant always prints the same `CF-…`, so a re-render, a re-hydration or a screenshot taken twice
 * cannot disagree about what a person was told. Crockford's base-32 alphabet drops I, L, O and U,
 * which is the difference between a reference someone can read down a phone line and one they
 * cannot.
 *
 * THE CALENDAR FILE is RFC 5545 with the two details most hand-rolled writers miss: CRLF line
 * endings (a bare LF makes the file unreadable to several desktop clients) and content lines folded
 * at 75 octets. `DTSTART` is written in local floating time — form 1 of the spec — because "8:40 AM"
 * means 8:40 in the room the clinic is in, and pinning it to a UTC instant would be a guess about
 * the visitor's zone dressed up as a fact. `DTSTAMP` is a real instant and so carries its Z.
 */

/** How long a Cedarfield appointment runs. Used for DTEND and nothing else. */
export const APPOINTMENT_MINUTES = 15;

/** Crockford base-32: no I, L, O or U, so a reference read aloud cannot be mis-heard. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** What a Cedarfield reference looks like. Exported so a test — or a form — can check one. */
export const REFERENCE_PATTERN = /^CF-[0-9A-HJKMNP-TV-Z]{4}$/;

/**
 * The booking reference, derived from whatever identifies the booking.
 *
 * FNV-1a over the seed, then five bits at a time off the top of the hash. Four characters is 20
 * bits — plenty to tell one person's booking from their own previous one, which is all a reference
 * on a single day's list has to do. It is not a secret and nothing is authorised by it.
 */
export function appointmentReference(seed: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[(h >>> (27 - i * 5)) & 31];
  }
  return `CF-${out}`;
}

/** `cedarfield-CF-4X2K.ics` — a filename a person can find again in a downloads folder. */
export function icsFilename(reference: string): string {
  return `cedarfield-${reference}.ics`;
}

/**
 * Turn a board time — "8:40 AM", "12:05 PM" — into a real instant on the visitor's calendar.
 *
 * The board publishes a time of day and nothing else, so the date has to come from somewhere: it is
 * today, unless today's version of that time has already passed, in which case it is tomorrow. That
 * is the same assumption a receptionist makes out loud, and it is stated on the card ("Today" /
 * "Tomorrow") rather than left for the visitor to infer. Returns null for anything unparseable so a
 * caller draws no calendar button rather than a wrong one.
 */
export function appointmentDateFor(timeLabel: string, now: Date): Date | null {
  // The dock rewrites its time labels with non-breaking spaces so "9:00 AM" never wraps mid-time;
  // a label that travelled through there must still parse.
  const match = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(timeLabel.replace(/\u00A0/g, ' '));
  if (match === null) return null;
  const hour12 = Number(match[1]);
  const minutes = Number(match[2]);
  if (hour12 < 1 || hour12 > 12 || minutes > 59) return null;
  const pm = match[3].toUpperCase() === 'PM';
  const hour = pm ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12;

  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minutes, 0, 0);
  if (at.getTime() < now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * "Today · Thursday 3 September". Written out rather than left to `toLocaleDateString`, which
 * answers differently on the server and in the browser and would hydrate into a mismatch.
 */
export function formatAppointmentDate(at: Date, now: Date): string {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const long = `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
  if (sameDay(at, now)) return `Today · ${long}`;
  if (sameDay(at, tomorrow)) return `Tomorrow · ${long}`;
  return long;
}

export interface IcsInput {
  reference: string;
  /** Local floating time — what the board said, in the room the clinic is in. */
  startsAt: Date;
  clinician: string;
  kind: string;
  /** The instant the file was written. Carries the Z. */
  stamp: Date;
  minutes?: number;
}

/** `,` `;` and `\` are delimiters in a content line; a newline is written as the two characters \n. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/**
 * RFC 5545 §3.1: a content line is at most 75 octets, and a longer one continues on the next line
 * after a single space. Folded by octet rather than by character so a multi-byte name cannot be cut
 * in half — the failure mode is a calendar file that imports as mojibake.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let octets = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (octets + size > 75) {
      out.push(current);
      current = ' '; // the continuation's leading space is part of its own 75-octet budget
      octets = 1;
    }
    current += ch;
    octets += size;
  }
  out.push(current);
  return out.join('\r\n');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local floating time: `20260903T084000`, no zone, no Z. */
function localStamp(at: Date): string {
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}T${pad(at.getHours())}${pad(at.getMinutes())}00`;
}

/** A real instant: `20260901T101500Z`. */
function utcStamp(at: Date): string {
  return `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`;
}

/** The clinic's own address, so the calendar entry can be navigated to. */
export const CLINIC_ADDRESS = 'Cedarfield Clinic, 14 Marlow Row, Cedarfield CF4 2QN';

/** One VEVENT, ready to hand to a Blob. CRLF throughout, folded, escaped. */
export function buildIcs(input: IcsInput): string {
  const minutes = input.minutes ?? APPOINTMENT_MINUTES;
  const ends = new Date(input.startsAt.getTime() + minutes * 60_000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cedarfield Clinic//Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.reference}@cedarfield.example`,
    `DTSTAMP:${utcStamp(input.stamp)}`,
    `DTSTART:${localStamp(input.startsAt)}`,
    `DTEND:${localStamp(ends)}`,
    `SUMMARY:${escapeText(`${input.kind} with ${input.clinician}`)}`,
    `LOCATION:${escapeText(CLINIC_ADDRESS)}`,
    `DESCRIPTION:${escapeText(`Booking reference ${input.reference}. Please arrive five minutes early.`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
