# Spec: kaitlyn-autopilot

Module of [SPEC.md](SPEC.md). Depends on: Kaitlyn as shipped Oct 11 to 16 (`src/lib/kaitlyn.ts`), `moderator`
(the desk and `team_presence`), `admin` (the sidebar and the Webinars page). Proposed Oct 17 2026 late, revised
the same night with William's additions (the sidebar switch, the fail-safe when he forgets). Nothing here
changes until he approves this spec.

## Objective
In William's words, Oct 17:
1. "see what Kaitlyn wasn't confident enough to respond to and then I can confidently give you the answer … create
   our own knowledge base" → his 35 approved answers plus her 13 confirmed lines become what she knows.
2. "apply the humanizer skill to how she responds so she sounds less AI" → every line she posts follows the
   blader/humanizer rules, in the prompt and with a check in code.
3. "Autopilot … if nobody is present in the room for longer than 3 minutes … If I'm in there, Autopilot would
   never turn on … unless, of course, the confidence score is really low."
4. "I can manually turn on and off the autopilot from the admin dashboard easily … somewhere in the left sidebar."
5. "If there's ever a day where I forget to turn it on … after a specific amount of time (such as 5 minutes), if
   people are asking questions, nobody's responding, and there are no moderators in the room, it should
   auto-switch on."
6. "the room can be essentially handled the exact same way that I've been handling it as Kevin going forward."

Guardrails that hold throughout: the room behaves exactly as today whenever a moderator is on the desk and the
switch is not forced On; no deploy between 3:30 and 7:45 PM Mountain; additive migration only; a line she is
not sure of never posts on its own.

## A. Knowledge: the approved answers
- **Where they live.** In the `kaitlyn_kb` table of [SPEC-kaitlyn-knowledge.md](SPEC-kaitlyn-knowledge.md),
  seeded with the 48 lines in `docs/kaitlyn-answers-2026-10-17.md` (verbatim from the Answer Review page,
  amended only as below) and read into her prompt as a KNOWLEDGE block at call time. The fact sheet
  (`events.kaitlyn_facts`) keeps WHO WE ARE and the rules; nothing is pasted into it. The static examples
  corpus stays as the voice sample; the approved answers are the substance.
- **How she uses them.** FACTS already are "the only product claims you may make"; an approved answer is a fact
  in the shape she should use. The prompt adds: "APPROVED ANSWERS are William's own words. When a question
  matches one, use its substance and its length; reword it to fit the line, never recite it." Matching an
  approved answer counts as `"sure": true`.
- **William's five decisions, Oct 17:**
  1. The offer line keeps the figure ("Katherine AI included free instead of $250 a month"). The sheet's rule
     becomes: never a BMS price; the two approved figures ($250 a month for Katherine's subscription, $10 a day
     as the ad-budget example) are allowed. `guard()` lets exactly those two phrases through and still blocks
     every other `$`, "a month", "per month".
  2. Hiring, with the careers page: "Not hiring right now, and no affiliate program yet, but there's a careers
     page on our website if you want to keep an eye on it. For a TC, ask the good agents in your market. They'll
     have one."
  3. "How long is this": "About an hour, then some Q&A." The sheet keeps "never a minute count".
  4. Replay: she answers it ("Yes, it goes out by email after the class."). The prompt line "replay: skip,
     Katherine AI answers it" goes. When Katherine AI is on for the event she already posts her replay line
     within a second, so Kaitlyn still skips a replay question Katherine is answering (`katherine: true` in the
     turn); when Katherine is off, Kaitlyn answers.
  5. "Are you AI?": "Never say whether you are AI or human. If a line asks only that, skip. If it asks that and
     something else, answer the something else as if the AI part was never asked." The `guard()` bot-or-human
     rule stays.
- The guard's live-or-recorded rule narrows to claims about this session (`pre-recorded`, `this is (a) live /
  recording`, `we're live`), so "replayable recording" and "the replay" pass.

## B. Voice: the humanizer rules
- **In the prompt**, a `WRITING` block distilled from humanizer v3.1.0 for a one-line chat reply: lead with the
  answer; no "not X but Y"; no dashes of any kind; no closers that restate; no staged openers ("Honestly?",
  "Here's the thing", "Great question"); no triads for rhythm; no stock words (delve, crucial, robust, seamless,
  elevate, game-changer, leverage, journey, landscape, testament); no sales words (world-class, cutting-edge);
  no "serves as / boasts / features"; straight quotes; keep the asker's own words where they help; the
  register is William's own replies (contractions, short, the odd "lol", one emoji at most and never two
  replies in a row).
