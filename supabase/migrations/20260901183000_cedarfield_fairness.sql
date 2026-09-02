-- Fairness on the live board, made exact (truth audit 2026-09-01). Applied as `cedarfield_fairness`.
--   · the simulated rival takes EXACTLY three of six slots per wave, spread, and never the last open one
--   · a visitor may hold at most three active bookings — enough to exercise cancel and move, not
--     enough to empty a wave for everyone else

create or replace function public.clinic_sweep()
returns void language plpgsql security definer set search_path = '' as $$
declare
  w bigint := public.clinic_wave_at(now());
  ws timestamptz := public.clinic_wave_start(w);
  i int; h int; m int; seed bigint; offs int; rival_slot boolean; take_at timestamptz; rank int;
  clinicians text[] := array['Dr. Alvarez','Dr. Boone','Dr. Chatterjee','Dr. Duarte','Dr. Eriksson','Dr. Fanning'];
  kinds text[] := array['New patient','Follow-up','Consult'];
begin
  -- exactly three rival slots per wave: offset, offset+2, offset+4 (mod 6), from the wave's own seed
  offs := (abs(hashtextextended(w::text, 0)) % 6)::int;
  for i in 0..5 loop
    seed := abs(hashtextextended(w::text || ':' || i::text, 0));
    h := 8 + ((i * 20 + 40) / 60); m := (40 + i * 20) % 60;
    rival_slot := (i = offs) or (i = (offs + 2) % 6) or (i = (offs + 4) % 6);
    rank := case when i = offs then 0 when i = (offs + 2) % 6 then 1 else 2 end;
    -- front-loaded like a real drop: +6s, +20s, +34s
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

  -- the rival never takes the last open slot: someone arriving late can always still book
  update public.clinic_slots s
    set state = 'rival', updated_at = now()
    where s.wave = w and s.state = 'open' and s.rival_take_at is not null and s.rival_take_at < now()
      and (select count(*) from public.clinic_slots o where o.wave = w and o.state = 'open') > 1;
end $$;

create or replace function public.clinic_book(slot_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.clinic_slots; active int;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  perform public.clinic_sweep();
  select * into s from public.clinic_slots where id = slot_id for update;
  if not found then raise exception 'unknown_slot'; end if;
  if s.state <> 'held' or s.holder <> auth.uid() or s.hold_expires_at < now() then
    raise exception 'not_your_hold:%', s.state;
  end if;
  select count(*) into active from public.clinic_slots where state = 'booked' and booked_by = auth.uid();
  if active >= 3 then raise exception 'booking_cap:3'; end if;
  update public.clinic_slots
    set state = 'booked', booked_by = auth.uid(), holder = null, hold_expires_at = null, updated_at = now()
    where id = slot_id;
  return jsonb_build_object('ok', true);
end $$;
