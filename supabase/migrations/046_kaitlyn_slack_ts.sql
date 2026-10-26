-- The Slack post behind a "Kaitlyn needs you" card (SPEC-slack-notifications, Oct 26 2026): a repeat of the same question
-- tonight edits the first post ("asked 3×") instead of posting again, so the ts is kept on the decision that posted it.
alter table kaitlyn_decisions add column if not exists slack_ts text;
