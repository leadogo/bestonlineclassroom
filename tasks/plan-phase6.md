# Plan: phase 6 (specced 2026-09-23; William said go at 7:45 PM; 6.0 shipped 2026-09-23 ~8:05 PM MT, walk on test-run 8:30 PM)

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
- [ ] B1 Brandon's post = Stats order, opt-ins denominator, typical-night line.
- [ ] B2 Tracker retention = pitch ÷ peak.
- Checkpoint: `room-count?force=1&dry=1` matches the Stats tab number for number.

## 6.2 bookings-fast
- [ ] F1 leadogo `iclosed-pull` every 3 min 6–8 PM, hourly otherwise; push to classroom at once.
- [ ] F2 Classroom `POST /api/bookings` returns the match; cancellations tracked.
- [ ] F3 🟢 🌟 New BOOKED post to #appointments-webinar; William turns the Zap off.
- [ ] F4 `/qr` redirect + scan post; link handed to William.
- Checkpoint: a test booking in iClosed reaches the desk and the channel within 3 minutes, with source lines.

## 6.3 engagement-2
- [ ] E1 Belief phrases (Settings) + score weights (+ tests).
- [ ] E2 Heartbeat minute + `attendance.minutes_seen` (migration 028; room lane) + testimonials %.
- [ ] E3 Engagement endpoint additions; PAR columns; pre-call brief Webinar block + flag.
- [ ] E4 Questions flag/answered_by (migration 029); admin Questions page + CSV.
- Checkpoint: a pre-call brief for a real booker reads right; PAR shows the two columns.

## 6.4 chat-2 (switches)
- [ ] K1 "Book now" row (kind cta) rendered per viewer; schedule in Settings (room lane).
- [ ] K2 Prompt script per event; draft lines from the transcript refined with William (room lane, Katherine switch).
- [ ] K3 Phone-number prompt → #sales-reporting with iClosed-closer round-robin (room lane + leadogo).
- [ ] K4 Ghost replies visible only to the ghost (`visible_to`).
- [ ] K5 Auto-ghost previously ghosted/blocked and 3rd-night repeats; "watched before ×N" on the desk.
- Checkpoint: full test-run walk with every switch on; on for ailg-r only when William says.
