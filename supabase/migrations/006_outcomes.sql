-- Analytics (SPEC-analytics.md): what each registrant did, per session, from rows we already have; and the
-- per-session totals. Tags sent to ActiveCampaign are logged so nobody is tagged twice.

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
  (l.registrant_id is not null) as attended,
  (l.registrant_id is null and rp.registrant_id is null) as missed,
  (rp.registrant_id is not null and rp.seconds_watched >= 60) as watched_replay,
  (l.registrant_id is not null and l.max_offset < coalesce(e.cta_at_seconds, e.video_seconds, 0)) as left_early,
  (l.registrant_id is not null and l.seconds_watched >= 2400) as stayed_40min,
  exists (select 1 from chat_messages m where m.registrant_id = r.id and m.role = 'attendee') as asked_question,
  (coalesce(l.cta_clicked_at, rp.cta_clicked_at) is not null) as clicked_offer,
  (l.registrant_id is not null and e.cta_at_seconds is not null and l.max_offset >= e.cta_at_seconds and coalesce(l.cta_clicked_at, rp.cta_clicked_at) is null) as saw_offer_no_click,
  (l.registrant_id is not null and e.cta_at_seconds is not null and l.max_offset >= e.cta_at_seconds) as live_at_pitch,
  coalesce(l.seconds_watched, 0) as live_seconds,
  coalesce(l.max_offset, 0) as live_max_offset,
  l.joined_at as live_joined_at,
  coalesce(rp.seconds_watched, 0) as replay_seconds
from registrants r
join events e on e.id = r.event_id
left join attendance l on l.registrant_id = r.id and l.session_date = r.session_date and l.kind = 'live'
left join attendance rp on rp.registrant_id = r.id and rp.session_date = r.session_date and rp.kind = 'replay';

create or replace view session_metrics as
select
  event_id,
  session_date,
  count(*) as registered,
  count(*) filter (where attended) as attended,
  count(*) filter (where missed) as missed,
  count(*) filter (where live_at_pitch) as live_at_pitch,
  count(*) filter (where clicked_offer) as clicked_offer,
  count(*) filter (where saw_offer_no_click) as saw_offer_no_click,
  count(*) filter (where watched_replay) as watched_replay,
  count(*) filter (where stayed_40min) as stayed_40min,
  count(*) filter (where asked_question) as asked_question,
  count(*) filter (where left_early) as left_early,
  coalesce(avg(live_seconds) filter (where attended), 0)::int as avg_live_seconds
from registrant_outcomes
where source <> 'test'
group by event_id, session_date;

create table if not exists outcome_tags (
  registrant_id uuid not null references registrants(id) on delete cascade,
  tag text not null,
  sent_at timestamptz not null default now(),
  primary key (registrant_id, tag)
);
alter table outcome_tags enable row level security;

-- Tag names per event, the nine EasyWebinar actions; edited in the admin later.
alter table events add column if not exists tags jsonb not null default '{
  "registered": "ailgr_registered", "attended": "ailgr_attended", "missed": "ailgr_missed",
  "watched_replay": "ailgr_watchedreplay", "left_early": "ailgr_leftearly", "stayed_40min": "ailgr_watched40min",
  "asked_question": "ailgr_askedquestion", "clicked_offer": "ailgr_clickedoffer", "saw_offer_no_click": "ailgr_sawoffernoclick"
}'::jsonb;
