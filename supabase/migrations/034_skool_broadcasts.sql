-- The Wednesday/Sunday Skool broadcast (SPEC-show-rate-recovery.md W2): one row per attempt, one posted row per day.
create table if not exists skool_broadcasts (
  id uuid primary key default gen_random_uuid(),
  group_slug text not null,
  broadcast_date date not null,
  weekday text not null,
  title text not null,
  body text not null,
  status text not null check (status in ('dry_run', 'posted', 'failed')),
  post_url text,
  error text,
  created_at timestamptz not null default now()
);
create unique index if not exists skool_broadcasts_one_post_a_day on skool_broadcasts (group_slug, broadcast_date) where status = 'posted';
