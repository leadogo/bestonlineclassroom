-- Email two-factor for the team (William, 2026-09-20 late): a 6-digit code on a device we have not seen, then a
-- signed cookie marks the device trusted for 90 days.
create table if not exists login_codes (
  user_id uuid primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now()
);
create table if not exists trusted_devices (
  user_id uuid not null,
  device_id text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  primary key (user_id, device_id)
);
alter table login_codes enable row level security;
alter table trusted_devices enable row level security;
