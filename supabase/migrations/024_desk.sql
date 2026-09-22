-- Phase 5.1, the moderator desk: a private team channel (chat rows only the team can read; the attendee feed already
-- selects visibility = 'all' or the person's own rows, so 'team' never reaches a phone), and what each moderator is
-- doing on the desk (tab, who they are replying to) for the presence strip.
alter table chat_messages drop constraint if exists chat_messages_visibility_check;
alter table chat_messages add constraint chat_messages_visibility_check check (visibility in ('all', 'author', 'team'));
alter table team_presence add column if not exists tab text;
alter table team_presence add column if not exists replying_to text;
