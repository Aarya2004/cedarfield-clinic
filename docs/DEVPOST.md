# Devpost entry — Cedarfield Clinic (draft, 2026-09-02)

Paste-ready. Every claim below is something the repo proves (`docs/evidence/clinic/`) or the live
site shows. Edit the tone, not the facts.

## Tagline

**The agentic web should not require a particular way of seeing, hearing, speaking, typing or clicking.**

## What it does

Cedarfield is a fictional clinic that releases cancelled appointments in waves — the kind of race a
mouse user barely notices and a person on a switch, a screen reader or a head pointer cannot win.
The booking page hands the race to your assistant through WebMCP, and keeps the one act that must
stay yours.

- **Eleven tools on the shared, live board** — search, compare, hold (three minutes), release, queue
  for a taken time, arm a cancel, arm a move, explain the rule — consumed by the Codex desktop app's
  browser pane, by Chrome 152 with WebMCP, and by the page's own voice agent. One tool surface,
  three clients.
- **No booking tool exists at load.** Booking, cancelling and moving happen only on a browser-trusted
  event: one key, one switch press, or one open palm to the camera. Synthetic presses are counted
  on screen, never obeyed.
- **The booking tool is born by your hand.** Press *Let my assistant book for me* (or show a palm)
  and `clinic_book_slot` appears in your agent's list for one booking, ten minutes; "yes, book it"
  then books; the tool dies with the booking. The card records *0 interactions from you*.
- **The page makes you legible to any agent.** WebMCP has no page-to-agent push, so *Say it to the
  page* queues what you say (the browser's recognizer), sign (five hand shapes: yes, no, stop, the
  first one, another one) or type, and `clinic_wait_for_request` hands your agent the next one. Tell
  it once: "keep helping me with what I say to the page until I say stop."
- **Talk to Cedarfield.** The page hosts its own voice agent (OpenAI Realtime over WebRTC) over the
  same tools. It answers aloud. It cannot press either.
- **You always see what happened.** A strip at the top announces each call as it lands, the page
  scrolls and pulses the row or card it changed, a record under the times keeps every call, and with
  sound on the page speaks it. The card names the patient, who is on file once per browser.
- **The waitlist cascade.** If a time is taken, your agent queues you; when it comes back the server
  hands it to you first as a fresh hold, the confirm bar rises by itself, and one press books it.
- **Shared and live.** Every visitor sees one board, backed by a database that enforces fairness
  between strangers: one hold each, hold-before-book, only your own booking cancels or moves.

## How we built it

Next.js on Vercel; WebMCP via `document.modelContext.registerTool` (imperative, top-level) and one
declarative form; Supabase with row-level security and security-definer RPCs for the board; MediaPipe
gesture recognition on-device for the palm and the five signs; the browser's SpeechRecognition for
"Say it to the page"; OpenAI Realtime (WebRTC) for the page's voice agent, behind a same-origin
route, a service-role-only daily cap and a ten-minute client secret; a CDP-driven eval harness that
invokes the page's tools exactly as a client would (24 browser cases, a two-visitor live proof, axe
on every route), run on every deploy.

## Challenges

- Chat clients take 10–39 s per tool call (measured): our 45-second holds were unusable. Holds are
  three minutes, waves six.
- WebMCP has no push. The wait tool is the honest answer: the agent asks, the page answers.
- Chrome stops the camera loop for a hidden tab; the page now says so instead of showing "no hand".
- The assistant paths booked for nobody. A clinic never does that; now a patient is on file.
- An independent security review found eight defects in the night's work — an anon-callable spend
  cap, a palm that booked and granted at once, a voice agent whose speech could be transcribed back
  as the person's words. All eight fixed and re-proven before deploy.

## What we learned

The right place to put an agent's capability is the page, and the right place to put human consent
is the browser's trusted-event boundary. Everything else in this project follows from refusing to
move either one.

## What's next

A real scheduling backend behind the same `DropDriver` seam; a vocabulary beyond five signs, built
with signers rather than for them; and the same pattern on pharmacies and labs.

## Try it

`https://rokan-terminal.vercel.app/clinic/book` in the Codex app's browser or Chrome 152 with
`chrome://flags/#enable-webmcp-testing`. The page tells you what to say. Repo: public, Apache-2.0,
with every proof re-runnable in two commands.
