-- 2026-09-03: judging day. The per-visitor cap (20/day) was spent again by our own proof runs sharing
-- an address with the person testing (Codex re-audit item 9). 40 per visitor, 200 per day; still fixed
-- in SQL, service_role only. Applied as `cedarfield_voice_quota_40`.
create or replace function public.clinic_voice_ticket(p_ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer; m integer;
begin
  if p_ip_hash is null or length(p_ip_hash) < 16 or length(p_ip_hash) > 128 then return false; end if;
  insert into public.clinic_voice_quota (day, count) values (current_date, 0) on conflict (day) do nothing;
  insert into public.clinic_voice_quota_ip (day, ip_hash, count) values (current_date, p_ip_hash, 0)
    on conflict (day, ip_hash) do nothing;
  update public.clinic_voice_quota_ip set count = count + 1
    where day = current_date and ip_hash = p_ip_hash and count < 40
    returning count into m;
  if m is null then return false; end if;
  update public.clinic_voice_quota set count = count + 1
    where day = current_date and count < 200
    returning count into n;
  if n is null then
    update public.clinic_voice_quota_ip set count = count - 1 where day = current_date and ip_hash = p_ip_hash;
    return false;
  end if;
  return true;
end $$;
