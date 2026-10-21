# Spec: link-opens (a link open is not a person)

Module of [SPEC.md](SPEC.md). Depends on: `room` (the `/j` page, the heartbeat), `analytics` (`session_metrics`,
`/api/metrics`), `moderator` (the desk's People and Stats), `reminders`, the ActiveCampaign link scripts of
`SPEC-show-rate-recovery.md`, and leadogo's room-count post. Proposed Oct 20 2026 late, from the Tuesday session's
numbers (report doc: "Tuesday Oct 20 Session Report"). Nothing here changes until William approves this spec.

**Status.** Oct 21 midday, William: build "all other smaller things" → A, B, D and G are approved and scheduled for Thursday Oct 22 morning (SPEC-post-session.md, batch 2); C (leadogo `room_join` at the two-minute mark) stays a decision for him; F is running (7,143 contacts, started 9:41 AM, 0 failures so far); E unchanged. **Built Oct 21 afternoon on branch `link-opens` (A, B, D, G; migration 043), reviewed twice and simplified on the data:** Oct 13 to 20, no real person ever appeared only through a Linux-desktop agent (0 of 415) and no chat-only person stayed under two minutes (0), so (1) the scanner tell is the Linux desktop agent only (`src/lib/scanner.ts`; the last 7 days of human clicks run Chrome 155, 153, 154, so a build threshold was dropped), (2) **a scanner's beats are dropped at the heartbeat**: no attendance row, no address, no first-beat ghost logic, nothing to count or move, (3) the person rule is two minutes or a click everywhere (the chat clause is gone), (4) `/j` moves nobody on a scanner open (`renderMove`, tested), reports no `room_join`, and logs `bot` on every click row (`/w` and `/replay` too; the per-source joins and the door's waiting count read `bot = false`), (5) a person the render misread (a Linux-desktop human) is moved in by the chat on their first POSTed line or by the offer click (`src/lib/move-in.ts`, with the `room_join` the render skipped), and the chat reads and writes under the date the room shows meanwhile, (6) the desk, `/api/metrics`, the per-source joins and the typical-night history count persons with `arriving`, `visits`, `moved_in`, `registered_tonight` and `joined_tonight`, and `show_up_rate` = persons registered tonight / registered tonight, (7) the views carry `joined` = persons, `visited`, `visits`, `moved_in` and `joined_moved_in`, and a sub-two-minute row no longer "saw the offer"; `/api/metrics/registrations` gains `person` beside `joined` for the site (decision 3 stays William's). Third review (same afternoon): smart-TV and console agents say Linux and are people (excluded from the tell); the room's date for a row is one rule (`roomDateFor` in `src/lib/move-in.ts`, tested: a row whose own session has not ended, a future row or a preview of one, is never moved), the `room_join` report is one function the join page, the chat and the click share, run in `after()`; the desk's picker and head count take a chatter under two minutes. **Audit, monthly:** persons whose /j clicks were only Linux-desktop agents (the query in Testing); if it ever shows people, the tell gets an address list. **Deploy Thursday Oct 22 morning: migration 043 first, then merge** (the click log and the click readers need the `bot` column; the render move needs `moved_in_at`).

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
  8 watched. From the two promo emails alone: 193 door hits (38 human, 155 scanner), 4 humans typed an email, none
  of the 4 watched. **Why they land there (Oct 21 check):** `WebinarJoinLink` holds 13,803 values; 7,148 are the
  door, all dated Oct 18: 7,038 `watch.bookmoreshowings.com/w/ailg-r?src=email&eh=<hash>` (the Sep 20
  `ac-links.ts` wrote that form to every contact without a room registrant; Sunday's phase 2 moved it onto the
  watch host) and 110 bare `/w/ailg-r` (dead EasyWebinar logins replaced by phase 2). The Oct 18 repair gave
  personal links only to contacts created since Aug 1 (the 90-day scope now shows 5 left); every one of the
  7,143 still on the door is older. The promo email and the Roezan text both send the field, so those contacts
  get the door from either (no text reached the door Oct 20: 0 clicks with `src=sms`). The door can walk a
  person in from `eh` only when a room row with that email hash exists, and these contacts have none; for the
  245 who do, the campaign's appended `?src=email` turns the hash into `<hash>?src=email`, which fails the
  64-hex check, so the lookup is skipped and they are prompted too.
- The humans who tapped at 4 PM mattered: 171 human taps between 3 and 5 PM, 46 of them watched; the move put them
  on the 30- and 15-minute reminders, a second touch worth keeping.

## Objective
Every published count is people. A scanner open moves nobody, emails nobody, calls nobody and counts nowhere.
Everyone in ActiveCampaign holds a personal link, so no promo email lands on the door. The desk still sees a wave
arriving, labelled as such.

## Definitions
- **Open**: a `/j` page load (a `link_clicks` row).
- **Visit**: an `attendance` row (the first heartbeat).
- **Person**: an attendance row with `seconds_watched >= 120` or `cta_clicked_at` (the chat line was in the first draft; Oct 13 to 20 had no chat-only person under two minutes, so one rule everywhere). Scanners tonight
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
F. **The door**: the existing `scripts/ac-personal-links.ts --since 2000-01-01` (no new flag: its selection is
   already "tag 304, join link not personal"): every such contact gets a room registrant (`source = legacy`, a
   past session date, so tonight's count and the reminders are untouched) and
   `https://watch.bookmoreshowings.com/<token>` + `/replay/<token>`. Dry run Oct 21 9:40 AM: 13,794 contacts,
   7,143 to write (245 already have a room row and only need the field, 6,898 need a row), about 25 minutes at
   5 requests a second. Apply before Thursday Oct 22's 4:08 PM send. **William in ActiveCampaign**: automation 192's "Update WebinarJoinLink = …/w/ailg-r?src=sms"
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
- The audit (monthly): `with p as (select registrant_id, session_date from attendance where kind='live' and session_date >= current_date - 30 and (seconds_watched >= 120 or cta_clicked_at is not null)), c as (select l.registrant_id, l.session_date, bool_or(not (l.user_agent ~ 'Linux' and l.user_agent !~ 'Android|CrOS|SMART-TV|SmartTV|Tizen|Web0S|webOS|CrKey|Roku|PlayStation|Xbox|Nintendo')) as human from link_clicks l join p using (registrant_id, session_date) where l.path='j' group by 1,2) select count(*) filter (where not human) as linux_only, count(*) as persons from p left join c using (registrant_id, session_date);` → `linux_only` must stay 0 (Oct 13 to 20: 0 of 415).

## Rollout
Migration 043 is a hard precondition of the deploy: `logClick` writes `bot` and the click readers filter on it.
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
5. The door backfill runs the existing script over every contact age (7,143 contacts, all created before Aug 1
   2026), and the automation 192 step is removed.
6. "Arriving" shows beside "in the room"; the Oct 20 report's numbers are the first on the new rule.
