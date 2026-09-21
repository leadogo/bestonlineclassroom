# Spec: end-to-end test run, 2026-09-20 22:45 MT

## Objective
Prove, before the first real session (2026-09-21 17:00 MT), that a registrant who clicks their link lands in a
room that works, and that nothing in the path (email, countdown, start, video, chat, moderation, offer, replay,
admin) breaks. One throwaway webinar `test-run` (a copy of `ailg-r` with the same 2 h 20 min video and the
753 simulated messages), one real registrant (Will Kabrall, kabrallw@gmail.com), the offer moved to minute 3 so
it can be seen tonight. ActiveCampaign tags are blank on the copy. Torn down after with
`npm run test:event -- --teardown`.

Assumptions: William tests from his iPhone as the attendee and from a laptop as admin; the moderator account is
the same Gmail address, invited as a moderator for `ailg-r` and `test-run`. Anything that fails tonight is fixed
tonight or listed as a known limit for tomorrow.

## What was set up (22:26 MT)
- `test-run` at 22:45 America/Edmonton, video 8385 s, CTA at 3:00, hides at 8:00.
- Registered through the production webhook: token `u8zea2qz9dqa`; confirmation with the calendar invite delivered
  by Postmark at 22:26:14; the 15-minute reminder is due at 22:30 (the 30-minute one was already past).
- Moderator invite emailed to kabrallw@gmail.com at 22:26:16 ("You're on the BestOnlineClassroom team").
- Pre-flight from the terminal: `/j/<token>` renders the countdown (10:45 PM Mountain, 11:45 PM Central,
  12:45 AM Eastern); `/replay/<token>` renders; the video answers byte-range requests with 206 (seeking works).

## Commands
- Create/refresh: `npm run test:event -- --at 22:45 --email kabrallw@gmail.com --first Will`
- Tear down: `npm run test:event -- --teardown`
- Invite a moderator: `doppler run -c prd -- node scripts/team-invite.ts --email … --name … --role moderator --events ailg-r,test-run`
- Live numbers: `GET /api/metrics?event=test-run` with the bearer; Postmark outbound search for delivery.

## Testing strategy
The checklist (published as an artifact for the phone) walks the evening in time order: before the start, the
start instant, the first ten minutes, the moderator side, the admin side, the replay, then teardown. Each line
says what to do, what must be true, and what to note if it is not. Anything marked **must** blocks tomorrow.

## Success criteria
- The countdown flips to live at 22:45:00 without a reload; video plays from 0:00 within 5 s of a tap for sound.
- Joining late lands at the right minute; locking and unlocking the phone resumes at the live minute.
- Chat: simulated messages on schedule; a real message is visible on the other device within 3 s; a moderator
  reply shows the badge; block hides the sender's messages; ghost keeps them visible only to the sender.
- The offer bar appears at 3:00 with the person's name, email and phone prefilled on the iClosed page.
- Attendance rows and the dashboard's live count reflect the two devices within 2 minutes.
- The replay link plays with chapters, remembers position, and the 72-hour window is stamped on first open.
- The moderator invite leads to a set-password page and lands on `/mod/test-run`; that account cannot open settings.

## Boundaries
- Always: keep `ailg-r` untouched; test with the throwaway webinar and the Gmail address only.
- Ask first: nothing tonight; William is driving.
- Never: leave `test-run` in place after the test; never tag a real ActiveCampaign contact from the test.

## Known limits tonight (not bugs for tomorrow)
- The confirmation subject reads the Eastern time first; a 22:45 MT start is 12:45 AM ET the next day, so the
  date and time look odd tonight. Tomorrow's 17:00 MT is 7:00 PM ET the same day.
- The "session ended" redirect and the 72-hour replay expiry cannot be seen tonight (the video runs to 01:04).
- Load: one real viewer tonight; the platform's limits for 100+ viewers are Vercel Blob egress and the per-IP
  chat rate limit (300/min), both noted in the review checklist.
