# Spec: friday-unattended (Fri Oct 23 runs with nobody on the desk)

Module of [SPEC.md](SPEC.md). Depends on: `kaitlyn-solo` (assisted, desk-first, built Oct 21), `kaitlyn-autopilot` (the
switch, the hand-off line), `kaitlyn-knowledge` (the table, the digest), `link-opens` (PR #4, reviewed twice, **not
merged**), `post-session` (the night report, the paced ActiveCampaign client), the ActiveCampaign link scripts. Proposed
Oct 22 2026 night from William's message after the Thursday session ("tomorrow I do need her to be automated as I won't
be able to be at the event"). **Approved Oct 22 ~10 PM MT** ("Let's push all of this so please /review and /ship"),
recovery (E3) dropped on his word; built the same night on branch `friday-unattended` (status at the end).

## What happened (Thu Oct 22), in numbers

**The room.** 216 live attendance rows; **70 people** by the two-minute-or-an-action rule (55 watched 15 minutes or more,
47 stayed 40+, 28 clicked the offer, 38 chatted). The other 146 rows lasted under two minutes and did nothing (143 under
one minute). The desk's tile counts every row, so "198 joined, peak 167" was the 5:03 to 5:10 PM wave: at 5:05 PM the
tile had 159 in the room and 38 of them were people; by 5:10 PM both counts read 52 to 54 and stayed equal all night
(53 at 5:30, 49 at 6:00, 47 at 6:20, 32 at 6:30, 16 at 7:00). "Dropped to 56" was the truth arriving. Who the 146 were:
112 `legacy` rows (old contacts' personal links written by Wednesday's backfill), opened 5:03 to 5:10 PM from 60
addresses (three of them, 172.252.65.35/.105/.16, account for 32 rows at 4 to 10 seconds each), Windows Chrome agents,
mean 25 s: email security scanners again, through personal links this time and **not on Linux**, so PR #4's agent tell
would have marked 14 of them; the two-minute rule marks all 112. The remaining 17 site rows and 1 Skool row under two
minutes (mean 34 s, one address each) look like people who peeked and left. Registered for tonight before the start:
204; 313 old rows were moved into tonight by link opens. The 7:50 PM night report already counts people
(`night-report.ts`, `PERSON_SECONDS = 120`); the desk, `/api/metrics` and the views still count rows until PR #4 lands.

**Kaitlyn** (William's "Katherine" in the message; "Katherine AI" is the replay-line bot). 312 attendee lines, 312
decisions: the model never failed. `kaitlyn_mode` assisted; she put 67 lines in the room, 42 on her own (markets,
bookings, price, thanks, tech), the rest through the desk (5 sent as drafted, 12 edited by hand, 2 hand-offs, 3 ghosts'
private lines). William deleted 4: the two hand-off lines ("let me pass that to the team …" to Kris Do at 5:20 PM,
"I'll flag that for the team …" to Noemi at 5:38 PM, both posted by the 90-second sweep), "You need to book a call …"
to Deborah Lee's "Cost" at minute 69 (six minutes before the pitch; Jace Rivera got the same line at minute 64 and it
stood), and a fourth Aspen answer to Deborah Capogrosso at minute 104. The Autopilot switch reads **Off** now; nothing
records when it flipped, but no sweep posted after 5:38 PM and the CRM questions at 6:39 to 6:40 PM were answered by his
click, which fits him turning it Off after the second hand-off. Off also returns `sweepHandoffs` at once, and the
desk-first posting (a sure product or integration reply after 90 s on the desk) lives in that sweep: that is "she
wasn't auto-responding". The routine categories kept posting (42 lines) because they never pass through the sweep.
Twelve knowledge rows opened tonight with no answer (`phone-verification-tool`, `wholesaling-fit`, `new-homes`,
`referral-fee-per-closing`, `nrg-brokerage`, `call-real-person`, `qualifunnel-customize-questions`, …); his 12 edits
reach her prompt as CORRECTIONS (the view takes `edited` since migration 038).

