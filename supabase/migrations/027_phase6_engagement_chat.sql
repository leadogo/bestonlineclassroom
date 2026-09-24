-- Phase 6.3 and 6.4 (William, Sep 23), all additive.
-- Engagement: which minutes a person actually watched (the heartbeat carries the offset), the belief phrases per event,
-- questions and who answered them. Chat: timed prompts and the per-viewer "book now" row, replies meant for one ghost,
-- call-me requests, and how many earlier sessions a seat's email has attended (auto-ghost rule).
alter table attendance add column if not exists minutes_seen integer[] not null default '{}';
alter table events add column if not exists belief_phrases text[] not null default array['makes sense','wow','value','amazing','so true','crazy good','that''s great','love this','exactly','100%','this is it','need this','game changer','🔥','🙌','👏'];
alter table events add column if not exists prompts jsonb not null default '[]'::jsonb;
alter table events add column if not exists cta_prompt_minutes integer[] not null default '{0,3,8,15}';
alter table events add column if not exists testimonials_from_seconds integer;
update events set testimonials_from_seconds = 6420 where slug = 'ailg-r' and testimonials_from_seconds is null;
alter table chat_messages add column if not exists kind text not null default 'text';
alter table chat_messages add column if not exists visible_to uuid;
alter table chat_messages add column if not exists is_question boolean not null default false;
alter table chat_messages add column if not exists answered_by uuid;
alter table chat_messages add column if not exists belief boolean not null default false;
create index if not exists chat_messages_questions on chat_messages (event_id, session_date) where is_question;
alter table registrants add column if not exists prior_sessions integer not null default 0;
alter table registrants add column if not exists auto_ghost_reason text;
create table if not exists prompt_posts (
  event_id uuid not null references events(id) on delete cascade,
  session_date date not null,
  minute integer not null,
  kind text not null default 'text',
  posted_at timestamptz not null default now(),
  primary key (event_id, session_date, minute, kind)
);
alter table prompt_posts enable row level security;
create table if not exists call_requests (
  id bigserial primary key,
  event_id uuid not null references events(id) on delete cascade,
  session_date date not null,
  registrant_id uuid not null references registrants(id) on delete cascade,
  phone text not null,
  message text not null,
  created_at timestamptz not null default now(),
  forwarded_at timestamptz
);
alter table call_requests enable row level security;
