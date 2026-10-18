-- One atomic touch of a knowledge row (review of Oct 17: the read-then-write raced when two messages named the same new
-- key at once). A known key counts another ask; a new key opens a row for William. The question is never overwritten.
create or replace function kaitlyn_kb_touch(p_event uuid, p_key text, p_question text) returns void
language sql as $$
  insert into kaitlyn_kb (event_id, key, question, handling, asked, last_asked_at)
  values (p_event, p_key, coalesce(nullif(p_question, ''), p_key), 'open', 1, now())
  on conflict (event_id, key) do update
    set asked = kaitlyn_kb.asked + 1, last_asked_at = now(), updated_at = now();
$$;
