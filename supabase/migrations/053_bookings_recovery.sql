-- SPEC-bookings-recovery.md. M1: the pushed contact's email, so a push is judged from the classroom's own records.
-- M2: each repeat-miss follow-up run (14-day rule). M4: one rescue text per registrant per session.
alter table push_log add column if not exists email text;

create table if not exists missed_followups (
  contact_id text not null,
  run_date date not null,
  primary key (contact_id, run_date)
);
alter table missed_followups enable row level security;

create table if not exists rescue_texts (
  registrant_id uuid not null,
  session_date date not null,
  tagged_at timestamptz not null default now(),
  primary key (registrant_id, session_date)
);
alter table rescue_texts enable row level security;
