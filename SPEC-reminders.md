# Spec: reminders

Module of [SPEC.md](SPEC.md). Depends on: `data-model`, `admin`. Built 2026-09-20 evening (phase 2 task R1);
**sending switches on when William adds a Postmark server token and a verified sender.**

## Objective
Three emails from our domain, each with the person's own link, sent once and stoppable in one click: the
confirmation with a calendar invite the moment someone registers, then reminders 30 and 15 minutes before.
Jeremy's brief (KB `frea-webinar-emails-sep2026`, 2026-09-20): send as "William Kabrall", reply-to
admin@bookmoreshowings.com, a real invite (METHOD:REQUEST) of 1h15 with "full replay available after", his
subject lines, a short footer, opens and links tracked, and the 15-minute email leading with the raw one-tap link.

## Confirmation (`sendConfirmation`, from the registration webhook)
William's template with `#WEBINAR_TIME#`, `#WEBINAR_DATE#`, `#EVENT_LINK#`, `#SKOOL_LINK#` and `{{first_name}}`
style placeholders, editable per event in `/admin` with a switch for the short footer; `invite.ics` attached;
`registrants.confirmation_sent_at` records it. Sample sends from `/admin` to any team address.

## Rules (`events.reminder_rules`)
`[{ key, minutes_before, subject, body }]`, edited in `/admin/events/<slug>` (Reminders section), 30 and 15 minutes by default, a third slot free. Placeholders:
`{{first_name}}`, `{{title}}`, `{{host_name}}`, `{{join_url}}`, `{{replay_url}}`, `{{start_local}}`. Defaults seeded by migrations 007 to 010. A stop link is appended to every email: `/u/<token>` sets
`registrants.no_email`.

## Sending
- `/api/cron/reminders` every 5 minutes (`CRON_SECRET`): for each event's next session, the rules whose send
  moment falls in the last ten minutes, to every registrant of that session with an email, not stopped, not a
  Test Sample; `reminder_sends` (registrant, rule) makes it once. `?dry=1` lists who would get what.
- Postmark (`POSTMARK_SERVER_TOKEN`, `REMINDER_FROM` = William Kabrall, `REPLY_TO` = admin@bookmoreshowings.com),
  transactional stream, plain text plus light HTML, opens and HTML links tracked, tag = rule key. Bounces and
  spam complaints are handled on Postmark's side (suppression list); we do not resend.
- **Before the first send (William)**: a Postmark server, the sender domain verified with DKIM and a return-path
  record on `bestonlineclassroom.com`, the token and the From address in Doppler prd.

## Testing
- `src/lib/reminders.test.ts`: placeholder rendering, which rules are due in a window (including a slow tick),
  HTML from text.
- Live: `?dry=1` at 16:12 MT lists the 50-minute rule for tomorrow's registrants; a Test Sample never appears.

## Boundaries
- Never: send to a Test Sample; send the same rule twice; send without a stop link; a marketing message on this
  stream.
- Ask first: a post-session email (the replay link belongs to the Zap / ActiveCampaign today); turning
  ActiveCampaign's own confirmation and reminders off now that ours exist (William's call).
