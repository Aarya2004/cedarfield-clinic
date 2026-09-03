# Keeping Cedarfield up through judging (2026-09-03 → at least 2026-10-01)

The page must work for the general public with nobody touching it. This is what can take it down,
how each is covered, and what to do if it happens. Checked on 2026-09-03 ~15:00 PT.

## The live URL and how to tell it is healthy

- https://cedarfield-clinic.vercel.app/clinic/book (rokan-terminal.vercel.app serves the same build).
- The build number is printed at the foot of the page.
- `https://cedarfield-clinic.vercel.app/api/health` answers `{"ok":true,"board":"live","slots":N,...}`.
  Anything else is a fault; see below.
- Full proof, from a laptop with the repo: `node evals/verify-deployed.mjs --url=https://cedarfield-clinic.vercel.app`.

## What can fail, and the cover

| Risk | Cover | If it happens |
|---|---|---|
| **Supabase free project pauses after 7 idle days** | A Vercel cron calls `/api/health` daily at 09:00 UTC; it calls a service-role-only sweep (`clinic_health`), which counts as activity and advances the waves. Any real visitor does the same. | Supabase dashboard → project `cedarfield-clinic` → Restore. Takes ~2 min. |
| **Board offline** | The kill switch `clinic_settings.live` is `true`. Pages fall back to the seeded board if the live one is unreachable, so the page still works. | SQL: `update public.clinic_settings set live = true where key = 'board';` |
| **Voice quota** | 40 calls per visitor per day, 200 per day, fixed in SQL; counters are per day, so they reset by themselves. The page says "used up" and still works without voice. | Raise in `supabase/migrations/20260903050000_cedarfield_voice_quota_40.sql` and re-apply. |
| **OpenAI key** | Voice only. If the key is removed or the account has no balance, the voice button says it is not set up; everything else works. | Vercel → Environment Variables → `OPENAI_API_KEY`; redeploy. |
| **Supabase service key** | Voice tickets and the health route only. Without it the voice route says not set up; the board (anon key) is unaffected. | Vercel → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY`; redeploy. |
| **Table growth** | 6 slot rows per 6-minute wave ≈ 26k rows to Oct 1 (≈ 8 MB). Waitlist rows are deleted by the sweep. | Nothing to do. |
| **Anonymous users** | One per browser; Supabase free allows 50k monthly active. | Nothing to do at judging scale. |
| **Vercel bandwidth (Hobby, 100 GB/month)** | The camera model (~10 MB) is fetched at build and served from our origin only when a visitor enables the camera. | Vercel usage page; unlikely at judging scale. |
| **A redeploy changes behaviour** | Do not deploy during judging unless a judge reports a fault. Every deploy: `bash scripts/stamp-build.sh`, then `cd apps/web && vercel --prod --yes`, then `node evals/verify-deployed.mjs --url=https://cedarfield-clinic.vercel.app`. | Roll back in the Vercel dashboard → Deployments → previous → Promote. |
| **Repository** | https://github.com/Aarya2004/cedarfield-clinic, public. Do not rename or make private until judging ends. | — |

## Accounts that must stay active

Vercel (medportgeneral, project `rokan-terminal`), Supabase (project `hxqpaquhkmnrnjfutuyu`, "cedarfield-clinic",
us-east-1), OpenAI (the key in Vercel; voice only), GitHub (`Aarya2004/cedarfield-clinic`). None of them should
be deleted, downgraded, or have their keys rotated before 2026-10-01.

## Supabase advisor notes (2026-09-03), all intentional

`SECURITY DEFINER` procedures are executable by signed-in (anonymous) visitors on purpose: they ARE the
fairness rules. `clinic_settings`, the quota tables and the waitlist have RLS with no policies on purpose:
only the procedures and the service role touch them. There are no passwords, so leaked-password protection
does not apply.
