-- bestonlineclassroom, phase 1 (SPEC-data-model.md). Service role only: RLS on, no policies.

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  host_name text not null default 'William Kabrall',
  timezone text not null default 'America/Edmonton',
  start_time time not null default '17:00',
  video_url text,
  video_seconds integer,
  cta_at_seconds integer,
  cta_hide_seconds integer,
  cta_label text,
  cta_href text,
  end_url text not null,
  simulated_names text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table registrants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  session_date date not null,
  token text not null unique,
  first_name text not null,
  email text,
  email_hash text not null default '',
  phone text,
  source text not null default 'site' check (source in ('site', 'zapier', 'skool', 'legacy', 'guest', 'test')),
  site_registration_id uuid,
  attribution jsonb not null default '{}'::jsonb,
  blocked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index registrants_event_session_email on registrants (event_id, session_date, email) where email is not null;
create index registrants_event_session_hash on registrants (event_id, session_date, email_hash);
create index registrants_site_rid on registrants (site_registration_id);

create table attendance (
  registrant_id uuid not null references registrants(id),
  session_date date not null,
  kind text not null default 'live' check (kind in ('live', 'replay')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seconds_watched integer not null default 0,
  max_offset integer not null default 0,
  params jsonb not null default '{}'::jsonb,
  cta_clicked_at timestamptz,
  primary key (registrant_id, session_date, kind)
);

create table chat_messages (
  id bigserial primary key,
  event_id uuid not null references events(id),
  session_date date not null,
  registrant_id uuid references registrants(id),
  team_member_id uuid,
  author_name text not null,
  role text not null check (role in ('attendee', 'moderator')),
  body text not null,
  offset_seconds integer not null default 0,
  reactions jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_messages_session_id on chat_messages (event_id, session_date, id);
create index chat_messages_session_updated on chat_messages (event_id, session_date, updated_at);

create table simulated_messages (
  id serial primary key,
  event_id uuid not null references events(id),
  offset_seconds integer not null,
  name text not null,
  body text not null
);
create index simulated_messages_event_offset on simulated_messages (event_id, offset_seconds);

create table team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table events enable row level security;
alter table registrants enable row level security;
alter table attendance enable row level security;
alter table chat_messages enable row level security;
alter table simulated_messages enable row level security;
alter table team_members enable row level security;
