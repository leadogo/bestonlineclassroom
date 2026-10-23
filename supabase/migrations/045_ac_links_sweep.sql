-- SPEC-friday-unattended.md, E2 and E4: the link sweep's once-per-slot guard and its last counts (for the 9 AM digest).
alter table events add column if not exists ac_links_slot text;
alter table events add column if not exists ac_links_last jsonb;
