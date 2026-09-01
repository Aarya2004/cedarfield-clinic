-- Hardening from the SPEC-V3 security review (2026-09-01). Applied as `cedarfield_hardening`.
--   · privacy: visitors never see each other's uuids (column-level SELECT; realtime honours it)
--   · the world-advance and clock helpers are not callable by visitors
--   · holds and move targets must be in the CURRENT wave (old-wave rows are not a back door)
--   · bookings are visible for the last 4 waves (~6 min) so "cancel my booking" means the recent one
--   · a runtime kill switch: clinic_settings.live = false takes the board offline without a deploy

revoke all on table public.clinic_slots from anon, authenticated;
grant select (id, wave, idx, time_label, clinician, kind, state, hold_expires_at, updated_at)
  on table public.clinic_slots to authenticated;

revoke execute on function public.clinic_sweep(), public.clinic_wave_at(timestamptz), public.clinic_wave_start(bigint)
  from anon, authenticated;

create table if not exists public.clinic_settings (
  key text primary key,
  live boolean not null default true,
  note text
);
insert into public.clinic_settings (key, live, note) values ('board', true, 'set live=false to take the shared board offline; pages fall back to the seeded board')
  on conflict (key) do nothing;
alter table public.clinic_settings enable row level security;
-- readable by nobody directly; only clinic_board consults it

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
      'hold_expires_at', s.hold_expires_at
    ) order by s.wave, s.idx), '[]'::jsonb)
  ) into result
  from public.clinic_slots s
  where s.wave = w or (s.state = 'booked' and s.booked_by = auth.uid() and s.wave >= w - 4);
  return result;
end $$;

create or replace function public.clinic_hold(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.clinic_slots;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  select * into s from public.clinic_slots where id = slot_id for update;
  if not found then raise exception 'unknown_slot'; end if;
  if s.wave <> public.clinic_wave_at(now()) then raise exception 'slot_unavailable:past_wave'; end if;
  if s.state <> 'open' then raise exception 'slot_unavailable:%', s.state; end if;
  update public.clinic_slots set state = 'open', holder = null, hold_expires_at = null, updated_at = now()
    where state = 'held' and holder = auth.uid();
  update public.clinic_slots
    set state = 'held', holder = auth.uid(), hold_expires_at = now() + interval '45 seconds', updated_at = now()
    where id = slot_id;
  return jsonb_build_object('ok', true, 'hold_expires_at', now() + interval '45 seconds');
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
  if t.wave <> public.clinic_wave_at(now()) then raise exception 'slot_unavailable:past_wave'; end if;
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
