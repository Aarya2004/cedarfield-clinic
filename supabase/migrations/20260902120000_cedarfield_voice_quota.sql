-- "Talk to Cedarfield" (2026-09-02): a daily ticket count for the page's own voice client, so the one
-- model key this product holds cannot be run up by a crowd. Called by the Next.js route only
-- (anon key; the route is the only caller that knows to). Fail closed: no row, no ticket.
-- Applied as `cedarfield_voice_quota`.
create table if not exists public.clinic_voice_quota (
  day date primary key,
  count integer not null default 0
);
alter table public.clinic_voice_quota enable row level security;

create or replace function public.clinic_voice_ticket(p_cap integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_cap is null or p_cap < 1 or p_cap > 1000 then return false; end if;
  insert into public.clinic_voice_quota (day, count) values (current_date, 0)
    on conflict (day) do nothing;
  update public.clinic_voice_quota set count = count + 1
    where day = current_date and count < p_cap
    returning count into n;
  return n is not null;
end $$;

revoke execute on function public.clinic_voice_ticket(integer) from public;
grant execute on function public.clinic_voice_ticket(integer) to anon, authenticated;
