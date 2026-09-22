# Plan: phase 5 (answered 2026-09-21; Q12 dropped; awaiting "go" on the desk render)

Guardrails apply to every task: no deploys 3:30–7:45 PM MT; desk-lane work never touches attendee routes;
room-lane work runs the test-run ritual first; per-event switches for crowd behaviour; additive migrations;
previous build named in every deploy note; the 4 PM canary posts to Slack daily.

## 5.0 mod-fixes (this week, desk lane except the replay gate)
- [ ] F1 @mention highlight only the picked names (store `mention_names`); test.
- [ ] F2 Real rows never trimmed in the moderator list; crowd rows capped separately; test with 700 crowd rows.
- [ ] F3 Moderator/admin message URLs clickable, new tab (room-lane: the message renderer; ritual applies); "Booking link" button in the reply box, prefilled for the person being replied to.
- [ ] F4 `events.replay_opens_at` (default 20:00 local) + replay page "available tonight at 8 PM" (room lane: replay page only; ritual applies).
- [ ] F5 Display-name pencil in the moderator header; rename rewrites past messages (scope per William).
- [ ] F0 No-code: ActiveCampaign link with merge tags; 5:02 PM "we're live" text to the SMS list.
- Checkpoint CP-5.0: smoke green; moderator walkthrough on test-run; deploy in window; canary next day green.

## 5.1 mod-desk + intel-feed (desk lane)
- [ ] D1 Video panel in the moderator view (same clock, muted until tapped, collapsible).
- [ ] D2 Tabs: Chat, People, Team, Engagement, Stats.
- [ ] D3 Presence: who is on the desk, which tab, replying to whom.
- [ ] I1 Offer click → Slack intel post (channel confirmed).
- [ ] I2 leadogo room-count reads /api/metrics; EasyWebinar-era inputs removed.
- Checkpoint CP-5.1: two moderators on test-run at once; intel posts seen; leadogo room-count post matches the session page.

## 5.2 bookings-loop (leadogo + desk)
- [ ] B1 Session bookings from iclosed_calls (window confirmed); book rate on the session page and Stats tab.
- [ ] B2 Weekday rate table refit nightly; projected bookings on Stats.
- [ ] B3 Post-session top-10 engagement report to #sales-reporting (time, fields confirmed).
- Checkpoint CP-5.2: tonight's session reconstructed from history matches iClosed by hand.

## 5.3 crowd-realism (room lane, switches)
- [ ] R1 Katherine AI replay reply behind `events.katherine_enabled`, test-run first.
- [ ] R2 People-count decline curve behind `events.people_curve_enabled`, test-run first (Q12 crowd reactions: dropped).
- Checkpoint CP-5.3: a full test-run walk with both on; then on for ailg-r in the window; watched live the next day.
