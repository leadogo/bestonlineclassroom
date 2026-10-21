# Spec: post-session (the tags, the night report, the small fixes)

Module of [SPEC.md](SPEC.md). Depends on: `analytics` (the outcomes cron, `registrant_outcomes`, `session_metrics`),
`kaitlyn-knowledge` (the 9 AM digest), `registration-webhook`, the client wall (`SPEC-phase7.md`), `link-opens`.
Proposed Oct 21 2026 midday from William's "if there's anything else you suggest to improve" and approved the same
hour ("yes the post-session tags need to be fixed and all other smaller things"). Built in two batches: this spec's
A to E the same afternoon; `link-opens` A, B and D on Thursday morning (its own spec carries them).

## What happened
- **The outcome tags stalled after the 770-registrant night.** `/api/cron/outcomes` (every 15 minutes, `maxDuration`
  300) tags each registrant of the last 8 days in ActiveCampaign with what they did; the AILGR Missed, Stayed and Left
  Early automations (the replay emails, now the replay text too) fire from those tags. `tagContact` sends two unpaced
  requests per tag (a contact lookup and the tag) with no retry on a 429, and the night left about 2,700 tags to push
  (dry run Oct 21 11 AM: missed 758, registered 1,000, attended 242, watched 40 min 208, saw offer 127, asked 204,
  clicked 99, replay 14). ActiveCampaign throttles at 5 requests a second, so one to ten tags land per run and every run
  dies at 300 s (Vercel log 10:45 AM: "Task timed out after 300 seconds"). Owed for Oct 20 alone at 11 AM: 500 missed,
  90 attended, 414 registered. Before Oct 20 the daily volume (80 to 200 tags) fit under the limit, so nobody noticed the
  shape of the problem. The `registrant_outcomes` query itself takes a second.
- **Nothing watches the push.** The failure was found by reading the replay numbers, not by an alert.
- **The replay path is small even when the tags flow:** 3 to 6 human replay viewers a day against 60 to 100 no-shows
  a night. The replay emails' button is `%REPLAYLINK%` (correct); William added a replay text Oct 21.
- **The client-wall sync** (`POST /api/client-wall` every 30 minutes from bms-dashboard) calls `client_wall_apply`, 816
  calls at a mean of 3.1 s and a max of 7.7 s since Sep 21, including the two or three runs that land inside a session
  on a Micro database that otherwise answers in under a millisecond.
- **The room's Skool invite** (`src/lib/skool.ts`, a GET to Skool's webhook on every registration) has returned 405
  since the Sep 20 launch; `skool_invited_at` is null for everyone. William (Oct 21): Zapier invites on opt-in, so the
  call is dead code: one error line and a wasted request per registration.
- **The session report** William asked for on Oct 20 was written by hand (the Claude doc). The numbers in it are all
  in the room's tables.

## Objective
Every tag reaches ActiveCampaign within the hour after a session, whatever the crowd; the morning digest says when the
push is behind; the night's numbers post themselves at 7:50 PM; the two bits of noise are gone.

## Changes
A. **The push finishes.** `src/lib/activecampaign.ts`: `api()` paces calls at least 210 ms apart (module clock) and
   retries a 429 once after 1.5 s. `src/lib/outcome-push.ts` (new) owns the planning the cron did inline: the rows of
   the last 8 days, the tags each still needs, ordered **newest session first, session-end tags (attended, missed,
   left early, stayed 40, saw offer) before the rest**, one contact lookup per email per run (a Map), and a time
   budget (`PUSH_BUDGET_MS = 240_000`): the run returns `{ sent, owed }` when the budget is spent and the next run
   continues. The cron route becomes a thin caller; `?dry=1` still lists. At 5 requests a second that is about 550
   tags per run, so the Oct 20 backlog clears in five runs and a Tuesday night in two.
