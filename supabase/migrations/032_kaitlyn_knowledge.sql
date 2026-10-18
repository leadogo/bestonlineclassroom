-- Kaitlyn's knowledge base (William, Oct 17 2026): one row per question the room asks, folded by meaning (the model names
-- the key), with William's answer, the humanizer line he approved, and how she treats it. Her prompt reads the approved
-- lines from here; the admin page is where he answers; a 9 AM digest lists what is still open. Additive.
create table if not exists kaitlyn_kb (
  event_id uuid not null references events(id) on delete cascade,
  key text not null,
  question text not null,
  answer text,
  approved text,
  handling text not null default 'open' check (handling in ('open', 'answer', 'me', 'ignore')),
  asked integer not null default 0,
  last_asked_at timestamptz,
  answered_at timestamptz,
  answered_by uuid references team_members(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, key)
);
alter table kaitlyn_kb enable row level security;
alter table kaitlyn_decisions add column if not exists kb_key text;
alter table events add column if not exists kaitlyn_digest_on date;
