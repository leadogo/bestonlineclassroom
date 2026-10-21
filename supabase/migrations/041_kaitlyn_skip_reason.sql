-- SPEC-kaitlyn-solo.md, E: why the desk skipped one of Kaitlyn's drafts (wrong, already answered, not needed, roll-call).
-- Only "wrong" teaches her: the corrections view (036) gains those skips, with her draft as what she "said" and no fixed line,
-- so her prompt reads them as lines the team removed. Same columns as 036, replaced in place.
alter table kaitlyn_decisions add column if not exists skip_reason text;
create or replace view kaitlyn_corrections with (security_invoker = true) as
  select d.id, d.event_id, d.session_date, d.status, d.kb_key, m.body as asked,
    case when d.status = 'skipped' then d.text
         when d.sent_body like '@' || r.first_name || ' %' then substr(d.sent_body, length(r.first_name) + 3) else d.sent_body end as said,
    case when d.improved_text like '@' || r.first_name || ' %' then substr(d.improved_text, length(r.first_name) + 3) else d.improved_text end as fixed
  from kaitlyn_decisions d
  join chat_messages m on m.id = d.message_id
  join registrants r on r.id = d.registrant_id
  where (d.status in ('fixed', 'deleted') and d.sent_body is not null)
     or (d.status = 'skipped' and d.skip_reason = 'wrong' and coalesce(d.text, '') <> '');
revoke all on kaitlyn_corrections from anon, authenticated;
