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

## Phase 5 (2026-09-21 night)
- [x] 5.0 mod-fixes shipped: mention names, crowd cap, moderator links + booking button, rename pencil, replay opens at 20:00, "Now playing", after-start reminder.
- [x] 5.1 desk, 5.2 bookings loop, 5.3 Katherine + crowd curve (switches), intel-feed: all shipped 2026-09-22 ~00:30 MT.
- [ ] William's one big walk (test-run rounds 9:30 / 10:30 / 11:15 AM MT Sep 22, checklist "Test run seven"); then flip switches for ailg-r in a morning window if he says so.
- [ ] Sentry (or Vercel error tracking) for the classroom, next week, with its own test-run walk.

## Phase 6 (2026-09-23)
- [x] 6.0 counters/desk fixes shipped ~8:05 PM MT; test-run eight at 8:30 PM for William's walk.
- [x] 6.1–6.4 shipped 2026-09-23 night; walk on test-run 8:30 AM Sep 24 (Test run nine). William added the iClosed webhook (created/rescheduled/cancelled). Still on him: old New BOOKED Zap off after the first post, QR → /qr. Join card redesigned Sep 23 late.

## Kaitlyn from William's Team (2026-10-11 night): the AI moderator
- [x] Shipped: migration 030 (`events.kaitlyn_mode` off|shadow|assisted|auto, `events.kaitlyn_facts`, `kaitlyn_decisions`), `src/lib/kaitlyn.ts` (one Claude call per attendee message → reply | skip | ghost | ask_william + a reaction; fact sheet is the only product source; price/guarantee/live/date guard), desk rows "Kaitlyn · reply/ghost?/react?/needs you" with Send as Kaitlyn / Skip / Ghost / React, her link line at the pitch minute (`prompts.ts`), admin switch + fact sheet, `ANTHROPIC_API_KEY` in Doppler (synced to Vercel). ailg-r and test-run in shadow. Verified on production with a test seat (drafts, Send as Kaitlyn, Ghost them, the link line); model answers JSON (no forced tools or prefill on this model), max_tokens 1500 for its thinking.
- [x] Shadow nights reviewed (Oct 13): Oct 11 (Sunday) 144 messages, 144 decisions, nobody on the desk, 41 market drafts unanswered; Oct 12 115 messages, 106 decisions, William sent 15 (none edited), skipped 7, ghosted 1, reacted 4, left 20 pending (11 market from the minute-0 city drops); latency p50 1.5 s, p90 3.3 s. Two people re-asked their market 5–6 times within a minute of Kevin's replies (rows stored fine; cause unknown).
- [x] Oct 13 (William approved 1–5): ailg-r and test-run to **assisted** (market, booking, price, replay, tech, greeting, thanks post themselves after 15–40 s; the rest draft + Slack ping); prompt: bare city drops before the pitch are skipped (William asks where people are from on screen), Katherine's poll answers skipped, price gets his fixed wording ("You need to book a call because it depends on your market area, type of leads, and cost per lead"); the model's own leading @Name stripped (`withoutMention`); fact sheet: "About an hour", training data used but never shared. The "edited" status was never wrong (my review script compared against the posted body, which carries the @mention).
- [x] Oct 14 (William: "agreed to all" + toggle, varied timing, ghosting), commit 7e9676a, deploy nuf603mp0: Oct 13 night reviewed (56 viewers, 39 at the pitch, 10 booked = 25.6%, William sent 15 drafts unedited at a 27 s median, left 14 pending incl. all 3 price questions; 140 drafts over 3 nights were all distinct but one skeleton: "you'd be the first" 32/75 market lines, "the call" 30/140, emoji on 95%). Fixes: `said` (her last 12 lines tonight, drafts included) in every turn + VARIETY rules and shape lists; voice = Kevin's register (8–15 words, no "great question", name never in the text, emoji ≤ 1 in 4); Kevin's corpus regenerated with the mention stripped by the real name (the old regex ate "I"/"We"/"Chat GPT", ~1 in 3 examples; now 224 Q/A + 24 ghosts); fact sheet + his Oct 13 answers (lenders, tone + voice cloning, pixel/Conversions API, not a broker, sign up before going live), re-seeded (5094 chars); `delayMs(mode, chars)` = read 5–20 s + type at 4–7 chars/s + busy 1 in 4 (20–60 s), cap 120 s; `ghostsItself`: assisted/auto ghost on the spot when category = negative (Slack line, Unghost on the desk), other ghost categories still draft; Webinars page: one-tap "Kaitlyn assist on/off" (assisted ↔ shadow, `setKaitlynAssist`). Both events ASSISTED. Verified on production (Fast Sample seat): "Boston" auto after 85 s ("3 in Boston right now, so there's plenty of room"), "booked" 40 s later correctly skipped by the 120 s per-person window, price auto after 36 s ("short answer: You need to book a call…"), heckle ghosted on the spot (the chat filter 422s "BS" before she sees it). Rows cleaned.
- [x] Oct 14 follow-up (William: "85sec is way too long… 8-15 seconds"; "if she's not confident… doesn't respond and saves a place for me"), commits 6139103 + 67d74d8, deploy lszu62s1m: `delayMs` = 8–15 s counted from their message (the model's thinking time comes off it); the model returns `"sure"` and `parseDecision` turns an unsure reply into ask_william with the draft kept (nothing posts in any mode); filler lines ("that one's for the call") are out of the prompt unless FACTS say the call handles it; the desk's "needs you" card always has the answer box (placeholder "Your answer, posted as Kaitlyn"). Verified on production: "Boston" auto 12 s end to end; "What's an AI pixel optimization?" → ask_william pending with her draft, nothing posted. Open question for William: `PER_PERSON_MS` 120 s still means one Kaitlyn reply per person per two minutes (a second line from the same person inside that window is skipped) — lower to ~30 s if he wants both answered.
- [x] Oct 16 morning (William's Oct 15 voice notes; "sounds robotic" is welcome honesty, everything else approved), commit d103ab3, deploy bnyyjy474: `testsLive` in `chat-filter.ts` (an instruction to the room to prove it is live, or a bare "pre rec?", ghosts on the spot with reason "tested whether the room is live"; sincere questions, "sounds robotic" / "she was AI" and real-estate lines pass); Kaitlyn's ghost bullet names the shapes he ghosts by hand (live tests, camera challenges, "he just read a comment", sneers at the host, price pushing after the call answer) with the same honesty exemption; the desk's Ghost on a message row hides that line (visibility author, as the Kaitlyn-approved ghost did) and the room's poll reports a hidden line as deleted to everyone but its author; desk chat rows show a grey name + "left HH:MM" after two minutes unseen; room names wrap instead of truncating (the simulated "Debbie Lynn Sutton" lost her last name). Verified on production with two test seats (live test → ghosted on the spot, hidden from the viewer, visible to the author; hidden line → viewer poll deleted:true, author deleted:false; "is this live?" not ghosted); rows cleaned, viewer seat deleted. Context: Oct 15 David's "say LIVE" stayed visible 98 s before a by-hand ghost; by-hand ghost lag this week 9–98 s; ailg-r was in shadow on Oct 15 (William monitoring).
- [x] Oct 17 night SHIPPED on William's go: `SPEC-kaitlyn-autopilot.md` + `SPEC-kaitlyn-knowledge.md` (see tasks/plan.md). Left for later: the weekly review as a cron (the digest covers the daily case), moderators answering on the knowledge page, a second-pass rewrite if tells ever show up (0 in the first eval), the full 494-line eval run.
- [ ] (was) Awaiting William (Oct 17 late): `SPEC-kaitlyn-autopilot.md`: his 48 approved answers (`docs/kaitlyn-answers-2026-10-17.md`) into the fact sheet with the guard loosened for the two approved figures and the replay wording, humanizer WRITING rules in the prompt + `humanize.ts` tells check, the Autopilot control in the admin sidebar (`events.autopilot` auto|on|off, default auto: takes over 3 min after the last moderator or at minute 5 of a session nobody opened; one hand-off line per person when she does not know; `kaitlyn_decisions.autopilot` badge; Slack on/off lines; mock at claude.ai/artifact/PeVJssd3Ty8tSEcDfYmiXo), an eval run over the month's 494 questions before every prompt change. Plus `SPEC-kaitlyn-knowledge.md`: `kaitlyn_kb` table seeded with the 48, the model names a `kb` key per decision, her prompt reads approved answers from the table, Admin → Knowledge base page (needs you / waiting for your OK / live, humanizer rewrite by one model call, merge), 9 AM Edmonton digest of unanswered questions to the intel channel via `postToIntel` (hourly cron, DST-proof). Day 1: migrations + seed + prompt + autopilot; day 2: the page + digest, a Teach Kaitlyn box on the desk. Build on his go, deploy before noon MT.
- [x] Oct 18 night (William: "turn on the ability for Kaitlyn to auto-answer [from tomorrow], I'll be there to monitor… a fix button… delete it, have her respond with my answer that's better, and train her going forward"), commit d0e1643: migration 036 (`kaitlyn_decisions.improved_text`, view `kaitlyn_corrections` with security_invoker, revoked from anon/authenticated); desk Fix on any of her lines (box prefilled with her text → `POST /api/mod` `case "fix"`: her line deleted, his posted as her to the same person, decision `fixed` + `improved_text` + `sent_message_id` moved to the new line, an `open` knowledge row gets his line as `answer` + `approved`); Delete on her line marks the decision `deleted`; `systemPrompt(facts, kb, corrections)` carries a CORRECTIONS block (newest 40: Q / you said / William or "removed by the team") between KNOWLEDGE and Kevin's replies. ailg-r `autopilot` set to **on** for Oct 19 (was off; mode stays shadow, so every sure reply posts itself after the pause, unsure ones wait on the desk with no hand-off line while he is on the desk). `SPEC-kaitlyn-transcript.md` written (A: the 90 s back / 2 min ahead window from the captions VTT in her turn; B: a one-time class outline; C: the on-screen line on the desk's cards; D: his Q&A answers from the tape into the knowledge boxes; E: the eval before/after), awaiting his approval.
- [x] Oct 18 late / Oct 19 early (William: "please /build your proposed /spec"): `SPEC-kaitlyn-transcript.md` BUILT, commits a115713…082c7de + e30df3c: T1 `src/lib/transcript.ts` (windowAt 90 s back / 2 min ahead, segmentAt, onScreen, cuesFor cached an hour); T2 the turn's WILLIAM ON SCREEN / COMING UP / SEGMENT lines + the WHAT HE IS SAYING rules and "about to cover it" shapes, chat route passes captions_url/offset/chapters/video_seconds; T3 migration 037 `events.outline`, `npm run outline -- --event <slug> --write` (effort low: the model thought the whole budget away over the 55k-token transcript), Settings field "Class outline (for Kaitlyn)", TONIGHT'S CLASS block (stored for ailg-r and test-run, 15 lines); T4 "on screen: …" (last 20 s) on the desk's Kaitlyn cards and the Knowledge page asks; T5 `npm run qa:transcript -- --event ailg-r [--write]`: 31 Q/A pairs found in the Q&A chapter (84:00 to 108:00; the rest is testimonials), every one maps to a key William already answered on Oct 17, so nothing was written; T6 eval gains the screen, corrections and outline, `--no-screen`/`--out` for the before/after (numbers in `docs/kaitlyn-eval.md`). Also fixed: `knowledgeBlock` now requires `approved_at` (a rewrite waiting for his OK was already in her prompt; no live row affected).
- [ ] Awaiting William (training, proposed Oct 16, partly folded into the Oct 17 spec): live examples read from the DB at prompt time (the team's replies paired with the question, edited drafts `text` → `sent_body`, deleted Kaitlyn lines as don'ts, ghosted lines; cached ~1 h) replacing the static corpus (its regenerate script was lost with the scratchpad); an Improve button on her posted lines saving `improved_text` on `kaitlyn_decisions`; Delete on her line marking the decision wrong; a "Teach Kaitlyn" box on the desk appending a dated fact line to the event's fact sheet; his Oct 15 facts (5000+ voices, careers page, team members with their own calendars) added to the sheet.
- [ ] Awaiting William: the two rendering fixes (desk: re-showing the simulated chat re-appends the whole crowd, `mod-view.tsx` crowd effect; room: the poll's dedup reads a stale list, `ChatPanel.tsx`), Katherine's three identical "Still deciding?" reminders at pitch +3/+8/+15, the Edmonton wording (directory says 110 clients there), whether "how long is this" (category other) should post itself.
- [ ] Report after a week of assisted: booking % among pitch reachers (baseline 32.6%), pitch reach (69%), share of chatters answered (37%), Kaitlyn rows per night, skipped-by-William per category; then auto.

## Phase 7 (2026-10-01 night): the client wall
- [x] Shipped: migration 028, `client_wall` + trigger + `client_wall_apply`, `POST /api/client-wall`, bms-dashboard cron every 30 min (PR #596), 404 at join and replay for `block_reason = client`, open-link email field behind `events.open_link_field`, `open-link-report` cron 02:50 UTC, canary check, opt-ins exclude walled, `/admin/blocked` Client wall section. 912 on the wall, 49 walled.
- [ ] William's walk on test-run (card asks for an email there): wall-test@example.com → 404; own email → room. Then flip Settings → "open link asks for an email" for ailg-r before 3:30 PM (Oct 2 or later).
- [ ] Watch the 8:50 PM MT open-link line for three blast nights; 🔴 means flip the switch back.
- [ ] Review after a week: should refunded / dispute statuses stay on the wall; any client appearing as a guest (then the IP layer).

## kaitlyn-ghosts (SPEC-kaitlyn-ghosts.md, William's go Oct 20 2026 ~11 AM MT; plan in tasks/plan.md)
- [x] T1 Migration 038: corrections view + `edited`; `kaitlyn_ghosts` view. Verify: migrate; the two selects.
- [x] T2 kaitlyn.ts tune: window by key, "honestly," out + shapes-vs-tells test, "see you on the call" out. Verify: npm test.
- [x] T3 Hand-off on an idle desk (90 s, no moderator reply or action). Verify: npm test; test-run with a background desk tab.
- [ ] T4 Eval set ghost class (40 + 10) and script; baseline run → docs/kaitlyn-eval-before-ghosts.md.
- [ ] Checkpoint 1: test, lint, build clean.
- [ ] T5 B0 Kaitlyn runs for ghosted people, private posts, "(ghosted)" markers. Verify: two seats on test-run.
- [ ] T6 B1+B2 ghost bullet, `sure`, sure ghosts act, private line + intel Slack for a client complaint. Verify: npm test.
- [ ] T7 B3 live GHOSTED block from the view; static list out. Verify: npm test; eval ghost recall ≥ 80%, 0 false.
- [ ] T8 B4 reason chip on the desk's Ghost; decision marked. Verify: test-run.
- [ ] Checkpoint 2: test, lint, build; eval after not below Oct 19 on answer/market/skip.
- [ ] T9 C reply-to-you scroll/flash + pill. Verify: Chrome mobile emulation; William's phone.
- [ ] T10 D roll-call rule + slot; A5 KB rows (SQL); Katherine's minute-2 line. Verify: npm test; two seats at minute 1.
- [ ] T11 E1 audit script + E2 digest lines. Verify: audit reproduces the table; digest dry run.
- [ ] T12 Deploy before 3:30 PM MT; six production checks; rows cleaned; report.
- [ ] T13 /review, fixes, docs, memory.
