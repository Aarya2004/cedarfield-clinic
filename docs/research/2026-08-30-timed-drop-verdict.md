# The timed drop vs the drag calendar — rivals, MediaPipe facts, verdict (Opus 5, 2026-08-30 ~16:30 PT)

Both research streams are back. Here is the full answer.

---

# A. IN-WINDOW RIVALS

**Sweep method:** `gh api search/repositories` over `created:2026-08-15..2026-09-05`, `in:name,description,readme`, across booking/reservation/appointment/slot/hold/calendar/schedule/reschedule/gesture/mediapipe/webcam/switch-access/dwell/eye-tracking/motor-impairment. Booking is the single most crowded theme (`webmcp schedule` = 90 in-window repos, `webmcp slot` = 57, `webmcp booking` = 55).

### Direct threats

| Repo | Created | One line | Live | (i) TTL hold | (ii) gesture/cam | (iii) human gate | (iv) forged tools |
|---|---|---|---|---|---|---|---|
| [MyTelexGlobal/latch](https://github.com/MyTelexGlobal/latch) | 08-30 | Live deal board; agent rewrites terms, **"HOLD latches one card"** and its write tools vanish | [latch.aa-c41.workers.dev](https://latch.aa-c41.workers.dev) (200) | Lock, not TTL | No | **Yes — "HOLD is a human gesture, not an agent tool"**, uses `requestUserInteraction` | Tools withdrawn dynamically, not forged |
| [skaiea13-ai/seriessafe](https://github.com/skaiea13-ai/seriessafe) | 08-29 | Move a recurring event without losing exceptions/make-ups/room changes | none listed | No | No | Yes | **Yes-adjacent** — `commit_staged_split` *does not exist* until validation passes; `undo_series_split` registers only when revertible |
| [Aj-Fishman/CoursePilot](https://github.com/Aj-Fishman/CoursePilot) | 08-28 | Course registration, scarce seats, agent stages → **"only the student can confirm"** | [coursepilot-webmcp.vercel.app](https://coursepilot-webmcp.vercel.app) (200) | No | No | Yes | No |
| [coreyhiggins/accesspath](https://github.com/coreyhiggins/accesspath) | 08-26 | Group planner where **accessibility/sensory/capacity needs are first-class inputs**; judge script literally says *"hold the best option, but don't book anything without me"* | [accesspath.pages.dev](https://accesspath.pages.dev/) (200) | Soft hold | No | Yes | No |
| [sergej87342-a11y/WebMCP-Challenge-2026](https://github.com/sergej87342-a11y/WebMCP-Challenge-2026) | 08-28 | Salon booking; human approves, UI issues **one-time confirmation token**, then `create_booking` | Cloudflare Workers | No | No | Yes (token-gated) | No |
| [pollychen-lab/TheraSync](https://github.com/pollychen-lab/TheraSync) | 08-29 | Therapist matching + intake booking, Postgres, **slot locking + consent auditing** | Docker | Yes (server lock) | No | Yes | No |
| [JEROME-PRAKASH-L/community-tool-library-webmcp](https://github.com/JEROME-PRAKASH-L/community-tool-library-webmcp) | 08-26 | Approval-gated reservations, overlap protection | [live](https://community-tool-library-webmcp.vercel.app/) | No | No | Yes | No |
| [khalid-hasan/the-line](https://github.com/khalid-hasan/the-line) | 08-29 | Kitchen expo rail; **FIRE/HOLD/PLATE** states, live timers, thesis is *"hands-busy — the person at the stove cannot type"* | — | Hold state + ticking timers | No | Yes | No |
| [raintree-technology/flightsweeper-webmcp](https://github.com/raintree-technology/flightsweeper-webmcp) | 08-26 | Bounded autonomous flight purchasing; traveler sets revocable limits | [webmcp.flightsweeper.com](https://webmcp.flightsweeper.com) | No | No | Yes | No |

### The one rival with a real camera

**[romiteld/commandcanvas](https://github.com/romiteld/commandcanvas)** (08-27, live [demo](https://commandcanvas.vercel.app/demo), 200) is the **only in-window WebMCP repo shipping `@mediapipe/tasks-vision@1.0.1`**. It runs Hand Landmarker in a Web Worker with pinch hysteresis, open-palm state, calibration E2E tests, and a documented `lib/gesture/spatial-vision-engine.ts` contract ([benchmark doc](https://github.com/romiteld/commandcanvas/blob/main/docs/spatial-vision-engine-benchmark.md)). **But**: it's a spatial drawing canvas, zero accessibility framing, and hands are an *authoring* input, not a *confirm gate*. Good news — the exact combination is unclaimed. Bad news — "we're the only ones with a webcam" is already false.

### Forge rivals (relevant to "recurring booking forged into a one-gesture tool")

- **[DITlieD/understudy](https://ditlied.github.io/understudy/)** (08-28, live, 200) — *"Show a support procedure once. The page registers it as a WebMCP tool."* Human demonstrates → agent names it → human approves → `registerTool()`, IndexedDB persistence, 16-tool cap, per-tool `AbortController`, fail-and-repair re-teach. This is a polished, shipped version of the forge thesis.
- [hayashiii-ghub/teachback-webmcp](https://teachback-webmcp.haygsiiii.chatgpt.site/) (08-28) — demonstrations → constrained reusable rules.
- [HarzerHeribert/webMCP](https://webmcp-weld.vercel.app) (08-29) — *"a compiler from human intent to a live, bounded WebMCP tool contract."*

### Known a11y entries — gesture re-check

I scanned repo trees + code search for `mediapipe|getUserMedia|GestureRecognizer|camera|webcam|dwell|switch` across **A11yMCP, tweaksy-live, curbcut, accesspath, accesscart, spacienta, inclusivepatch, equaltrace**. **Result: zero gesture or camera input in any of them.** All are semantic/DOM-layer accessibility:

- [TusharTechs/A11yMCP](https://a11ymcp.vercel.app) (08-29) — sites declare accessibility *capabilities* as tools; agent negotiates, adapts, verifies task completion. Ships a WebMCP-vs-actuation eval harness.
- [YoavAlro/tweaksy-live](https://tweaksy-live.yoavalro.chatgpt.site/) (08-28) — color-vision/low-vision/read-aloud adaptation via tools; explicitly disclaims replacing a screen reader.
- [nbobby07/curbcut](https://curbcut-one.vercel.app) (08-27) — axe-core repair workbench, developer-facing.
- [Aarush-Dubey/accesscart-accessible-shopping](https://github.com/Aarush-Dubey/accesscart-accessible-shopping) (08-28) — capability-aware product fit.
- Also: [tokoh-ai/spacienta](https://spacienta.vercel.app), [1aifanatic/inclusivepatch](https://github.com/1aifanatic/inclusivepatch-webmcp-challenge), [ricardoNP51/equaltrace-webmcp](https://ricardonp51.github.io/equaltrace-webmcp/) (parity across human/assistive/agent routes).

**Side finding, flag to Aarya:** `Aarya2004/webmcp-private` (created 08-28) is a **public** GitHub repo.

---

# B. SPONSOR OVERLAP — the honest answer is bad

**Mabel's Table.** I pulled the shipped bundle (`/assets/index-BeShSkui.js`). Exact tools:

```
mabel_check_availability
mabel_hold_table            ← "Place a five-minute hold on an available seating time."
mabel_confirm_reservation   ← "Confirm an active hold after the user provides the guest name…"
mabel_cancel_reservation
mabel_lookup_reservation
mabel_reschedule_reservation
```

Internals contain `holdToken`, `ttl`, `expires`, `expired`, `holder`. **It is a working TTL hold state machine — five-minute holds, token-passed to confirm.** Netlify's own writeup: agents "can hit a fully booked slot, negotiate alternatives, **place holds**, confirm or cancel bookings" against "live reservation state" ([blog](https://www.netlify.com/blog/compete-openai-webmcp-challenge/)). **No accessibility framing. No gesture. And no human gate — `mabel_confirm_reservation` is an agent tool.**

**Chrome Labs** ([AWESOME_WEBMCP.md](https://github.com/GoogleChromeLabs/webmcp-tools/blob/main/AWESOME_WEBMCP.md)) — booking is *the* canonical demo category: [Le Petit Bistro](https://googlechromelabs.github.io/webmcp-tools/demos/french-bistro/) (restaurant reservation), [CineFlow](https://googlechromelabs.github.io/webmcp-tools/demos/ticket-booking/) (showtimes → checkout), [L'Atelier Hotel Chain](https://googlechromelabs.github.io/webmcp-tools/demos/hotel-chain/), [React Flight Search](https://googlechromelabs.github.io/webmcp-tools/demos/react-flightsearch/), [zaMaker](https://googlechromelabs.github.io/webmcp-tools/demos/pizza-maker/), [Flight booking](https://webmcp-flight-demo.netlify.app/). **None do holds. None do gesture.** Notably [WebMCP Maze](https://googlechromelabs.github.io/webmcp-tools/demos/webmcp-maze/) is already "navigate entirely by prompting — no keyboard or mouse."

**WanderNote** — OpenAI's own showcase ([developers.openai.com/showcase/wandernote](https://developers.openai.com/showcase/wandernote), [live](https://wandernote.openai.chatgpt.site/)). 11 tools including `list_time_slots`, `add_itinerary_activity`, `update_itinerary_activity`, `remove_itinerary_activity`, `get_traveler_feedback`. **That is finalist 2 — a time-slot editor with agent-proposes/human-comments — already built by OpenAI as the reference implementation.** No holds, no gesture.

### Is "the accessibility answer to the race, with gesture commit + forged repeat-booking" defensibly different from Mabel's Table?

**Honestly: partially, and not enough on its own.** Strip it down —

- TTL hold state machine → **Mabel's has it.** Five minutes. Shipped by a judging sponsor with readable source.
- Reschedule tool → **Mabel's has it.**
- Human-gated consequential confirm → **table stakes.** It is the single most common phrase in this hackathon; I counted it in CoursePilot, latch, accesspath, salon-booking, community-tool-library, TheraSync, flightsweeper, teachback, understudy, and ~a dozen more. It differentiates you from Mabel's Table and from nobody else.
- Forged repeat-booking tool → **Understudy already ships this**, live, with persistence and repair.
- Gesture/switch confirm channel → **genuinely unclaimed** in the a11y cohort; only commandcanvas has a camera at all.
- **Contention/scarcity — slots actually vanishing under a competing claimant** → **unclaimed.** Mabel's holds a table; nothing in this field makes you *lose the race*.

So a judge who knows Mabel's Table — and Netlify is a judge — will file it as **"Mabel's Table with a webcam"** unless two things are true on screen in the first ten seconds: (1) the slot is *contested* and visibly lost when you're slow, which Mabel's never shows; (2) the confirm channel is the *point*, not a garnish. If your demo is "agent finds a table, I nod, booked," that is Mabel's Table with a webcam, and it will be scored as such.

---

# C. MEDIAPIPE FACTS

- **Package:** `@mediapipe/tasks-vision@1.0.1`, **Apache-2.0**, unpacked **35.1 MB** ([npm](https://www.npmjs.com/package/@mediapipe/tasks-vision)). `vision_bundle.mjs` = **152 KB** uncompressed. Runtime fetches **one** wasm: `vision_wasm_internal.wasm` **11.2 MB** (nosimd fallback 10.5 MB) + ~323 KB loader ([jsDelivr manifest](https://data.jsdelivr.com/v1/packages/npm/@mediapipe/tasks-vision@1.0.1)).
- **Models (verified `content-length`):** `gesture_recognizer.task` float16 = **8.0 MB**; `face_landmarker.task` float16 = **3.6 MB**; `hand_landmarker.task` = **7.5 MB**. So a gesture-confirm page is **~19 MB cold** before first frame.
- **Model licence is NOT confirmed Apache-2.0.** Code is Apache-2.0 ([LICENSE](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE)); the `.task` weights fall under the separate [MediaPipe APIs ToS](https://ai.google.dev/edge/mediapipe/legal/tos), which also states the API contacts Google servers for model updates **and sends metrics**. Self-host the `.task` files and say so.
- **Load time:** [google-ai-edge/mediapipe#5171](https://github.com/google-ai-edge/mediapipe/issues/5171) — "30+ seconds to load the first time," filed Feb 2024, stale-bot closed with **no root cause and no fix**, reporter pinged twice with no Google reply, still labeled `stat:awaiting googler`. It was iOS webview + CPU delegate; **GPU-vs-CPU was never addressed in the thread.** Treat first load as multi-second-to-catastrophic and preload behind a visible progress state.
- **FPS:** official benchmark (Pixel 6, inference only) — GestureRecognizer **CPU 16.76 ms / GPU 20.87 ms**, i.e. **GPU is slower** for this model ([docs](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer)). ~60 fps inference budget on a laptop is realistic. **No published FaceLandmarker latency table, no published battery numbers.**
- **Canonical gesture labels (exact):** `["None", "Closed_Fist", "Open_Palm", "Pointing_Up", "Thumb_Down", "Thumb_Up", "Victory", "ILoveYou"]` ([web_js guide](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)).
- **Head nod is not a blendshape.** FaceLandmarker emits 52 ARKit blendshapes ([source](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/face_landmarker/face_blendshapes_graph.cc)); a nod requires `outputFacialTransformationMatrixes` plus your own velocity/threshold detector. Best single-blendshape confirms: `browInnerUp`, or `eyeBlinkLeft`+`eyeBlinkRight` together. **Blink is a trap** — people blink 15–20×/min, so you need a held blink, which is uncomfortable; blink-HCI literature reports false-positive rates 5.6%–46.5% depending on movement type.
- **getUserMedia in ChatGPT desktop's built-in browser: UNKNOWN. This is the load-bearing unknown and the evidence leans negative.** OpenAI's own [WebMCP docs](https://learn.chatgpt.com/docs/webmcp) specify GPT-5.6 Sol/Terra, top-level JS registration, no declarative, no iframes — and contain **zero mention of camera, microphone, getUserMedia, or WebRTC**. The Help Center article 403s to automated fetch. Press describes the surface as an Electron `<webview>`/BrowserView; Electron's default `media` permission handler **denies unless the host app calls `session.setPermissionRequestHandler()`**, and there is no evidence OpenAI has. Closest concrete data point is the adjacent-but-different Apps SDK iframe, where developers report the camera prompt **never appearing** and `NotAllowedError` ([thread](https://community.openai.com/t/camera-permission-dont-pop-up-in-chatgpt-apps-widget-in-mobile-mode/1379646)). Suggestive, not conclusive. **Do not architect around camera working in the judging surface.**
- **Gesture-only confirm is an accessibility failure, not an accessibility feature.** WCAG 2.2 [SC 2.5.1 Pointer Gestures (A)](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html), [SC 2.5.4 Motion Actuation (A)](https://www.w3.org/WAI/WCAG22/Understanding/) — motion-triggered functionality must have a UI alternative **and be disableable** — and [SC 2.5.7 Dragging Movements (AA)](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). The people you are targeting (ALS, Duchenne, CP, high SCI) frequently cannot produce *any* specific voluntary movement on demand, and tremor/spasticity/dystonia will fire false positives on exactly the gesture you chose. **Switch + keyboard must be the primary path; camera is the enhancement.** Ship a visible per-user threshold control. If an a11y-literate judge sees camera-gesture as the only commit path, the accessibility framing inverts into the critique.

---

# D. PRIOR ART OUTSIDE THE WINDOW

**Accessible appointment racing: no such product exists.** Closest is the 2021 vaccine-finder cohort — [TurboVax](https://news.yahoo.com/software-engineer-made-bot-called-145150511.html), [VaccinateCA](https://github.com/usdigitalresponse/vaccine-finder-tools), [Dr. B](https://time.com/5945095/dr-b-vaccine-standby-list/) — which *notify*, never hold-and-commit; one builder explicitly cited people who "can't type fast enough." The [NHS App accessibility statement](https://www.nhs.uk/nhs-app/about/nhs-app-legal-and-cookies/nhs-app-accessibility-statement/) admits WCAG 2.2 §2.1.1 keyboard failures — the incumbent booking surface is itself not motor-accessible. **Real whitespace.**

**Auto-booking bots — the optics are worse than you think.** Campsite tools ([Campnab](https://campnab.com/)) deliberately *only notify* and press defends them on exactly that basis ([Here & There](https://www.hereandthere.club/p/no-bots-probably-didnt-take-your)). Everything that auto-grabs is now legislated against: ticket bots are a federal crime under the 2016 BOTS Act with [FTC's first enforcement in 2021](https://www.ftc.gov/news-events/news/press-releases/2021/01/ftc-brings-first-ever-cases-under-bots-act) and [renewed 2025–26 pressure](https://www.cnbc.com/2026/06/27/ticket-bots-concert-scalpers-ticketmaster-china-korea.html); NY's [Restaurant Reservation Anti-Piracy Act](https://spectrumlocalnews.com/nys/central-ny/politics/2024/12/19/hochul-signs-bill-on-third-party-restaurant-reservations) (Dec 2024, $1,000/listing) was written at [Appointment Trader](https://en.wikipedia.org/wiki/Appointment_Trader); Florida/Nevada/Miami-Dade criminalized [DMV appointment scalping](https://www.carscoops.com/2025/03/florida-cracks-down-on-scalpers-reselling-dmv-appointments-for-250/). **2024–2026 is precisely the window in which "a bot grabs a scarce slot before a human can" became the legislated villain.** Own agent, own account, no resale, human performs the consequential act, motor-impairment framing — say all four in the first ten seconds or a news-literate judge marks you down.

**AI calendar movers: solved and consolidating.** Motion, [Reclaim](https://reclaim.ai/compare/motion-alternative) (880M conflicts auto-rescheduled), Clockwise — and [Clockwise shut down March 27 2026 after a Salesforce acquihire](https://news.ycombinator.com/item?id=47402579), folding into Agentforce. Gemini in Google Calendar does suggested-time and auto-reschedule natively.

**The commit gesture is already an OS primitive.** Apple Eye Tracking with Dwell Control (iOS 18+), Switch Control dwell-select, [Windows Eye Control](https://support.microsoft.com/en-us/accessibility/windows/eye-control/eye-control-basics-in-windows), [Google Project Gameface](https://developers.googleblog.com/en/project-gameface-launches-on-android/) (which is MediaPipe face-gesture cursor — literally your stack, shipped by Google, open source). A judge will say "the OS already does this." Your novelty can only be in **what** is confirmed, never in **how**.

**Nearest mechanism precedent:** a [LangGraph+MCP scheduling agent](https://www.k5n.us/2026/07/16/human-in-the-loop-scheduling-agent/) (Jul 2026) already does agent-proposes → durable checkpoint → human y/n for calendar writes. Text-based, not WebMCP, not gesture, not a11y-framed.

**Novelty scores:**
- **Finalist 1 (timed drop): 6/10.** Every component is prior art; the *composition* — contested TTL hold + accessible single-input commit, framed for motor impairment — is unclaimed. Below your stated 8 bar. Above the hackathon field's median.
- **Finalist 2 (drag calendar): 3/10.** OpenAI's own WanderNote showcase plus Motion/Reclaim/Clockwise plus Google Calendar. A UI wrapper on a solved problem. **Reject.**

---

# E. VERDICT

**Winner: (1) the timed drop.** Not close.

| | WebMCP Leverage | Execution | Impact | Creativity | Total |
|---|---|---|---|---|---|
| **Timed drop** | **6** | **7** | **8** | **5** | **26** |
| Drag calendar | 4 | 7 | 5 | 3 | 19 |

**Timed drop — why each score.**
- *Leverage 6* — the honest tie-break answer is uncomfortable: the **gesture channel is not WebMCP**, it's a normal web page, and Mabel's Table proves plain WebMCP already does holds. Your only true "nothing but WebMCP" claim is that `confirm` is **not a registered tool at all** while `hold` is — the agent can *see* the slot is held and *cannot* take it, and the tool list changes as the TTL burns down.
- *Execution 7* — small, demoable, seeded, no auth; the ~19 MB MediaPipe cold start and camera permission are the only real build risks.
- *Impact 8* — a specific audience that provably cannot win a manual click-race, against a booking surface that [admits its own keyboard failures](https://www.nhs.uk/nhs-app/about/nhs-app-legal-and-cookies/nhs-app-accessibility-statement/). Strongest of the four.
- *Creativity 5* — the sponsor already shipped the mechanic; you are adding a gate and a camera.

**Drag calendar — why it loses.** OpenAI built it as the reference showcase (WanderNote's `list_time_slots` / `update_itinerary_activity`), the AI-moves-your-calendar category is consolidating into Google and Salesforce, and SeriesSafe already occupies the one genuinely hard corner (recurrence exceptions) with better engineering than you'll produce in the remaining time.

**Single biggest risk of the winner: `getUserMedia` in ChatGPT desktop's built-in browser is unverified, and the closest analogous OpenAI surface fails with `NotAllowedError` and no visible permission prompt.** If the camera is dead in the judging surface, the differentiator is invisible to the judges and you ship Mabel's Table with a human gate. **Mitigation is non-optional and also happens to be the correct accessibility design:** switch/keyboard/single-key is the primary commit path and works with zero permissions; the camera is a progressive enhancement that upgrades in-place when `getUserMedia` resolves. Test this on the deployed URL in ChatGPT desktop **today** — it is a gate-A-class question, not a polish question.

**Honest first sentence of the README:**

> A booking page where the agent can find a slot and hold it for ninety seconds, but cannot take it — the only thing that books the slot is one switch press, one key, or one held gesture from the person the slot is for.

Note what it does **not** claim: no speed, no winning, no autonomy. That sentence is also your defence against both the Appointment-Trader read and the "Mabel's Table with a webcam" read, so put it above the fold on the page, not just in the repo.

**Sources:** [Netlify WebMCP blog](https://www.netlify.com/blog/compete-openai-webmcp-challenge/) · [Mabel's Table](https://webmcp-mabels-table.netlify.app/) · [AWESOME_WEBMCP](https://github.com/GoogleChromeLabs/webmcp-tools/blob/main/AWESOME_WEBMCP.md) · [WanderNote showcase](https://developers.openai.com/showcase/wandernote) · [OpenAI WebMCP docs](https://learn.chatgpt.com/docs/webmcp) · [Challenge rules](https://webmcp.devpost.com/rules) · [tasks-vision npm](https://www.npmjs.com/package/@mediapipe/tasks-vision) · [MediaPipe #5171](https://github.com/google-ai-edge/mediapipe/issues/5171) · [Gesture Recognizer web guide](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js) · [MediaPipe ToS](https://ai.google.dev/edge/mediapipe/legal/tos) · [WCAG 2.2 Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html) · [WCAG 2.2 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) · [ChatGPT camera thread](https://community.openai.com/t/camera-permission-dont-pop-up-in-chatgpt-apps-widget-in-mobile-mode/1379646) · [FTC BOTS Act](https://www.ftc.gov/news-events/news/press-releases/2021/01/ftc-brings-first-ever-cases-under-bots-act) · [NY reservation law](https://spectrumlocalnews.com/nys/central-ny/politics/2024/12/19/hochul-signs-bill-on-third-party-restaurant-reservations) · [Clockwise shutdown](https://news.ycombinator.com/item?id=47402579) · [Project Gameface](https://developers.googleblog.com/en/project-gameface-launches-on-android/)