# Capability Map, phase 4: operate many webinars

Status: **approved by William 2026-09-20 late, with `analytics-ui` added at his request. Built the same night
(William: "lets continue as of now"), all six modules deployed; the leadogo side is PR #35 in leadogo-app,
migration 249 applied.** Decisions taken in the spec chat: moderators moderate and see the numbers, not
settings; webinars recur on chosen weekdays at one time; IPs are kept 30 days for blocking, applied at the edge;
reactions and @mentions are for everyone.

Built as: migrations 015 (days), 016 (roles, assignments, invites), 017 (ghost, IP, reactions, mentions).
Edge IP blocking needs `VERCEL_TOKEN` in Doppler (a Vercel account token); until then blocks apply on our side
only and the moderator button says so. Peak live for leadogo is computed from attendance intervals
(`peakConcurrent`). "New webinar" copies settings and the simulated chat; the video and brand are uploaded on the
new webinar's settings page.

| Module id | Responsibility | Depends on | Phase |
|---|---|---|---|
| `schedules` | A webinar recurs on chosen weekdays at one start time in its timezone (`events.days`, default all seven). `nextSession` skips days that are off; links, emails, reminders, the countdown and the metrics follow. The room and replay change nothing. | `schedule` | 4 |
| `roles-team` | Two roles: **admin** (everything) and **moderator** (the moderator view and the session numbers for the webinars they're assigned to). Invitations by email with a set-password link instead of a printed password; a moderator's own link `/mod/<webinar>` that opens the live chat for the current session; assignments per webinar; remove and re-invite. | `moderator`, `reminders` (Postmark) | 4 |
| `dashboard` | `/admin` becomes the operating screen: every webinar with its next session, "LIVE now, 43 in the room" while running, registrants for the next session, last session's joined / show-up / clicks, who's moderating, quick links (settings, registrants, moderate, preview). Create a webinar from the dashboard (copy from an existing one). | `schedules`, `roles-team`, `analytics` | 4 |
| `chat-moderation` | For moderators, on every message: **delete** (exists), **block** (exists; the person is out), **ghost block** (the person stays and sees their own messages; nobody else does; the moderator view marks them), **IP block** (the join's IP is blocked at Vercel's edge and on our side; wiped after 30 days). Real vs simulated messages are marked in the moderator view and in exports; attendees never see the difference. A "recorded" badge on chat exports of past sessions. | `chat`, `moderator` | 4 |
| `chat-social` | **Reactions** by everyone: one per emoji per person, Slack-style counts, tap again to remove. **@mentions**: typing `@` offers real attendees and moderators in the room; the mentioned person's name is highlighted and they get a badge; moderators see a "mentions" filter. Simulated people cannot be mentioned or reacted to as if real (their counts are display only). | `chat` | 4 |
| `analytics-ui` | Per webinar, across sessions: a table and trend of registered, joined, show-up %, live at the pitch, CTA clicks, replay, retention at each 10-minute mark, by day and by week; a session-to-session comparison; CSV export of sessions, registrants and chat. The **leadogo mapping**: Funnel Performance in leadogo-app reads `GET /api/metrics` (a change in that repo) so its daily rows come from us, with the room-count cron reading the same feed. Moderators see it read-only for their webinars. | `analytics`, `dashboard` | 4 |

Build order: `schedules` → `roles-team` → `dashboard` → `chat-moderation`, `chat-social` and `analytics-ui` in parallel.

## Module notes (enough to plan from; each gets its own SPEC when built)

### schedules
- `events.days int[]` (0 = Sunday … 6 = Saturday), default `{0,1,2,3,4,5,6}`. `nextSession` and `sessionFor`
  take the days; a date not in `days` has no session (a registrant dated that day is moved to the next one at
  registration time). The admin settings gain seven checkboxes.
- Test: Tue/Thu schedule at 17:00, an opt-in on Wednesday registers for Thursday; the countdown says Thursday.

### roles-team
- `team_members.role text` (`admin` | `moderator`), `team_assignments(member_id, event_id)`. Invitation:
  `team_invites(token, email, role, expires_at)`; the email carries `/invite/<token>` → set a password → signed
  in (the two-factor device becomes trusted at that moment). Admin can resend, revoke, change role, assign.
- Guards: `getTeamMember()` returns the role; `/admin/*` needs admin; `/mod` and `/api/mod` need an assignment
  (admins are assigned to everything); the session numbers page allows assigned moderators, read-only.
- The moderator's link: `/mod/<slug>`; the dashboard shows it per person.

### dashboard
- One query per webinar: next session, live state (start ≤ now < end), people seen in the last two minutes,
  registrants for the next session, last session's `session_metrics`.
- "New webinar" copies settings, chapters, copy, tags, reminder rules and the simulated chat from a chosen one;
  video and brand are uploaded separately.
- The Zap and the site pass `event` (slug) to the webhook already; a second webinar only needs a second landing
  page sending its slug.

### chat-moderation
- Ghost: `registrants.ghosted_at`; `chat_messages.visibility` (`all` | `author`). `POST /api/chat` from a ghosted
  registrant stores `author`; `GET /api/chat` returns `author` rows only to their token. `/api/mod` shows them
  with a ghost mark. Unghost restores nothing retroactively (their earlier rows stay author-only).
- IP: `attendance.ip inet` set on the first heartbeat (the request's `x-forwarded-for`), nulled by a nightly job
  after 30 days. Block = `blocked_ips(ip, reason, by, at)` + `vercel firewall ip-blocks add` through the CLI's
  API (`/api/mod` action `block_ip`); our side also refuses `/api/chat` and the room for that IP as a fallback.
  Unblock removes both.
- Real vs simulated: the moderator view already labels simulated rows; add the same to the CSV export of a
  session's chat and a "recorded" header for past sessions.

### chat-social
- `message_reactions(message_id, registrant_id | team_member_id, emoji, at)` unique per person per emoji;
  `chat_messages.reactions` becomes a maintained count (trigger or on write). The poll's `updated` carries the
  new counts; the attendee's own reactions are marked so the button reads pressed.
- Mentions: `chat_messages.mentions uuid[]`; the composer offers names (real attendees seen in the last 2
  minutes, moderators); the message renders `@Name` in the brand colour; the mentioned viewer's tab shows a
  badge and the message row is tinted. Moderators get a "Mentions" filter in `/mod`.

### analytics-ui
- `/admin/events/<slug>/analytics`: `session_metrics` rows for the last 30 and 90 days, the tiles from the
  session page as a trend (one line per number), retention at 10-minute marks as a small multiple per session,
  "compare two sessions" side by side. Exports: sessions CSV, registrants CSV (name, email, source, live
  minutes, replay minutes, CTA, tags sent), chat CSV (with real / simulated marked).
- leadogo-app: `fetchWebinarDailyCounts` reads `GET https://www.bestonlineclassroom.com/api/metrics` with a
  bearer stored in leadogo's Doppler; the Funnel Performance daily row maps registered → registrants, joined →
  attendees, live_at_pitch and clicked_offer as new columns; the room-count cron reads the same feed instead
  of the site's `room_join` events. One branch in leadogo-app, reviewed there.

## What else remains, across everything (for the dashboard of work)
1. **Tomorrow, 2026-09-21**: the launch checklist from 16:30 MT (`docs/launch-2026-09-21.md`).
2. **leadogo**: part of `analytics-ui` above.
3. **iClosed**: server-side push of events (needs their API details); the CTA prefill works today.
4. **Design pass** (Zoom-faithful room and replay, designed in a tool, applied without changing data flow).
5. **AI moderator**: a persona that answers when no human is on; rate-limited; hands off.
6. **Encrypted HLS** (Mux or Cloudflare Stream) only if video sharing becomes a real problem.
7. **Housekeeping**: bare domain as primary in Vercel (with the site's `CLASSROOM_URL` switch), Blob transfer
   cost on the first invoice, Test Sample rows cleanup, `event_platform` value in the Zap payload, Supabase CLI
   for migrations, the Supabase "leaked password protection" toggle, backups plan, BIMI's Verified Mark
   Certificate if Gmail logos matter.
8. **ActiveCampaign**: the link rewrite finishes tonight; confirm on a contact tomorrow.
