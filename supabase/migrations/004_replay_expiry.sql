-- Replay access window (Jeremy, William 2026-09-20): honest and enforced. The clock starts at the first open of
-- the replay page and is stored per registrant; the browser only mirrors it.
alter table events add column if not exists replay_hours integer not null default 72;
alter table registrants add column if not exists replay_opened_at timestamptz;
