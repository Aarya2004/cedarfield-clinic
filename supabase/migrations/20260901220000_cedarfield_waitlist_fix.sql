-- plpgsql resolves `slot_id` ambiguously when a parameter and a column share the name; the
-- waitlist functions touch clinic_waitlist(slot_id). Pin the resolution to the variable.
-- Applied as `cedarfield_waitlist_fix` (found by the two-visitor live proof: the join RPC errored,
-- so the page never learned its position).

create or replace function public.clinic_join_waitlist(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare s public.clinic_slots; waiting int; pos int; mine timestamptz;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  select * into s from public.clinic_slots where id = slot_id for update;
  if not found then raise exception 'unknown_slot'; end if;
  if s.wave <> public.clinic_wave_at(now()) then raise exception 'slot_unavailable:past_wave'; end if;
  if s.state = 'open' then raise exception 'slot_open:hold_it_instead'; end if;
  if s.state = 'held' and s.holder = auth.uid() then raise exception 'already_yours:held'; end if;
  if s.state = 'booked' and s.booked_by = auth.uid() then raise exception 'already_yours:booked'; end if;
  select count(*) into waiting from public.clinic_waitlist w where w.visitor = auth.uid();
  if waiting >= 3 then raise exception 'waitlist_cap:3'; end if;
  insert into public.clinic_waitlist (slot_id, visitor) values (slot_id, auth.uid())
    on conflict (slot_id, visitor) do nothing;
  select w.joined_at into mine from public.clinic_waitlist w where w.slot_id = slot_id and w.visitor = auth.uid();
  select count(*) into pos from public.clinic_waitlist w where w.slot_id = slot_id and w.joined_at <= mine;
  return jsonb_build_object('ok', true, 'position', pos);
end $$;

create or replace function public.clinic_leave_waitlist(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  delete from public.clinic_waitlist w where w.slot_id = slot_id and w.visitor = auth.uid();
  if not found then raise exception 'not_waiting'; end if;
  return jsonb_build_object('ok', true);
end $$;
