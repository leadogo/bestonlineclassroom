# Spec: kaitlyn-solo (the room runs without William on the desk)

Module of [SPEC.md](SPEC.md). Depends on: `kaitlyn-autopilot` (built: the switch, the hand-off line, the sweep),
`kaitlyn-knowledge` (the table, the digest, the train-from-desk script proposed Oct 20), `kaitlyn-ghosts` (D, the
roll-call rule revised Oct 20 night, not built), `kaitlyn-transcript` (built), `moderator`, `link-opens`. Proposed
Oct 21 2026 morning from William's ask ("make the room more automated and Kaitlyn's responses more accurate as well as
moderate better without requiring me … she wasn't really actually answering market questions around the pitch
time"). Nothing here changes until William approves this spec.

**Status.** Oct 21 morning (William: "ok go"): C and D built with `kaitlyn-ghosts` D and deployed; replay of Oct 20 through the new prompt: 18 of 18 roll-call drops skip, 37 of 37 pitch-window market lines are sure replies with a count (Treasure Coast, Southern MD, Upstate and "Ny" included). A: the switch at 5 PM. B, E, F, G, H: Thursday morning.

## What happened (Tue Oct 20, the pitch)
- `events.kaitlyn_mode` for ailg-r is still **shadow**: every line she drafts waits for a click on the desk. The
  Autopilot switch (auto) only takes over when nobody has polled the desk for 3 minutes, and William was on it all
  night, so none of her 297 decisions ran under autopilot. In eight nights (Oct 13 to 20) she posted 38 lines on her
  own, 35 of them on Oct 19 while the desk was empty; William clicked 136 through, edited 24, skipped 50 and left
  67 cards pending.
- The pitch (video minute 75; the "what market are you in?" ask lands at 78 to 82): 46 attendee lines in minutes
  80 to 90, 31 of them her drafts he clicked. The click came a median 44 s after the line, 92 s at worst; the model
  itself took 1.6 s. Five drafts never went out: "Sellers Reno area NV" (4 in Reno, sat 8 minutes), "Northern
  California" (87 across the state, which city?), "Any agents in Santa Barbara, CA?" (the repeat, because the first
  answer took 58 s), and two "I booked". That is what "not actually answering" looked like from the room.
- Her market drafts were right: 25 of 31 sent as written, 3 edited for tone, 2 went to ask_william. Over the eight
  nights the routine categories (market, booking, price, replay, tech, greeting, thanks) were sent as written 81
  times, edited 15 times, and 41 of those drafts were never sent at all.
- The two market hand-offs are the real misses: "Im on the treasure coast" got "I'll flag that for the team" after
  99 s and "Hi! Are there any in Southern MD" waited for William ("7 across Maryland, I don't see any in southern
  MD"). The matcher reads neither as a place: a region word with no city, and "MD" after "Southern" is found but
  the line is then "not only a state", so MARKET DATA gave the roll-up without its markets and the model still chose ask_william; the prompt rule is the fix there, the matcher for the rest. Same family tonight: "Ny", "Fl", "Tx"
  (title case, read as words, not states), "Upstate" on its own, "Peel region in ON" (the capital ON needs a comma),
  and "Bruce Peninsula, in Ontario" (", in" read as Indiana).
- Questions overall: 31 asked, 4 unanswered within 15 minutes. The room is answered; it is answered late and by his
  hand.

## What already runs without him (for the picture)
Reminders at 30 and 15 minutes and the "started" email (cron, 5 min); Katherine's link emails and the 4 PM call list;
the Skool Wed/Sun broadcast (cron); the hourly outcome tags to ActiveCampaign; the market counts from the BMS
directory every 30 minutes; the 9 AM Slack digest (unanswered questions, ghosts, answers waiting for his OK); the
hand-off line on a card nobody took in 90 s; sure ghosts on the spot in assisted and auto; Autopilot when the desk is
empty. Proposed and waiting on him: `link-opens` (scanners, the door), `kaitlyn-ghosts` A to E, the train-from-desk
script. The one thing that has never been on is the mode that lets her post while he is there.

## Objective
She posts every line she is sure of; the desk reviews, it does not gate. A night with nobody on the desk and a night
with William on it look the same from the room. A market line is answered in under 20 seconds at the pitch, with the
count, every time. His clicks keep teaching her without him typing.

## Changes
A. **Assisted is the mode** (`kaitlyn_mode = assisted` for ailg-r, the admin switch that exists). The routine
   categories post themselves after the 8 to 15 s pause; the desk shows them in the stream with her badge and Fix
   and Delete (built Oct 18), and only the non-routine cards stay as cards. On Oct 20 that is 41 more lines in the
   room over eight nights and a pitch answer in about 15 s instead of 44 to 92. Prerequisite: `kaitlyn-ghosts` D
   (the first five minutes are a skip), or assisted posts the roll-call drops the 10 s slot lets through, up to 12
   lines in the first two minutes; William skipped all 18 by hand Oct 20. The flip is a click, no deploy.
B. **Desk first, then she posts** (sure replies outside the routine set: product, integration, compliance, other).
   The card is pending for `DESK_FIRST_MS = 90_000`; if nobody sent, edited or skipped it and no moderator answered
   the person, she posts it with the usual checks (`takenBy`, the presence re-check does not apply: he is there and
   chose not to act). `sweepHandoffs` already walks the 90-second cards for hand-offs; it takes sure reply cards too.
   Status `auto`, why `desk passed; …`, one Slack line ("Kaitlyn posted after 90 s: …") so he knows. Nothing he is
   not sure of changes: ask_william still waits and gets the hand-off line as today.
C. **A market line never hands off.** Prompt rule under "markets and the clock": a region, a county, a suburb or a
   place the directory does not list gets the state's count and the nearest listed market when MARKET DATA names
   one, else "nobody there yet, you'd be first" and the state count, and a which-city when the place is a region;
   ask_william is never the answer to a market line. `marketLine` feeds the roll-up whenever a state is found,
   whether or not the line is "only a state" (today a region line gets no MARKET DATA at all). Matcher fixes in
   `market-answer.ts`, each with a test: a message that is one two-letter word reads as the state in any case ("Ny",
   "Fl", "Tx"; the SHOUTED set still keeps Hi, Ok, In, Me, Or, On, So as words); "Upstate" alone is NY; a capital
   two-letter code after "in" or "from" counts ("in ON", "from TX"); a comma followed by a lower-case two-letter word
   is not a code (", in Ontario"); REGION words (northern, southern, eastern, western, central, upstate, coast,
   peninsula, valley, county, region, area) with a state make the line a market question.
D. **Regions in the directory's words.** A small `REGIONS` map next to `ALIAS`: the region phrase → its state and
   the directory places inside it (treasure coast → FL, Port St. Lucie, Stuart, Vero Beach; southern md → MD,
   Waldorf; northeast ohio → OH, Cleveland, Akron; upstate → NY, Albany, Rochester, Buffalo, Syracuse; bay area
   already a directory market). MARKET DATA then reads "directory has no Treasure Coast; Florida 61; inside it Vero
   Beach 2, Port St. Lucie 0". Seeded from the region phrases people typed since Oct 8 (one query), extended from
   the digest's unanswered list. Decision 4: ten rows now or none.
E. **Skips teach her.** A skip on a reply card gets the one-tap reason the Ghost button has (B4): "wrong", "already
   answered", "not needed", "roll-call". Only "wrong" writes a correction (said, no fixed line), so the next turn
   sees "William skipped this: don't"; the others are bookkeeping. Today a skip teaches nothing and 50 of them sit in
   the table. `kaitlyn_decisions.skip_reason text` (new), default null; the corrections view takes `wrong`.
F. **The number in the digest.** One more line at 9 AM: "Kaitlyn posted 61 last night: 52 stood, 6 you fixed, 2 you
   deleted, 1 you skipped (agreement 85%)". Computed from `kaitlyn_decisions` (auto + sent as stood; edited, fixed,
   deleted, wrong-skipped as not). A night under 80% is the signal to open the Knowledge page; nothing acts on it.
