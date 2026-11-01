# SPEC: Clock agreement (1 Nov 2026)

## Why
On 1 Nov 2026 Alberta stayed on UTC-6 while Eastern fell back. The webinar was defined as 5 PM Edmonton but sold as
7 PM Eastern, so every system that timed it from Edmonton drifted an hour. William caught it by hand that afternoon.
This check catches the next drift the morning it happens, whatever causes it (a law change, a stale tzdata, a
hand edit).

## What
Inside the daily canary (`/api/cron/canary`, 3:45 PM Alberta = 4:45 PM ET in winter, 5:45 PM ET in summer), for the
`ailg-r` event only. The events row is the source of truth: tonight's start = `sessionFor(scheduleOf(row), today)`.

| System | Read | Must |
|---|---|---|
| Site | `GET thefuturerealestateagent.com/api/calendar`, first `DTSTART` | equal the start |
| Katherine | `GET app.getkatherine.ai/api/public/webinar-clock` (`next_start`, `slots`) | equal the start; every slot before it |
| Leadogo | `GET app.leadogo.com/api/public/webinar-clock` (`next_start`) | equal the start |
| ActiveCampaign | `/api/3/users/me` `localZoneid`; `/automations/{173..178,191,199}/triggers` | account zone = the event's zone (every "wait until date field" step runs on it); each trigger fires before the start |

- A disagreement is a failed check: the canary posts its 🚨 ask naming the system and how many minutes off.
- Unreachable (non-200, an auth redirect, a timeout) is a warning (⚠ in the detail), not a failure: a deploy gap
  must not page William. A trigger not on the event's zone is a warning (it drifts at the next clock change).
- ActiveCampaign wait-step hours are not in the API (only the builder shows them); the account zone check covers
  the class of failure, not each hour.
- `?dry=1` renders without posting; `?force=1` ignores the hour.

## Code
`src/lib/clock-agreement.ts` (pure comparisons, `clock-agreement.test.ts`: winter and summer dates), fetching in the
canary route. Env overrides: `KATHERINE_URL`, `LEADOGO_URL`.

## Not now
Comparing ActiveCampaign wait-step hours (needs the builder; revisit if AC exposes segment conditions). Checking
Skool, Zapier and the closers' calendar (no clock to read).
