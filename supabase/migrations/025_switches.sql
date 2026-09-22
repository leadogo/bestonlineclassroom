-- Phase 5.3 switches, off by default, turned on per event from Settings (test-run first, then ailg-r):
-- Katherine AI answers replay questions; the crowd shown in the People tab thins as the session runs (Jeremy's curve).
alter table events add column if not exists katherine_enabled boolean not null default false;
alter table events add column if not exists people_curve_enabled boolean not null default false;
