-- Reminder emails (SPEC-reminders.md): rules per event, a log per registrant per rule, and a way to stop.
alter table events add column if not exists reminder_rules jsonb not null default '[
  {"key": "before50", "minutes_before": 50, "subject": "{{title}} starts in 50 minutes", "body": "Hi {{first_name}},\n\nWe start in 50 minutes. Your link:\n{{join_url}}\n\nOpen it a few minutes early on your phone or laptop. Turn the sound on when it starts.\n\nSee you there,\n{{host_name}}"},
  {"key": "before30", "minutes_before": 30, "subject": "Starting in 30 minutes: {{title}}", "body": "Hi {{first_name}},\n\n30 minutes to go. Here is your link again:\n{{join_url}}\n\nSee you in the room,\n{{host_name}}"}
]'::jsonb;
alter table registrants add column if not exists no_email boolean not null default false;
create table if not exists reminder_sends (
  registrant_id uuid not null references registrants(id) on delete cascade,
  rule_key text not null,
  sent_at timestamptz not null default now(),
  primary key (registrant_id, rule_key)
);
alter table reminder_sends enable row level security;
