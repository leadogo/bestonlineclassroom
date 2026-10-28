-- A knowledge row William marks "ghost" (Oct 28 answer desk): a line that means it is hidden on the spot, not answered and
-- not merely skipped ("Scam?", "the others are bots", a vomit emoji, a service pitch, "my questions are answered by AI"). Additive.
alter table kaitlyn_kb drop constraint if exists kaitlyn_kb_handling_check;
alter table kaitlyn_kb add constraint kaitlyn_kb_handling_check check (handling in ('open', 'answer', 'me', 'ignore', 'ghost'));
