-- The call to action as a banner (2026-09-20 late, from the test run): a title and a subtitle next to the button.
alter table events add column if not exists cta_title text;
alter table events add column if not exists cta_subtitle text;
