# Spec: link-opens (a link open is not a person)

Module of [SPEC.md](SPEC.md). Depends on: `room` (the `/j` page, the heartbeat), `analytics` (`session_metrics`,
`/api/metrics`), `moderator` (the desk's People and Stats), `reminders`, the ActiveCampaign link scripts of
`SPEC-show-rate-recovery.md`, and leadogo's room-count post. Proposed Oct 20 2026 late, from the Tuesday session's
numbers (report doc: "Tuesday Oct 20 Session Report"). Nothing here changes until William approves this spec.

## What happened (Tue Oct 20)
- The room wrote 259 live attendance rows; 131 were people (watched two minutes or more, chatted, or clicked the
  offer). The other 128 lasted under two minutes with no action.
- 5:04 PM: 55 personal links opened in one minute, 49 of them gone within three. Every one of those addresses
  resolves to Microsoft (AS8075, Boydton, Moses Lake, San Jose, Toronto, Des Moines) or Amazon (AS14618); several
  "people" share one address; the agents are Linux or Windows Chrome with impossible builds (Chrome 145 to 155,
  299 clicks tonight). Email security scanners (Microsoft Defender Safe Links and the like) opening every link
  in the 5:05 PM promo email. They run the page: the video played, the heartbeat fired, the row was written.
- The desk's live tile climbed to 126 at 5:06:30 PM while 67 people were there (the 120 s presence grace keeps a
  40-second visit counted for two more minutes). Stats showed peak 126 all night.
- The 4:08 PM email: 2,117 link clicks between 3 and 6 PM, 1,290 from Linux desktops; 481 "people" by agent were
  scanners, 301 were human (a normal day: 19 to 43 scanner "people" from the room's own Postmark reminders, 34 to
  72 humans).
- Every open of an old personal link moves that registrant into the running session (`/j` render), so about 620
  rows became "tonight's registrants" an hour before the start (768 registered, 34% show-up on Brandon's post);
  about 300 of them were moved by scanners and then received the room's 30- and 15-minute reminder emails (313
  and 296 legacy rows) and Katherine's 4:12 PM link emails (205).
- leadogo's `room_join` fires on the `/j` render when the room is live, so the site's show rate counts opens:
  new registrants 48% tonight on the site against 35% by the two-minute rule in the room (Oct 13 to 17: 41%
  against 32%; Sun 48 against 29; Mon 56 against 45). Trends hold, levels are lower.
- The open door (`/w/ailg-r`, an email field): 208 clicks, 146 from Linux agents; 62 human clicks, 14 got through,
  8 watched. Contacts whose ActiveCampaign field still holds the generic door (about 4,245 at the Oct 18 dry run)
  land there from every promo email.
- The humans who tapped at 4 PM mattered: 171 human taps between 3 and 5 PM, 46 of them watched; the move put them
  on the 30- and 15-minute reminders, a second touch worth keeping.

## Objective
Every published count is people. A scanner open moves nobody, emails nobody, calls nobody and counts nowhere.
Everyone in ActiveCampaign holds a personal link, so no promo email lands on the door. The desk still sees a wave
arriving, labelled as such.

## Definitions
- **Open**: a `/j` page load (a `link_clicks` row).
- **Visit**: an `attendance` row (the first heartbeat).
- **Person**: an attendance row with `seconds_watched >= 120`, or a chat line, or `cta_clicked_at`. Scanners tonight
  averaged 33 to 40 s with the video playing, so "30 s" or "video played" does not separate them; two minutes
  separated 128 of 259 rows and every one of the night's 14 legacy bookings sits above it.
- **Scanner open** (the render-time tell, cheap, no lookup): the agent says Linux without Android or CrOS, or claims
  a Chrome or Edge major version at least three above current stable. Real agents on a Linux desktop are rare; the
  tell marked 1,334 of 2,359 clicks tonight. Address lists come later if the audit shows misses (decision 2).

## Changes
A. **The `/j` page**: a scanner open renders the room as today (a sandbox sees a page, nobody minds) but does not move
   the row and does not report `room_join`; the click is logged with `bot = true` (new column).
B. **The row move** stays at render for a human-looking open (decision 4: a 4 PM tap still earns the 30- and
   15-minute emails) and happens as a backstop in the heartbeat route when a row becomes a person while its
   `session_date` is not the running session. `registrants.moved_in_at` (new) records the move.
