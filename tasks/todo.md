# Todo: phase 1 (see plan.md)

## T1 Scaffold
- [x] Task: Create the Next 16 app (TypeScript, Tailwind 4, ESLint, App Router, `src/`), add `@supabase/supabase-js`, `@supabase/ssr`, `@vercel/blob`, an `npm test` script (`node --test src/lib/*.test.ts`), `.env.example` listing every env name from the specs, a dark placeholder page, and push to a new private GitHub repo.
  - Acceptance: `npm run build` and `npm run lint` pass; `.env.local` is git-ignored; the repo is on GitHub for William to connect Vercel.
  - Verify: `npm run build && npm test && git log --oneline -1`
  - Files: package.json, next.config.ts, src/app/layout.tsx, src/app/page.tsx, .env.example

## T2 Schedule (SPEC-schedule.md)
- [x] Task: Copy `tz.ts` and `daily-schedule.ts` from the site, generalise to a `Schedule` argument, add `roomState` and `scheduleOf`, port the tests and add the six `roomState` cases.
  - Acceptance: every case in SPEC-schedule.md passes, including the DST date.
  - Verify: `npm test`
  - Files: src/lib/tz.ts, src/lib/daily-schedule.ts, src/lib/daily-schedule.test.ts

## T3 Migration (SPEC-data-model.md)
- [x] Task: Write `supabase/migrations/001_init.sql` with the six tables, indexes, the partial unique on registrants, RLS enabled with no policies; apply it through the Supabase MCP; add `src/lib/db.ts` (service-role client, env read once).
  - Acceptance: `list_tables` shows the six tables; RLS on for each.
  - Verify: MCP `list_tables`; `select relrowsecurity from pg_class where relname in (...)`
  - Files: supabase/migrations/001_init.sql, src/lib/db.ts

## T4 Data scripts (SPEC-data-model.md)
- [x] Task: `scripts/seed-event.ts`, `scripts/upload-video.ts` (atom check, `mvhd` duration, multipart Blob upload, writes `video_url` + `video_seconds`), `scripts/import-chat.ts` (CSV parser in `src/lib/csv.ts` with tests), `scripts/team-add.ts`; run all four for tonight's event, William's MP4 and CSV, and `william@leadogo.com` / "William".
  - Acceptance: 1 event row with video URL and 8386 s; 754 simulated messages; 109 names; 1 team member; the video URL plays in a browser.
  - Verify: `npm test`; MCP `execute_sql` counts; open the Blob URL
  - Files: scripts/seed-event.ts, scripts/upload-video.ts, scripts/import-chat.ts, scripts/team-add.ts, src/lib/csv.ts (+ test), src/lib/mp4.ts (+ test)

## CP1 checkpoint: data in place (counts above) — William confirms
- 2026-09-20 evening: migration applied via the Management API (`_migrations` table records it), event seeded, 754 messages / 109 names imported, team member william@leadogo.com created. Video upload in progress. The Blob store is `bestonlineclassroom-video` (public, `store_23HoRUChFzhQuDRX`); the private store William created first cannot serve `<video>` and can be deleted.

## T5 Registration webhook (SPEC-registration-webhook.md)
- [x] Task: `POST /api/register` with bearer auth, validation, `nextSession` default, idempotent upsert, token generation, test-identity flag; `src/lib/registrants.ts` + tests; `src/lib/events.ts` with a 60 s cache.
  - Acceptance: the contract in the spec, including 401/404/422; a repeat call returns the same token.
  - Verify: `npm test`; two `curl` calls with the Test Sample identity → same `join_url`; wrong bearer → 401
  - Files: src/app/api/register/route.ts, src/lib/registrants.ts, src/lib/registrants.test.ts, src/lib/events.ts

## T6 Room and video (SPEC-room.md)
- [x] Task: `/j/[token]` and `/w/[slug]` pages (registrant resolution by token, `eh`, `rid`, guest prompt with cookie), `Room`, `TopBar`, `VideoStage` (offset seek, drift correction, click for sound, LIVE pill, full screen, stalled line), countdown that flips to live, ended redirect with params, `?at=` preview gated by `PREVIEW_KEY` until T9 adds the team session.
  - Acceptance: SPEC-room.md "Behaviour by state" and "Layout" for countdown, live and ended.
  - Verify: laptop and phone at `/w/ailg-r?at=4490&key=…` and `?at=8380&key=…`; a token link before start counts down and flips at the start instant (use a test event start 2 minutes out)
  - Files: src/app/j/[token]/page.tsx, src/app/w/[slug]/page.tsx, src/components/room/Room.tsx, src/components/room/VideoStage.tsx, src/components/room/TopBar.tsx

