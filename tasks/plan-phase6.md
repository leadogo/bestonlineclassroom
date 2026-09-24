# Plan: phase 6 (specced 2026-09-23; William said go at 7:45 PM and asked for all of it tonight; 6.0–6.4 shipped by 2026-09-23 ~11 PM MT; one walk on test-run 8:30 AM Sep 24)

Guardrails as phase 5. Room-lane tasks are marked; each gets the test-run walk before a morning deploy.

## 6.0 counters
- [x] C1 `presence()` grace rule for in-room, peak, at-the-pitch (+ tests); at-the-pitch frozen at pitch + 2 min.
- [x] C2 Typical-night tile + phase word from the last ten sessions' attendance intervals (no new table needed; the history endpoint returns each session's minute curve).
- [x] C3 Green live count; retention on the live card.
- [x] C4 Attendees search.
- [x] C5 Booking link + Enter; press feedback on buttons (desk; room CSS = room lane).
- [x] C6 Monitor pauses when hidden.
- [x] C7 Redirects /moderate /moderator /desk → /mod; team page shows the short address.
- [x] C8 Room: overscroll off; reaction pop (room lane).
- Checkpoint: iPad + phone walk on test-run; the peak never sits below the live count for a whole test.

## 6.1 brandon
- [x] B1 Brandon's post = Stats order, opt-ins denominator, typical-night line.
- [x] B2 Tracker retention = pitch ÷ peak.
- Checkpoint: `room-count?force=1&dry=1` matches the Stats tab number for number.

## 6.2 bookings-fast
- [x] F1 iClosed webhook → leadogo `/api/webhooks/iclosed?key=…` (William adds the subscriber URL; triggers: created, rescheduled, cancelled) → upcoming pull → push → announce; the 30-minute sync stays as the fallback. No 3-minute poll needed.
- [x] F2 Classroom `POST /api/bookings` returns the match; cancellations tracked.
- [x] F3 🟢 🌟 New BOOKED post to #appointments-webinar; William turns the Zap off.
- [x] F4 `/qr` redirect + scan post; link handed to William.
- Checkpoint: a test booking in iClosed reaches the desk and the channel within 3 minutes, with source lines.

## 6.3 engagement-2
- [x] E1 Belief phrases (Settings) + score weights (+ tests).
- [x] E2 Heartbeat minute + `attendance.minutes_seen` (migration 028; room lane) + testimonials %.
- [x] E3 Engagement endpoint additions; PAR columns; pre-call brief Webinar block + flag.
- [x] E4 Questions flag/answered_by (migration 029); admin Questions page + CSV.
- Checkpoint: a pre-call brief for a real booker reads right; PAR shows the two columns.

## 6.4 chat-2 (switches)
- [x] K1 "Book now" row (kind cta) rendered per viewer; schedule in Settings (room lane).
- [x] K2 Prompt script per event; draft lines from the transcript refined with William (room lane, Katherine switch).
- [x] K3 Phone-number prompt → #sales-reporting with iClosed-closer round-robin (room lane + leadogo).
- [x] K4 Ghost replies visible only to the ghost (`visible_to`).
- [x] K5 Auto-ghost previously ghosted/blocked and 3rd-night repeats; "watched before ×N" on the desk.
- Checkpoint: full test-run walk with every switch on; on for ailg-r only when William says.
