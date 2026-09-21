-- Links sent by SMS and email carry the person's email and first name, so they walk straight in.
alter table registrants drop constraint if exists registrants_source_check;
alter table registrants add constraint registrants_source_check check (source in ('site', 'zapier', 'skool', 'legacy', 'guest', 'test', 'sms', 'email'));
