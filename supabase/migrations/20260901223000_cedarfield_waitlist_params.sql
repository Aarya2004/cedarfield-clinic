-- Parameters named apart from columns (p_slot_id): no pragma, no ambiguity, ON CONFLICT intact.
-- Applied as `cedarfield_waitlist_params`. (The `#variable_conflict use_variable` pragma in the
-- previous fix made `on conflict (slot_id, visitor)` resolve slot_id as the variable — "there is
-- no unique or exclusion constraint matching the ON CONFLICT specification". Found by the Node
-- probe; the page's join tool had been timing out on it.)
drop function if exists public.clinic_join_waitlist(text);
drop function if exists public.clinic_leave_waitlist(text);

create or replace function public.clinic_join_waitlist(p_slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.clinic_slots; waiting int; pos int; mine timestamptz;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  select * into s from public.clinic_slots where id = p_slot_id for update;
  if not found then raise exception 'unknown_slot'; end if;
  if s.wave <> public.clinic_wave_at(now()) then raise exception 'slot_unavailable:past_wave'; end if;
  if s.state = 'open' then raise exception 'slot_open:hold_it_instead'; end if;
  if s.state = 'held' and s.holder = auth.uid() then raise exception 'already_yours:held'; end if;
  if s.state = 'booked' and s.booked_by = auth.uid() then raise exception 'already_yours:booked'; end if;
  select count(*) into waiting from public.clinic_waitlist w where w.visitor = auth.uid();
  if waiting >= 3 then raise exception 'waitlist_cap:3'; end if;
  insert into public.clinic_waitlist (slot_id, visitor) values (p_slot_id, auth.uid())
    on conflict (slot_id, visitor) do nothing;
  select w.joined_at into mine from public.clinic_waitlist w where w.slot_id = p_slot_id and w.visitor = auth.uid();
  select count(*) into pos from public.clinic_waitlist w where w.slot_id = p_slot_id and w.joined_at <= mine;
  return jsonb_build_object('ok', true, 'position', pos);
end $$;

create or replace function public.clinic_leave_waitlist(p_slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  delete from public.clinic_waitlist w where w.slot_id = p_slot_id and w.visitor = auth.uid();
  if not found then raise exception 'not_waiting'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.clinic_join_waitlist(text), public.clinic_leave_waitlist(text) from public, anon;
grant execute on function public.clinic_join_waitlist(text), public.clinic_leave_waitlist(text) to authenticated;
