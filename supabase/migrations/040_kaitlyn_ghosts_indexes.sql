-- The ghost view (038, 039) is read on every attendee message; the review of Oct 20 measured ~74 ms of sequential scans.
-- Two additive indexes for its lateral pick and context, and `answered` scoped to the person's own session so it uses the
-- existing (event_id, session_date, id) index. Same columns as 039, replaced in place.
create index if not exists chat_messages_registrant_id on chat_messages (registrant_id, id);
create index if not exists registrants_ghosted_at on registrants (ghosted_at) where ghosted_at is not null;
create or replace view kaitlyn_ghosts with (security_invoker = true) as
  select r.id as registrant_id, r.event_id, r.session_date, r.first_name, r.ghosted_at,
    case when r.auto_ghost_reason like 'by hand: %' then substr(r.auto_ghost_reason, 10) end as reason,
    t.id as line_id, t.body as line,
    (select array_agg(x.body order by x.id) from (select b.id, b.body from chat_messages b where b.registrant_id = r.id and b.role = 'attendee' and b.id < t.id order by b.id desc limit 2) x) as context,
    (select count(*) from chat_messages a where a.event_id = r.event_id and a.session_date = r.session_date and a.role = 'moderator' and r.id::text = any(a.mentions) and a.id < t.id)::int as answered
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
