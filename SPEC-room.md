# Spec: room

Module of [SPEC.md](SPEC.md). Depends on: `schedule`, `data-model`. Consumed by: `chat`, `moderator`,
`site-cutover`.

## Objective
A page that always lets people in and feels like Zoom: countdown before the session, the video playing at the
live offset during it, the CTA at 1:15:00, and the booking page after. Every open, heartbeat, leave and CTA
click lands in `attendance` so we know who came, how long they stayed and who clicked.

## Entry points
- `/j/<token>`: the registrant's link. Unknown token → a plain "This link isn't valid" page with the site link.
- `/w/<slug>`: the open link (Skool, legacy). Resolution in order: `eh` (email hash) matching a registrant for
  the session → that registrant; `rid` matching `site_registration_id` → that registrant; else a one-field
  first-name prompt that creates a guest registrant (`source` = `src` param if one of skool/legacy, else guest;
  `site_registration_id = rid` when given) and sets a cookie so a reload keeps the identity.
- Query params on either entry are stored on `attendance.params` (allowlisted keys, ≤ 20, ≤ 200 chars) and
  appended to the CTA href.
- Team preview: a signed-in team member may add `?at=<seconds>` to force `live` at that offset.

## Behaviour by state (`roomState`)
- **countdown**: title, "Starts in mm:ss" from the server-supplied start, the four-zone time line; flips to live
  on the client at the start instant without a reload (the client keeps `serverNow - clientNow` as the skew).
- **live**: `<video playsInline muted autoPlay preload="auto">` with no controls. On `loadedmetadata`
  `currentTime = offset + elapsedSinceRender`; on `canplay` `play()`. "Click for sound" overlay unmutes on tap.
  Every 30 s, if `|currentTime - expected| > 5` seek to expected. "LIVE · 47m 20s" pill. Stalled > 5 s shows a
  small "Reconnecting…" line, never a spinner over the whole stage. Full screen on the whole room container;
  iOS Safari falls back to the video element.
- **ended**: `302` to `events.end_url`, with the room's query params appended.
- A registrant whose `session_date` is past opens the ended state; one dated in the future gets that date's
  countdown.

## Layout (Zoom-shaped, dark)
Top bar: title left, "LIVE" pill, Full screen. Stage: the video, 16:9, letterboxed on a dark surface. Right
panel (bottom sheet on phones): Chat and People tabs, unread badge on Chat. Bottom of the stage: the CTA bar
when active. Colours and type in `src/lib/theme.ts`; the design pass later restyles without touching data flow.

## Tracking
- `POST /api/heartbeat { token, offset, params? }` on open, every 30 s, and on `pagehide` by `sendBeacon`.
  Upsert: `joined_at = coalesce(joined_at, now)`, `last_seen_at = now`, `seconds_watched += min(30, wall
  delta)`, `max_offset = greatest(max_offset, offset)`.
- CTA: visible while `cta_at_seconds ≤ offset < cta_hide_seconds`. Href = `cta_href` + the registrant's
  `first_name`, `email`, `phone`, `rid` (registrant id) + the stored params. Click → `sendBeacon("/api/cta")` sets
  `cta_clicked_at`, then opens the href in a new tab.

## This repo
`src/app/j/[token]/page.tsx`, `src/app/w/[slug]/page.tsx` (both `force-dynamic`; they load the registrant,
event and state, and render `<Room>`), `src/components/room/{Room,TopBar,VideoStage,CtaBar,PeoplePanel}.tsx`,
`src/app/api/heartbeat/route.ts`, `src/app/api/cta/route.ts`, `src/app/api/people/route.ts` (host + real
attendees with `last_seen_at` within 120 s, first names only), `src/lib/cta.ts` (`ctaHref`), `src/lib/params.ts`.

## Testing
- `src/lib/cta.test.ts`: href assembly keeps the target's own query, appends fields and params, drops unknown
  keys, encodes. `src/lib/params.test.ts`: allowlist and caps. `roomState` is covered in `schedule`.
- Manual before 5 PM: on a phone and a laptop, `/w/ailg-r?at=4490` shows the video at 1:14:50, the CTA appears
  at 1:15:00 and opens the booking page with the fields; `?at=8380` redirects to the end URL ten seconds later;
  a token link at 16:58 MT counts down and starts playing at 17:00 without a reload.

## Boundaries
- Always: the video plays even if every API call fails (chat, people, heartbeat are best-effort).
- Never: show an email or phone in the room; let the browser's clock alone decide the offset; add a scrubber.

## Success criteria
A joiner at 17:45 MT sees minute 45. `attendance` has a row per opener with a believable `seconds_watched`.
The CTA click lands on the booking page with the person's name and email prefilled.
