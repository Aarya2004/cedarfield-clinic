# Devpost text — Cedarfield Clinic (final copy, 2026-09-03)

Paste each section into its Devpost field. Live URL for the form: https://cedarfield-clinic.vercel.app/clinic/book
The build number is printed at the foot of the page. Video: the link Aarya uploads.

TAGLINE
A clinic page that gives your own agent real tools and never lets it book for you.

INSPIRATION
Someone in our family needs time to talk. Not to think, to talk. The web punishes that more every year. Cancelled appointments go up at 8:00 and are gone by 8:01. Course seats, visa slots, concert tickets, same story. If you use a switch, a head pointer or voice control you lose that race every time, and nobody who built the race was thinking about you.

The odd thing is that this same person already has an assistant that understands them fine. It just cannot do anything on a clinic website except look at the buttons and guess.

So we built the page we wished existed. Not an app you install and not the clinic's chatbot. A normal public booking page that, when you turn up with your own agent, tells that agent exactly what it may do for you and draws a line it cannot cross.

WHAT IT DOES
Cedarfield is a made up clinic that releases cancelled appointments in waves, a few at a time. You open the booking page inside whatever agent you use. We recorded ours with Codex. Through WebMCP the page hands your agent fourteen tools. It can read the board, find times, hold a slot for three minutes, let it go, wait for whatever you say to the page, and ask you one question with two or three choices.

You talk to the page however you can. Type. Speak. Press a phrase. Hold up a hand shape and the camera reads it as a switch. If you cannot type your name, a scanning keyboard opens and you pick letters with a thumbs up and a fist, the way switch users have typed for decades. Your agent takes each request, searches, holds a time, and when it needs a decision it asks you on the page instead of in its own window. You answer with a button, a word or a thumbs up.

This is the part we care about most. When the page loads there is no booking tool. None. Your agent can hold a slot and it can ask, but it cannot book. A booking tool only comes into existence when you do something an agent cannot fake. You press the button yourself, or hold an open palm to the camera, or say a word that is shown on your screen and nowhere else. Then the tool lives for ten minutes, works once, and disappears. You can watch it appear as a gold chip on the page and watch it die when you take permission back. Cancelling and moving an appointment are never handed over at all.

If an agent tries to press the confirm button with a script, the page notices, refuses, and says so on screen. Every call your agent makes is written on the page in plain English, and a small cursor travels to whatever it touched, so you can see your assistant working instead of taking its word for it.

Cedarfield is fictional. The other patients you see taking slots are simulated and the page says so in its footer. No real appointment is ever made and your details never leave your browser.

HOW WE BUILT IT
Next.js 15 on Vercel. The page registers tools with document.modelContext. The twelve tools that exist at load time are registered by an inline script in the HTML before any JavaScript bundle runs. We learned that the hard way. An agent that snapshots the tool list the instant a page opens would otherwise see nothing. The app takes over running those tools once it has hydrated. Three more sets of tools are born and die with the state of the page.

The board is shared between every visitor and lives in Supabase. Row level security and security definer procedures enforce the rules. One hold per person. Hold before you book. You can only cancel your own. A clever client cannot cheat a stranger out of a slot. Hand shapes come from MediaPipe, served from our own domain. Speech is the browser's own recognizer. The scanning keyboard is a hundred lines of state machine with tests.

Every number you see on the page is measured by the code that displays it. One interaction from you. Three appointments left. Held for 2:41. We did not want a single decorative number.

CHALLENGES WE RAN INTO
The first call problem above cost us a whole audit round. Three fresh loads, three failures, all because React had not hydrated yet.

Yes is a trap. It is the one word an agent can say too. So a spoken yes only counts when the page itself asked a visible question. The microphone is ignored while the page is talking. The page's voice client cannot run at the same time as its listener. For a noisy room there is a word on screen you can say instead.

We wanted to call the hand shapes sign language and we cannot. Five shapes are five switches, not a language, and the page says exactly that. It stung. Claiming ASL with a gesture model would have been a lie to the people we built this for.

Agents are slow. Ten to forty seconds per tool call in a chat client. Our forty five second hold kept expiring while the agent was still telling the user about it. Holds are three minutes now and the timer on screen is real.

ACCOMPLISHMENTS THAT WE'RE PROUD OF
We shipped twenty builds in one night and verified every one of them against the live URL before the next. Thirty nine browser cases, 513 unit tests, an accessibility scan on every route, and a two visitor test that books a slot from a second browser and watches the first one update. We had another agent audit the deployed page cold, three times in a row. On the last three passes it found nothing above P3.

And the thing works. Someone who cannot move their hands can open this page, type their name with two hand shapes, ask for a time with one finger, answer their agent's question with a thumbs up, grant permission with an open palm, and get a booking with a reference number and a calendar file. Without touching anything and without saying a word.

WHAT WE LEARNED
The agent was the easy part. Getting an agent to call tools is a weekend. The hard part was a page that knows what an agent should be allowed to do for this person right now, and can say it in a way the person can check. WebMCP let us make consent itself a tool, one that is born and dies. A scraper cannot forge that. An API cannot see it.

WHAT'S NEXT
Sit down with a real switch user and a real AAC user, record it with their permission, and fix whatever they hate. Real sign language the day a model can read one. Then every other page where people lose races they should never have had to run.

BUILT WITH
Next.js 15, TypeScript, WebMCP, Supabase, MediaPipe, Web Speech API, OpenAI Realtime API, Vercel
