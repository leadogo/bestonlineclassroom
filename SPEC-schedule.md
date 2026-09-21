# Spec: schedule

Module of [SPEC.md](SPEC.md). Depends on: nothing. Consumed by: every room and API route.

## Objective
One rule decides every instant in the app: an event runs one session a day at `events.start_time` in
`events.timezone` (tonight: 17:00 America/Edmonton), lasting exactly `events.video_seconds`. The rule is the
site's `daily-schedule.ts` generalised from constants to an event, plus one function the room calls.

## This repo
- `src/lib/tz.ts`: copied from the site verbatim.
- `src/lib/daily-schedule.ts`: copied, with `TZ`, `START_HOUR`, `SESSION_MINUTES` replaced by a `Schedule`
  argument `{ timezone, startHour, startMinute, seconds }` on `nextSession`, `sessionFor`,
  `currentOrNextSession`. `Session = { start, end, date }` unchanged. Everything EasyWebinar-specific
  (`easyWebinarSlot`, `acFields`, `fourZones`, `liveLinkTarget`) is left out.
- `roomState(schedule, now, date?)`: for a registrant's `date` use `sessionFor(date)`; otherwise
  `currentOrNextSession(now)`. Returns `{ state: "countdown" | "live" | "ended", session, offsetSeconds }` where
  `offsetSeconds = floor((now - start) / 1000)` clamped to `[0, seconds]`. `ended` when `now >= end`.
- `scheduleOf(event)` builds the `Schedule` from an `events` row.

## Testing
`src/lib/daily-schedule.test.ts` (the site's cases re-pointed at a `Schedule`) plus `roomState`: 16:59:59 MT →
countdown with offset 0; 17:00:00 → live offset 0; 17:45:00 → live offset 2700; start + video_seconds → ended;
a registrant dated tomorrow at 18:00 tonight → countdown for tomorrow; DST boundary 2026-11-01 still 17:00 local.

## Boundaries
- Never: cache a session across requests; compute an offset in the browser from the phone's clock alone (the
  server sends `offsetSeconds` and `serverNow`, the page advances from there).

## Success criteria
`npm test` green; the room opened at 17:45 MT shows the video at 45:00.
