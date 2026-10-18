-- Each broadcast is scored after the session (SPEC-show-rate-recovery.md W4): emailed → door clicks → emails →
-- joined → at the pitch → booked. Jeremy's rule: bookings decide, four sends of a title before judging it.
alter table skool_broadcasts add column if not exists result jsonb;
alter table skool_broadcasts add column if not exists scored_at timestamptz;
