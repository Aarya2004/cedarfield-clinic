-- The waitlist cascade (SPEC-V5, 2026-09-01): the race is gone. Applied as `cedarfield_waitlist`.
-- An agent may queue its human for a slot that is not open. When that slot comes back — a hold
-- lapses, a booking is cancelled, a move frees it — the SWEEP hands it to the first waiter as a
-- fresh 45 s hold, in order. Nobody races; the person still books with one press.

create table public.clinic_waitlist (
  slot_id text not null references public.clinic_slots(id) on delete cascade,
  visitor uuid not null,
  joined_at timestamptz not null default now(),
  primary key (slot_id, visitor)
);
create index clinic_waitlist_order on public.clinic_waitlist (slot_id, joined_at);
alter table public.clinic_waitlist enable row level security;
-- no direct access: the functions below are the only door

-- a visitor may wait on at most three slots at once (the same restraint as bookings)
create or replace function public.clinic_join_waitlist(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.clinic_slots; waiting int; pos int;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  select * into s from public.clinic_slots where id = slot_id for update;
  if not found then raise exception 'unknown_slot'; end if;
  if s.wave <> public.clinic_wave_at(now()) then raise exception 'slot_unavailable:past_wave'; end if;
  if s.state = 'open' then raise exception 'slot_open:hold_it_instead'; end if;
  if s.state = 'held' and s.holder = auth.uid() then raise exception 'already_yours:held'; end if;
  if s.state = 'booked' and s.booked_by = auth.uid() then raise exception 'already_yours:booked'; end if;
  select count(*) into waiting from public.clinic_waitlist where visitor = auth.uid();
  if waiting >= 3 then raise exception 'waitlist_cap:3'; end if;
  insert into public.clinic_waitlist (slot_id, visitor) values (slot_id, auth.uid())
    on conflict (slot_id, visitor) do nothing;
  select count(*) into pos from public.clinic_waitlist w
    where w.slot_id = clinic_join_waitlist.slot_id
      and w.joined_at <= (select joined_at from public.clinic_waitlist where clinic_waitlist.slot_id = clinic_join_waitlist.slot_id and visitor = auth.uid());
  return jsonb_build_object('ok', true, 'position', pos);
end $$;

create or replace function public.clinic_leave_waitlist(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  delete from public.clinic_waitlist where clinic_waitlist.slot_id = clinic_leave_waitlist.slot_id and visitor = auth.uid();
  if not found then raise exception 'not_waiting'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- the cascade lives in the sweep: every reopened slot with a queue is handed to its first waiter
create or replace function public.clinic_sweep()
returns void language plpgsql security definer set search_path = '' as $$
declare
  w bigint := public.clinic_wave_at(now());
  ws timestamptz := public.clinic_wave_start(w);
  i int; h int; m int; seed bigint; offs int; rival_slot boolean; take_at timestamptz; rank int;
  clinicians text[] := array['Dr. Alvarez','Dr. Boone','Dr. Chatterjee','Dr. Duarte','Dr. Eriksson','Dr. Fanning'];
  kinds text[] := array['New patient','Follow-up','Consult'];
  r record;
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

  -- lapsed holds reopen
  update public.clinic_slots
    set state = 'open', holder = null, hold_expires_at = null, updated_at = now()
    where state = 'held' and hold_expires_at < now();

  -- THE CASCADE: an open slot with a queue goes to its first waiter as a fresh hold, in order.
  -- (A waiter who already holds something else gives that up — one hold per visitor, always.)
  for r in
    select distinct on (wl.slot_id) wl.slot_id, wl.visitor
    from public.clinic_waitlist wl
    join public.clinic_slots s on s.id = wl.slot_id
    where s.state = 'open' and s.wave = w
    order by wl.slot_id, wl.joined_at
  loop
    update public.clinic_slots set state = 'open', holder = null, hold_expires_at = null, updated_at = now()
      where state = 'held' and holder = r.visitor;
    update public.clinic_slots
      set state = 'held', holder = r.visitor, hold_expires_at = now() + interval '45 seconds', updated_at = now()
      where id = r.slot_id and state = 'open';
    delete from public.clinic_waitlist where slot_id = r.slot_id and visitor = r.visitor;
  end loop;

  -- the labelled rival takes its scheduled slots, never the last open one, never a queued one
  update public.clinic_slots s
    set state = 'rival', updated_at = now()
    where s.wave = w and s.state = 'open' and s.rival_take_at is not null and s.rival_take_at < now()
      and not exists (select 1 from public.clinic_waitlist wl where wl.slot_id = s.id)
      and (select count(*) from public.clinic_slots o where o.wave = w and o.state = 'open') > 1;

  -- queues on slots of past waves are meaningless
  delete from public.clinic_waitlist wl using public.clinic_slots s where s.id = wl.slot_id and s.wave < w;
end $$;

-- the board tells each visitor where they wait, and how many wait on each slot
create or replace function public.clinic_board()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w bigint; result jsonb; is_live boolean;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select live into is_live from public.clinic_settings where key = 'board';
  if coalesce(is_live, true) = false then raise exception 'board_offline'; end if;
  perform public.clinic_sweep();
  w := public.clinic_wave_at(now());
  select jsonb_build_object(
    'wave', w,
    'wave_started_at', public.clinic_wave_start(w),
    'next_wave_at', public.clinic_wave_start(w + 1),
    'server_now', now(),
    'slots', coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'time_label', s.time_label, 'clinician', s.clinician, 'kind', s.kind,
      'state', s.state,
      'yours_held', s.state = 'held' and s.holder = auth.uid(),
      'yours_booked', s.state = 'booked' and s.booked_by = auth.uid(),
      'hold_expires_at', s.hold_expires_at,
      'waiting', (select count(*) from public.clinic_waitlist wl where wl.slot_id = s.id),
      'your_position', (select count(*) from public.clinic_waitlist a
                          where a.slot_id = s.id and a.joined_at <= (select b.joined_at from public.clinic_waitlist b where b.slot_id = s.id and b.visitor = auth.uid()))
    ) order by s.wave, s.idx), '[]'::jsonb)
  ) into result
  from public.clinic_slots s
  where s.wave = w or (s.state = 'booked' and s.booked_by = auth.uid() and s.wave >= w - 4);
  return result;
end $$;

revoke execute on function public.clinic_join_waitlist(text), public.clinic_leave_waitlist(text) from public, anon;
grant execute on function public.clinic_join_waitlist(text), public.clinic_leave_waitlist(text) to authenticated;
