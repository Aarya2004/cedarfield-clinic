# Devpost submission text — Cedarfield Clinic (2026-09-03, final)

> Paste each section into the matching Devpost field. True of production build `2fe0c0c` or newer; the
> build number is printed at the foot of the page. Live URL: https://cedarfield-clinic.vercel.app/clinic/book
> (also https://rokan-terminal.vercel.app/clinic/book). Repo: this one, public.

## Tagline

Your words, your agent, your final say: a public clinic page that gives a visitor's own agent safe live tools, and never lets it commit.

## Inspiration

Some people cannot reliably speak, type, or get through a long booking form: cerebral palsy, ALS, a stroke, a speech difference, or just a bad day. For them a web page that releases cancelled appointments in timed waves is not merely tiring. It is unwinnable. No switch, head pointer, or voice control has ever beaten a mouse in a race.

Many of those same people already have an agent that understands how they communicate. Public websites do not. They expose forms, dropdowns, timers, and a phone number. This project began with a family member for whom communication takes time and web workflows demand fast, precise clicks. We wanted one public page where a visitor arrives with their own agent and their own way of communicating, and the page meets both of them halfway, without ever handing the agent the right to decide.

## What it does

Cedarfield is a fictional clinic that releases cancelled appointments in waves. A visitor opens the booking page inside their own agent's browser. Through WebMCP the page tells that agent exactly what it may do right now: see the board, find times, hold and release a slot, wait for the person's words, and ask them one bounded question.

The visitor talks to the page however works for them: typing, speaking, a hand shape the camera reads as a switch, or a scanning keyboard driven by two of those shapes, the way switch users type today. The agent takes each request from the page, searches, holds a time, and can ask back through the page. The visitor answers by button, key, voice, or hand.

What the agent cannot do is commit. **There is no booking tool when the page loads.** One is born only from an act a person performs: a trusted press, an open palm held to the camera, or a word shown on screen that only they can see. It lives ten minutes, books once, and dies on use, revoke, or expiry. Cancel and move are never delegated. A permission card shows the contract at every moment: can, cannot, until. The tool surface is on the page too, as a row of chips: when the person grants, a gold chip appears, "born from your press"; when they take it back, it fades. A scripted press is counted and refused, out loud. Every call the agent makes is written on the page in plain words, and a cursor travels to whatever it touched.

## How we built it

Next.js 15 on Vercel. The page registers its tools with `document.modelContext`, the imperative WebMCP API. The twelve load-time tools are registered by an inline script under the page's CSP nonce before any bundle runs, so they exist in a client's very first snapshot, and the app takes over their execution when it hydrates. Three further tool sets are born and die with page state: the queue verbs on the shared board, the booking tool under a grant, and the appointment tool after a booking.

A shared live board runs on Supabase with row-level security and `SECURITY DEFINER` procedures, so fairness between strangers, one hold each, hold before book, only your own booking cancels or moves, is enforced by the database rather than the client. The page reads intent through the browser's speech recogniser, MediaPipe hand-shape recognition served from our own origin, and a row-column scanning keyboard. Every number on screen is measured by the code that shows it.

## Challenges we ran into

Registering tools after hydration lost the first call of any client that snapshots at navigation. The fix was to register from the HTML itself.

A page-defined "yes" is the one word an agent can also say. So the spoken answer accepts "yes" only where the page asked a visible question, ignores the microphone while the page itself is talking, keeps the voice client off while the page listens, and offers a word shown on screen for a noisy room.

Five camera shapes are not a language, and the page says so. They are five switches the visitor labels, or asks their agent to label.

Chat clients take ten to forty seconds per tool call. A 45-second hold was expiring while the agent was still describing it. Holds are now three minutes, measured, not guessed.

## Accomplishments that we're proud of

Three consecutive clean independent audits on production by another agent, with no P1 and no P2. Tools present in the first snapshot on every fresh load of the live board. 513 unit tests, 39 browser cases, zero accessibility violations on every route, and a two-visitor live-board proof, all run against the deployed URL before every release, twenty releases in one night, each verified. A person with no hands can enter their name, ask for a time, answer the agent's question, grant, and book without touching anything, and the page never claimed a language it cannot read.

## What we learned

The agent is the easy part. The hard part is a page that knows what an agent may do for this person, right now, and what must stay human, and says it in a way the visitor can check. WebMCP made that expressible: consent became a tool that is born and dies, which no scraper can fake and no developer API can see.

## What's next

A session with a real switch and AAC user, recorded with their consent, and the changes it forces. Sign language, when a recogniser exists that reads a language rather than five shapes. And the same pattern on the other pages where people lose races they should never have had to run: visa slots, course registration, ticket drops.

## Built with

Next.js 15 · TypeScript · WebMCP (`document.modelContext`) · Supabase (Postgres, RLS, realtime) · MediaPipe hand gestures · Web Speech API · OpenAI Realtime API over WebRTC · Vercel

## Scope, stated plainly

Cedarfield is a fictional practice. The other patients on the board are simulated and the page says so. No real appointment is made; the visitor's details never leave their browser.
