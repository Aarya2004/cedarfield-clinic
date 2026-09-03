# Devpost text — Cedarfield Clinic (final, 2026-09-03)

> Paste each section into its Devpost field. Live: https://cedarfield-clinic.vercel.app/clinic/book
> (the build number is at the foot of the page; verified on this domain 38/38). Repo: this one. Video: the link Aarya uploads.
> The final copy handed to Arav in chat on 2026-09-03 ~05:10 PT has no dashes or parentheses; prefer that version if the two differ.

## Tagline

A clinic page that gives your own agent real tools and never lets it book for you.

## Inspiration

There's a person in our family for whom talking takes time. Not thinking. Talking. And the web has quietly become a place that punishes that. Cancelled appointments get released at 8:00 and are gone by 8:01. Course seats, visa slots, concert tickets, same thing. If you use a switch, a head pointer, or voice control, you lose that race every single time, and nobody built the race with you in mind.

The strange part is that the same person already has an assistant that understands them perfectly well. It just can't do anything on a clinic's website except stare at the buttons and guess.

So we built the page we wished existed. Not an app you have to install, not the clinic's chatbot. A normal public booking page that, when you show up with your own agent, tells that agent exactly what it's allowed to do for you, and draws a line it can't cross.

## What it does

Cedarfield is a made-up clinic that releases cancelled appointments in waves, a few at a time. You open the booking page inside whatever agent you use (we recorded with Codex). Through WebMCP, the page hands your agent fourteen tools: read the board, find times, hold a slot for three minutes, let it go, wait for whatever you say to the page, ask you one question with two or three choices.

You talk to the page however you can. Type. Speak. Press a phrase. Hold up a hand shape and the camera reads it as a switch. If you can't type your name, a scanning keyboard opens and you pick letters with a thumbs-up and a fist, the same way switch users have typed for decades. Your agent takes each request, searches, holds a time, and when it needs a decision it asks you on the page, not in its own window. You answer with a button, a word, or a thumbs-up.

Here's the part we care about most. **When the page loads there is no booking tool.** None. Your agent can hold a slot and it can ask, but it cannot book. A booking tool only comes into existence when you do something an agent can't fake: press the button yourself, hold an open palm to the camera, or say a word that's shown on your screen and nowhere else. Then the tool lives for ten minutes, works once, and disappears. You can watch it appear as a gold chip on the page and watch it die when you take permission back. Cancelling and moving an appointment are never handed over at all.

If an agent tries to press the confirm button with a script, the page notices, refuses, and says so out loud. Every call your agent makes gets written on the page in plain English, with a little cursor that travels to whatever it touched, so you can see your assistant working instead of trusting it.

## How we built it

Next.js 15 on Vercel. The page registers tools with `document.modelContext`. The twelve tools that exist at load time are registered by an inline script in the HTML, before any JavaScript bundle runs, because we learned the hard way that agents which snapshot the tool list the instant a page opens will otherwise see nothing. The app takes over running those tools once it's hydrated. Three more sets of tools are born and die with the state of the page.

The board is shared between every visitor and lives in Supabase. Row-level security and `SECURITY DEFINER` procedures enforce the rules (one hold per person, hold before book, you can only cancel your own), so a clever client can't cheat a stranger out of a slot. Hand shapes come from MediaPipe, served from our own domain. Speech is the browser's own recognizer. The scanning keyboard is a hundred lines of state machine with tests.

Every number you see on the page, "1 interaction from you", "3 appointments left", "held for 2:41", is measured by the code that displays it. We didn't want a single decorative number.

## Challenges we ran into

The first-call problem above cost us a whole audit round. Three fresh loads, three failures, all because React hadn't hydrated yet.

"Yes" is a trap. It's the one word an agent can say too. We ended up with rules: a spoken yes only counts when the page itself asked a visible question, the microphone is ignored while the page is talking, the page's voice client can't run at the same time as its listener, and for a noisy room there's a word on screen you can say instead.

We wanted to call the hand shapes sign language and we can't. Five shapes are five switches, not a language, and the page says exactly that. It stung, but claiming ASL with a gesture model would have been a lie to the people we built this for.

And agents are slow. Ten to forty seconds per tool call in a chat client. Our forty-five second hold kept expiring while the agent was still telling the user about it. Holds are three minutes now, and the timer on screen is real.

## Accomplishments that we're proud of

We shipped twenty builds in one night and verified every one of them against the live URL before the next: a suite of 39 browser cases, 513 unit tests, an accessibility scan on every route, and a two-visitor test that books a slot from a second browser and watches the first one update. We had another agent audit the deployed page cold, three times in a row, and it found nothing above P3 on the last three passes.

And the thing itself works. Someone who cannot move their hands can open this page, type their name with two hand shapes, ask for a time with one finger, answer their agent's question with a thumbs-up, grant permission with an open palm, and get a booking with a reference number and a calendar file, without touching anything and without saying a word.

## What we learned

The agent was the easy part. Getting an agent to call tools is a weekend. The hard part was building a page that knows what an agent should be allowed to do for *this* person, right now, and can say it in a way the person can check. WebMCP gave us a way to make consent itself a tool, one that's born and dies. A scraper can't forge that. An API can't see it.

## What's next

Sit down with a real switch user and an AAC user, record it with their permission, and fix whatever they hate. Real sign language, the day a model can read one. And then every other page where people lose races they never should have had to run.

## Built with

Next.js 15, TypeScript, WebMCP (`document.modelContext`), Supabase (Postgres, RLS, realtime), MediaPipe hand gestures, Web Speech API, OpenAI Realtime API over WebRTC, Vercel.

## Honest scope

Cedarfield is fictional. The other patients you see taking slots are simulated, and the page says so in its footer. No real appointment is ever made and your details never leave your browser.
