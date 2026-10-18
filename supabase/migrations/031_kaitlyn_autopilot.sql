-- Autopilot (William, Oct 17 2026): per webinar, auto | on | off. auto: Kaitlyn posts her sure answers herself once no
-- moderator has been on the desk for 3 minutes (or from minute 5 of a session nobody opened); on: from the first message;
-- off: never. Decisions made while engaged are marked. Additive; the room ignores both until the code reads them.
alter table events add column if not exists autopilot text not null default 'auto' check (autopilot in ('auto', 'on', 'off'));
alter table kaitlyn_decisions add column if not exists autopilot boolean not null default false;
