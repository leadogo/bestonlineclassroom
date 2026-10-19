-- Tonight's class by minute (SPEC-kaitlyn-transcript.md, B): a short outline of what William covers when, generated once
-- from the transcript (scripts/outline.ts) and editable on the event's Settings page. Kaitlyn's prompt reads it so she can
-- say "he gets to that around minute 75" to a question the class answers later. Additive; empty means no block.
alter table events add column if not exists outline text;
