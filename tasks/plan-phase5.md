# Plan: phase 5 (5.0–5.3 all shipped 2026-09-22 ~00:30 MT; one big walk on test-run at 9:30 AM MT, then William decides which switches go on for ailg-r)

Guardrails apply to every task: no deploys 3:30–7:45 PM MT; desk-lane work never touches attendee routes;
room-lane work runs the test-run ritual first; per-event switches for crowd behaviour; additive migrations;
previous build named in every deploy note; the 4 PM canary posts to Slack daily.

## 5.0 mod-fixes (this week, desk lane except the replay gate)
- [x] F1 @mention highlight only the picked names (store `mention_names`); test.
- [x] F2 Real rows never trimmed in the moderator list; crowd rows capped separately; test with 700 crowd rows.
- [x] F3 Moderator/admin message URLs clickable, new tab (room-lane: the message renderer; ritual applies); "Booking link" button in the reply box, prefilled for the person being replied to.
- [x] F4 `events.replay_opens_at` (default 20:00 local) + replay page "available tonight at 8 PM" (room lane: replay page only; ritual applies).
- [x] F5 Display-name pencil in the moderator header; rename rewrites past messages (scope per William).
- [x] F6 The word "live" out of client-facing copy (Jeremy): TopBar pill "Now playing" + "Starts at 5:00 PM MT"; replay wait screen headline/button; replay "next session" link + expired subtitle default. Room lane (TopBar): ritual applies; ships with F3.
- [~] F0 No-code (5:03 email done as the "started" reminder rule; AC merge-tag link and the Roezan text are on William): ActiveCampaign link with merge tags; 5:02 PM "we're live" text to the SMS list.
- Checkpoint CP-5.0: smoke green; moderator walkthrough on test-run; deploy in window; canary next day green.

## 5.1 mod-desk + intel-feed (desk lane)
- [x] D1 Video panel in the moderator view (same clock, muted until tapped, collapsible).
- [x] D2 Tabs: Chat, People, Team, Engagement, Stats.
- [x] D3 Presence: who is on the desk, which tab, replying to whom.
- [x] I1 Offer click → Slack intel post (channel confirmed).
- [x] I2 leadogo room-count reads /api/metrics; EasyWebinar-era inputs removed.
- [x] I3 Daily Tracker fed from the classroom (shipped 2026-09-21 ~11 PM MT: metrics API + leadogo classroom-sync cron every 30 min) (William, 2026-09-21 10:30 PM; plan in the chat of that night):
  metrics API adds `ad_optins` (site opt-ins with an ad in their attribution), `site_optins`, `at_pitch` (concurrent at the pitch instant), keeps `joined`, `peak_live`;
  leadogo classroom sync writes registrants_auto = ad_optins, attendees_auto = peak_live, pitch_live_auto = at_pitch, joined_auto (new column) = joined, for days ≥ 2026-09-21;
  retention = at_pitch ÷ joined; booking % = bookings ÷ at_pitch (exists); SR = peak ÷ opt-ins (exists); today's rates shown once the session ran;
  a light `classroom-sync` cron every 30 min replaces the 6 daily ticks for the classroom block; room-count stops writing attendees_auto.
  Marketing Insights: metrics API `/api/metrics/registrations?date=` per site_registration_id (joined, minutes, at_pitch, clicked) so "Showed up" and "Booked ≤ 48 h" per variant read the classroom, not the site's dead room_join events.
- Checkpoint CP-5.1: two moderators on test-run at once; intel posts seen; leadogo room-count post matches the session page.

## 5.2 bookings-loop (leadogo + desk)
- [x] B1 Session bookings from iclosed_calls (window confirmed); book rate on the session page and Stats tab.
- [x] B2 Weekday rate table refit nightly; projected bookings on Stats.
- [x] B3 Post-session top-10 engagement report to #sales-reporting (time, fields confirmed).
- Checkpoint CP-5.2: tonight's session reconstructed from history matches iClosed by hand.

## 5.3 crowd-realism (room lane, switches)
- [x] R1 Katherine AI replay reply behind `events.katherine_enabled`, test-run first.
- [x] R2 People-count decline curve behind `events.people_curve_enabled`, test-run first (Q12 crowd reactions: dropped).
- Checkpoint CP-5.3: a full test-run walk with both on; then on for ailg-r in the window; watched live the next day.

## Round three notes (2026-09-22 10:40 AM, William)
- [x] Second moderator (kabrallw@gmail.com) seated at test-run; test events seat every moderator.
- [x] Toggling the crowd or the mentions filter lands at the newest messages.
- [x] Replies show on the desk at once (the poll took up to 3 s to bring them back); attendees still get them within their 3-second poll by design (load).
- [x] Tabs renamed Attendees / Private Chat.
- [x] Engagement is a leaderboard on the shared score (lib/engagement.ts), same order as the 8:15 PM top ten.
- [x] Daily canary at 3:45 PM MT (api/cron/canary) → one line in #autoweb-intel. Sentry: proposed for next week (room-lane change, needs its own walk).
