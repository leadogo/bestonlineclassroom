-- Links sent before the cutover keep working with the same key: the EasyWebinar join hash lives on the registrant.
-- Skool invites go out once per registrant.
alter table registrants add column if not exists legacy_key text;
create index if not exists registrants_legacy_key on registrants (legacy_key) where legacy_key is not null;
alter table registrants add column if not exists skool_invited_at timestamptz;
