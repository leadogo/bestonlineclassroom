# Review checklist (William, after 2026-09-21)

What to look at, in the order it matters. Tick as you go; anything wrong becomes a task.

## Before tomorrow's session (16:30 MT)
- [ ] `docs/launch-2026-09-21.md` run top to bottom.
- [ ] Zap 1 maps `classroom_join_link` and `classroom_replay_link` into ActiveCampaign (EasyWebinar fields are empty now).
- [ ] Zap 2 (engagement) untouched: it reads the site's signals, which did not change.

## UX, on your phone (iPhone) and a laptop
- [ ] Name page (`/w/ailg-r`): logo, one field, one button, nothing to think about.
- [ ] Countdown: local time reads right; flips to live without a reload.
- [ ] Room upright: video on top, chat below, send box above the keyboard; sideways: video left, chat right.
- [ ] Tap for sound once; never a native player bar.
- [ ] CTA at 1:15:00: visible, obvious, opens iClosed with name, email and phone prefilled.
- [ ] People count feels real; chat feels alive from the first second; a late joiner sees history.
- [ ] `/mod` on the phone: reply, delete, block, react; reply appears in the room within 3 s.
- [ ] Replay: Play with sound on the first press; chapters on the bar and as buttons; the 72-hour line; the pinned CTA on phones; the nudge at 1:15:00; testimonials read as real.
- [ ] Expired replay page (set an event's window to 0.01 hours on a test event to see it).
- [ ] Admin on a laptop: edit the CTA time, upload a video, import the CSV, add a teammate, block a registrant, change the replay headline.
- [ ] Design pass (phase 3): decide whether the current look is enough or a designer redraws it Zoom-faithfully.

## Analytics and leadogo
- [ ] `/admin/events/ailg-r/sessions/2026-09-21` after the session: registered, joined, live at the pitch, clicks, retention curve. Compare with the room-count post in #autoweb-intel.
- [ ] leadogo Funnel Performance: swap `fetchWebinarDailyCounts` (EasyWebinar API) for `GET https://www.bestonlineclassroom.com/api/metrics?event=ailg-r` (Bearer = our `REGISTER_SECRET`; store as `CLASSROOM_METRICS_SECRET` in leadogo's Doppler). Fields: `registered`, `attended`, `live_at_pitch`, `clicked_offer`, `watched_replay`, `retention[]`, `show_up_rate`.
- [ ] leadogo room-count cron: keeps reading `room_join` from the site's `/join`; decide whether to read `/api/metrics` instead.
- [ ] Which numbers you want on Funnel Performance beyond joined / retention / live at pitch.

## ActiveCampaign and iClosed tags
- [x] `ACTIVECAMPAIGN_API_URL` and `ACTIVECAMPAIGN_API_KEY` in Doppler prd (2026-09-20 evening; the key lists the `ailgr_*` tags).
- [ ] Tag names in `/admin/events/ailg-r` (defaults `ailgr_registered` … `ailgr_sawoffernoclick`, matching EasyWebinar's).
- [ ] After the first session: `GET /api/cron/outcomes?dry=1` (Bearer `CRON_SECRET`) lists who gets what; then check a real contact in ActiveCampaign.
- [ ] iClosed: how you want events pushed (their API or a webhook), and which events. Not built yet.

## Reminders
- [x] Postmark server token and `REMINDER_FROM` (`William Kabrall <william@bestonlineclassroom.com>`) in Doppler prd.
- [ ] Postmark: verify the domain. Postmark → Sender Signatures → Add Domain → `bestonlineclassroom.com`; add the DKIM TXT record and the Return-Path CNAME it shows in Cloudflare (DNS only); click Verify on both. Until then every send is refused with "not a Sender Signature".
- [ ] Reminder text in `/admin/events/ailg-r` (50 and 30 minutes are seeded; a third slot is available).
- [ ] `GET /api/cron/reminders?dry=1` at 16:12 MT lists tomorrow's 50-minute sends; a Test Sample receives both emails once Postmark is on.
- [ ] Decide whether ActiveCampaign's reminders stay on alongside ours.

## Housekeeping
- [ ] Bare domain as primary in Vercel (then I switch the site's `CLASSROOM_URL` back), after the session.
- [ ] Blob transfer cost on the first invoice.
- [ ] Remove the Test Sample registrants (they are excluded from every count already).
- [ ] The `event_platform: "easywebinar"` value in the Zap payload: change to `bestonlineclassroom` if nothing in the Zap filters on it.
- [ ] Supabase migrations move from the API script to the Supabase CLI once you're in the dashboard regularly.
- [ ] Phase 3 leftovers: AI moderator (persona answers when nobody is on), design pass.
