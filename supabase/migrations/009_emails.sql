-- The three emails (SPEC-reminders.md, revised 2026-09-20 late): a confirmation with a calendar invite on opt-in,
-- then reminders 30 and 15 minutes before. Instant tags need to know a join was reported once.
alter table events add column if not exists confirmation jsonb not null default '{}'::jsonb;
alter table registrants add column if not exists confirmation_sent_at timestamptz;
alter table registrants add column if not exists room_join_reported_at timestamptz;
update events set reminder_rules = '[
  {"key": "before30", "minutes_before": 30, "subject": "Starting in 30 minutes: {{title}}", "body": "Hi {{first_name}},\n\nWe start in 30 minutes. Your private link:\n{{join_url}}\n\nOpen it a few minutes early, on a laptop if you can, and turn the sound on when it starts.\n\nSee you there,\n{{host_name}}"},
  {"key": "before15", "minutes_before": 15, "subject": "15 minutes: your link to join", "body": "Hi {{first_name}},\n\n15 minutes to go. Here is your link again:\n{{join_url}}\n\nSee you in the room,\n{{host_name}}"}
]'::jsonb;
