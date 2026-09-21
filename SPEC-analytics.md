# Spec: analytics

Module of [SPEC.md](SPEC.md). Depends on: `data-model` (attendance, chat), `admin`. Built 2026-09-20 evening
(phase 2/3 tasks N1 to N4 in `tasks/plan-phase2.md`). The ActiveCampaign tags replace what EasyWebinar's
integration did (William's screenshot, 2026-09-20).

## Objective
The numbers William asked for, from rows we already record, with nothing new to capture: how many joined,
retention, how many were live at the pitch, who clicked; per person, the nine outcomes EasyWebinar tagged; and a
feed leadogo's Funnel Performance can read in place of EasyWebinar's API.

## Definitions (view `registrant_outcomes`, migration 006; test rows excluded from totals)
- **registered**: every registrant with an email (tagged within the hour, once the Zap has created the contact).
- **attended**: at least 15 minutes of live heartbeats. **missed**: fewer than 15 minutes live (a replay does not
  change it). **joined**: any live row (the show-up count on the admin page).
- **live_at_pitch**: furthest live offset ≥ `cta_at_seconds`. **left_early**: attended, furthest offset before
  the pitch. **stayed_40min**: 2400 s or more of live heartbeats.
- **asked_question**: at least one chat message. **clicked_offer**: a CTA click (live or replay).
  **saw_offer_no_click**: live at the pitch and no click. **watched_replay**: opened the replay page.
- **Retention curve**: of joiners, the share whose furthest offset reaches each 10-minute mark.
- `session_metrics`: the counts per event and session date, plus average live seconds.

## Surfaces
- `/admin/events/<slug>/sessions/<date>`: eleven tiles and the retention curve with the pitch marked.
- `GET /api/metrics?event=&date=` (Bearer `REGISTER_SECRET`): the same per session, with `retention` and
  `show_up_rate`, for leadogo. **Follow-up in leadogo-app**: Funnel Performance's `fetchWebinarDailyCounts`
  reads this instead of EasyWebinar; the room-count cron keeps reading `room_join` from the site's `/join`.
- **Tags** (`/api/cron/outcomes`, hourly, `CRON_SECRET`): for sessions in the last 8 days, every registrant with
  an email gets the ActiveCampaign tags their outcomes earn (`events.tags`, default `ailgr_*`). Attended, missed,
  left early, stayed 40 min and saw-offer-no-click wait until 30 minutes after the recording ends; watched replay,
  asked a question and clicked offer go within the hour. `outcome_tags` logs what was sent, so nothing repeats.
  **registered** is sent by the same job, so it no longer depends on the site's own ActiveCampaign call.
- iClosed: planned, not built. iClosed reads the prefill parameters on the CTA link today; a server-side push
  needs their API details from William.

## Testing
- `src/lib/outcomes.test.ts`: which tags go before and after the session end; the retention curve.
- Live: `GET /api/cron/outcomes?dry=1` lists the planned tags; a Test Sample is never tagged (`source = test`).

## Boundaries
- Ask first: any tag beyond the nine; tagging guests (no email, so nothing is sent today); a threshold change.
- Never: tag a Test Sample; send a tag twice; block the room on any of this.
