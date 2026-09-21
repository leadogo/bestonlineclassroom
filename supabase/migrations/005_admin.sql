-- Admin-editable copy for the replay page: overrides merged over the defaults in src/lib/replay-content.ts.
alter table events add column if not exists replay_copy jsonb not null default '{}'::jsonb;
