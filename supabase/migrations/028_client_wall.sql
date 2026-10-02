-- Phase 7 (SPEC-phase7.md): the client wall. Current and past BMS clients, pushed from bms-dashboard every 30 minutes,
-- never get into the room or the replay again. Matching is by identity (email, email hash, last ten digits of the
-- phone), never by address. The trigger walls a matching registrant at insert time and can never fail the insert.
create table if not exists client_wall (
  client_id text primary key,
  name text,
  status text,
  emails text[] not null default '{}',
  email_hashes text[] not null default '{}',
  phones text[] not null default '{}',
  client_since timestamptz,
  seen_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists client_wall_emails on client_wall using gin (emails);
create index if not exists client_wall_email_hashes on client_wall using gin (email_hashes);
create index if not exists client_wall_phones on client_wall using gin (phones);
alter table client_wall enable row level security;

alter table registrants add column if not exists block_reason text;
update registrants set block_reason = 'mod' where blocked_at is not null and block_reason is null;

alter table events add column if not exists open_link_field text not null default 'name';
alter table events add column if not exists open_link_email_since date;

-- True when this identity belongs to a client on the wall. Blank keys never match; team members never match.
create or replace function client_wall_hit(raw_email text, raw_hash text, raw_phone text) returns boolean language plpgsql stable as $$
declare
  e text := lower(trim(coalesce(raw_email, '')));
  h text := lower(trim(coalesce(raw_hash, '')));
  d text := regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g');
  p text := case when length(d) >= 10 then right(d, 10) else '' end;
begin
  if e = '' and h = '' and p = '' then return false; end if;
  if e <> '' and exists (select 1 from team_members t where lower(t.email) = e) then return false; end if;
  return exists (
    select 1 from client_wall w
    where w.released_at is null
      and ((e <> '' and w.emails @> array[e]) or (h <> '' and w.email_hashes @> array[h]) or (p <> '' and w.phones @> array[p]))
  );
end $$;

-- Walls a matching registrant as it is created. Any error inside means "not walled", never a failed insert.
create or replace function registrants_client_wall() returns trigger language plpgsql as $$
begin
  if new.blocked_at is null and coalesce(new.source, '') <> 'test' and client_wall_hit(new.email, new.email_hash, new.phone) then
    new.blocked_at := now();
    new.block_reason := 'client';
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists registrants_client_wall on registrants;
create trigger registrants_client_wall before insert on registrants for each row execute function registrants_client_wall();

-- After a sync: wall every registrant on the list, release the ones no longer on it. Refuses to wall more than `cap`
-- people in one go (a bad snapshot, not a directory) and reports what it would have done instead.
create or replace function client_wall_apply(cap int default 300) returns jsonb language plpgsql as $$
declare would int; flagged int; released int;
begin
  select count(*) into would from registrants r
   where r.blocked_at is null and coalesce(r.source, '') <> 'test' and client_wall_hit(r.email, r.email_hash, r.phone);
  if would > cap then return jsonb_build_object('error', 'cap', 'would_flag', would, 'cap', cap); end if;
  update registrants r set blocked_at = now(), block_reason = 'client'
   where r.blocked_at is null and coalesce(r.source, '') <> 'test' and client_wall_hit(r.email, r.email_hash, r.phone);
  get diagnostics flagged = row_count;
  update registrants r set blocked_at = null, block_reason = null
   where r.block_reason = 'client' and not client_wall_hit(r.email, r.email_hash, r.phone);
  get diagnostics released = row_count;
  return jsonb_build_object('flagged', flagged, 'released', released);
end $$;