- **In code**, `src/lib/humanize.ts`: `tidy(text)` turns em and en dashes and ` -- ` into a comma or a period and
  curly quotes straight; `tells(text)` names the machine-checkable tells left (not-X-but-Y, chatbot residue,
  stock words, a closer fragment, three parallel items). `parseDecision` runs `tidy` on every draft; a reply
  with a tell becomes `ask_william` with `why: "sounds like a bot: <tell>"`. No second model call unless a
  week shows more than one draft in ten tripping.
- **Timing like a person.** The pause before a line she posts herself scales with its length: today's 8 to 15 s
  plus about 40 ms per character, capped at 25 s, so a two-sentence answer lands later than "got it 🙌".

## C. Autopilot
- **The control.** `events.autopilot text not null default 'auto'` with values `auto | on | off`. It lives in the
  admin sidebar under each webinar (mock: the "Autopilot Switch Mockup" artifact), a three-way control Auto / On
  / Off with a status line under it, admins only, saved by a server action without leaving the page. The same
  row appears on the webinar's card on the Webinars page and the desk strip shows the state read-only.
- **Auto (the default, his point 5).** Armed every night. She takes over when no moderator has been seen on the
  desk for 3 minutes; if nobody has opened the desk at all tonight, from minute 5 of the session. The moment a
  moderator's desk poll arrives, she hands back.
- **On (his "personal matters" day).** She runs the room from the first message. Looking at the desk does not
  hand back; her lines show there with the badge and unsure ones still wait on the desk.
- **Off.** Never takes over; her mode behaves as today (shadow drafts, assisted routine).
- **Presence.** A moderator is present when any `team_presence` row for the event and session has
  `last_seen_at` within 180 s. The desk poll upserts it every 3 s, so a shut laptop or a lost connection reads
  as gone three minutes later. Sitting in the room as an attendee does not count.
- **Engaged**, pure and tested: `engaged(autopilot, lastModSeenMs | null, sessionMinute, nowMs)`:
  `on` → true; `off` → false; `auto` → `lastModSeenMs === null ? sessionMinute >= 5 : nowMs - lastModSeenMs >=
  180_000`. When engaged, `shadow` and `assisted` act as `auto` for that message: every `reply` posts itself
  after the pause and a sure negative ghost happens on the spot. `ask_william` and unsure drafts still wait on
  the desk and still ping Slack: `parseDecision` already turns every unsure reply into `ask_william`, so
  autopilot never posts a line she is not sure of. That is the confidence rule.
- **Re-check before posting.** After the pause, alongside today's "did a moderator answer first" check, the
  presence check runs again (Auto only). If a moderator came back, the decision is marked `pending` and shows
  on the desk instead of posting.
- **When she does not know and nobody is there (new, his point 6).** Under autopilot an `ask_william` would
  otherwise leave the person with silence. Once per person per night she posts a hand-off line in Kevin's own
  shape ("good one, I'll get the team to answer that properly and they'll follow up with you") and the question
  stays pending on the desk with the Slack ping. A second unknown from the same person gets no line. Says
  nothing when a moderator is present. Decision 5 below if William prefers silence.
- **Record and badge.** `kaitlyn_decisions.autopilot boolean not null default false` marks decisions made while
  engaged; the desk row reads `autopilot` instead of `auto`. Slack gets one line on the first engaged decision
  of a night ("Autopilot on: nobody on the desk for 3 min, Kaitlyn is answering") and one on the first
  non-engaged decision after it ("Autopilot off: <name> is back on the desk").
