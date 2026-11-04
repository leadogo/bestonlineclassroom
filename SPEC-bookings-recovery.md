# SPEC — Bookings recovery (M1–M6), Nov 4 2026

Status: APPROVED. William marked all six pieces Go on the review page (Nov 4 2026, 12:19 PM ET), including the draft
rescue text and Katherine opener; no notes, no added ideas. Plan doc: https://claude.ai/artifact/5P9DV6eVruZw8U2G6dffGv
(plan tab + Build spec tab). Review page: https://claude.ai/artifact/3yk1AT7v3j7T9f82fkh7ba. Jeremy conversation
`b27fd1ef-8d1a-4463-afdb-92e3ad1df7b2`. Builds on SPEC-daily-push.md.

## Objective
Win back bookings (23/day Oct 19–25 → 12/day Nov 2–3) without more ad spend: older contacts back in the room, Katherine
reaching tonight's registrants, a same-night rescue for offer clickers who did not book, and one view of all Katherine jobs.

## Modules, apps, waves
| Id | Piece | Repo(s) | Wave |
| --- | --- | --- | --- |
| M1 | Push judged on clicks/watchers/bookings | bestonlineclassroom (+ AC link edit) | 1 |
| M2 | Repeat missers re-enter 172/192 after 14 days | bestonlineclassroom (+ AC trigger edits) | 1 |
| M3 | Katherine dials tonight's registrants first | katherine-v5 | 1 |
| M4 | Post-pitch rescue: Roezan text + Katherine call | bestonlineclassroom + katherine-v5 (+ new AC automation) | 2 |
| M6 | "What Katherine is doing" board | katherine-v5 (lanes endpoint) + leadogo-app | 2 |
| M5 | Daytime re-invites 10 AM–4 PM ET, spaced | katherine-v5 | 3 (after 72 h of wave 2) |

Code ships per wave; AC edits are made only at ship time, each read back through the API.

## M1 Push measurement
- Push email links (AC campaigns 6239, 6241) `?src=email` → `?src=push` (AC edit at ship).
- Cron reads email counters BEFORE the first tag; previous push judged from classroom records: pushed contacts (push_log,
  AC contact id → registrant by email) who clicked a `src=push` link (non-bot, non-Linux-desktop), watched ≥120 s,
  reached the pitch (max_offset ≥ 4500), booked (bookings after the push). Until the link edit, `src=email` counts.
- Tripwires: click-through < 5% of pushed, unsubscribes > 2.5% of pushed (AC unsubscribe counter delta).
- Pure `pushResult()` in `src/lib/push-day.ts`; Slack line in `pushNotice`.

## M2 Repeat missers
- AC: automation 172 trigger (tag added `ailgr_missed`) and 192 trigger (tag added `ailgr_nurturemissed`) → Runs: multiple.
- Outcome push, for a registrant whose outcome is `missed`: pure `missedAction(lastRun, alreadyTagged, today)` →
  `first` (add tag), `rerun` (remove 306 + 339, then add 306) when last run ≥ 14 days ago or never logged but already
  tagged, `skip` inside 14 days. Log in `missed_followups` (contact_id, run_date). Migration 053.

## M3 Registrants first (katherine-v5)
- Import: rows of lists `no_show` and `reinvite` get `next_attempt_at` = the 18:15 ET slot of the session day; `day_of`
  keeps 17:30 (late sign-ups keep their own time). Verify the cron's fair-share due query orders by next_attempt_at.
- Target: ≥ 90% of day-of call rows dialed.

## M4 Post-pitch rescue
- Classroom endpoint `GET /api/registrants/rescue?event=ailg-r&date=YYYY-MM-DD` (Bearer CLASSROOM_API_SECRET):
  `{ rescue: [...], second_ring: [...] }`, each item `{ id, token, first_name, email, phone, join_url, session_date,
  clicked_at? }`. rescue = clicked the offer in that session, no booking at/after the click, click ≥ 15 min ago, not
  blocked, not test. second_ring = that session's attendees who reached the pitch, did not click, no booking.
- Classroom cron (every 5 min, 8:15–10:45 PM ET): for new rescue people, add AC tag `ailgr_rescue` once per
  registrant per session (`rescue_texts` log, migration 053). AC automation "AILGR Rescue text" (trigger: tag added,
  multiple) → Roezan text → remove tag. Text (approved): "Hi %FIRSTNAME%, it's William's team. Looked like you were
  picking a time for your call. Here's the calendar again: https://aiforagentsmasterclass.com/join-community?src=rescue"
- Katherine: new list `rescue` (pool `rescue`, mode `rescue`): rows 30–60 min after the click, ahead of other lists;
  time zone from the phone's area code; after 8:55 PM local → 10:00 AM local next day. Every 5th = holdout (text only).
  Second ring: list `reinvite` pool `pitch_no_click`, next evening, cap 15, mode `reinvite_attended`.
  Opener (approved): "Hi {name}, it's Katherine with William's team. Saw you were picking a time on the calendar after
  the masterclass, did you have trouble finding a slot? I can help you grab one."

## M6 Board
- Katherine `GET /api/masterclass/lanes?date=` (insights secret): per list/pool today queued/dialed/answered/booked,
  per-number per-hour dials, alerts. leadogo: new first tab "What she's doing" on /sales/katherine, PAR from
  par_outreach(_touches); confirm PAR's calling number.

## M5 Daytime re-invites (wave 3)
- `no_show`/`reinvite` rows: window 10:00–16:00 ET, `next_attempt_at` spaced ~1/min per number; nobody before 10 AM local.

## Commands
classroom `npm test`, `npx tsc --noEmit -p .`, `npm run db:migrate`; katherine `npx vitest run lib/masterclass`,
dry run `scripts/masterclass-reinvite-plan.ts --date`; leadogo the repo's tests + tsc.

## Boundaries
Always: dry run before live; quiet hours 8 AM–9 PM recipient local; every 5th held back on new calls/texts; one PR per
repo per wave. Ask first: copy changes, AC edits (made at ship, read back), number changes. Never: raise the 60/hour
cap, contact blocked/DNC/unsubscribed/booked people, pause a live Zap, RevRing.
