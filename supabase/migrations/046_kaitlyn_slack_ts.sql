-- The Slack post behind a "Kaitlyn needs you" card (SPEC-slack-notifications, Oct 26 2026): a repeat of the same question
-- tonight edits the first post ("asked 3×") instead of posting again, so the ts is kept on the decision that posted it.
-- One card per question per session holds a ts (the partial unique index): two cards for the same key in a burst race
-- for the claim, the loser edits the winner's post. The claim writes 'pending' first, the real ts after the post.
alter table kaitlyn_decisions add column if not exists slack_ts text;
create unique index if not exists kaitlyn_decisions_needs_you_once on kaitlyn_decisions (event_id, session_date, kb_key) where slack_ts is not null;
