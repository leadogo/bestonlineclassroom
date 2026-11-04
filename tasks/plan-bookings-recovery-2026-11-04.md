# Plan — bookings recovery M1–M6 (SPEC-bookings-recovery.md), Nov 4 2026

Three repos, built in parallel lanes; shipped per wave. Each task: failing test → code → full suite → typecheck → commit.

## Dependency graph
- M1, M2 (classroom) and M3 (katherine) are independent → wave 1.
- M4 needs the classroom rescue endpoint (T3) before the Katherine rescue lane (T5) can be dry-run against real data;
  the lane is built against the contract in the spec meanwhile. M4's call order relies on M3 (rescue ahead of all).
- M6's lanes endpoint (T7) reads Katherine's lists, including `rescue` (T5); the leadogo board (T8) reads T7.
- M5 (T6) builds on M3's slot logic; ships behind a constant (`DAYTIME_REINVITES = false`) until wave 3.

## Lane A — classroom (bestonlineclassroom, branch feat/bookings-recovery)
- **T1 M1 push result.** Pure `pushResult()` + tripwires in `push-day.ts`; route reads counters before tagging and
  judges the previous push from push_log × link_clicks (src push|email, non-bot) × attendance × bookings; notice line.
  Accept: tests for maths/tripwires/empty push; dry run reports Nov 3's push (534) from records.
- **T2 M2 repeat missers.** Migration 053 (`missed_followups`, `rescue_texts`). Pure `missedAction()`. Outcome planner
  owes `missed` again when the last `missed` outcome_tag predates this session (moved-in rows reuse the registrant id);
  pusher: `rerun` = remove 306 + 339, add 306; log run. `removeTag` helper in activecampaign.ts.
  Accept: tests 13 d skip / 14 d rerun / first / tagged-never-logged; dry run lists tonight's reruns.
- **T3 M4 classroom side.** Pure `rescue.ts` (who qualifies, 15-min rule, second ring); `GET /api/registrants/rescue`
  (Bearer CLASSROOM_API_SECRET); cron `rescue-text` every 5 min, 20:15–22:45 ET guard → tag `ailgr_rescue` once per
  registrant per session (`rescue_texts`). Accept: tests incl. booked-at-minute-12, 14-min not yet; dry run tonight.

## Lane B — Katherine (katherine-v5, own worktree)
- **T4 M3** day-of first: no_show/reinvite rows at the 18:15 slot; verify fair-share query order. Tests.
- **T5 M4 rescue lane:** `rescue-plan.ts` (pure), area-code time zone, 30–60 min after click, 8:55 PM local cut-off →
  10 AM local next day, every 5th holdout, mode `rescue` opener + prompt section; second ring `pitch_no_click` cap 15.
  Reads the T3 endpoint via `lib/masterclass/classroom.ts`. Tests.
- **T6 M5** daytime window + spacing behind `DAYTIME_REINVITES = false`. Tests.

## Lane C — board (katherine-v5 endpoint + leadogo-app, own worktrees)
- **T7** Katherine `GET /api/masterclass/lanes` (insights secret) + pure `lanes.ts` (per list/pool counts, per-number
  per-hour dials, alerts). Tests.
- **T8** leadogo "What she's doing" first tab on /sales/katherine + API route; PAR lane from par_outreach(_touches);
  find PAR's calling number. Render check desktop + phone.

## Checkpoints
- **CP1 (after T1, T2, T4):** all suites green; real-data dry runs; review → ready to ship wave 1 (with AC edits:
  6239/6241 links, 172/192 triggers).
- **CP2 (after T3, T5, T7, T8):** dry run of tonight's rescue list end to end; review → ship wave 2 (AC "AILGR Rescue
  text" automation built and read back).
- **CP3 (Mon Nov 9):** flip `DAYTIME_REINVITES` after 72 h of wave 2 with no flagged number.
