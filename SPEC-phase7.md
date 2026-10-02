# Spec, phase 7: the client wall

Status: **proposed 2026-10-01 ~8 PM MT, awaiting William's approval. No code until he approves this spec and the plan.**
Origin: William's note on Oct 1: current or past Book More Showings clients must never get into the room again; they
should see a generic "404, video will not load", nothing that reads as a wall. Discussion settled on identity (email and
phone from the BMS client directory) as the key, not IP; the open link asks for an email so the Skool blast path is
covered; a nightly monitor compares the open-link conversion with the name-only baseline; a Settings switch reverts the
field without a deploy.

## The rule above every module (unchanged since phase 5)
No deploys 3:30–7:45 PM Mountain. Two lanes: room (anything a phone loads) and desk (moderator, admin, crons, Slack,
bms-dashboard). Room-lane work: tests, a test-run walk on William's phone, morning deploy. Per-event switch for
anything a viewer sees. Additive migrations. The 3:45 PM canary. One-click rollback. Nothing in this phase touches the
crowd, Katherine, the prompts, the counters or the video.

## What the data says (measured 2026-10-01)
- BMS directory: 992 clients. Current (active, onboarding, check_for_renewal, offboarding, paused): 755. Past (churned,
  dispute_churned, refunded, partially_refunded): 237. With an email: 913. With a phone: 446.
- Classroom registrations by a known client since launch (Sep 21): 50. Registered before buying (the funnel): 35, of
  which 30 joined. Registered after becoming a client: 15, of which 1 joined (0 minutes). Every one used their real
  email or phone.
- Open link (`/w/ailg-r`, the Skool blast and old-link path), last 11 nights: 186 Skool cards shown → 82 typed a name
  (44%) → 64 joined. Blast nights Sep 23 and Sep 27: 65% and 68% typed a name. All other sources on the card are noise
  (41 Zap-email views, 0 names: those people resolve by hash and skip the card).
- Phase 4 already shipped: `registrants.blocked_at` (join, chat, heartbeat, reactions refuse it), `registrants.ip`
  captured on first heartbeat and wiped after 30 days, `blocked_ips` with a 60-second cache, `/admin/blocked`, the
  moderators' Block button. Replay does **not** check `blocked_at` today. Reminders do not check it either.

## Definitions
- **Client:** any row in bms-dashboard `clients`, every status, past and present (Q1).
- **Identity keys:** email, lowercased and trimmed, from `email` and `contact_email_secondary`; phone, last ten digits,
  from `phone` and `contact_phone_secondary` (Q5). The sync also stores `sha256(email)` so hash-only links match.
