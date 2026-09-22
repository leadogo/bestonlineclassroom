-- Phase 5.2, the bookings loop: iClosed bookings pushed in by leadogo and matched to the session they came from
-- (by the room link's rid, else email or phone), so the desk shows bookings live and a book rate against the pitch.
create table if not exists bookings (
  id bigserial primary key,
  source text not null default 'iclosed',
  external_id text not null,
  event_id uuid not null references events(id) on delete cascade,
  session_date date not null,
  registrant_id uuid references registrants(id) on delete set null,
  name text,
  email text,
  phone text,
  booked_at timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
create index if not exists bookings_event_session on bookings (event_id, session_date);
alter table bookings enable row level security;
