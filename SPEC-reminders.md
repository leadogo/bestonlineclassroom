# Spec: reminders

Module of [SPEC.md](SPEC.md). Depends on: `data-model`, `admin`. Built 2026-09-20 evening (phase 2 task R1);
**sending switches on when William adds a Postmark server token and a verified sender.**

## Objective
Our own reminder emails, from our domain, at 50 and 30 minutes before the session, with the person's own link,
sent once each and stoppable in one click. ActiveCampaign's emails and the off-platform SMS keep running beside
them; ours are the ones we control and can see.

## Rules (`events.reminder_rules`)
`[{ key, minutes_before, subject, body }]`, edited in `/admin/events/<slug>` (Reminders section). Placeholders:
`{{first_name}}`, `{{title}}`, `{{host_name}}`, `{{join_url}}`, `{{replay_url}}`, `{{start_local}}`. Defaults
seeded by migration 007 (50 and 30 minutes). A stop link is appended to every email: `/u/<token>` sets
`registrants.no_email`.

## Sending
- `/api/cron/reminders` every 5 minutes (`CRON_SECRET`): for each event's next session, the rules whose send
  moment falls in the last ten minutes, to every registrant of that session with an email, not stopped, not a
  Test Sample; `reminder_sends` (registrant, rule) makes it once. `?dry=1` lists who would get what.
- Postmark (`POSTMARK_SERVER_TOKEN`, `REMINDER_FROM`), transactional stream, plain text plus minimal HTML, tag =
  rule key. Bounces and spam complaints are handled on Postmark's side (suppression list); we do not resend.
- **Before the first send (William)**: a Postmark server, the sender domain verified with DKIM and a return-path
  record on `bestonlineclassroom.com`, the token and the From address in Doppler prd.

## Testing
- `src/lib/reminders.test.ts`: placeholder rendering, which rules are due in a window (including a slow tick),
  HTML from text.
- Live: `?dry=1` at 16:12 MT lists the 50-minute rule for tomorrow's registrants; a Test Sample never appears.

## Boundaries
- Never: send to a Test Sample; send the same rule twice; send without a stop link; a marketing message on this
  stream.
- Ask first: a third rule; a post-session email (the replay link belongs to the Zap / ActiveCampaign today).
