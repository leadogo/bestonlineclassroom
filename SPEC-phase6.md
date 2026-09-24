# Capability Map, phase 6: counters that agree, bookings within minutes, engagement that reaches the closer

Status: **specced 2026-09-23 7:20 PM MT from William's 31 notes after the first two nights**; review page
https://claude.ai/artifact/Epapgj9ppiLdVtekdHLShm. Answers: all recommended except Q15 (the QR is in the video; he only
needs the target link), Q2 (prompt questions are drafted from the transcript and refined with him), Q26 (round-robin over
the iClosed closer list, not Close CRM). **No code until the room is empty and he says go.**

## The rule above every module (unchanged from phase 5)
No deploys 3:30–7:45 PM Mountain. Two lanes: room (anything a phone loads) and desk (moderator, admin, crons, leadogo,
Slack). Room-lane work: tests, admin smoke, a test-run walk on William's iPad and phone, morning deploy, preview of the
real room. Per-event switches for anything the crowd sees. Additive migrations. The 3:45 PM canary. One-click rollback.

## Definitions that every screen now shares (Jeremy, Q23, Q25)
- **Opt-ins (show-rate denominator):** people who registered themselves for that session: site opt-ins plus the Zap's SMS
  and email registrations. Not imports, not Skool, not guests. "Held a link" is a small line, never a headline.
- **Show rate** = joined ÷ opt-ins.
- **Peak** = highest concurrent count, computed with the same two-minute heartbeat grace as "in the room now", scanned
  every 15 seconds. **At the pitch** = in the room at the pitch instant with the same grace, frozen two minutes after.
- **Retention** = in the room now ÷ peak on the live card; at the pitch ÷ peak on the tracker and in Brandon's post.
- **Bookings** = our `bookings` table, reschedule chains collapsed to one person, cancellations excluded; it feeds the
  desk, Brandon, the tracker, the appointments channel and the report. One source, one number.
- **The five Brandon and Stats lead with:** peak, at the pitch, retention to the pitch, calls booked, bookings per pitch
  attendee. Then show rate, offer clicks, chatters, stayed 15+, projected bookings, the typical-night line.

| Module id | Responsibility | Lane | Notes | Phase |
|---|---|---|---|---|
| `counters` | Peak and at-the-pitch on the grace rule; green live count; retention on the live card; typical-night curve (warming / peak / holding / cooling) from the last ten sessions; Attendees search; Booking link + Enter; press feedback on every button; monitor pauses when hidden; `/moderate`, `/moderator`, `/desk` → `/mod`; iPad overscroll; reaction pop. | desk + small room CSS | 1, 9, 3, 23, 20, 24, 14, 19, 22, 13, 6 | 6.0 |
| `brandon` | Brandon's 15-minute post mirrors the Stats tab (the five, then the rest, then the typical-night line); show rate on opt-ins; the tracker's retention moves to ÷ peak. | leadogo | 4, 25, 23 | 6.1 |
| `bookings-fast` | leadogo pulls iClosed every 3 minutes 6:00–8:00 PM (hourly otherwise) and pushes to the classroom at once; reschedule chains collapsed, cancellations flagged; 🟢 🌟 "New BOOKED AILGR Webinar Lead" post to #appointments-webinar with name, email, phone, closer, call time MT, session, source (ad/campaign/creative, opt-in age, or Skool/SMS/import/organic), watch summary, minutes after the pitch; replaces the Zap's post; `/qr` redirect that logs the scan, posts to #autoweb-intel and forwards to the booking link with utm_source=qr. | leadogo + desk | 11, 18, 12, 15 | 6.2 |
| `engagement-2` | Belief signals (phrase list in Settings; weights minutes 35 / pitch 25 / messages 15 / belief 10 / clicked 15); per-minute watch map from the heartbeat (which minutes were seen) → testimonials watched % (1:47:00 to the end); PAR board gets webinar score and testimonials %; the pre-call brief gets a Webinar block in Jeremy's order with the High/Medium/Low flag; Questions page and export (question, minute, answer, who). | leadogo + desk + one heartbeat field | 7, 16, 17, 27 | 6.3 |
| `chat-2` | Katherine's per-viewer "book now" row at the pitch, +3, +8, +15, pinned while the banner shows; a timed prompt script per event (minute → line) behind the Katherine switch, lines drafted from the transcript and refined with William; phone-number prompt ("Want someone from the team to call you?") → #sales-reporting with round-robin over the iClosed closer list and a mention, number hidden from the room; ghost replies visible only to the ghost; auto-ghost anyone ghosted or blocked before, "watched before ×N" on the desk, auto-ghost from the third night. | room (switches) + desk + leadogo | 10, 2, 26, 28, 29 | 6.4 |

Build order: `counters` → `brandon` and `bookings-fast` in parallel → `engagement-2` → `chat-2`.

## Module notes

