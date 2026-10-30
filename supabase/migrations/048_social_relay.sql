-- Stacy's instant DM relay (Meta webhook → Stacy): one row per forwarded message or comment id, for the 24 h
-- de-dupe of Meta's retries and the relay health check. Ids and outcomes only; the message text is never stored.
create table if not exists social_relay_events (
  mid text primary key,
  platform text not null,
  kind text not null,
  received_at timestamptz not null default now(),
  forwarded_at timestamptz,
  error text
);
create index if not exists social_relay_events_received on social_relay_events (received_at desc);
alter table social_relay_events enable row level security;