B. **The digest says when the push is behind.** The 9 AM Kaitlyn digest gains one line when the owed count (the dry
   plan's length) is 50 or more: "Outcome tags owed to ActiveCampaign: N (the push is behind)". Below 50, nothing.
C. **The night report.** `/api/cron/night-report` (hourly at :50, posts when it is 7 PM in the event's zone, the
   session ended, and nothing posted today; `events.night_report_on date` records the day, like the digest). One
   Slack line to #autoweb-intel per event with a session that day:
   "Wed Oct 21 · 131 people (7-night median 40) · peak 96 · 95 at the pitch · 43 offer clicks · 72 stayed 40+ ·
   37 booked (median 13)" and, when promo email taps exist that afternoon (`link_clicks` with `src = email` between
   3 PM and the pitch, scanner agents out): "Emails: 59 human taps → 13 watched → 5 booked". People = the two-minute
   rule (`seconds_watched >= 120` or a CTA click); peak and at-the-pitch over those people; stayed 40+ =
   `seconds_watched >= 2400`; booked = `bookings` scheduled for the session; the median over the previous seven
   sessions. `src/lib/night-report.ts` is pure (counts from rows, the text); the route reads and posts.
D. **The client-wall sync waits for the room.** While any event is live (`roomState` live) the route stores the wall
   rows and the market counts but does not call `client_wall_apply`; it answers 202 `{ deferred: true }` and the next
   push applies. Walling a client who registers mid-session is delayed by up to the session's length (decision 2).
E. **The dead Skool call goes.** `inviteToSkool` and `src/lib/skool.ts` are removed; `SKOOL_INVITE_WEBHOOK` stays in
   Doppler unused until William deletes it; `registrants.skool_invited_at` stays.

## Data (additive)
```sql
alter table events add column if not exists night_report_on date;
```

## This repo
`src/lib/activecampaign.ts` (A), `src/lib/outcome-push.ts` + test (A, B), `src/app/api/cron/outcomes/route.ts` (A),
`src/lib/kaitlyn-kb.ts` + test and `src/app/api/cron/kaitlyn-digest/route.ts` (B), `src/lib/night-report.ts` + test,
`src/app/api/cron/night-report/route.ts`, `vercel.json` (C), `src/app/api/client-wall/route.ts` (D),
`src/app/api/register/route.ts`, `src/lib/skool.ts` deleted (E), migration 042 (C).

## Plan (the order of work; each task ends green)
Batch 1, Oct 21 afternoon, deployed before 3:30 PM MT: T1 A (pacing, retry, the plan, the budget; tests for the
order and the budget); T2 B (the owed line; test); T3 E (remove); T4 D (defer; the live check is `roomState`); T5 C
(the pure counts and text with a test on Oct 20's rows; the route; the cron; the migration); T6 `npm test`, `tsc`,
eslint, `next build`; a dry run of the cron and of the night report against production; the `/review` pass; merge;
watch the first real cron run clear tags.
Batch 2, built Oct 21 evening, deployed Thursday Oct 22 morning before 3:30 PM MT: `link-opens` A, B, D and G (the
scanner tell, no row move or `room_join` for a scanner open, the backstop move at the 120-second beat, persons in
every counter with "arriving" and "moved in today", the views), each with its test, replay of Oct 20 through the
views (131 people, peak 96), the `/review` pass, merge.

## Testing
- Pure: `orderTags` (newest session first, session-end before registered, done tags left out); `spendBudget` (stops
  at the budget, returns owed); `digestText` with `owed`; `nightReportCounts` on a fixture shaped like Oct 20 (131
  people from 259 rows, 43 offer clicks); `nightReportText` with and without the email line and the medians.
- Production: `GET /api/cron/outcomes?dry=1` lists the same tags as before in the new order; one real run under
  budget pushes and returns `{ sent, owed }` with `owed` falling; `GET /api/cron/night-report?dry=1` returns last
  night's line; the client-wall push at 5:30 PM tonight returns 202 and the 7:30 PM one applies.

## Rollout
Batch 1 today, outside 3:30 to 7:45 PM MT. Rollback: revert the merge; the migration column stays.

## Boundaries
- Never: change what a tag means (`registrant_outcomes` stays the AC contract); push a tag twice; post the night
  report more than once a day; deploy in the window.
- Ask first: a new tag; changing which automation fires on which tag (ActiveCampaign is William's).

## Decisions proposed (say no to any)
1. The order: newest session first, session-end tags before `registered`; a 240 s budget per run.
2. The client-wall apply waits while a session is live (a mid-session client is walled after the session).
3. The night report posts to #autoweb-intel at 7:50 PM in the event's zone; the digest keeps 9 AM.
4. The digest's owed line only at 50 or more.
