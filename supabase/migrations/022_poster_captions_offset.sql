-- A frame to show behind the start button before the video plays, and a captions offset (seconds, may be negative).
alter table events add column if not exists poster_url text;
alter table events add column if not exists captions_offset_seconds numeric not null default 0;
