-- Phase 4 chat-moderation: ghost block, IP capture and block. chat-social: per-person reactions and @mentions.
alter table registrants add column if not exists ghosted_at timestamptz;
alter table registrants add column if not exists ip inet;
alter table registrants add column if not exists ip_seen_at timestamptz;
create index if not exists registrants_ip on registrants (ip) where ip is not null;

alter table chat_messages add column if not exists visibility text not null default 'all' check (visibility in ('all', 'author'));
alter table chat_messages add column if not exists mentions text[] not null default '{}';

create table if not exists blocked_ips (
  ip inet primary key,
  reason text,
  by uuid references team_members(id) on delete set null,
  at timestamptz not null default now(),
  edge_id text
);
alter table blocked_ips enable row level security;

-- who = registrant uuid, or 'm:<team member uuid>'
create table if not exists message_reactions (
  message_id bigint not null references chat_messages(id) on delete cascade,
  who text not null,
  emoji text not null,
  at timestamptz not null default now(),
  primary key (message_id, who, emoji)
);
alter table message_reactions enable row level security;
