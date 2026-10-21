-- SPEC-post-session.md, C: the day the night report was posted for an event, so the hourly cron posts once (same shape as kaitlyn_digest_on).
alter table events add column if not exists night_report_on date;
