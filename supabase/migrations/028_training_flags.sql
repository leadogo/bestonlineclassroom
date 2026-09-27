-- Free training (SPEC-free-training.md in the site repo, William Sep 26): the site tells us when a registrant
-- crosses Jeremy's hot line from pre-webinar consumption; moderators see it as a badge. Additive.
alter table registrants add column if not exists flags jsonb not null default '{}'::jsonb;