- **Walled:** a registrant with `blocked_at` set and `block_reason = 'client'`. Moderator blocks get
  `block_reason = 'mod'` (today's rows backfilled to `'mod'`).
- **Never walled:** emails in `team_members`, registrants with `source = 'test'`, test events.
- **Open-link conversion:** named-or-emailed guests ÷ cards shown, per session night, from `link_clicks`
  (`path = 'w', outcome = 'prompt'`) and `registrants` (`source in (skool, guest, legacy)`).

| Module id | Responsibility | Lane | Depends on |
|---|---|---|---|
| `wall-sync` | bms-dashboard cron pushes the directory snapshot to the classroom every 30 minutes; the classroom upserts `client_wall`, releases rows that left the directory, flags matching registrants (every session, past and future), unflags released ones. | desk | — |
| `wall-trigger` | Postgres `before insert` trigger on `registrants`: email, email hash or phone matches an unreleased `client_wall` row → `blocked_at = now(), block_reason = 'client'`. Exempt team emails and `source = 'test'`. The body is wrapped so an error can never fail the insert. Covers site, Zap, Skool, guest and import paths with no app code in the hot path. | DB | wall-sync |
| `wall-page` | Join and replay return HTTP 404 with a plain page for `block_reason = 'client'`: "404" and "The video could not be loaded." (Q2). No logo, no address, no link. Moderator blocks keep "You've been removed". IP blocks keep today's line. | room | wall-trigger |
| `open-link-email` | Join card asks for an email (required) when `events.open_link_field = 'email'`; first name stays optional and is derived from the email when blank (Q8). Guest route validates and stores email + hash. Default `'name'` until flipped in Settings for ailg-r (Q10). | room | wall-trigger |
| `wall-monitor` | Classroom cron at 7:50 PM MT posts to #autoweb-intel: tonight's cards → emails → joined, the rate, the name-only baseline (the seven session nights before the flip), 🟢 or 🔴, plus "walled tonight: N registered, M hit the 404". 🔴 when cards ≥ 30 and rate < 75% of baseline (Q9); the line says to flip Settings back to name only. Never flips anything itself. | desk | open-link-email |
| `wall-visibility` | #autoweb-intel line when a client registers or hits the 404 (Q6); "client" chip in the desk Attendees list; Clients section on `/admin/blocked` (count, last sync, newest 50); canary check "client wall synced in the last 2 hours"; opt-ins exclude walled rows so the show rate is not dragged. | desk | wall-sync |

Build order: wall-sync → wall-trigger → wall-page, open-link-email (walked together on test-run) → wall-monitor,
wall-visibility.

## wall-sync
- bms-dashboard `GET /api/cron/classroom-client-wall` (Vercel cron `*/30 * * * *`, `CRON_SECRET` as the other crons):
  reads `clients` (id, name, status, email, contact_email_secondary, phone, contact_phone_secondary, created_at) and
  POSTs the whole list to `https://bestonlineclassroom.com/api/client-wall` with `Authorization: Bearer
  CLASSROOM_WALL_SECRET` (Doppler bms-dashboard prd; same value as the classroom's `REGISTER_SECRET`, the pattern
  leadogo's bookings push uses). ~1,000 rows, ~150 KB. Idempotent.
- Classroom `POST /api/client-wall`: upsert `client_wall (client_id pk, name, status, emails text[], email_hashes
  text[], phones text[], client_since, seen_at, released_at)`; rows missing from the snapshot get `released_at`; then one
  statement flags registrants matching any unreleased row (`blocked_at = now(), block_reason = 'client'` where
  `blocked_at is null`), one statement clears `block_reason = 'client'` rows whose identity no longer matches. Returns
  `{ clients, flagged, released }`. Last sync = `max(seen_at)`.
- Test: `node --test` on the normalizer (emails lowercased and trimmed, phones to ten digits, blanks dropped) and the
  flag/unflag SQL against a seeded table.

## wall-trigger
- Migration 028 (additive): `client_wall` table with GIN indexes on the three arrays; `registrants.block_reason text`
  (backfill `'mod'` where `blocked_at` is set); `events.open_link_field text not null default 'name'`;
  `events.open_link_email_since date`; the trigger function `registrants_client_wall()` with `exception when others
  then null` around the lookup; `create trigger ... before insert on registrants`.
- Match: `lower(trim(new.email)) = any(emails)` or `new.email_hash = any(email_hashes)` or `right(regexp_replace(
  new.phone, '\D', '', 'g'), 10) = any(phones)`; skip when `new.source = 'test'` or `new.email` is a team member's.
- Test: insert a registrant with a walled email, a walled phone, a hash only, a team email, a test source; assert the
  four outcomes. Insert with the table empty; assert nothing changes.

## wall-page
- `j/[token]`: after the IP check, `r.blocked_at && r.block_reason === 'client'` → the 404 page with `status: 404`
  (a route-level `notFound()` would render the app's not-found page; the spec wants its own plain page, so the page
  sets the status through the response or a dedicated `not-found` boundary; decided in the plan). Log
  `link_clicks` outcome `walled` so the monitor can count hits.
- `replay/[token]`: same check (today replay ignores `blocked_at` entirely; moderator blocks get `Removed` here too).
- Copy (Q2): heading "404", line "The video could not be loaded." Same font and background as the room, no logo, no
  address, no email link, no button.
- Test-run walk: a test registrant whose email is seeded into `client_wall` (a manual row, `status = 'test'`) sees the
  404 on join and replay; a normal test registrant is unaffected; the moderators' Block button still shows "removed".

## open-link-email
- `events.open_link_field`: `'name'` (today) or `'email'`. Settings page gets the toggle under the join card section.
- Card when `'email'`: field "Your email" (`type=email`, `autocomplete=email`, `inputmode=email`, required), then
  "First name (optional)". Button text unchanged. The trust lines unchanged. Error on an invalid email: "Enter the
  email you registered with." (room copy, shown inline, no alert).
- `/api/guest`: accepts `email`; validates with the register route's rule; lowercases; stores `email` and `email_hash`;
  `first_name` = the typed name, else the email's local part up to the first dot, digit or underscore, capitalized,
  else "Guest". The trigger then walls a client. The person still receives a token and lands on `/j/<token>`, which
  returns the 404 for a walled row and the room for everyone else.
- `open_link_email_since` is set to the session date when the switch flips to email; the monitor's baseline is the
  seven session nights before it.
- Test: guest route with and without a name, with a bad email, with a walled email (expects a token, and the row walled).

## wall-monitor
- Classroom `GET /api/cron/open-link-report`, Vercel cron `50 1 * * *` (7:50 PM MT in daylight time; the canary's
  21:45 UTC shows the house convention), `CRON_SECRET`.
- For each event with `open_link_field = 'email'`: tonight's cards (`link_clicks`), guests created (`registrants`
  source skool, guest, legacy), joined (attendance rows on them), rate; baseline = the same ratio pooled over the seven
  session nights before `open_link_email_since`; walled tonight (rows with `block_reason = 'client'` created today) and
  404 hits (`link_clicks` outcome `walled`).
- Post to #autoweb-intel via `postToIntel`: "Open link tonight (ailg-r): 34 cards → 23 emails (68%) → 22 joined.
  Name-only baseline: 44% over 7 nights. 🟢" or "… (31%) 🔴 below 75% of baseline on 40 cards: flip Settings → Open link
  → Name only." Then "Client wall tonight: 2 registered, 1 opened the link." Under 30 cards: "(small sample)" and never 🔴.
- Test: the rate and verdict function with the Sep 23 and Sep 27 numbers, a small-sample night, a 🔴 night.

## wall-visibility
- `postToIntel` on a wall hit from `j/[token]` (after the response, like offer clicks): "🚧 Client wall: Jane D (active
  since Jul 15) opened the join link". On registration (trigger) there is no app hook; the sync reports the count
  instead, and the nightly line carries it.
