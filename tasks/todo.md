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
- [x] Task: `src/lib/classroom.ts` (+ test), register route calls it first and EasyWebinar while `EASYWEBINAR_PARALLEL=1`, `join-link.ts` token form, `/join` (token → `/j/`, legacy hash → `/w/ailg-r?rid&sd&src=legacy`), `/live` → `/w/ailg-r?src&eh`, `optin.ts` gains `classroom_join_link` and `classroom_registered`, `calendar-links.ts` accepts our link, tests re-pinned; env `CLASSROOM_URL`, `CLASSROOM_REGISTER_SECRET`, `EASYWEBINAR_PARALLEL=1` in Vercel and Doppler.
  - Acceptance: one commit; SPEC-site-cutover.md testing section passes on production with the Test Sample identity; no Zapier field renamed.
  - Verify: `npm test` in the site; production Test Sample opt-in → thank-you page calendar link → our room; `/live` → room; legacy `/join?k=<32 hex>` → name prompt
  - Files: src/lib/classroom.ts (+ test), src/app/api/register/route.ts, src/lib/join-link.ts (+ test), src/app/join/route.ts, src/app/live/route.ts, src/lib/optin.ts, src/lib/calendar-links.ts

## T10b Replay (SPEC-replay.md, pulled into phase 1 on 2026-09-20 evening)
- [x] Task: `/replay/[token]` with native controls, resume point, in-player nudge at the pitch, chapters from `events.chapters`, recap and FAQ, CTA above, below and pinned on phones; `replay` attendance and CTA rows; `replay_url` from the webhook; `classroom_replay_link` in the site's payload.
  - Acceptance: SPEC-replay.md page and data sections.
  - Verify: page 200 for a Test Sample token; heartbeat kind replay 204; webhook returns replay_url
  - Files: src/app/replay/[token]/page.tsx, src/components/replay/ReplayView.tsx, supabase/migrations/003_chapters.sql, site src/lib/optin.ts

## CP4 checkpoint: production Test Sample path works end to end — go / no-go for 5:00 PM MT
- 2026-09-20 evening: William approved the merge; site `main` at 84f8f25 (fast-forward from feat/classroom-cutover). Test Sample check follows the deploy.
- CP4 passed 2026-09-20 ~20:10 MT after one fix (the site must call the www host; a cross-host redirect drops the bearer). Test Sample opt-in on the live site: our link in the response, the thank-you page and the calendar entry; `/join`, `/live` (hashed email) and a legacy EasyWebinar hash with rid all land in the registrant's own room; the room shows tomorrow's countdown. EasyWebinar still registers in parallel. **Go for 2026-09-21.**

## T11 Launch (2026-09-21, frozen at 16:30 MT)
- [ ] Task: run the checklist: DNS resolves to Vercel; every env set in production; the Blob video plays from the domain on a phone; `/w/ailg-r?at=…` at 16:00; William signed in at `/mod`; Slack relay seen; `EASYWEBINAR_PARALLEL=1` on; EasyWebinar reminders left on; 16:55 to 17:10 watched live with the room open in two browsers; `attendance` counts checked at 17:30 and 18:30 against the room-count post.
  - Acceptance: joiners land at the right minute all evening; no bounce; chat and moderation work; counts recorded.
  - Verify: the evening itself; notes into `docs/launch-2026-09-21.md`
  - Files: docs/launch-2026-09-21.md

## Phase 2 and 3 (tasks/plan-phase2.md), 2026-09-20 evening
- [x] A1–A5 admin: events, video upload, simulated chat, replay copy, team, registrants (`SPEC-admin.md`).
- [x] N1 outcomes and session metrics views; N3 numbers and retention on the session page; `GET /api/metrics`.
- [x] N4 ActiveCampaign tags (hourly cron, `outcome_tags`), tag names editable. Needs the ActiveCampaign API key.
- [x] N2 leadogo: Funnel Performance reads `/api/metrics` (leadogo-app PR #35, migration 249 applied, `CLASSROOM_METRICS_SECRET` in leadogo Doppler). Merge after review.
- [x] R1 reminders: rules, cron, Postmark sender, stop link (`SPEC-reminders.md`). Needs the Postmark token.
- [ ] iClosed tags/events push (needs iClosed API details).
- [ ] D1 design pass. [ ] M1 AI moderator.
- [x] Review checklist: `docs/review-checklist.md`.

## Phase 4 (SPEC-phase4.md), built 2026-09-20 late
- [x] schedules: `events.days`, rule skips off days (tests), admin checkboxes.
- [x] roles-team: admin/moderator, email invites with set-password link (`/invite/<token>`), assignments, `/mod/<slug>`, moderators read-only on numbers.
- [x] dashboard: live state and room count, next-session registrants, last session numbers, moderators, previews, New webinar by copy, delete (typed slug).
- [x] chat-moderation: ghost, IP capture (30-day retention in the hourly cron), IP block here + at the edge (needs `VERCEL_TOKEN`), chat CSV marks real/simulated with a recorded header.
- [x] chat-social: reactions for everyone (one per emoji per person), @mentions with autocomplete, tinted rows, moderator "Mentions of me" filter.
- [x] analytics-ui: `/admin/events/<slug>/analytics` trend, by session, by week, retention small multiples, compare two sessions, CSV exports; `/api/metrics` `limit` and `peak_live`.
- [ ] End-of-night test: `npm run test:event -- --at HH:MM` (copies ailg-r, registers William), walk the flow, then `npm run test:event -- --teardown`.
- [ ] `VERCEL_TOKEN` in Doppler for edge IP blocks (William creates it at vercel.com/account/tokens, scope team leadogo).

## Fixes from the 22:45 test (tasks/plan-fixes-2026-09-20.md)
- [ ] A1–A11 tonight, then CP-A: second test run 10 minutes after done.
- [ ] B1–B3 tomorrow daytime if safe. C1–C2 after launch.
