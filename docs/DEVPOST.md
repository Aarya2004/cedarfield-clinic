# Devpost submission text — Cedarfield Clinic (2026-09-03, final draft)

> Paste each section into the matching Devpost field. Everything here is true of production build
> `891c755` or newer. Numbers are the page's own or the evidence files under `docs/evidence/clinic/`.

## Tagline (one line)

Your words, your agent, your final say: a public clinic page that gives a visitor's own agent safe live tools, and never lets it commit.

## Inspiration

Some people cannot reliably speak, type, or work through a long booking form: speech differences, cerebral palsy, ALS, a stroke, a bad day. Many of them already have an agent that understands how they communicate. Public websites do not. They expose forms, dropdowns, timers and a phone number. This project began with the friction a family member experiences when communication takes time and web workflows demand fast, precise interactions. We wanted one public page where a visitor arrives with their own agent and their own way of communicating, and the page meets both of them halfway, without handing the agent the right to decide.

## What it does

Cedarfield is a fictional clinic that releases cancelled appointments in waves. A visitor opens the booking page inside their own agent's browser. Through WebMCP the page tells that agent exactly what it may do right now: see the board, find times, hold and release a slot, wait for the person's words, and ask them one bounded question. The visitor talks to the page in whatever way works for them: typing, speaking, a hand shape the camera reads as a switch, or a scanning keyboard driven by two of those shapes. The agent takes each request from the page, searches, holds a time, and can ask back through the page ("9:00 with Dr. Alvarez, or another time?"), which the visitor answers by button, key, voice or hand.

What the agent cannot do is commit. There is no booking tool when the page loads. One is born only from an act a person performs: a trusted press, an open palm held to the camera, or a word shown on screen that only they can see. It lives ten minutes, books once, and dies on use, revoke or expiry. Cancel and move are never delegated. A permission card shows the contract at every moment: can, cannot, until. A scripted press is counted and refused, out loud. Every call the agent makes is written on the page in plain words, and a pointer sits on whatever the call touched.

## How we built it

Next.js 15 on Vercel; the page registers its tools with `document.modelContext` (imperative WebMCP). The twelve load-time tools are registered by an inline script under the page's CSP nonce before any bundle runs, so they exist in a client's very first snapshot; the app takes over their execution when it hydrates. Three further sets are born and die with page state: the queue verbs on the shared board, the booking tool under a grant, the appointment tool after a booking. A shared live board runs on Supabase with row-level security and SECURITY DEFINER procedures, so fairness (one hold, hold before book, own-booking cancel and move) is enforced by the database, not the client. The page reads intent with the browser's speech recognizer, MediaPipe hand-shape recognition, and a switch-scanning keyboard; the page's own voice client uses the OpenAI Realtime API over WebRTC and consumes the same tools through the same path. Everything on screen that is a number is measured by the code that shows it.

## Why WebMCP

Without WebMCP a visitor's agent has two roads: scrape the visual page and guess at controls, or use an API the clinic built for developers, which the visitor does not have and which knows nothing about consent on this page. WebMCP lets the page itself declare, to the visitor's own agent, the actions available right now, in the page's current state, and lets that set change the instant the person grants or revokes something. Consent becomes a tool that is born and dies. That is not achievable by scraping, and an API cannot see the visitor's hand.

## Challenges we ran into

Registering tools after hydration lost the first call of any client that snapshots at navigation; the fix was to register from the HTML itself. A page-defined "yes" is the one word an agent can also say, so the spoken answer accepts "yes" only where the page asked a question, ignores the microphone while the page itself is talking, keeps the voice client off while the page listens, and offers a word shown on screen for a noisy room. Five camera shapes are not a language, and we say so on the page: they are five switches the visitor labels, or asks their agent to label. The sample patient from our test flag once persisted into a real visit; it is memory-only now.

## Accomplishments we're proud of

Three consecutive clean audits by an independent agent on production. Tools present in the first snapshot on five fresh loads of the live board. Thirty-eight browser cases, 508 unit tests, zero axe violations on every route, and a two-visitor live-board proof, all run against the deployed URL twice before every release. A person with no hands can grant, answer and book without touching anything.

## What we learned

The agent is the easy part. The hard part is a page that knows what an agent may do for this person, right now, and what must stay human, and says it in a way a visitor can check.

## What's next

A real switch and AAC user's session, recorded with their consent, and the changes it forces. Sign language when a recognizer exists that reads a language, not five shapes.

## Built with

Next.js 15 · TypeScript · WebMCP (`document.modelContext`) · Supabase (Postgres, RLS, realtime) · MediaPipe hand gestures · Web Speech API · OpenAI Realtime API over WebRTC · Vercel

## Scope, stated plainly

Cedarfield is a fictional practice. The other patients on the board are simulated and the page says so. No real appointment is made; the visitor's details never leave their browser. This is a proving ground for one pattern: a public website that gives a visitor's own agent safe, live, revocable capabilities and keeps every consequential decision with the person.
