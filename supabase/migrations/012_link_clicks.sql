-- Every open of a join, open or replay link and what the person got (William, 2026-09-20 late): so we know that
-- clicks turn into a room, and can flag anyone who clicked and could not watch.
create table if not exists link_clicks (
  id bigserial primary key,
  at timestamptz not null default now(),
  path text not null,                -- j | w | replay
  token text,
  registrant_id uuid references registrants(id) on delete set null,
  event_id uuid references events(id),
  session_date date,
  outcome text not null,             -- live | countdown | ended | replay | replay_expired | invalid | prompt
  src text,
  user_agent text
);
create index if not exists link_clicks_event_at on link_clicks (event_id, at desc);
create index if not exists link_clicks_outcome on link_clicks (outcome, at desc);
alter table link_clicks enable row level security;
