# Plan: kaitlyn-autopilot + kaitlyn-knowledge (approved by William Oct 17 2026, 10:40 PM MT)

Specs: `SPEC-kaitlyn-autopilot.md`, `SPEC-kaitlyn-knowledge.md`. One commit per task; tests first.

Day 1 (deploy before 5 PM MT Oct 18; nothing in the 3:30 to 7:45 PM window)
- [x] T1 Migrations 031 (events.autopilot, kaitlyn_decisions.autopilot) and 032 (kaitlyn_kb, kaitlyn_decisions.kb_key, events.kaitlyn_digest_on), applied.
- [x] T2 `src/lib/humanize.ts`: `tidy`, `tells` (+ test).
- [x] T3 `src/lib/kaitlyn-kb.ts`: key check, KNOWLEDGE block, digest time rule and text, rewrite fact check, hand-off line (+ test).
- [x] T4 `src/lib/kaitlyn.ts`: WRITING block, KNOWLEDGE block, are-you-AI and replay rules, `kb` in the output, guard exceptions, `tidy`/`tells` in `parseDecision`, `engaged`, length-scaled pause, hand-off line, presence checks, KB upsert, autopilot badge and Slack lines (+ tests).
- [x] T5 `src/app/api/chat/route.ts`: pass `autopilot` and `id` with the event.
- [x] T6 Seed script `scripts/seed-kaitlyn-kb.mjs` (the 48 for ailg-r and test-run), run.
- [x] T7 Admin sidebar Autopilot control (admin-nav, layout, actions) + Webinars card row; desk strip text, Teach box (`case "teach"`), `autopilot` badge.
- [x] T8 Deploy (bdctfxkgn, then 28b22a5 with maxDuration 60 on the chat route: the paused reply was being cut off), production check on test-run with a test seat: empty desk → price line posted 12.7 s later with the autopilot badge; moderator present → the contract draft waited on the desk; unknown question → hand-off line + open row; "are you AI? and how long" → the length answer only. Cleaned.

Day 2
- [ ] T9 `/admin/knowledge` page + actions + forms; sidebar item with open count.
- [ ] T10 Rewrite call with vendored humanizer rules + fact check.
- [ ] T11 `/api/cron/kaitlyn-digest` + vercel.json cron.
- [ ] T12 `scripts/kaitlyn-eval.mjs` + `docs/kaitlyn-eval.md`.
- [ ] T13 Deploy, production check, review.
