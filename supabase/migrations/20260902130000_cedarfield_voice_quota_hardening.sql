-- Security review 2026-09-02 (P1-1): the voice ticket was anon-executable with a caller-chosen cap —
-- anyone with the public key could burn the day's allowance. Now: service_role only, caps fixed in
-- SQL, and a per-visitor sub-cap keyed by a hash the route computes (never the address itself).
-- Applied as `cedarfield_voice_quota_hardening`.
drop function if exists public.clinic_voice_ticket(integer);

create table if not exists public.clinic_voice_quota_ip (
  day date not null,
  ip_hash text not null,
  count integer not null default 0,
  primary key (day, ip_hash)
);
alter table public.clinic_voice_quota_ip enable row level security;

create or replace function public.clinic_voice_ticket(p_ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer; m integer;
begin
  if p_ip_hash is null or length(p_ip_hash) < 16 or length(p_ip_hash) > 128 then return false; end if;
  insert into public.clinic_voice_quota (day, count) values (current_date, 0) on conflict (day) do nothing;
  insert into public.clinic_voice_quota_ip (day, ip_hash, count) values (current_date, p_ip_hash, 0)
    on conflict (day, ip_hash) do nothing;
  -- per-visitor first (6/day), then the day's allowance (60/day) — both under row locks
  update public.clinic_voice_quota_ip set count = count + 1
    where day = current_date and ip_hash = p_ip_hash and count < 6
    returning count into m;
  if m is null then return false; end if;
  update public.clinic_voice_quota set count = count + 1
    where day = current_date and count < 60
    returning count into n;
  if n is null then
    update public.clinic_voice_quota_ip set count = count - 1 where day = current_date and ip_hash = p_ip_hash;
    return false;
  end if;
  return true;
end $$;

revoke execute on function public.clinic_voice_ticket(text) from public, anon, authenticated;
grant execute on function public.clinic_voice_ticket(text) to service_role;
