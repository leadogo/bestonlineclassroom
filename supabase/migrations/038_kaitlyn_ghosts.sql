-- Kaitlyn learns from the desk's edits and from William's by-hand ghosts (SPEC-kaitlyn-ghosts.md, A4 and B3).
-- 1. kaitlyn_corrections also returns status 'edited' (a draft of hers the desk reworded before sending): her draft as
--    `said`, what was sent as `fixed`. Same columns as migration 036, so the app's query is unchanged.
-- 2. kaitlyn_ghosts: one row per person ghosted by hand (no rule reason, or the desk's "by hand: <reason>"), with the
--    line the ghost came from (the hidden line at or before the ghost, else their last line before it), their two lines
--    before that, and the reason. Read into her prompt as LINES THE TEAM GHOSTED; an Unghost drops the row by itself.
drop view if exists kaitlyn_corrections;
create view kaitlyn_corrections with (security_invoker = true) as
  with raw as (
    select d.id, d.event_id, d.session_date, d.status, d.kb_key, d.message_id, d.registrant_id,
      case when d.status = 'edited' then d.text else d.sent_body end as said_raw,
      case when d.status = 'edited' then d.sent_body else d.improved_text end as fixed_raw
    from kaitlyn_decisions d
    where d.status in ('fixed', 'deleted', 'edited')
  )
  select x.id, x.event_id, x.session_date, x.status, x.kb_key, m.body as asked,
    case when x.said_raw like '@' || r.first_name || ' %' then substr(x.said_raw, length(r.first_name) + 3) else x.said_raw end as said,
    case when x.fixed_raw like '@' || r.first_name || ' %' then substr(x.fixed_raw, length(r.first_name) + 3) else x.fixed_raw end as fixed
  from raw x
  join chat_messages m on m.id = x.message_id
  join registrants r on r.id = x.registrant_id
  where x.said_raw is not null;
revoke all on kaitlyn_corrections from anon, authenticated;

create view kaitlyn_ghosts with (security_invoker = true) as
  select r.id as registrant_id, r.event_id, r.session_date, r.first_name, r.ghosted_at,
    case when r.auto_ghost_reason like 'by hand: %' then substr(r.auto_ghost_reason, 10) end as reason,
    t.id as line_id, t.body as line,
    (select array_agg(x.body order by x.id) from (select b.id, b.body from chat_messages b where b.registrant_id = r.id and b.role = 'attendee' and b.id < t.id order by b.id desc limit 2) x) as context
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
