-- Cedarfield Clinic: one shared board for every visitor (SPEC-V3, 2026-09-01).
-- Applied to Supabase project hxqpaquhkmnrnjfutuyu as migration `cedarfield_board`.
--
-- The page keeps the human-only gate; this schema keeps the integrity between strangers:
-- single hold per visitor, hold-before-book, only-your-booking cancels, atomic move, TTL expiry.
-- The world advances lazily — every reader sweeps it forward. No cron, no idle cost.
--
-- What the database does NOT enforce, on purpose and stated in docs/SECURITY.md §10: that a human
-- pressed anything. That gate lives in the page, in the only API an agent is handed. A script with
-- the (public) publishable key can create an anonymous session and call these functions directly;
-- it still cannot take another visitor's hold or booking, and it cannot book without holding first.

create table public.clinic_slots (
  id text primary key,
  wave bigint not null,
  idx int not null check (idx between 0 and 5),
  time_label text not null,
  clinician text not null,
  kind text not null,
  state text not null default 'open' check (state in ('open','held','booked','rival')),
  holder uuid,
  hold_expires_at timestamptz,
  booked_by uuid,
  rival_take_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (wave, idx)
);

-- one live hold per visitor, enforced by the database rather than by anyone's promise
create unique index clinic_one_hold_per_visitor on public.clinic_slots (holder) where state = 'held';
create index clinic_slots_wave on public.clinic_slots (wave);
create index clinic_slots_booked_by on public.clinic_slots (booked_by) where state = 'booked';

alter table public.clinic_slots enable row level security;
create policy "board is readable by signed-in visitors"
  on public.clinic_slots for select to authenticated using (true);
-- no insert/update/delete policies: every write goes through the definer functions below.

-- ── the clock ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.clinic_wave_at(at timestamptz)
returns bigint language sql immutable set search_path = '' as
$$ select floor(extract(epoch from at) * 1000 / 90000)::bigint $$;

create or replace function public.clinic_wave_start(wave bigint)
returns timestamptz language sql immutable set search_path = '' as
$$ select to_timestamp(wave * 90.0) $$;

-- ── the world, advanced by whoever looks at it (superseded by cedarfield_fairness) ────────────
create or replace function public.clinic_sweep()
returns void language plpgsql security definer set search_path = '' as $$
declare
  w bigint := public.clinic_wave_at(now());
  ws timestamptz := public.clinic_wave_start(w);
  i int; h int; m int; seed bigint; rival_slot boolean; take_at timestamptz;
  clinicians text[] := array['Dr. Alvarez','Dr. Boone','Dr. Chatterjee','Dr. Duarte','Dr. Eriksson','Dr. Fanning'];
  kinds text[] := array['New patient','Follow-up','Consult'];
begin
  for i in 0..5 loop
    seed := abs(hashtextextended(w::text || ':' || i::text, 0));
    h := 8 + ((i * 20 + 40) / 60); m := (40 + i * 20) % 60;
    rival_slot := (seed % 2 = i % 2);
    take_at := case
      when rival_slot and i in (0,1) then ws + interval '6 seconds' + (i * interval '14 seconds')
      when rival_slot and i in (2,3) then ws + interval '20 seconds' + ((i-2) * interval '14 seconds')
      when rival_slot and i >= 4 then ws + interval '34 seconds'
      else null end;
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

  update public.clinic_slots
    set state = 'rival', updated_at = now()
    where wave = w and state = 'open' and rival_take_at is not null and rival_take_at < now();
end $$;

-- ── read: the current wave plus your own bookings from earlier waves ─────────────────────────
create or replace function public.clinic_board()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w bigint; result jsonb;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
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
      'hold_expires_at', s.hold_expires_at
    ) order by s.wave, s.idx), '[]'::jsonb)
  ) into result
  from public.clinic_slots s
  where s.wave = w or (s.state = 'booked' and s.booked_by = auth.uid());
  return result;
end $$;

-- ── the agent's verb ─────────────────────────────────────────────────────────────────────────
create or replace function public.clinic_hold(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.clinic_slots;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  select * into s from public.clinic_slots where id = slot_id for update;
  if not found then raise exception 'unknown_slot'; end if;
  if s.state <> 'open' then raise exception 'slot_unavailable:%', s.state; end if;
  update public.clinic_slots set state = 'open', holder = null, hold_expires_at = null, updated_at = now()
    where state = 'held' and holder = auth.uid();
  update public.clinic_slots
    set state = 'held', holder = auth.uid(), hold_expires_at = now() + interval '45 seconds', updated_at = now()
    where id = slot_id;
  return jsonb_build_object('ok', true, 'hold_expires_at', now() + interval '45 seconds');
end $$;

create or replace function public.clinic_release(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  update public.clinic_slots set state = 'open', holder = null, hold_expires_at = null, updated_at = now()
    where id = slot_id and state = 'held' and holder = auth.uid();
  if not found then raise exception 'nothing_held'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── the human's verbs. The PAGE gates these on a trusted press; the database gates integrity. ─
create or replace function public.clinic_book(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.clinic_slots;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  select * into s from public.clinic_slots where id = slot_id for update;
  if not found then raise exception 'unknown_slot'; end if;
  if s.state <> 'held' or s.holder <> auth.uid() or s.hold_expires_at < now() then
    raise exception 'not_your_hold:%', s.state;
  end if;
  update public.clinic_slots
    set state = 'booked', booked_by = auth.uid(), holder = null, hold_expires_at = null, updated_at = now()
    where id = slot_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.clinic_cancel(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  update public.clinic_slots set state = 'open', booked_by = null, updated_at = now()
    where id = slot_id and state = 'booked' and booked_by = auth.uid();
  if not found then raise exception 'not_your_booking'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.clinic_move(from_slot text, to_slot text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare f public.clinic_slots; t public.clinic_slots;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  if from_slot = to_slot then raise exception 'same_slot'; end if;
  select * into f from public.clinic_slots where id = least(from_slot, to_slot) for update;
  select * into t from public.clinic_slots where id = greatest(from_slot, to_slot) for update;
  select * into f from public.clinic_slots where id = from_slot;
  select * into t from public.clinic_slots where id = to_slot;
  if f.id is null or t.id is null then raise exception 'unknown_slot'; end if;
  if f.state <> 'booked' or f.booked_by <> auth.uid() then raise exception 'not_your_booking'; end if;
  if not (t.state = 'open' or (t.state = 'held' and t.holder = auth.uid())) then
    raise exception 'slot_unavailable:%', t.state;
  end if;
  update public.clinic_slots
    set state = 'booked', booked_by = auth.uid(), holder = null, hold_expires_at = null, updated_at = now()
    where id = to_slot;
  update public.clinic_slots
    set state = 'open', booked_by = null, updated_at = now()
    where id = from_slot;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.clinic_board(), public.clinic_hold(text), public.clinic_release(text),
  public.clinic_book(text), public.clinic_cancel(text), public.clinic_move(text, text) to authenticated;

alter publication supabase_realtime add table public.clinic_slots;