**ActiveCampaign.** 13,964 contacts carry `ailgr_registered` (tag 304); **79 hold no personal link**, and 58 of the
293 contacts created since Oct 20 hold no link at all: site registrations with a `site_registration_id` (Ana Linnehan,
Deborah Capogrosso, John Olson, David Corso, Laura Halprin, all Thursday morning), Skool registrations (Theresa King,
Andrew Farley) and guests. The site's Zap is not writing `WebinarJoinLink` for about a fifth of new contacts; the Skool
and guest paths never did; the room itself creates the contact on the `registered` tag (`ensureContact`) with no link.
Theresa Matthew King is AC contact #20224 (theresa0702@me.com, tagged 304); she registered through Skool Wed Oct 21 at
5:00 PM MT (room token `wcpmbaz6aa6u`), four hours after Wednesday's backfill finished, so the field was blank when the
promo rendered "Webinar Link:" on Thursday.

## Objective
Friday night with nobody on the desk looks like a good night with William on it: every sure answer posts within 25 s;
nothing she does not know gets a line in the room, it gets a card, a Slack line, a knowledge row and the Saturday 9 AM
digest; nobody hears "call" before 6:15 PM; the desk, the metrics and the night report all count people; every tagged
contact's promo email carries a personal link. His grades on the review page are in her prompt before 3:30 PM.

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `kaitlyn-review-50` | The review page: 50 real questions through the live prompt, his Right/Wrong and his line, read back into `kaitlyn_kb`; rounds repeat | — |
| `kaitlyn-quiet-unknowns` | No hand-off line, ever; an unknown is silence plus the flag; the desk-first posting no longer dies with the switch | — |
| `kaitlyn-pitch-first` | Before the pitch she never says "call"; price gets "he gets to that near the end"; a line that still says it is silenced | `kaitlyn-review-50` (his pre-pitch wording) |
| `room-counts` | PR #4 merged (persons everywhere, scanner opens move nobody) plus an address tell for the Windows-agent wave | `link-opens` |
| `ac-links-everyone` | The room writes the two links into ActiveCampaign on every registration; a 3 AM and 3 PM sweep repairs the rest | — |

Build order: `kaitlyn-review-50` (round 1 up tonight; his grades Friday morning) → `kaitlyn-quiet-unknowns` and
`kaitlyn-pitch-first` (one branch, Friday morning) → `room-counts` (merge, migration 043, Friday morning) →
`ac-links-everyone` (Friday morning; the 3 PM sweep runs before the 4:08 PM send). Everything deployed before noon MT
Friday, nothing between 3:30 and 7:45 PM; the switch to On is a click Friday morning.

## A. kaitlyn-review-50 (round 1 is live)

- **The page**: 50 lines attendees really typed Oct 16 to 22, sampled at random with the routine categories capped
  (market 8, booking 4, tech 3, thanks 2, greeting 1), de-duplicated by wording, each run through the live prompt
  offline with the room empty (as `scripts/kaitlyn-eval.ts` does, with what William is saying on screen at that minute).
  Each card: the minute and whether booking is open, the asker's line, what she would do (post, stay silent and flag,
  skip, ghost), her line, her reasoning; Right / Wrong / Not sure and a box for his line. Round 1 tonight: she would
  post 33, stay silent on 13, skip 4; five price answers say "the free call", three of them before the pitch.
- **Where it lives**: `scripts/kaitlyn-review.ts --n 50 --seed N --round rK` writes the items JSON;
  `scripts/kaitlyn-review-page.html` is the page with an `__ITEMS__` slot; the grades are the page's own `db`
  (`grades/<round>-<nn>`: verdict, fix, question, her line), read back with the ArtifactData tool.