### counters (6.0)
- One `presence(intervals, at, graceMs = 120_000)` helper in `lib/outcomes.ts` used by in-room, peak, at-the-pitch and the
  typical-night curve; peak scans every 15 s. At-the-pitch freezes at pitch + 2 min (stored on `session_stats`, new table:
  event_id, session_date, minute, in_room; written by the desk poll and the outcomes cron; the typical-night curve reads it).
- Live card: green count, "retention 78% of peak" beneath it once the peak is past.
- Typical night: average of the last ten sessions' minute curves; tile "peak at minute 42 · holding to the pitch · cooling
  from 1:20" and a phase word for the current minute; the same line in Brandon's post.
- Attendees: search box filters name and email as you type.
- Booking link: after insert, focus the input and let Enter send. Press feedback: 120 ms scale on all buttons (desk and room).
- Monitor: pause on `visibilitychange` hidden, re-sync on visible.
- Redirects in `next.config`: /moderate, /moderator, /desk → /mod. Team page shows the short address.
- Room: `overscroll-behavior: none` on the shell; reactions pop and count optimistically, snap back on refusal.

### brandon (6.1)
- `classroomRoomCountText` rewritten to the Stats order; opt-ins denominator; the typical-night line; final at 7:30.
- leadogo tracker: retention = pitch ÷ peak (joined_auto stays for the joined column). Sync unchanged.

### bookings-fast (6.2)
- leadogo: `iclosed-pull` cron `*/3 0-2 * * *` UTC (6:00–8:00 PM MDT) + hourly; on new or changed calls → push to the
  classroom `POST /api/bookings` (already exists) → then post to #appointments-webinar via `postToSlack` with the
  account's bot token; dedupe by iClosed call id; reschedule chains collapsed (leadogo's `dedupeRescheduleChains`).
- Classroom `POST /api/bookings` returns the match (registrant, session, source, attribution, watch summary) so the post
  can carry it; `bookings.status` drives "cancelled" corrections in the channel.
- `/qr`: `GET /qr` → log to `link_clicks` (path `qr`), post "📱 QR scanned at 6:17 PM" to #autoweb-intel, 302 to
  `cta_href` + `utm_source=qr&utm_medium=video&utm_campaign=ailgr-pitch&src=qr`. William's QR target becomes
  `https://bestonlineclassroom.com/qr`.

### engagement-2 (6.3)
- `events.belief_phrases text[]` (Settings), default list: makes sense, wow, value, amazing, so true, crazy good, that's
  great, love this, exactly, 100%, this is it, need this, game changer, 🔥, 🙌, 👏. `lib/engagement.ts` gains `belief`.
- Heartbeat carries `minute`; `attendance.minutes_seen int[]` (additive) appended; `testimonials_pct` = minutes seen in
  [1:47:00, end] ÷ minutes in that range. Room lane: the heartbeat body only; walked on test-run.
- `/api/metrics/engagement` adds `belief`, `testimonials_pct`, `score` breakdown; leadogo PAR board adds two columns;
  the pre-call brief adds the Webinar block (Jeremy's 12 lines, flag High = 60+ min, at the pitch, clicked; Medium = two).
- Questions: `chat_messages.is_question` (rule: "?" or starts with how/what/does/can/is/will/when/where), `answered_by`
  set when a moderator reply mentions the asker; admin Questions page + CSV.

### chat-2 (6.4, switches, test-run first)
- "Book now" row: a chat row of kind `cta` that each client renders with its own `p.cta.href`; Katherine posts it at the
  pitch, +3, +8, +15 (Settings: minutes list); pinned above the list while the banner is up.
- Prompt script: `events.prompts jsonb` [{minute, text}], posted by Katherine on the room's clock; draft in
  `docs/katherine-prompts-draft.md`, William edits in Settings.
- Phone numbers: the filter detects a phone; the room shows that person a prompt; Yes → message stored with the number
  masked for the room, `call_requests` row, leadogo endpoint posts to #sales-reporting with a round-robin closer from
  the iClosed closer list (read-only: no write to iClosed) and mentions them; No → posted with the number removed.
- Ghost reply: `chat_messages.visible_to uuid` set when a moderator reply mentions a ghosted registrant.
- Auto-ghost: at first heartbeat, ghost if the email was ghosted or blocked before, or has attended two or more earlier
  sessions; desk rows and messages show "watched before ×N" with one-tap Ghost.

## On William
- Q5: confirm the two Zaps are Slack-only, then turn them off. Q12: turn the "New BOOKED" Zap off once ours posts.
- Q11: check iClosed for a booking webhook; polling every 3 minutes until then.
- Q15: point the QR at `https://bestonlineclassroom.com/qr` once 6.2 is live (link given in chat).
- Video edits: smoky, camera-ask and baby audio; Jeremy's micro-CTA at 35–40, re-hook at 65, proof clips at 70–80.
- Q2: refine the prompt lines in `docs/katherine-prompts-draft.md`.
