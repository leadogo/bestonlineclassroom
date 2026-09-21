-- Round four (2026-09-21 00:30): the offer banner's own icon and the slim strip's icon, a dark square for the lock
-- screen card, and closed captions from the transcript.
alter table events add column if not exists cta_icon_url text;
alter table events add column if not exists cta_strip_icon_url text;
alter table events add column if not exists artwork_url text;
alter table events add column if not exists captions_url text;
