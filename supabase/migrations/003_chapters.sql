-- Replay chapters per event: [{ "at": seconds, "label": "Offer and next steps" }, ...]. Edited by the admin UI later.
alter table events add column if not exists chapters jsonb not null default '[]'::jsonb;
