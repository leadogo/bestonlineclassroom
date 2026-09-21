-- Phase 4 roles-team: admins run everything; moderators moderate and see the numbers for their webinars.
alter table team_members add column if not exists role text not null default 'admin' check (role in ('admin', 'moderator'));

create table if not exists team_assignments (
  member_id uuid not null references team_members(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  primary key (member_id, event_id)
);
alter table team_assignments enable row level security;

create table if not exists team_invites (
  token text primary key,
  email text not null,
  display_name text not null,
  role text not null check (role in ('admin', 'moderator')),
  event_ids uuid[] not null default '{}',
  invited_by uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table team_invites enable row level security;