## T7 Attendance, CTA, people (SPEC-room.md)
- [x] Task: `/api/heartbeat`, `/api/cta`, `/api/people`; `CtaBar` (visible between `cta_at` and `cta_hide`, href from `src/lib/cta.ts`, beacon then new tab), `PeoplePanel` (host + simulated names + real attendees in the last 2 minutes); `src/lib/params.ts`; tests for `cta` and `params`; heartbeat every 30 s and on `pagehide`.
  - Acceptance: an `attendance` row per opener with believable `seconds_watched` and `max_offset`; CTA lands on the booking page with name and email prefilled; people count = simulated + real.
  - Verify: `npm test`; open the room, wait 90 s, read the row; click the CTA at `?at=4500`
  - Files: src/app/api/heartbeat/route.ts, src/app/api/cta/route.ts, src/app/api/people/route.ts, src/components/room/CtaBar.tsx, src/components/room/PeoplePanel.tsx, src/lib/cta.ts (+ test), src/lib/params.ts (+ test)

## CP2 checkpoint: William tries the room on his phone — layout and playback accepted for tonight
- 2026-09-20 evening, first pass: playback and the CTA work on William's laptop; he asked for a stronger CTA, no native player ever, chat, the logo, a phone-first Zoom/Twitch layout. Design pass done (Atkinson Hyperlegible, brand blue, red LIVE, amber CTA; upright phone: video then chat; sideways phone and desktop: video left, chat right). Second look pending.

## T8 Chat (SPEC-chat.md)
- [x] Task: `/api/simulated` (cached), `/api/chat` GET (poll with `after`/`since`, history cap 300) and POST (limits, block check, Slack relay in `after()` through the persona bridge), `ChatPanel` (simulated cursor, merge of new/updated, composer, unread badge), `src/lib/chat.ts` + tests, `src/lib/slack.ts`.
  - Acceptance: SPEC-chat.md data flow; a late joiner sees history to the current offset at once.
  - Verify: `npm test`; two browsers: a message crosses within 3 s; simulated feed matches the video minute on both; the Test Sample message appears in #autoweb-chat
  - Files: src/app/api/chat/route.ts, src/app/api/simulated/route.ts, src/components/room/ChatPanel.tsx, src/lib/chat.ts (+ test), src/lib/slack.ts

## T9 Moderator (SPEC-moderator.md)
- [x] Task: `src/lib/auth.ts` (`@supabase/ssr` cookie session, `requireTeam`), `/login` (email + password server action), `/mod` (stream, reply, delete, block, react, people strip, simulated toggle), `/api/mod`, `src/lib/moderation.ts` + tests; `?at=` preview accepts a team session.
  - Acceptance: SPEC-moderator.md; every action reflected in an attendee room within one poll.
  - Verify: `npm test`; sign in on a phone; reply/delete/block/react while a laptop watches as Test Sample
  - Files: src/lib/auth.ts, src/app/login/page.tsx, src/app/mod/page.tsx, src/app/api/mod/route.ts, src/lib/moderation.ts (+ test)

## CP3 checkpoint: William moderates from his phone — accepted

## T10 Site cutover (SPEC-site-cutover.md, in ~/orca/futurerealestateagent)
- [ ] Task: `src/lib/classroom.ts` (+ test), register route calls it first and EasyWebinar while `EASYWEBINAR_PARALLEL=1`, `join-link.ts` token form, `/join` (token → `/j/`, legacy hash → `/w/ailg-r?rid&sd&src=legacy`), `/live` → `/w/ailg-r?src&eh`, `optin.ts` gains `classroom_join_link` and `classroom_registered`, `calendar-links.ts` accepts our link, tests re-pinned; env `CLASSROOM_URL`, `CLASSROOM_REGISTER_SECRET`, `EASYWEBINAR_PARALLEL=1` in Vercel and Doppler.
  - Acceptance: one commit; SPEC-site-cutover.md testing section passes on production with the Test Sample identity; no Zapier field renamed.
  - Verify: `npm test` in the site; production Test Sample opt-in → thank-you page calendar link → our room; `/live` → room; legacy `/join?k=<32 hex>` → name prompt
  - Files: src/lib/classroom.ts (+ test), src/app/api/register/route.ts, src/lib/join-link.ts (+ test), src/app/join/route.ts, src/app/live/route.ts, src/lib/optin.ts, src/lib/calendar-links.ts

## CP4 checkpoint: production Test Sample path works end to end — go / no-go for 5:00 PM MT

## T11 Launch (2026-09-21, frozen at 16:30 MT)
- [ ] Task: run the checklist: DNS resolves to Vercel; every env set in production; the Blob video plays from the domain on a phone; `/w/ailg-r?at=…` at 16:00; William signed in at `/mod`; Slack relay seen; `EASYWEBINAR_PARALLEL=1` on; EasyWebinar reminders left on; 16:55 to 17:10 watched live with the room open in two browsers; `attendance` counts checked at 17:30 and 18:30 against the room-count post.
  - Acceptance: joiners land at the right minute all evening; no bounce; chat and moderation work; counts recorded.
  - Verify: the evening itself; notes into `docs/launch-2026-09-21.md`
  - Files: docs/launch-2026-09-21.md
