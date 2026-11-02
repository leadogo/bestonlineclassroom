# Plan — daily push week-1 additions (SPEC-daily-push.md M1–M3), Nov 2 2026

Dependency graph: M1 (classroom) and M2/M3 (katherine-v5) touch different repos and share nothing at run time;
M3 depends on M2 only by file (same constants.ts). Order: T1 → T2 → CP1 → T3 → T4 → CP2 → ship.
Deadline: live before Tue Nov 3 5:50 pm ET (group 2 + first hot invites).

## T1 — Hot pick (pure) · classroom
`src/lib/push-day.ts`: `pickHot(candidates, history, inReengagement, today)` → `{ first, second, graduate }`.
- candidates ordered watched-40 first; first invites ≤ `HOT_DAILY_CAP` (140) among those with no hot push;
  second invite when the only hot push is ≥ 7 days before today; two hot pushes → graduate (not pushed);
  anyone in 192 or pushed in the last 6 days sits out.
Acceptance: unit tests for cap, order, 7-day boundary (6 days no, 7 yes), graduation, exclusions, de-dupe.
Verify: `npm test`.

## T2 — Hot track in the cron · classroom
- Migration `052_push_track.sql`: `push_log.track text not null default 'group'`.
- Route: candidates = (tag 305 ∪ 316) − booked 334 − client 14 − any group member; history from `push_log` (track='hot');
  tag first+second `push_today`, log them `track='hot'`; graduates get the smallest group's tag.
- `pushNotice`: "N hot invited (first M, second K), G graduated".
Acceptance: tsc clean, tests pass, `?dry=1&group=2` in prod after deploy shows ~140 hot first invites and group 2 counts.
Verify: `npx tsc --noEmit`, `npm test`, prod dry run.

### CP1 — classroom PR: review, migrate 052, merge, prod dry run. Stop if the dry run counts look wrong.

## T3 — Push days Mon–Thu · katherine-v5
`MASTERCLASS_PUSH_DAYS = [1, 2, 3, 4]`; update its comment and the reinvite-plan test (Mon is a push day, Fri is not).
Verify: `npx vitest run lib/masterclass`.

## T4 — Attended pool, 40 a day · katherine-v5
- `MASTERCLASS_REINVITE.attended = { minDaysAgo: 3, perDay: 40 }`.
- `reinviteBudget` adds `attendedRoom = perDay − today.attendedRows` (every day).
- `planReinvites` takes `poolFor(r) === "attended"`, age 3–30, newest first, inside rows-cap leftovers, mode `reinvite_attended`,
  own ordinal + every-5th holdout, after the main queue, before the unknown cohort.
- `import.ts`: count `attendedRows`; the early return also checks `attendedRoom`.
Acceptance: tests for age gate, cap, holdout ordinal, lifetime phones, rows-cap squeeze; tsc clean.
Verify: vitest, tsc, `scripts/masterclass-reinvite-plan.ts --date 2026-11-03` dry run shows an `attended` pool ≤ 40.

### CP2 — katherine PR: review, merge, deploy, dry run for Nov 3.

## Ship
Tue Nov 3: the cron runs group 2 + hot at 5:50 pm ET; Katherine's import runs with push day = true and the attended pool.
Watch the #autoweb-intel line and Katherine's digest; report to William.
