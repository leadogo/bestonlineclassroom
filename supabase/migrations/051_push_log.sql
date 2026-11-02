-- The daily ActiveCampaign push (src/lib/push-day.ts): one row per contact per push day, read back for the 13-day
-- hold, and one row per run for the Slack line and the next run's open/unsubscribe deltas. Contact ids only.
create table if not exists push_log (
  contact_id text not null,
  push_date date not null,
  group_no smallint not null,
  primary key (contact_id, push_date)
);
create index if not exists push_log_date on push_log (push_date desc);
alter table push_log enable row level security;

create table if not exists push_runs (
  push_date date primary key,
  group_no smallint not null,
  tagged integer not null,
  skipped_reengagement integer not null,
  skipped_hold integer not null,
  assigned_new integer not null,
  failed integer not null,
  email_stats jsonb,
  created_at timestamptz not null default now()
);
alter table push_runs enable row level security;
