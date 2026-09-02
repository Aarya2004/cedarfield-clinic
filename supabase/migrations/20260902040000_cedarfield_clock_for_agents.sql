-- The clock, retuned for the judged client (2026-09-02). Applied as `cedarfield_clock_for_agents`.
-- ChatGPT desktop's per-call latency was measured at 10–39 s (docs/evidence/clinic/
-- 2026-09-02-chatgpt-desktop-transcript.md): a 45 s hold had 31 s left by the time the agent finished
-- reporting it, and a 90 s wave rolled between two answers. Holds are now 90 s and waves 180 s. The
-- page's constants (components/clinic/wave-clock.ts, lib/drop/supabase-driver.ts) changed in the same
-- commit so every countdown agrees with the server. The rival still takes at +6 s / +20 s / +34 s.

create or replace function public.clinic_wave_at(at timestamptz)
returns bigint language sql immutable set search_path = '' as
$$ select floor(extract(epoch from at) * 1000 / 180000)::bigint $$;

create or replace function public.clinic_wave_start(wave bigint)
returns timestamptz language sql immutable set search_path = '' as
$$ select to_timestamp(wave * 180.0) $$;

-- clinic_sweep and clinic_hold: byte-identical to 20260902010000_cedarfield_cascade_hardening.sql
-- except `interval '45 seconds'` → `interval '90 seconds'` (three occurrences).
create or replace function public.clinic_sweep()
returns void language plpgsql security definer set search_path = '' as $$
declare
  w bigint := public.clinic_wave_at(now());
  ws timestamptz := public.clinic_wave_start(w);
  i int; h int; m int; seed bigint; offs int; rival_slot boolean; take_at timestamptz; rank int;
  clinicians text[] := array['Dr. Alvarez','Dr. Boone','Dr. Chatterjee','Dr. Duarte','Dr. Eriksson','Dr. Fanning'];
  kinds text[] := array['New patient','Follow-up','Consult'];
  r record; st text; granted boolean;
begin
  offs := (abs(hashtextextended(w::text, 0)) % 6)::int;
  for i in 0..5 loop
    seed := abs(hashtextextended(w::text || ':' || i::text, 0));
    h := 8 + ((i * 20 + 40) / 60); m := (40 + i * 20) % 60;
    rival_slot := (i = offs) or (i = (offs + 2) % 6) or (i = (offs + 4) % 6);
    rank := case when i = offs then 0 when i = (offs + 2) % 6 then 1 else 2 end;
    take_at := case when rival_slot then ws + interval '6 seconds' + (rank * interval '14 seconds') else null end;
    insert into public.clinic_slots (id, wave, idx, time_label, clinician, kind, rival_take_at)
    values (
      'w' || w || '-s' || (i + 1), w, i,
      h::text || ':' || lpad(m::text, 2, '0') || ' AM',
      clinicians[1 + (seed % 6)::int],
      kinds[1 + ((seed / 7) % 3)::int],
      take_at
    )
    on conflict (wave, idx) do nothing;
  end loop;

  update public.clinic_slots
    set state = 'open', holder = null, hold_expires_at = null, updated_at = now()
    where state = 'held' and hold_expires_at < now();

  -- THE CASCADE, race-safe: lock the slot, re-check it is still open, only then give the waiter's
  -- other hold back and hand this one over; a lost race leaves their place in line intact, and a
  -- unique/deadlock collision skips this waiter rather than failing the caller's read.
  for r in
    select distinct on (wl.slot_id) wl.slot_id, wl.visitor
    from public.clinic_waitlist wl
    join public.clinic_slots s on s.id = wl.slot_id
    where s.state = 'open' and s.wave = w
    order by wl.slot_id, wl.joined_at, wl.visitor
  loop
    begin
      select s2.state into st from public.clinic_slots s2 where s2.id = r.slot_id for update;
      if st is distinct from 'open' then continue; end if;
      update public.clinic_slots set state = 'open', holder = null, hold_expires_at = null, updated_at = now()
        where state = 'held' and holder = r.visitor;
      update public.clinic_slots
        set state = 'held', holder = r.visitor, hold_expires_at = now() + interval '90 seconds', updated_at = now()
        where id = r.slot_id and state = 'open';
      granted := found;
      if granted then
        delete from public.clinic_waitlist where slot_id = r.slot_id and visitor = r.visitor;
      end if;
    exception when unique_violation or deadlock_detected then
      null; -- this waiter's turn comes on the next sweep; nobody else's read fails
    end;
  end loop;

  update public.clinic_slots s
    set state = 'rival', updated_at = now()
    where s.wave = w and s.state = 'open' and s.rival_take_at is not null and s.rival_take_at < now()
      and not exists (select 1 from public.clinic_waitlist wl where wl.slot_id = s.id)
      and (select count(*) from public.clinic_slots o where o.wave = w and o.state = 'open') > 1;

  delete from public.clinic_waitlist wl using public.clinic_slots s where s.id = wl.slot_id and s.wave < w;
end $$;

create or replace function public.clinic_hold(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.clinic_slots;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  select * into s from public.clinic_slots where id = slot_id for update;
  if not found then raise exception 'unknown_slot'; end if;
  -- the sweep may have just handed this very slot to the caller from the line: that is a success
  if s.state = 'held' and s.holder = auth.uid() then
    return jsonb_build_object('ok', true, 'hold_expires_at', s.hold_expires_at, 'already_yours', true);
  end if;
  if s.wave <> public.clinic_wave_at(now()) then raise exception 'slot_unavailable:past_wave'; end if;
  if s.state <> 'open' then raise exception 'slot_unavailable:%', s.state; end if;
  update public.clinic_slots set state = 'open', holder = null, hold_expires_at = null, updated_at = now()
    where state = 'held' and holder = auth.uid();
  update public.clinic_slots
    set state = 'held', holder = auth.uid(), hold_expires_at = now() + interval '90 seconds', updated_at = now()
    where id = slot_id;
  return jsonb_build_object('ok', true, 'hold_expires_at', now() + interval '90 seconds');
end $$;
