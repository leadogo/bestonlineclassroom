-- Fix and Delete on Kaitlyn's posted lines (William, Oct 18 2026): Fix deletes her line, posts his better one as her
-- to the same person and keeps both on the decision; Delete marks the decision wrong. Both become CORRECTIONS she
-- reads on every message (kaitlyn_corrections, the question as asked with the mention stripped from her line and his).
-- Additive: nothing reads these until the code does.
alter table kaitlyn_decisions add column if not exists improved_text text;

create or replace view kaitlyn_corrections with (security_invoker = true) as
  select d.id, d.event_id, d.session_date, d.status, d.kb_key, m.body as asked,
    case when d.sent_body like '@' || r.first_name || ' %' then substr(d.sent_body, length(r.first_name) + 3) else d.sent_body end as said,
    case when d.improved_text like '@' || r.first_name || ' %' then substr(d.improved_text, length(r.first_name) + 3) else d.improved_text end as fixed
  from kaitlyn_decisions d
  join chat_messages m on m.id = d.message_id
  join registrants r on r.id = d.registrant_id
  where d.status in ('fixed', 'deleted') and d.sent_body is not null;
-- The tables behind it have RLS with no policies; the view must not be a way around that for the public keys.
revoke all on kaitlyn_corrections from anon, authenticated;
