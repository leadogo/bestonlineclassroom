-- New events default to the AI Leads masterclass clock: 7 PM Eastern (SPEC-webinar-7pm-eastern, 1 Nov 2026).
-- Defaults only; no row changes (ailg-r was moved to America/New_York 19:00 by hand that day).
alter table events alter column timezone set default 'America/New_York';
alter table events alter column start_time set default '19:00';
