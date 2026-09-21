-- Phase 4 schedules: a webinar recurs on chosen weekdays (0 = Sunday ... 6 = Saturday) at one start time.
alter table events add column if not exists days smallint[] not null default '{0,1,2,3,4,5,6}';
