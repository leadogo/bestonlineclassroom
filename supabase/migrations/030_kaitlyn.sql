-- Kaitlyn from William's Team (William, Oct 11 2026): the room's AI moderator. Per event a mode (off | shadow | assisted
-- | auto) and the fact sheet she may quote; one row per decision she makes about an attendee message, with what the
-- desk did about it. Additive: nothing in the room reads these until the mode is on.
alter table events add column if not exists kaitlyn_mode text not null default 'off' check (kaitlyn_mode in ('off', 'shadow', 'assisted', 'auto'));
alter table events add column if not exists kaitlyn_facts text;

create table if not exists kaitlyn_decisions (
  id bigserial primary key,
  event_id uuid not null references events(id) on delete cascade,
  session_date date not null,
  message_id bigint not null,
  registrant_id uuid not null,
  action text not null,
  category text not null default 'other',
  text text not null default '',
  react text not null default '',
  why text not null default '',
  -- pending: on the desk; sent / edited: a moderator posted it (as typed / changed); auto: Kaitlyn posted it herself;
  -- skipped: Kaitlyn (decided_by null) or a moderator passed; ghosted: the person was ghosted on this line.
  status text not null default 'pending',
  sent_body text,
  sent_message_id bigint,
  reacted_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  model text,
  ms integer,
  created_at timestamptz not null default now()
);
create index if not exists kaitlyn_decisions_session on kaitlyn_decisions (event_id, session_date, status);
alter table kaitlyn_decisions enable row level security;
