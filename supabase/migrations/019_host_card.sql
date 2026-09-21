-- The host on the countdown page and (later) the tap-to-reveal card: a photo and one line of credentials.
alter table events add column if not exists host_avatar_url text;
alter table events add column if not exists host_tagline text;
