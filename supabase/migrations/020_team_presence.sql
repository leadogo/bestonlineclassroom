-- Moderators show in the People tab while they are on the moderator view (touched on every poll, 2-minute window).
create table if not exists team_presence (
  member_id uuid not null references team_members(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  session_date date not null,
  last_seen_at timestamptz not null default now(),
  primary key (member_id, event_id, session_date)
);
alter table team_presence enable row level security;