C. **`room_join` to the site** fires from the heartbeat route when a row becomes a person (the 120-second beat, or
   the first chat line or CTA click), never from the render. leadogo's show rate then reads the room's two-minute
   level (about 32% on a normal night). Its gate floor (`GATE_RULES.showFloor` 0.32) and the thank-you test's show
   rail compare arms and nights on one measure, so they keep working, but the absolute floor is re-based after 14
   days of history on the new measure (noted in the site's `SPEC-page-tests.md`). The alternative, if continuity
   matters more: keep `room_join` at render for humans and add a `room_watch` event at two minutes (a new event kind
   on the site). Decision 3.
D. **Counters**: the desk's `people[].in_room`, `stats.in_room`, `stats.peak`, `stats.joined`; `/api/metrics`
   `joined`, `peak_live`, `show_up_rate`; `session_metrics.joined`; and Brandon's 15-minute post all count persons,
   with the 120 s presence grace unchanged for "still here". The Stats pane and the post gain **arriving N**: rows
   under two minutes with a beat in the last 120 s, so the desk still sees the wave. `registered` splits into
   **registered tonight** (rows created for this session before its start) and **moved in today** (`moved_in_at`
   not null); show-up rate = persons / registered tonight, with the moved-in pair beside it.
E. **Reminders and Katherine**: no change in the cron; B keeps scanner-moved rows out of tonight, so the 30- and
   15-minute emails and the 4 PM call list reach registrants and human moved-ins only. Whether Katherine keeps
   calling moved-ins is William's call (the plan item in the report doc).
F. **The door**: `scripts/ac-personal-links.ts --door`: every ActiveCampaign contact whose `WebinarJoinLink` is the
   generic door (`/w/ailg-r`, any host) gets a room registrant (`source = legacy`, a past session date, no email)
   and `https://watch.bookmoreshowings.com/<token>` + `/replay/<token>`; dry run, then apply before Thursday Oct
   22's 4:08 PM send. **William in ActiveCampaign**: automation 192's "Update WebinarJoinLink = …/w/ailg-r?src=sms"
   step (W1 of `SPEC-show-rate-recovery.md`) would overwrite these; remove it (every contact then holds a personal
   link) or condition it on a blank field. The door page itself is unchanged; its `?e=&fn=` pass-through stays
   for Skool and Zap links.
G. **History**: the views compute "person" from the columns that exist; `session_metrics` for Sep 21 onward is
   recomputed by the existing sync, so the chart in the report doc (131 on Oct 20, previous best 83 on Sep 23) is
   what the room reports from now on.

## Data (additive)
```sql
alter table link_clicks add column if not exists bot boolean not null default false;
alter table registrants add column if not exists moved_in_at timestamptz;
-- session_metrics / registrant_outcomes: joined = persons; visits = rows, kept for the record.
```

## This repo
`src/app/j/[token]/page.tsx` (A, B), `src/app/api/heartbeat/route.ts` (B backstop, C), `src/lib/scanner.ts` (the
agent tell, pure) + test, `src/lib/outcomes.ts` (person rule, pure) + test, `src/app/api/mod/route.ts` and
`src/app/mod/mod-view.tsx` (D: arriving, registered split), `src/app/api/metrics/route.ts` (D), the two views
(G), `scripts/ac-personal-links.ts` (F). leadogo: the room-count post text (D) and, with decision 3, nothing else;
the site: nothing unless decision 3 takes the `room_watch` road.

## Testing
- Pure: `isScannerAgent` (Linux Chrome true; Android false; CrOS false; Chrome/155 true; iPhone Safari false;
  Windows Chrome 142 false); `isPerson` at 119 s / 120 s / a chat line / a CTA click; the move decision table
  (human open moves; scanner open does not; the 120-second beat moves).
- Production on test-run: a `curl` with a Linux agent on a test token → `link_clicks.bot = true`, row not moved, no
  `room_join`; the same token from a phone → moved, "arriving 1" on the desk, "1 in the room" at two minutes,
  `room_join` reported once.
- Replay of Oct 20 through the views: 131 people, peak 96, 35% show for new registrants, 46 of 131.

## Rollout
Before Thursday's 4:08 PM send: A, B, C (or decision 3's road), D, F (the script run and the AC step). Deploy
outside 3:30 to 7:45 PM MT. Rollback: the columns are additive; one flag returns the `/j` render to today's path.

## Boundaries
- Never: delete attendance or click rows; block an address as a scanner (a block is a person-level decision);
  change the 120 s presence grace; a destructive migration; deploy in the window.
- Ask first: an address or ASN list; the gate floor on the site; Katherine's call list.

## Decisions proposed (say no to any)
1. A person is two minutes or an action, everywhere: desk, metrics, Brandon's post, leadogo.
2. The scanner tell is the user agent only for now (Linux desktop, impossible Chrome build); addresses only if the
   audit shows misses.
3. leadogo's `room_join` moves to the two-minute mark and the show rate drops to the real level (one measure,
   re-based after 14 days). The `room_watch` road only if continuity of the old number matters more.
4. The row move stays at render for human-looking opens, so a 4 PM tap still earns the reminder emails.
5. The door backfill covers every contact holding the generic link, not only tagged ones, and the automation 192
   step is removed.
6. "Arriving" shows beside "in the room"; the Oct 20 report's numbers are the first on the new rule.
