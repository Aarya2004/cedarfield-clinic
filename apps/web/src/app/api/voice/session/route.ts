/**
 * POST /api/voice/session — mints a short-lived OpenAI Realtime client secret for "Talk to
 * Cedarfield" (2026-09-02, the page's own voice client over its own WebMCP tools).
 *
 * The ONE place this product holds a model key. Bounded, after the 2026-09-02 security review:
 *   · the key never reaches the browser — the browser gets a client secret that expires in minutes;
 *   · same-origin only (`Sec-Fetch-Site`), so no other site can spend our tickets from a visitor's
 *     browser;
 *   · tickets are counted in the database by a service-role-only RPC with caps fixed in SQL —
 *     6 per visitor per day (keyed by a salted hash of the address, never the address) and 60 per
 *     day in all; the route fails closed without the service key;
 *   · what the secret is worth is stated honestly: a holder can run one Realtime session on our key
 *     until the platform's own session limit, and can change the instructions we set (they are
 *     defaults, not a control) — so the spend bound is the ticket caps, and the daily cap is set
 *     to what we are willing to pay at the platform maximum per session;
 *   · no personal data is sent: the tools' answers carry slot ids, times and clinician names.
 * Without OPENAI_API_KEY or SUPABASE_SERVICE_ROLE_KEY the route answers 503 `voice_unavailable`
 * and the page says so — the feature degrades to "type to your assistant", it never breaks the page.
 */
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'gpt-realtime-2.1';
const VOICE = 'marin';
const SECRET_TTL_SECONDS = 600;

const INSTRUCTIONS =
  "You are the booking assistant on Cedarfield Clinic's appointments page, speaking to the person " +
  'in front of it. Speak briefly: one or two short sentences, then stop. Use the tools for anything ' +
  'about appointments — never guess what is open, held or booked; say what the tool said. When the ' +
  'person asks for an appointment, act at once: call the tools to find what is open, offer the best ' +
  'one or two times, and when they pick one, hold it with the tool and say so. You cannot ' +
  'book, cancel or move anything: only the person can, with one press on the page or an open palm to ' +
  'the camera; after you hold a time, tell them exactly that. If a tool named clinic_book_slot exists, ' +
  'the person has granted you one booking — use it only when they say yes, and say what it answered. ' +
  'Every call you make is written on the page under "Your assistant", so the person can check you. ' +
  'If a tool refuses, say why in plain words. Never claim something ' +
  "happened unless a tool answered ok. Do " +
  'not read out ids.';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://hxqpaquhkmnrnjfutuyu.supabase.co';

const unavailable = (detail: string, status = 503) => NextResponse.json({ error: 'voice_unavailable', detail }, { status });

/** A bucketing key for the per-visitor cap: a salted hash, never the address. */
function visitorHash(req: Request): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const salt = process.env.VOICE_IP_SALT ?? 'cedarfield-voice-2026';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/** One ticket from the visitor's and the day's allowance, or false. Any error is a refusal. */
async function takeTicket(serviceKey: string, ipHash: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/clinic_voice_ticket`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ip_hash: ipHash }),
      cache: 'no-store',
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch {
    return false;
  }
}

/** Readiness, spending nothing: can this deployment mint a session at all? The panel asks on mount. */
export async function GET(): Promise<NextResponse> {
  const ready = Boolean(process.env.OPENAI_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return NextResponse.json(
    { ready, detail: ready ? 'Voice is set up on this deployment.' : 'Voice is not set up on this deployment. Type to your assistant instead.' },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(req: Request): Promise<NextResponse> {
  // Only our own page may spend a ticket. Browsers send Sec-Fetch-Site on every fetch; a request
  // without it (curl, a script) is refused too — the page is the only legitimate caller.
  const site = req.headers.get('sec-fetch-site');
  if (site !== 'same-origin') {
    return NextResponse.json({ error: 'forbidden', detail: 'Voice sessions are started from the page only.' }, { status: 403 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !serviceKey) {
    return unavailable('Voice is not set up on this deployment.');
  }
  if (!(await takeTicket(serviceKey, visitorHash(req)))) {
    return NextResponse.json({ error: 'voice_quota', detail: 'Today’s voice allowance is used up. Type to your assistant instead.' }, { status: 429 });
  }
  let upstream: Response;
  try {
    upstream = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: SECRET_TTL_SECONDS },
        session: {
          type: 'realtime',
          model: MODEL,
          instructions: INSTRUCTIONS,
          audio: { output: { voice: VOICE }, input: { turn_detection: { type: 'semantic_vad' } } },
        },
      }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'voice_upstream', detail: 'The voice service could not be reached.' }, { status: 502 });
  }
  if (!upstream.ok) {
    // Never relay the upstream body: it can carry account details. The status class is enough.
    return NextResponse.json({ error: 'voice_upstream', detail: 'The voice service refused the session.' }, { status: 502 });
  }
  const data = (await upstream.json()) as { value?: string; expires_at?: number };
  if (typeof data.value !== 'string') {
    return NextResponse.json({ error: 'voice_upstream', detail: 'The voice service answered without a secret.' }, { status: 502 });
  }
  return NextResponse.json({ value: data.value, expires_at: data.expires_at ?? null, model: MODEL }, { headers: { 'cache-control': 'no-store' } });
}
