-- SPEC-link-opens.md, A, B, D and G: a link open is not a person.
-- A scanner open is logged as such; a row moved into a session records when; the views count persons (two minutes, a
-- click, or a chat line in that session) as "joined" and keep every row as "visited"/"visits", so Oct 20 reads 131 people
-- from 259 rows from now on. A sub-two-minute row no longer "saw the offer" either (the session-end tag went to scanners).
alter table link_clicks add column if not exists bot boolean not null default false;
alter table registrants add column if not exists moved_in_at timestamptz;

create or replace view registrant_outcomes as
select
  r.id as registrant_id,
  r.event_id,
  r.session_date,
  r.email,
  r.first_name,
  r.source,
  e.cta_at_seconds,
  e.video_seconds,
  true as registered,
  (coalesce(l.seconds_watched, 0) >= 900) as attended,
  (coalesce(l.seconds_watched, 0) < 900) as missed,
  (rp.registrant_id is not null) as watched_replay,
  (coalesce(l.seconds_watched, 0) >= 900 and l.max_offset < coalesce(e.cta_at_seconds, e.video_seconds, 0)) as left_early,
  (coalesce(l.seconds_watched, 0) >= 2400) as stayed_40min,
  exists (select 1 from chat_messages m where m.registrant_id = r.id and m.role = 'attendee') as asked_question,
  (coalesce(l.cta_clicked_at, rp.cta_clicked_at) is not null) as clicked_offer,
  (l.registrant_id is not null and (coalesce(l.seconds_watched, 0) >= 120 or l.cta_clicked_at is not null) and e.cta_at_seconds is not null and l.max_offset >= e.cta_at_seconds and coalesce(l.cta_clicked_at, rp.cta_clicked_at) is null) as saw_offer_no_click,
  (l.registrant_id is not null and (coalesce(l.seconds_watched, 0) >= 120 or l.cta_clicked_at is not null) and e.cta_at_seconds is not null and l.max_offset >= e.cta_at_seconds) as live_at_pitch,
  (l.registrant_id is not null and (coalesce(l.seconds_watched, 0) >= 120 or l.cta_clicked_at is not null
    or exists (select 1 from chat_messages c where c.registrant_id = r.id and c.session_date = r.session_date and c.role = 'attendee'))) as joined,
  coalesce(l.seconds_watched, 0) as live_seconds,
  coalesce(l.max_offset, 0) as live_max_offset,
  l.joined_at as live_joined_at,
  coalesce(rp.seconds_watched, 0) as replay_seconds,
  (l.registrant_id is not null) as visited,
  r.moved_in_at
from registrants r
join events e on e.id = r.event_id
left join attendance l on l.registrant_id = r.id and l.session_date = r.session_date and l.kind = 'live'
left join attendance rp on rp.registrant_id = r.id and rp.session_date = r.session_date and rp.kind = 'replay';

create or replace view session_metrics as
select
  event_id,
  session_date,
  count(*) as registered,
  count(*) filter (where joined) as joined,
  count(*) filter (where attended) as attended,
  count(*) filter (where missed) as missed,
  count(*) filter (where live_at_pitch) as live_at_pitch,
  count(*) filter (where clicked_offer) as clicked_offer,
  count(*) filter (where saw_offer_no_click) as saw_offer_no_click,
  count(*) filter (where watched_replay) as watched_replay,
  count(*) filter (where stayed_40min) as stayed_40min,
  count(*) filter (where asked_question) as asked_question,
  count(*) filter (where left_early) as left_early,
  coalesce(avg(live_seconds) filter (where joined), 0)::int as avg_live_seconds,
  count(*) filter (where visited) as visits,
  count(*) filter (where moved_in_at is not null) as moved_in
from registrant_outcomes
where source <> 'test'
group by event_id, session_date;
