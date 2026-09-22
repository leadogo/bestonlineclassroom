-- Phase 5.0: the names a message mentions (only those are coloured), and when the replay opens (local time on the
-- session's day; blank = the moment the session ends). ailg-r opens at 8 PM (William, 2026-09-21).
alter table chat_messages add column if not exists mention_names text[] not null default '{}';
alter table events add column if not exists replay_opens_at time;
update events set replay_opens_at = '20:00' where slug = 'ailg-r' and replay_opens_at is null;
