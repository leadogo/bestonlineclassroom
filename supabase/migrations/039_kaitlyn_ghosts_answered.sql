-- The ghost view (038) also says how many times the team had answered the person before the line that got them
-- ghosted. The nag rule (SPEC-kaitlyn-ghosts.md, B1) turns on exactly that: "I can't get an answer" after three answers
-- is a ghost; the same words from someone nobody answered is a see-me reply. Column appended, so the view is replaced in place.
create or replace view kaitlyn_ghosts with (security_invoker = true) as
  select r.id as registrant_id, r.event_id, r.session_date, r.first_name, r.ghosted_at,
    case when r.auto_ghost_reason like 'by hand: %' then substr(r.auto_ghost_reason, 10) end as reason,
    t.id as line_id, t.body as line,
    (select array_agg(x.body order by x.id) from (select b.id, b.body from chat_messages b where b.registrant_id = r.id and b.role = 'attendee' and b.id < t.id order by b.id desc limit 2) x) as context,
    (select count(*) from chat_messages a where a.role = 'moderator' and r.id::text = any(a.mentions) and a.id < t.id)::int as answered
  from registrants r
  join lateral (
    select m.id, m.body from chat_messages m
    where m.registrant_id = r.id and m.role = 'attendee' and m.created_at <= r.ghosted_at + interval '2 seconds'
    order by (m.visibility = 'author') desc, m.id desc
    limit 1
  ) t on true
  where r.ghosted_at is not null and coalesce(r.source, '') <> 'test'
    and (r.auto_ghost_reason is null or r.auto_ghost_reason like 'by hand%');
revoke all on kaitlyn_ghosts from anon, authenticated;
