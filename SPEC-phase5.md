# Capability Map, phase 5: the moderator's desk and the numbers behind it

Status: **answered 2026-09-21 evening** (review page: https://claude.ai/artifact/CrNrgCkWPy7vn8mVHK64Mp; desk before/after render: https://claude.ai/artifact/2mmpEwA3FxVrSjAonmQhaJ). William answered yes to Q1–Q11, Q13–Q15, Q17 as recommended; **Q12 (crowd reactions on real messages) is dropped.** Awaiting "go" on the render before code.
Written from William's notes after moderating the first live session on the platform. Nothing here is built
until each line is confirmed. The session on 2026-09-21 is the checkpoint: 250 registered, 73 joined, peak 41,
36 live at the pitch minute, 19 offer clicks, zero broken links.

## The rule above every module: 5 PM must not break

$8,000 a day in ads and about $30,000 a day in revenue ride on the 5 PM session. So:

1. **No deploys between 3:30 PM and 7:45 PM Mountain.** Ever. Cron changes included.
2. **Two lanes.** Room lane (anything an attendee's page loads: room, replay, chat API, heartbeat, video) and
   desk lane (moderator view, admin, exports, leadogo). Desk-lane changes cannot affect attendees by
   construction: they live in other routes and components. Room-lane changes are rare and get the full ritual.
3. **The ritual for a room-lane change:** tests green, the throwaway-admin smoke green, a private `test-run`
   event started 5 minutes out and walked on an iPhone with the checklist, then deploy in the window, then a
   preview of the real room at `?at=60` and `?at=4500`. If any step fails, nothing ships.
4. **Per-event switches** for anything that changes crowd behaviour (Katherine replies, crowd reactions): built
   dark, turned on for `test-run` first, then for `ailg-r` by a checkbox in Settings. Off means the code path
   is not entered.
5. **Rollback in one click:** Vercel keeps every build; the last known-good is promoted in under a minute.
   Every deploy note names the previous build.
6. **A 4:00 PM canary every day:** an automated check that the countdown renders, the video answers byte
   ranges, chat and heartbeat answer, and the reminder cron ran, posted to Slack. Silence means fine.
7. **Migrations are additive only** (new columns, new tables). Nothing renamed or dropped while it is read.

| Module id | Responsibility | Lane | Depends on | Phase |
|---|---|---|---|---|
| `mod-fixes` | The three bugs from tonight: the word after an @mention turning blue; showing simulated chat wiping real messages at ~94 min; moderator links not clickable. Plus the replay-at-8-PM setting and the display-name pencil. | desk (+ replay page gate) | — | 5.0 |
| `mod-desk` | The moderator view as a real desk: a synced video panel, tabs for Chat, People, Team chat, Engagement, Stats; who else is moderating and what they are on. | desk | `mod-fixes` | 5.1 |
| `intel-feed` | Offer clicks and other moments posted to #autoweb-intel as they happen; Brandon's room count from our numbers, not the site's join events. | desk (Slack + leadogo) | `analytics` | 5.1 |
| `bookings-loop` | Bookings matched to the session (iClosed via leadogo): live booking tracker, book rate against live-at-pitch, projected bookings per weekday that learn from history, the post-session top-10 engagement report to #sales-reporting. | desk (leadogo) | `intel-feed` | 5.2 |
| `crowd-realism` | Katherine AI answering replay questions; the people-count decline curve (Phase B). Behind per-event switches. Crowd reactions on real messages: dropped by William. | room | `mod-fixes` | 5.3 |

Build order: `mod-fixes` → `mod-desk` and `intel-feed` in parallel → `bookings-loop` → `crowd-realism`.

## Module notes (draft; each becomes its own SPEC once confirmed)

### mod-fixes
- **@mention highlight.** Today `splitMentions` colours `@` plus every following capitalised word, so
  "@Will Great point" paints "Great". After: the message stores the mentioned names; only those are coloured.
- **Simulated toggle wiped real chat.** Today the moderator list is capped at 600 rows; turning simulated chat on
  at minute 94 loads ~600 crowd rows and trims the oldest, real rows included. After: real rows are never trimmed;
  the crowd has its own cap.
- **Moderator links.** Moderator replies already skip the filter; they are just not clickable. After: URLs in
  moderator and admin messages render as links that open in a new tab. Attendee messages unchanged.
- **Replay at 8 PM.** Today the replay gate lifts at the session's end (7:19 PM). After: `events.replay_opens_at`
  (local time, default 20:00). The replay page says "Available tonight at 8 PM" until then.
- **The word "live" (Jeremy, 2026-09-21).** A recording must not be labelled LIVE. Four client-facing strings change, nothing else:
  top bar pill "LIVE 1:16:02" → "Now playing 1:16:02" (red pill, white dot, clock and count unchanged); pre-start pill "Starting soon" → "Starts at 5:00 PM MT" (from the event's schedule);
  replay wait screen "Your session is live right now" / "Join the live session" → "Session is in progress now" / "Enter the session";
  replay page "Register for the next live session" (footer link and the expired subtitle default) → "Register for the next session".
  The 5:03 PM email says "Your session has started", never "we're live". Internal admin/desk "Live" badges stay.
- **Display name pencil.** In the moderator header, next to the name: edit, save; every message by that team
  member (past and future, all sessions unless William says this session only) shows the new name.

### mod-desk
- **Video panel:** the same clock as attendees, muted until tapped, collapsible, above the chat.
- **Tabs:** Chat (today's view) · People (in the room now: name, source, joined, minutes, ghost/block, and who has
  left) · Team (moderators only; never shown to attendees, never in the chat export) · Engagement (per person:
  minutes, messages, reached pitch, clicked; sortable) · Stats (registered, joined, live now, peak, live at 1:15,
  clicks, chatters; projected bookings from `bookings-loop`).
- **Presence:** who is on the desk and which tab they are on, "Kevin is replying to Sarah".

### intel-feed
- Offer click → "Name (+phone) clicked the offer at 1:16" in #autoweb-intel (channel to confirm).
- Brandon's room count: leadogo's `room-count` job reads `GET /api/metrics` (joined, in room now, peak, at pitch)
  instead of the site's own-link join events. Show rate = joined ÷ [denominator to confirm].

### bookings-loop
- leadogo already has `iclosed_calls` (invitee email, event, created time). A booking "from the session" = a
  call created after the pitch minute and before the next session, by an email that holds a link for that
  session (window to confirm).
- Book rate = bookings ÷ live at 1:15. Projected bookings = live at 1:15 × the weekday's rate, the rate refit
  nightly from the last N sessions (N to confirm; starts from tonight's single point).
- Report at [time to confirm] to #sales-reporting: the 10 most engaged people (score from minutes, messages,
  reached pitch, clicked) with booked yes/no, name, phone, email, for the setters.

### crowd-realism (room lane, per-event switch, `test-run` first)
- Katherine AI: a named moderator persona; when an attendee message contains "replay" or "recording", she
  replies once per person: "A replay will be sent tonight after the event!" (wording to confirm). Appears in the
  People tab as a moderator. Never answers anything else.
- Crowd reactions: a real attendee's message gets 1–3 reactions from the crowd within 5–30 s, not every message,
  more for questions; counts only, no fake people in the picker.

## Why 30 to 40 live tonight (answered from the data)
250 with a link, 73 joined (29%), peak 41. The 84 site opt-ins showed at 37% (31). The SMS list: 124 registered by
tapping the text, 26 joined; 194 taps hit the countdown before 5 PM and most never came back. ActiveCampaign
email: 16 taps, 14 hit the name prompt (the link had no name or email merge tag), 0 joined. Skool: 17 prompts,
3 joined. No broken links. Two fixes need no code: the merge-tag link shape for ActiveCampaign, and a "we're
live, tap to join" text at 5:02 PM to the SMS list.