G. **Staged answers that wait.** An answer staged for his OK (the five from Oct 20) that is still unapproved after 7
   days gets its own digest line with the key names; never auto-approved (decision 7 of `kaitlyn-knowledge` stands).
H. **The desk at the pitch.** Her posted lines in the stream collapse into one "Kaitlyn answered 14 in the last
   minute" row that expands on tap, so at 5 lines a minute the cards that need him stay on screen. `mod-view.tsx`,
   nothing on the wire.

## Data (additive)
```sql
alter table kaitlyn_decisions add column if not exists skip_reason text;
```

## This repo
`src/lib/kaitlyn.ts` (B: the sweep takes sure reply cards, `DESK_FIRST_MS`; C: the prompt rule; A: nothing, the mode
is data), `src/lib/market-answer.ts` + `market-answer.test.ts` (C, D), `src/lib/kaitlyn-kb.ts` (E: the corrections
view reads `wrong`; F, G: `digestText`), `src/app/api/cron/kaitlyn-digest/route.ts` (F, G), `src/app/api/mod/route.ts`
(E: `case "kaitlyn"` skip takes `reason`), `src/app/mod/mod-view.tsx` (E chips, H), migration (E).

## Testing
- Pure: `findStates` on the fourteen lines above (each to its state or none); `marketLine` on "Southern MD" gives the
  Maryland roll-up; `deskFirstDue` (pending 89 s no; 90 s yes; a human reply no; edited no); `digestText` with the
  agreement line; `skip_reason = wrong` appears in the corrections view, the others do not.
- Replay: the 31 pitch-window market lines of Oct 20 through `decide()` offline with the C prompt: every one a sure
  reply with a count or a state count, zero ask_william.
- Production, Oct 21 night, William on the desk: assisted on from 5 PM; the pitch's market lines land in under 20 s
  by `sent_message_id` minus `message_id` times; he fixes or deletes what is wrong and the morning line reads the
  agreement.

## Rollout
Oct 21 before 3:30 PM MT: C and `kaitlyn-ghosts` D (one deploy), then A at 5 PM (the switch). Thursday morning: B,
E, F, G, H. Rollback: A is the same switch back; B is `DESK_FIRST_MS` off; the column stays.

## Boundaries
- Never: post a line she is not sure of; a price figure; approve a knowledge answer; ghost on an unsure card; change
  the pause or the 120 s per-person window; deploy 3:30 to 7:45 PM MT.
- Ask first: the regions map's contents beyond the ten seeds; any change to the ghost rules.

## Decisions proposed (say no to any)
1. Assisted is the mode from Oct 21, with William on the desk the first night.
2. A sure non-routine reply posts itself after 90 s on the desk with no action.
3. A market line never hands off; the matcher fixes ship with the prompt rule.
4. The regions map: ten rows now (the phrases of Oct 8 to 20).
5. Skip reasons on the desk; only "wrong" trains her.
6. The agreement line in the 9 AM digest; a 7-day reminder for staged answers.
7. The collapsed "Kaitlyn answered N" row at the pitch.