- **What a grade does** (the apply step, `scripts/kaitlyn-review-apply.ts --round r1 --apply`): a *Wrong* with his line
  → the matching `kaitlyn_kb` key (the decision's `kb` key, or a slug coined from the question) gets `answer` = his
  words, `approved` = his words verbatim, `approved_at` now, `handling` answer, `answered_by` his seat (decision 4: he
  typed her line, no rewrite); a *Wrong* with no line on a posted answer → `handling` = `me` (always ask him) until he
  writes one; a *Wrong* on a silent one with his line → the same approved row (she answers it next time); *Right* and
  *Not sure* → nothing. The 9 AM digest's "answers waiting" line is untouched (nothing is staged, he approved on the page).
- **Round 2**: the same script with a new seed and `--round r2` after the apply step and the two Kaitlyn modules below
  are deployed, republished to the same page (round 1's grades stay in the store). **Done Oct 22 11:20 PM**: the 11
  he marked wrong re-run with his answers in, plus 39 fresh; through the shipping code: 40 would post, 5 stay silent,
  5 skip (the three asides among them), no "call" before minute 75, the Katherine figure at minute 64.
- **Round 1 graded (Oct 22, 9:11 to 9:35 PM MT): 39 right, 11 wrong.** By what she would do: posted lines 26 right
  and 7 wrong, silences 10 right and 3 wrong, skips 3 right and 1 wrong. The apply step, keyed by hand where the
  replay's key is broader than his fix:
  - `facebook-ads-failed` (#4), `new-agent` (#8), `legal` (#9, California: the AI disclosure is built in, opt-in is
    consent), `voice` (#11: 5,000 voices, record your own), `crm` (#45: Katherine first, then Follow Up Boss),
    `referral-fee-per-closing` (#47: no percentages), `nrg-brokerage` (#50: New Realty Group is William's residential
    team), `booking-not-going-through` (#33: "do you want us to reach out and help?"), `who-is-william` (#19, new:
    a realtor since 2020 who built the community around his method in 2023): his line becomes the approved answer.
  - `katherine-ai-price` (#15, new, not `price`): "how much does the AI cost" gets "$250 a month, with incentives where
    some don't pay"; the BMS price rule is unchanged. `guard()` accepts the approved figure in any spelling
    ("$250/mo", "$250 per month"), today only "$250 a month" passes.
  - #10 ("@iPhone $$?", his word: ignore) is not a knowledge row: a line addressed to another attendee is a skip
    (C, below).
  - One grade to check with him: #17 ("how much is this going to cost William", minute 68, "… that's what the free call
    is for") was marked right, and the rule in C silences that line before minute 75. The rule stands unless he says
    otherwise (open question 3).

## B. kaitlyn-quiet-unknowns

- **The hand-off line goes.** `HANDOFF` and `handoffLine` leave `kaitlyn-kb.ts`; `handoff`, `handedOff`,
  `claimHandoff`, `postHandoff`, `handoffDue`, `HANDOFF_AFTER_MS` and the ask_william half of `sweepHandoffs` leave
  `kaitlyn.ts`; their tests go; `answeredWithin` loses its `handoffIds` parameter (nothing feeds it any more). An
  `ask_william` is then exactly: the pending card on the desk, the "Kaitlyn needs you" Slack line, the knowledge row
  (`touchKb`, open), and the 9 AM digest's "couldn't answer N questions" list. Decision 5 of `SPEC-kaitlyn-autopilot.md`
  reversed on William's words ("flag it and store it in our database for me to answer and then just ignore the question").
- **Desk-first stops depending on the switch.** `sweepHandoffs` becomes `sweepDeskFirst` and the `autopilot === "off"`
  return goes: a sure non-routine reply posts after 90 s on the desk in assisted and auto whatever the switch says. Off
  keeps its one meaning: she never takes over an empty desk (`engaged`). The heartbeat route's call changes name.
- **Nothing else moves**: the pause, the per-person window, the roll-call slot, the ghost rules.

## C. kaitlyn-pitch-first

- **Prompt**, a BEFORE THE PITCH block under "markets and the clock": until ROOM says booking is open, never mention the
  call, booking, a consult or the button. A price, cost, fee, contract or "what does it include" question gets one of
  the `later` shapes ("he gets to that near the end of the class", "pricing comes up at the end, hang tight", "he goes
  over all of that in the last part"), sure, category price, no figure; the specifics FACTS send to the call (setup for
  their market, compliance detail, commitment levels) get "he covers that later in the class" in place of the `call`
  shapes; "how do I book" before the pitch gets "the booking button shows up near the end of the class"; a second price
  ask before the pitch is a skip, never a ghost (the price-push ghost rule starts at the pitch). From the pitch on,
  today's rules word for word.
- **Code**, so the model's wording cannot slip: `guard(text, beforePitch)`: before the pitch a reply containing
  `book(ing)? (a |the |your )?call`, `the call`, `a call`, `your call`, `free call` or `consult` returns "call talk
  before the pitch" and the reply becomes `ask_william` (silent, flagged) like any other guard trip;
  `parseDecision(input, { beforePitch })` carries it; `kaitlynHandle` passes `ctx.pitchMinute !== null && ctx.minute <
  ctx.pitchMinute`. A price-category reply before the pitch is overwritten in code with a `later` shape, rotating by the
  decision id, so the first price ask always gets an answer. `SHAPES.later` joins the VARIETY block.
- **The fact sheet** (`events.kaitlyn_facts`, Admin → the event): the pricing rule gains one sentence: "Before the pitch:
  he gets to that near the end of the class; never the call."
- **A line aimed at another attendee is a skip** (his grade on #10): a body that opens with `@<name>` where the name
  is not a moderator's (Kaitlyn, Katherine, Kevin, William, the team's display names) is chatter between attendees;
  `isAsideToAttendee(body, moderatorNames)` pure in `kaitlyn.ts`, applied before the model like the roll-call guard.
  A line that opens with `@Katherine` or `@Kaitlyn` is for her and goes through as today.
- **Eval**: the pre-pitch price lines of round 1 (#17 and Deborah Lee's "Cost" at minute 69) replay to a `later`
  shape; #15 ("how much does the ai cost") replays to the Katherine figure; #10 replays to a skip; Anthony Lasswell's
  minute 76 ("Is this a monthly cost?") keeps the FACTS line.

## D. room-counts

- **Merge PR #4** (`link-opens` A, B, D, G: `bot` on `link_clicks`, `moved_in_at`, persons in every counter, "arriving"
  and "moved in today" on the desk and in the post, the views recomputed) onto today's main (merges clean, checked Oct
  22 9:30 PM); migration 043; deploy Friday morning. Replay check: tonight reads 70 people and a peak in the fifties,
  not 216 and 167.
- **The address tell** (decision 5, new; as built Oct 22 night): the Windows-agent wave shares addresses.
  `link_clicks.ip inet` (migration 044, additive, logged at render from `clientIp`, only a real address). An address
  that opened **four or more different** personal tokens in the last ten minutes (`isScannerAddressRows`, pure, in
  `scanner.ts`; one indexed query on `link_clicks (ip, at desc)`) is a fleet: at the `/j` render the open takes the
  scanner path (`bot = true`, no `room_join`; the row still moves, as PR #4 decided for the agent tell), and at the
  heartbeat its beats are dropped, so no attendance row. Four, not three: a brokerage office is one or two laptops on
  one address. Tonight that catches the heavy addresses (three of them 32 of the 112 rows); the two-minute rule
  catches the rest of the wave in every count. A false positive (four real people behind one office or carrier
  address inside ten minutes) loses attendance rows for at most ten minutes; chat is unaffected.
- **Still true after this**: a scanner that reaches the live room with a fresh address still writes a row (the heartbeat
  does not know); the two-minute rule keeps it out of every count. Reminders and Katherine's 4 PM list read tonight's
  registrants, so a scanner that no longer moves rows no longer gets them.

## E. ac-links-everyone (Theresa's blank link, and everyone's)

**Why it happens.** The room never writes `WebinarJoinLink`. Three other things do: the site's Zap after `/api/register`
(it is missing about one new contact in five since Oct 20: 15 of Thursday morning's site registrations have a blank
field), the Oct 21 backfill (one pass, finished 1 PM Wednesday, nothing after it), and EasyWebinar's dead integration
(off since Oct 18). The Skool path (`/live` → the Zap → `/api/register`, 37 registrations since Monday) and the door's
guest path never wrote it. Nine contacts created since Monday (second addresses like ana.linnehan@comcast.net and
jolson1696@gmail.com, and arnold@royallepage.ca, info@sherrisell.ca, cpomeroy@gmail.com, ladonna2012@gmail.com …) have
no room row at all, so they never had a link anywhere. The 4 PM "in case you missed yesterday" email is an automation
step (the AILGR perpetual sequence) to registered contacts, not a campaign (the last campaign was Oct 14), and its link is
the bare merge tag, so a blank field renders "Webinar Link:" with nothing after it: that is Theresa's screenshot.

**What it costs.** Site registrants still get the room's own confirmation and the 30- and 15-minute reminders with
their link (7 of Thursday morning's 15 blank-field site registrants watched most of the class), so for them the blank
promo is a lost nudge. For Skool and no-row contacts the promo is their only link: 18 Skool registrants of Oct 18 to 21
and the 9 no-row contacts got a blank one on Thursday. Call it a few dozen people over three days who could not come
back, Theresa among them.

- **E0, tonight, by hand (William).** Theresa's room link is `https://watch.bookmoreshowings.com/wcpmbaz6aa6u`
  (registrant `theresa0702@me.com`, Skool, Oct 21); reply to her Skool message with it. It works for every session.
- **E1, at registration.** `activecampaign.ts` gains `setLinks(email, token)`: `contactId(email)` then two paced
  `POST /fieldValues` (field 47 `https://watch.bookmoreshowings.com/<token>`, field 49 `…/replay/<token>`; AC upserts
  by contact and field). `tagNow("registered")` calls it after `ensureContact`, and the outcome push calls it when it
  sends the `registered` tag, so a registration the instant path missed is repaired by the hourly cron. Every path
  (site, Skool, Zapier, guest with an email, the door) is covered from the first deploy, seconds after the
  registration (the same `after()` that sends the confirmation) and within the hour for anything the instant path
  missed (the outcomes cron re-sends `registered` to anyone without the tag). The site's Zap keeps writing what it
  writes; the room's value wins because it writes last and checks first. A personal link already in the field is left
  alone (one `GET /contacts/{id}/fieldValues` before the write).
- **E2, the sweep.** `src/lib/ac-links.ts` (the plan pure: which contacts need a write, the room row to create when
  there is none, `sessionDateFor`, `linkSlot`) behind `/api/cron/ac-links` (hourly `20 * * * *`; runs once in the 3 AM
  slot and once in the 3 PM slot in America/Edmonton, `events.ac_links_slot` records it so a failed run is retried the
  next hour; budget 240 s; `?dry=1` lists) and `scripts/ac-links-sweep.ts` for the by-hand run. **Two modes (found at
  build time, Oct 22 11 PM: the full read of 14,789 contacts took 241 s, the cron's whole budget):** the cron is
  incremental, the join field read in bulk once (about a minute), then the tagged contacts *created* and the list
  members *updated* in the last 3 days (a contact added to "30 day openers" is an update; `updated_after` alone is
  useless, 10,410 of 13,967 tagged contacts were "updated" since Monday); the script's `--full` reads every contact
  and is how the backlog was cleared tonight (883 contacts). Each write re-reads the contact's own field rows (the
  replay field's id), so a half-written contact is finished on the next pass. Scope: tag 304 (`ailgr_registered`) **and every active member of lists 4740
  "AI For Agents Masterclass" and 4743 "30 day openers"** (Tuesday's email list: 6,305 active, 823 without a link, 399
  of the first 400 untagged, found Oct 22 11 PM; William: "make sure that all clients for Tuesday's upcoming email
  won't have missing links"), field 47 not a personal link, test samples out; a contact with no room row gets one (`source = legacy`, dated yesterday, so tonight's count and the reminders
  are untouched until they click). Today's dry run: 79 to write, 9 rows to create. 3 PM so the 4 PM email never
  carries a blank; 3 AM for the evening's Skool joins. The first run is by hand Friday morning (`--apply`), not at 3 PM.
- **E3, recovery: dropped** (William, Oct 22 night: "regarding recovery, skip that"). The repaired contacts get their link in the next email they are sent; Theresa gets hers from his Skool reply.
- **E4, the tell.** The 3 PM run posts one line to #autoweb-intel: "Links: 12 repaired, 2 rows created, 0 still
  blank" and a red line ("Links: the sweep failed, N contacts may get a blank promo at 4 PM") when it throws or ends
  with blanks owed. The 9 AM digest gains "N registrations yesterday reached ActiveCampaign without a link (repaired)"
  computed from the sweep's own counts (`events.ac_links_last` jsonb: when, repaired, created, owed), so a Zap that
  stops writing is visible the next morning instead of in a Skool message.
- **E5, in ActiveCampaign (William, two minutes).** In the AILGR automation emails, the "Webinar Link:" block becomes
  conditional content: shown when `WebinarJoinLink` is not blank; the else branch shows the door,
  `https://watch.bookmoreshowings.com/w/ailg-r?src=email`, so no email ever renders the label with nothing after it
  even on the day something upstream breaks again. The door takes an email and lets them in.

## Friday's settings (the rollout, in order)
1. Friday morning, after his grades: the apply step (A), then the branch with B and C: tests, `tsc`, eslint, `next
   build`, the pre-pitch replay, merge, deploy. Round 2 of the page.
2. PR #4 merged, migration 043 (and 044 with decision 5), deploy; `GET /api/mod` for test-run shows "arriving".
3. E1 and E2: deploy; `GET /api/cron/ac-links?dry=1` lists 79; the 3 PM run writes them and reports 0 pending;
   a test seat registered on test-run with a real-looking address shows both fields in AC within a minute.
4. The switch: `autopilot = on` for `ailg-r` (the admin sidebar), `kaitlyn_mode` stays assisted. She answers from the
   first message, the desk reviews if anyone opens it; Katherine AI's replay line stays on; the night report at 7:50 PM;
   the digest at 9 AM Saturday with the unknowns and the agreement line.
5. Rollback: the switch back to Auto; B and C revert as one commit; the migrations stay.

## Tech stack
Next.js 16.3.5 (App Router, `after()`), React 19, TypeScript 5, Supabase (service role, server only; PostgREST capped
at 1,000 rows), Vercel crons, Claude `claude-sonnet-5-5` through the Messages API with the system prompt cached,
ActiveCampaign API v3 (5 requests a second, paced in `activecampaign.ts`), Postmark, Slack. Secrets in Doppler
(`-p bestonlineclassroom -c prd`).

## Commands
```
npm test                                   # node --test src/lib/*.test.ts (127 pass tonight)
npx tsc --noEmit && npx eslint <touched files>
npm run build                              # next build, before every deploy
npm run db:migrate                         # applies 043 (and 044) through the Management API
npm run kaitlyn:eval                       # the 231-line eval, numbers into docs/kaitlyn-eval.md
doppler run -p bestonlineclassroom -c prd -- node --no-warnings scripts/kaitlyn-review.ts --n 50 --seed 23 --round r2
doppler run -p bestonlineclassroom -c prd -- node --no-warnings scripts/kaitlyn-review-apply.ts --round r1 [--apply]
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.bestonlineclassroom.com/api/cron/ac-links?dry=1"
gh pr merge 4 --merge
```

## Project structure
```
src/lib/kaitlyn.ts, kaitlyn-kb.ts (+ .test.ts)   B, C: the prompt, guard, parseDecision, the sweep
src/app/api/heartbeat/route.ts                   B: calls sweepDeskFirst
src/lib/activecampaign.ts, tagging.ts, outcome-push.ts   E1: setLinks on the registered tag
src/lib/ac-links.ts (+ .test.ts), src/app/api/cron/ac-links/route.ts, vercel.json   E2
src/lib/scanner.ts (+ .test.ts), src/lib/clicks.ts, src/app/j/[token]/page.tsx     D: the address tell
supabase/migrations/043_link_opens.sql (PR #4), 044_click_ip.sql, 045_ac_links_slot.sql
scripts/kaitlyn-review.ts, kaitlyn-review-apply.ts, kaitlyn-review-page.html        A
docs/kaitlyn-eval.md                              the eval numbers after C
```

## Code style
One rule, pure, tested, its reason on the line (the shape every change here follows):
```ts
/** Before the pitch she never sends anyone to the call (William, Oct 22: "we don't want to talk about booking a call until they actually get to the part where they have to book a call"). */
export function guard(text: string, beforePitch = false): string | null {
  if (beforePitch && /\b(?:book(?:ing)?(?: a| the| your)? call|(?:the|a|your|free) call|consult)\b/i.test(text)) return "call talk before the pitch";
  …
}
```
Comments say why, in plain words, with the date and whose decision; constants are named and exported; nothing in
`src/components/room/*`; migrations additive; no new dependency.

## Testing strategy
- Pure (`node --test`): `guard` with and without `beforePitch` on "you need to book a call", "the free call covers
  it", "consult", and a `later` shape (passes); `parseDecision` turns a pre-pitch call line into `ask_william` with the
  why; `sweepDeskFirst` is reachable with the switch Off (`deskFirstDue` unchanged); `isScannerIp` on three tokens in
  ten minutes (true), one token twice (false), two tokens an hour apart (false); `linkPlan` leaves a personal link,
  replaces a door link, skips `-test-sample@`, creates a row only when the email has none; `setLinks` is called once
  per registration (a stub counts).
- Replay: round 1's pre-pitch price lines and Deborah Lee's "Cost" through C; tonight's 216 rows through the views (70).
- Production on test-run with test seats: a product question nobody answers → silence in the room, a card, the Slack
  line, an open row; the same with the switch Off → the desk-first line posts after 90 s; a price question at minute 10
  of a preview → a `later` shape; a `curl` from one address on three test tokens inside a minute → the third is
  `bot = true` and nothing moved; a registration → both AC fields within a minute; cleanup as always.

## Boundaries
- Always: her unsure lines wait for a human (now silently); the two-minute rule is the person everywhere; a migration
  is additive; every change has its test; deploy before noon MT.
- Ask first: any change to the ghost rules (John Custer's third "Wisconsin" was ghosted tonight after an answer and a
  see-me; whether that was right is open question 4); the promo's audience in ActiveCampaign; a static address or ASN
  list; a figure anywhere in her lines.
- Never: post a line she is not sure of; mention the call before the pitch; a BMS price; deploy 3:30 to 7:45 PM MT;
  delete attendance, click or decision rows; touch `ailg-r` knowledge rows in a test.

## Success criteria (Friday Oct 23 night, read Saturday morning)
- The desk tile, `/api/metrics` and the 7:50 PM night report agree on one number, and it is people.
- Zero Kaitlyn lines containing "call" before 6:15 PM MT; zero lines containing "team" in the hand-off sense all night.
- Every sure reply posts within 25 s of the line (`sent_message_id` minus `message_id` times); the agreement line in
  Saturday's digest is 85% or better; every `ask_william` of the night is in the digest's list.
- The 3 PM sweep reports 0 pending before the 4:08 PM send; a Skool registration at 5 PM Friday holds both links by
  the 3 AM sweep at the latest and usually within the hour.
- His round-1 grades are in `kaitlyn_kb` before 3:30 PM Friday; round 2 is on the page.

## Decisions proposed (say no to any)
1. The hand-off line goes for good: an unknown question gets silence in the room plus the card, the Slack line, the
   knowledge row and the 9 AM digest.
2. Autopilot Off no longer stops the 90-second desk-first posting; Off only means she never takes over an empty desk.
3. Before the pitch she never says "call": price gets "he gets to that near the end of the class", the call-handled
   specifics get "he covers that later in the class"; a reply that still says it is silenced and flagged.
4. Your typed line on the review page becomes her approved answer verbatim, no rewrite, approved on the spot.
5. PR #4 merges as reviewed; on top of it the address tell (three personal tokens from one address inside ten
   minutes) with `link_clicks.ip`.
6. The room writes `WebinarJoinLink` and `ReplayLink` into ActiveCampaign on every registration, and a 3 AM and 3 PM
   sweep over the tag and lists 4740 and 4743 repairs the rest (79 tagged plus about 820 on the Tuesday list today).
7. Friday: Autopilot On from the morning, mode stays assisted; Katherine AI's replay line stays on.
8. ~~The one-time repair email~~ dropped (William, Oct 22 night).
9. The sweep's Slack line at 3 PM and the digest's "reached ActiveCampaign without a link" count, so the next broken
   writer is seen the same day.
10. Your round-1 fixes go in as listed in A, with `katherine-ai-price` as its own key and #10 as the aside rule.

## Open questions
1. Did you flip Autopilot to Off tonight after the second hand-off line? (The fix in B assumes that is why she stopped.)
2. The AILGR automation emails: are there other emails or texts that send `%WEBINARJOINLINK%` besides the 4 PM one and
   Roezan's 5:03 and 5:08 texts? (E5's conditional block should go in each.)
3. The pre-pitch wording: "he gets to that near the end of the class", or your words? And #17 at minute 68 was marked
   right with "the free call" in it; the rule silences that before minute 75. Keep the rule?
4. John Custer's third "Wisconsin" (ghosted at minute 87 after a count and a "can you see my messages?"): right or wrong?
