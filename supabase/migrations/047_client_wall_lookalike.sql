-- The client wall's look-alike email (William, Oct 28 2026: Brishen, walled as combsrealtor@gmail.com, came back through
-- the Skool link as combsrealtor@icloud.com). A personal mailbox whose name part (six characters or more, not a role
-- word) matches a client's personal mailbox is that client. free_locals is written by the sync (freeLocal in
-- src/lib/client-wall.ts, the same rule) and backfilled here. Oct 28 check: 2 registrants newly walled, both the same
-- person as the client (buzz628@yahoo ≈ @gmail, lesliecarretti@yahoo ≈ @gmail).

alter table client_wall add column if not exists free_locals text[] not null default '{}';
create index if not exists client_wall_free_locals on client_wall using gin (free_locals);

create or replace function client_wall_free_local(raw text) returns text language sql immutable as $$
  select case
    when e ~ '^[^@[:space:]]+@(gmail|googlemail|icloud|me|mac|yahoo|ymail|hotmail|outlook|live|msn|aol|comcast|att|sbcglobal|verizon|protonmail|proton|gmx)\.[a-z.]+$'
     and length(split_part(e, '@', 1)) >= 6
     and split_part(e, '@', 1) <> all (array['info','admin','contact','sales','office','hello','support','team','realtor','realestate','homes','properties','mail','email','agent','broker','listings','marketing','noreply'])
    then split_part(e, '@', 1) end
  from (select lower(trim(coalesce(raw, ''))) as e) x
$$;

update client_wall w set free_locals = coalesce((select array_agg(distinct l) from unnest(w.emails) x, client_wall_free_local(x) l where l is not null), '{}');

create or replace function client_wall_hit(raw_email text, raw_hash text, raw_phone text) returns boolean language plpgsql stable as $$
declare
  e text := lower(trim(coalesce(raw_email, '')));
  h text := lower(trim(coalesce(raw_hash, '')));
  d text := regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g');
  p text := case when length(d) >= 10 then right(d, 10) else '' end;
  l text := coalesce(client_wall_free_local(raw_email), '');
begin
  if e = '' and h = '' and p = '' then return false; end if;
  if e <> '' and exists (select 1 from team_members t where lower(t.email) = e) then return false; end if;
  return exists (
    select 1 from client_wall w
    where w.released_at is null
      and ((e <> '' and w.emails @> array[e]) or (h <> '' and w.email_hashes @> array[h]) or (p <> '' and w.phones @> array[p]) or (l <> '' and w.free_locals @> array[l]))
  );
end $$;