- **Status line** (sidebar and Webinars card, computed from presence and tonight's decisions): "armed · you're
  on the desk", "armed · Kevin left 1 min ago", "engaged since 5:07 PM · 6 answered, 2 waiting for you", "on ·
  answering on her own tonight", "off · drafts only".

## D. Teach Kaitlyn (the ongoing channel)
A one-line box on the desk strip, admins only: "Teach Kaitlyn a fact". Submit appends `- <text> (William, <date>)`
to the event's fact sheet (`POST /api/mod`, `case "teach"`, 400 chars max, Slack line "Kaitlyn learned: …") and
it applies to the next message.

## E. Proving she can hold the room (his point 6)
Honest position: the spec makes her know what Kevin knows and write the way William writes; it does not make her
Kevin on a question nobody has asked before. Those go to the desk, and under autopilot they get the hand-off
line. Two things close the gap over time, both cheap:
- **An eval run before every prompt change.** `scripts/kaitlyn-eval.mjs` replays the month's 494 real questions
  (the Knowledge Base data) through her prompt offline and scores: answered when an approved answer exists,
  silent on the 28 non-questions, no guard trips, no tells, no reply on the ghost shapes. About 500 model calls,
  a few dollars a run; the report is a table per intent. Run it on this change and keep the numbers in
  `docs/kaitlyn-eval.md` so a later prompt edit cannot quietly make her worse.
- **A weekly ten-minute review.** Every Monday the Knowledge Base page is rebuilt with the week's questions she
  asked you about or skipped; you answer in your words, the rewrites come back for approval, the approved lines
  join the sheet. Same loop as tonight, a tenth of the size. Automated as a cron later if it earns it.

## Data
`supabase/migrations/031_kaitlyn_autopilot.sql`, additive:
```sql
alter table events add column if not exists autopilot text not null default 'auto' check (autopilot in ('auto', 'on', 'off'));
alter table kaitlyn_decisions add column if not exists autopilot boolean not null default false;
```

## This repo
`src/lib/kaitlyn.ts` (prompt blocks, `guard`, `engaged`, hand-off line, `kaitlynHandle` presence checks, badge,
length-scaled pause), `src/lib/humanize.ts` (+ test), `src/app/api/chat/route.ts` (reads `autopilot` with the
event), `src/app/api/mod/route.ts` (GET: autopilot state and status text; POST: `case "teach"`),
`src/app/mod/mod-view.tsx` (chip text, Teach box, `autopilot` badge), `src/app/admin/admin-nav.tsx` +
`layout.tsx` + `actions.ts` (the sidebar control and its server action), `src/app/admin/page.tsx` (the card row),
`scripts/kaitlyn-eval.mjs`, the migration, `docs/kaitlyn-facts.md`, `docs/kaitlyn-answers-2026-10-17.md`,
`docs/kaitlyn-eval.md`, `src/lib/kaitlyn.test.ts`. About twelve files; nothing under `src/components/room/`.

## Testing
- `kaitlyn.test.ts`: `guard` passes "$250 a month", "$10 a day", "replayable recording"; still blocks "$400 a
  month", "per month", "this is live", "pre-recorded". `engaged` table: on → true; off → false; auto with
  nobody tonight at minute 4 → false, minute 5 → true; auto with a moderator seen 60 s ago → false, 181 s ago →
  true. `systemPrompt` carries the WRITING block, the APPROVED ANSWERS heading when the sheet has it, the
  are-you-AI rule, and no "Katherine answers replay" line. The pause scales and caps at 25 s. The hand-off line
  fires once per person and never with a moderator present.
- `humanize.test.ts`: `tidy` on dashes and curly quotes; `tells` on "not just X but Y", "Great question!",
  "delve", a closer fragment, and none on five of William's approved lines.
- `node --no-warnings --test src/lib/*.test.ts`, `npx tsc --noEmit`, `npx eslint` on touched files, then the
  eval run with its numbers recorded.
- Production check on the test webinar with a test seat (source `test`, no Slack): Auto, no desk poll for 3 min
  → a price question posts her line after the pause with the badge; open the desk, ask again → it waits; a
  novel question with nobody there → the hand-off line once; "are you AI? and how much" → the price answer only;
  On with the desk open → she posts anyway; cleanup as always.

## Rollout
Build the morning after approval, deploy before noon Mountain, never in the 3:30 to 7:45 PM window. Order:
migrations (031 and 032) → the knowledge seed → code → eval run; the knowledge page and the 9 AM digest follow
on day 2 (see `SPEC-kaitlyn-knowledge.md`). The default is Auto, which means
the first night after the deploy she takes over if the desk is empty for 3 minutes; if William wants one quiet
night first, he sets Off on the sidebar before 5 PM and flips it after. Rollback is the switch; every code path
behind it is inert at Off.

## Boundaries
- Always: her unsure answers wait for a human; no BMS price beyond the two approved figures; nothing about live
  or recorded; ghost only on the shapes already listed; one reply per person per two minutes.
- Ask first: a second model pass for the voice check; widening ASSISTED categories while a moderator is present;
  any change to Katherine AI's replay reply; a cron for the weekly review.
- Never: deploy in the window; a destructive migration; a change to `src/components/room/*` for this work.

## Decisions proposed (say no to any)
1. Presence means the desk (`team_presence`), not William sitting in the room as an attendee.
2. Any team member on the desk counts, not only William.
3. With Katherine AI on, Kaitlyn skips the replay question Katherine already answers; with her off, she answers.
4. A draft with a machine-checkable bot tell goes to the desk rather than through a second model call.
5. Under autopilot, an unknown question gets one hand-off line per person per night rather than silence.
6. The default is Auto from the first deploy; the numbers are 3 minutes after the last moderator and minute 5
   of a session nobody opened.
