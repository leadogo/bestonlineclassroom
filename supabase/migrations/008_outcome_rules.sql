-- William's tag rules (2026-09-20 evening): attended = at least 15 minutes in the live room; missed = fewer than
-- 15 minutes live (replay does not change that); watched replay = opened the replay page; left early = attended but
-- gone before the pitch; stayed 40 min; asked a question = any chat message; clicked offer; saw offer, no click.

drop view if exists session_metrics;
drop view if exists registrant_outcomes;

create view registrant_outcomes as
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
  (l.registrant_id is not null and e.cta_at_seconds is not null and l.max_offset >= e.cta_at_seconds and coalesce(l.cta_clicked_at, rp.cta_clicked_at) is null) as saw_offer_no_click,
  (l.registrant_id is not null and e.cta_at_seconds is not null and l.max_offset >= e.cta_at_seconds) as live_at_pitch,
  (l.registrant_id is not null) as joined,
  coalesce(l.seconds_watched, 0) as live_seconds,
  coalesce(l.max_offset, 0) as live_max_offset,
  l.joined_at as live_joined_at,
  coalesce(rp.seconds_watched, 0) as replay_seconds
from registrants r
join events e on e.id = r.event_id
left join attendance l on l.registrant_id = r.id and l.session_date = r.session_date and l.kind = 'live'
left join attendance rp on rp.registrant_id = r.id and rp.session_date = r.session_date and rp.kind = 'replay';

create view session_metrics as
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
  coalesce(avg(live_seconds) filter (where joined), 0)::int as avg_live_seconds
from registrant_outcomes
where source <> 'test'
group by event_id, session_date;
