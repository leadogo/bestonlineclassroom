-- Hot track (SPEC-daily-push.md M1): which track a push came from. Group pushes stay 'group'.
alter table push_log add column if not exists track text not null default 'group';
alter table push_runs add column if not exists hot_first integer not null default 0;
alter table push_runs add column if not exists hot_second integer not null default 0;
alter table push_runs add column if not exists hot_graduated integer not null default 0;
