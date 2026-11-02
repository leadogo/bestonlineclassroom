# SPEC — Daily ActiveCampaign push (eight groups) and week-1 additions

Status: APPROVED by William, Nov 2 2026. Base (eight groups, Mon–Thu 5:50 pm ET) shipped in PR #23 (7be1675).
Week-1 additions M1–M3 below. Jeremy conversation `b27fd1ef-8d1a-4463-afdb-92e3ad1df7b2` (Nov 2 rulings).

## Objective

Lift the 7 pm ET room four nights a week from people already in ActiveCampaign, without wearing out the list.
Success = more real people (watched 2+ min) and bookings from contacts who registered before yesterday, with
email-1 opens ≥ 20%, unsubscribes ≤ 2.5% and spam complaints < 0.3% per push.

### Base (shipped, PR #23)
ActiveCampaign's scheduled trigger admits a contact once ever, so the classroom app picks:
- 4,021 eligible contacts (old trigger segment 1972) split round-robin by engagement into `push_g1`…`push_g8` (tags 422–429).
- `/api/cron/push-day` (`50 21,22 * * 1-4`, guard 17:5x ET): Nov 2 = group 1, next group each Mon–Thu, back every 14 days.
  Newcomers in segment 1972 join the smallest group. Skips contacts active in automation 192 and anyone in `push_log`
  within 13 days. Tags `push_today` (421) → automation 199 (trigger 264) removes the tag, excludes booked/clients/registered
  tonight, email 1 now, SMS once ever, email 2 at 7 pm if not registered.
- `push_log`, `push_runs`; one #autoweb-intel line with the previous push's email-1 deltas and tripwires.
- Old Tue/Thu scheduled trigger 261 deleted Nov 2.

### M1 — Hot track (classroom app)
Who: AC contacts tagged `ailgr_attended` (305) or `ailgr_watched40min` (316), not `ailgr-booked` (334), not `bms_client` (14),
not in any push group. 541 today (447 watched 40+). They were never pushed because segment 1972 requires missed/left early.

Rules (Jeremy A1):
1. On a push day, first-invite up to `HOT_DAILY_CAP = 140` hot contacts with no hot push yet (watched 40+ first).
2. Second invite to anyone whose only hot push was ≥ 7 days ago (no cap; volume is the previous week's first invites).
3. After two hot pushes they join the smallest group (group tag) and leave the hot track.
4. Same exclusions as groups: active in 192, or any push in the last 6 days.
5. Same automation and emails (tag `push_today`); `push_log.track = 'hot'` separates them.
6. Slack line adds "N hot (first M, second K)".

### M2 — Katherine push days Mon–Thu (katherine-v5)
`MASTERCLASS_PUSH_DAYS` `[2, 4]` → `[1, 2, 3, 4]`. The re-invite cap (env `MASTERCLASS_PUSH_DAY_REINVITES = 200`)
applies on all four push days (William, Nov 2: "Yes, 200 on Mon–Thu"). Fri–Sun stay at 75.

### M3 — Katherine calls stayed-not-booked (katherine-v5)
William, Nov 2: re-invite them to watch tonight (overrides his Oct 15 rule "15+ min watchers are not re-invited to watch
again" for this pool). New planner pool `attended`:
- From the existing 30-day classroom pool: `poolFor(r) === "attended"` (live ≥ 900 s, not booked), age ≥ 3 days.
- 40 rows a day (`MASTERCLASS_REINVITE.attended.perDay`), every day, inside what the rows cap leaves; its own ordinal and
  every-5th holdout; one call per person for life (shared `reinvitedPhones`); newest first.
- Mode `reinvite_attended` (opener already written: "You came out to the Masterclass a few nights ago…").

## Commands
- classroom: `npm test` (node --test), `npx tsc --noEmit`, `npm run db:migrate` (Doppler prd), dry run
  `curl -H "Authorization: Bearer $CRON_SECRET" "https://<host>/api/cron/push-day?dry=1"`.
- katherine-v5: `npx vitest run lib/masterclass`, `npx tsc --noEmit`, dry run `scripts/masterclass-reinvite-plan.ts --date YYYY-MM-DD`.

## Project structure
- classroom: `src/lib/push-day.ts` (pure), `src/lib/push-day.test.ts`, `src/app/api/cron/push-day/route.ts`,
  `src/lib/notices.ts` (`pushNotice`), `supabase/migrations/052_push_track.sql`.
- katherine-v5: `lib/masterclass/constants.ts`, `lib/masterclass/reinvite-plan.ts` (+ test), `lib/masterclass/import.ts`.

## Code style
Match each repo: pure planners with no I/O, one-line doc comments that state the rule and who decided it, no new deps.

## Testing
Pure functions get unit tests (hot pick: cap, order, 7-day second invite, graduation after two, exclusions; Katherine:
push days Mon–Thu, attended pool age/cap/holdout/lifetime). Prod verification = dry runs before the first live push.

## Boundaries
- Always: dry run before a live change; never push a contact twice in a day; respect 192 and the holds.
- Ask first: new email copy, new sending domain, Katherine pools beyond the 30-day window, any AC automation edit.
- Never: pause a live Zap; touch unsubscribed/bounced contacts; RevRing.

## Later (not in this build)
Re-engagement path for ~11k lapsed registrants (250/day, plain text), ~16k old-launch contacts on a separate sending
domain, Katherine calls to today's group, 4 rotating email angles.
