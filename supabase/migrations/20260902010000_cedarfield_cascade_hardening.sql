-- Cascade hardening from the SPEC-V5 security review (2026-09-02). Applied as `cedarfield_cascade_hardening`.
--   · the hand-over re-checks the slot under lock; a lost race skips the waiter and keeps their
--     place (never "nothing held and dequeued")
--   · a unique/deadlock error inside the cascade never aborts another visitor's board read
--     (and never leaks a uuid through a raw Postgres error)
--   · clinic_hold on the slot the sweep just granted YOU is a success, not a refusal
--   · per-slot queue cap (3) bounds idle-waiter griefing; deterministic order on joined_at ties
--   · index on clinic_waitlist(visitor) for the per-visitor cap

create index if not exists clinic_waitlist_visitor on public.clinic_waitlist (visitor);

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
        set state = 'held', holder = r.visitor, hold_expires_at = now() + interval '45 seconds', updated_at = now()
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
    set state = 'held', holder = auth.uid(), hold_expires_at = now() + interval '45 seconds', updated_at = now()
    where id = slot_id;
  return jsonb_build_object('ok', true, 'hold_expires_at', now() + interval '45 seconds');
end $$;

create or replace function public.clinic_join_waitlist(p_slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.clinic_slots; waiting int; on_slot int; pos int; mine timestamptz;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  select * into s from public.clinic_slots where id = p_slot_id for update;
  if not found then raise exception 'unknown_slot'; end if;
  if s.wave <> public.clinic_wave_at(now()) then raise exception 'slot_unavailable:past_wave'; end if;
  if s.state = 'open' then raise exception 'slot_open:hold_it_instead'; end if;
  if s.state = 'rival' then raise exception 'slot_unavailable:rival'; end if;
  if s.state = 'held' and s.holder = auth.uid() then raise exception 'already_yours:held'; end if;
  if s.state = 'booked' and s.booked_by = auth.uid() then raise exception 'already_yours:booked'; end if;
  select count(*) into waiting from public.clinic_waitlist w where w.visitor = auth.uid();
  if waiting >= 3 then raise exception 'waitlist_cap:3'; end if;
  select count(*) into on_slot from public.clinic_waitlist w where w.slot_id = p_slot_id and w.visitor <> auth.uid();
  if on_slot >= 3 then raise exception 'waitlist_full:3'; end if;
  insert into public.clinic_waitlist (slot_id, visitor) values (p_slot_id, auth.uid())
    on conflict (slot_id, visitor) do nothing;
  select w.joined_at into mine from public.clinic_waitlist w where w.slot_id = p_slot_id and w.visitor = auth.uid();
  select count(*) into pos from public.clinic_waitlist w where w.slot_id = p_slot_id and (w.joined_at < mine or (w.joined_at = mine and w.visitor <= auth.uid()));
  return jsonb_build_object('ok', true, 'position', pos);
end $$;
