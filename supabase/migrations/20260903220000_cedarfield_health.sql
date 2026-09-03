-- 2026-09-03: liveness for the judging window. The board RPC needs a signed-in visitor; a daily cron has
-- none. This service-role-only function sweeps the board forward (activity, so a free project never
-- pauses) and returns counts only. Applied as `cedarfield_health`.
create or replace function public.clinic_health()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w bigint; is_live boolean; n_open int; n_total int;
begin
  select live into is_live from public.clinic_settings where key = 'board';
  perform public.clinic_sweep();
  w := public.clinic_wave_at(now());
  select count(*) filter (where state = 'open'), count(*) into n_open, n_total
    from public.clinic_slots where wave = w;
  return jsonb_build_object('live', coalesce(is_live, true), 'wave', w,
    'next_wave_at', public.clinic_wave_start(w + 1), 'open', n_open, 'slots', n_total, 'server_now', now());
end $$;
revoke all on function public.clinic_health() from public, anon, authenticated;
grant execute on function public.clinic_health() to service_role;