- Desk Attendees list: chip "client" on rows with `block_reason = 'client'` (they never heartbeat, so they show as
  registered, not in the room).
- `/admin/blocked`: a Clients section with the count, last sync time, and the newest 50 walled registrants (name,
  email or phone, status, session). No release button; the directory is the source.
- Canary: check "client wall" ok when `max(seen_at)` is within 2 hours.
- `/api/metrics` and the tracker: `site_optins` and opt-ins exclude `block_reason = 'client'`.

## Commands
Build `npm run build`; test `node --test` (61 today); lint `npm run lint`; migrate `npm run db:migrate` (028);
test event `npm run test:event -- --at HH:MM --seconds N …` and `--teardown`. bms-dashboard: `doppler run -- …`.

## Boundaries
- Always: additive migration; the trigger never raises; registration for a non-client is byte-for-byte unchanged;
  tests for the normalizer, the trigger, the guest route, the monitor math; test-run walk before the room lane deploys;
  morning window.
- Ask first: any copy change on the card beyond the field; anything the crowd or Katherine sees (none planned).
- Never: deploy 3:30–7:45 PM MT; wall a team member; let the monitor flip the switch; an IP layer (off by decision,
  revisit if walled clients reappear as guests).

## Success criteria
- First sync flags the ~50 known client registrations; `/admin/blocked` shows them; the two moderator blocks keep
  reason `mod`.
- A seeded client email on test-run gets HTTP 404 at `/j` and `/replay`; a normal registrant does not.
- A new site registration, Zap registration or Skool guest with a client email or phone is walled by the trigger
  within the same request, no sync needed.
- With the switch on, the card asks for an email; the monitor posts at 7:50 PM with a 🟢 or 🔴 and the baseline.
- Canary green with the new check; 61 + new tests pass; lint clean.

## Kill switches
- Card: Settings → Open link → Name only (no deploy).
- Wall: pause the bms-dashboard cron; `update registrants set blocked_at = null, block_reason = null where
  block_reason = 'client'` (one statement; the trigger is inert once `client_wall` rows are released).
- Code: one-click Vercel rollback.

## Decisions (defaults in bold; confirm or change)
- Q1 Scope: **all 992, every status**.
- Q2 Wording: **"404" / "The video could not be loaded."**
- Q3 IP layer: **off** (William agreed identity is the key; office and carrier false positives).
- Q4 Reminders to walled clients: **keep sending** (the camouflage).
- Q5 Secondary contacts: **walled too**.
- Q6 Slack line on wall hits: **yes**, #autoweb-intel.
- Q7 Open link asks for an email: **approved by William Oct 1**.
- Q8 Name field: **optional, derived from the email when blank**.
- Q9 Alarm rule: **🔴 when cards ≥ 30 and rate < 75% of the name-only baseline**; smaller nights say "small sample".
- Q10 Switch: **on for ailg-r the morning after the walk**, reviewed after three blast nights.
