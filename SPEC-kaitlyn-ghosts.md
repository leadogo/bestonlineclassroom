# Spec: kaitlyn-ghosts

Module of [SPEC.md](SPEC.md). Depends on `kaitlyn-transcript` (Kaitlyn as shipped Oct 19), `moderator` (the desk),
`room` (the chat panel), `admin` (the Knowledge page, the digest). Proposed Oct 20 2026 from
[docs/kaitlyn-ghost-audit-2026-10-20.md](docs/kaitlyn-ghost-audit-2026-10-20.md).

**Status: BUILT AND SHIPPED Oct 20 2026, 11:30 AM to 12:15 PM MT** (commits fb0420e to the fixes after the production
checks; migrations 038 and 039; plan in `tasks/plan.md`). Every check in the Testing section passed on test-run with five
test seats, after four fixes the checks found (a mid-line question of hers frees the follow-up; one hand-off per card, the
card claimed first; the roll-call slot checked after the pause; the room's pill reads the live callback; the re-point filed
under see-me). Eval after: answer 71%, market 97%, skip 91%, ghost 82% (17 of 18 sure), keep 8 of 9 (`docs/kaitlyn-eval.md`).
Review (fresh-context reviewer, Oct 20 ~12:30 PM MT): no Critical; two Important, one fixed (her private replies to ghosted
people stayed out of everyone's RECENT ROOM context) and one kept by decision 1 below (the 90 s hand-off also fires in shadow
mode with the desk open: Autopilot Off is the switch); five suggestions taken (the hand-off card claimed before the pause,
two indexes and a scoped count on the ghost view, migration 040; an already ghosted client still gets the private line and the
team's note; the roll-call slot cut from 30 s to 10 s so a burst still answers most people; one "answered" rule shared by the
digest and the audit, her hand-off line not counting as an answer).
Follow-ups noticed, not built: "OC" and other abbreviations do not match the directory's "Orange County, CA" (she said
"wide open" where the count is 9: a market alias table); a third live-or-recorded push with an ultimatum (Kim Ma) is the one
line she ghosts that the spec calls sincere, his hand agreed; the roll-call slot still skips a tie for good (a queue if it
shows in the audit). Decisions below were taken on his go.
**Oct 20 night:** the roll-call rule reversed after its first session (section D, decision 4); the training from his
own replies that night is in `SPEC-kaitlyn-knowledge.md` ("Training from the desk's own replies").

## Objective
In William's words, Oct 20: "look at the messages from yesterday and see what we can do to train Kaitlyn even more.
Audit when I'm ghosting people and understand, from people who've been ghosted, what they said. What am I doing that
incentivizes me to ghost them? Train Kaitlyn to do that as well."

What the audit found, in one paragraph: last night five people were left without an answer, every one of them by a
rule of ours (the 120 s per-person window ate three follow-ups, a lead-in her own prompt suggests tripped the bot-tell
check, and a desk tab open in the background silenced her hand-off). Since launch he has ghosted 40 people by hand in
20 nights at a median 20 s after the line; Kaitlyn has proposed a ghost twice in nine nights and never acted on one.
His ghosts protect the room from the live illusion being tested, from price pushing, from sneering, from client
complaints, and from people nagging that they are skipped; the nagging is largely produced by replies the room never
surfaces to the person and by the roll-call minute, where a real city drop is skipped by design.

Success: the five misses of Oct 19, replayed on test-run, are all answered; her ghosts land on at least 8 in 10 of
the lines he ghosted by hand and on none of the honest ones; a week on, unanswered among wanted is under 10% (16%
last night, 25% over the nine nights), "can you see my messages" lines from Kevin are zero, and he ghosts by hand fewer
than one person a night that she had not already proposed.

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `kaitlyn-tune` | Last night's misses: the follow-up window, the "honestly" lead-in, the hand-off when the desk is open but idle, edits as corrections, the knowledge rows from his lines | — |
| `kaitlyn-ghost` | Ghost the way he does: the rules from the audit, acting on the spot when sure, his by-hand ghosts as live training, a ghost class in the eval | `kaitlyn-tune` (the corrections view) |
| `room-reply-seen` | A reply addressed to you lands: scroll, flash, a "replied to you" pill when the chat is hidden or scrolled away | — |
| `roll-call` (ask) | The first five minutes: Katherine's minute-2 line stops promising a shout-out, Kaitlyn answers real city drops with the count | — |
| `kaitlyn-audit` | The audit as a script and two lines in the 9 AM digest, so this is read every morning instead of once | `kaitlyn-ghost` (the reason chip) |

Build order: `kaitlyn-tune` → `kaitlyn-ghost` → `kaitlyn-audit`; `room-reply-seen` and `roll-call` in parallel with
them. One night if approved, `room-reply-seen` last (a room change, walked on a phone before 3:30 PM MT).

## A. kaitlyn-tune

A1. **The per-person window only holds the same question.** `PER_PERSON_MS` (120 s) stays for a repeat of the key she
just answered (Frankie's third "Michigan"). A line with a different `kb_key` than her last reply to that person, or a
line that answers a question she asked them (her last line to them ends with "?"), posts after the normal pause.
`takenBy` reads her last auto row for the registrant (`kaitlyn_decisions.kb_key`, `text`). Cases from Oct 19: Kailash
"Booked" then "East Bay San Fran"; Cindy "OC" → her question → "OC california"; Hamid Newmarket then "How much does it
cost?". All three answer.

A2. **The prompt never suggests what the check refuses.** "honestly," leaves the price lead-ins. A unit test runs every
shape in the VARIETY list through `tells()` and fails on a hit, so this cannot come back.

A3. **The hand-off fires when the desk is idle, not only when it is empty** (ask). Today `handoff` stays silent whenever
the desk was polled in the last 3 minutes, which a background tab keeps true all night. Change: an ask_william card
pending 90 s with no moderator line to that person and no desk action on the card posts the hand-off line (still once
per person per night). Heather would have got "let me pass that to the team" at 17:11.

A4. **Edits teach her.** Migration 038: the `kaitlyn_corrections` view also returns status `edited` rows (`text` as
`said`, `sent_body` as `fixed`), so Kevin's three rewordings of Oct 19 join the CORRECTIONS block. No code change beyond
the view.

A5. **Knowledge from his lines.** For him to approve on the Knowledge page (proposed wording, his to change):
- `no-sound-after-refresh` (open, asked 2): "try another browser or open your join link on your phone, and tap the video once for sound".
- `who-are-you` (open): "Kaitlyn, I help out in the chat for William's team".
- `thanks` (open, asked 6): handling `ignore`, so the digest stops listing it; she already answers thanks from the prompt.
- `other-industries` (mortgage): "yes, more than ten mortgage agents use it: they handle the pre-approvals first and share the leads with a partner agent".
- `offer`: add "the first 10 who book get Katherine included free".
- `market_counts`: Pittsburgh 1 (he said "I believe we have 1 there") (ask).
- "Our own mortgage product coming out January": a date and a roadmap item; not in her knowledge unless he says so (ask).

A6. **The deleted shape.** "booked, see you on the call" leaves the booked shapes in the prompt (she is not on the call)
(ask: confirm that was the reason).

## B. kaitlyn-ghost

B0. **A ghosted person still gets answers, privately** (William, Oct 20: "when people are ghosted I do want to confirm
that Kaitlyn can still respond to them and answer the questions, but it's just hidden from the chat"). Today the chat
route skips Kaitlyn entirely once someone is ghosted (`!ghosted` on the call), which is how Brett asked thirteen times
into the void. Change: she decides on a ghosted person's lines exactly as on anyone's; her replies and her hand-off line
post with `visible_to` = that person (only they see them; `postAsKaitlyn` already does this); her "needs you" cards reach
the desk and Slack marked "(ghosted)", and a desk reply to them is private already; a ghost decision on someone already
ghosted only records. Her context for them reads their own hidden lines too (today `recent` keeps `visibility = all`).
Katherine's replay line and the Slack relay of their lines stay off for ghosted people, as he set them. Test: a ghosted
seat asks the price and a market, both answered, a second seat sees neither.

B1. **The ghost bullet rewritten from his hand.** Each rule names the lines it comes from; the register stays his (median
20 s, nothing announced to the room).
- *The illusion tested or exposed* (14 of 40): claims and live tests are the chat filter's already; she adds "he just read a comment", "you're just watching the comments", "prepopulated comments", "why are the reminder texts still coming if I'm in here". A sincere "is this live?" or "is this recorded?" is still not a ghost: he stopped ghosting those after Oct 9, and Katherine answers the replay.
- *Price pushed, or a figure named in the open* (5): the first price ask gets the line; a second ask after it, "you're avoiding the question", "give us an approx cost", "CAD $400?" ghost on the spot. A pre-pitch price ask gets the line too (ask: he hid Teri's).
- *Sneering, heckling, impatience, a racist line* (8): "waste of time", "booooo", "I'd hang up", "I hate this X thing", "meow", "get to the point instead of telling us how much money you made", "why ask us to turn on cameras" ghost on the spot. "How do I turn on my camera?" gets the camera answer.
- *A legal accusation stated as fact* (Brett): "it's illegal to do that in my market" ghosts; a legality question gets the `legal` answer.
- *A client or a booked prospect complaining in the open* (4): "I purchased your program…", "my rep didn't show", "no one came to my appointment", "tired of losing money to charlatans". Ghost on the spot, post the `support` line to them privately, and one Slack line to the intel channel with the name and email so the team follows up. Category `support` becomes a sure ghost.
- *Not a prospect, soliciting* (5): a minor or someone who cannot be licensed yet ghosts and still gets the `beginner` answer privately; hiring out services or posting a number to call ghosts.
- *The nag* (4, and the one Kevin fights every night): "why do you keep skipping me", "you only speak to some people", "I've asked three times", "can you see my messages". First time: one line that re-gives the answer and asks if they can see it ("the answer's in the chat, 3 in Michigan, can you see it?"). Second time the same night: ghost (Grant 6 s, Hamid 20 s after exactly that sequence) (ask).
- *Still never ghosts*: honest reactions to Katherine's voice, a sincere live or replay question, a joke, a bare "can you see me?" from someone nobody has answered yet (that one is a `see-me` reply).

B2. **A sure ghost acts.** `ghostsItself` today acts only on category `negative`. Change: any ghost with `sure: true`
acts on the spot in assisted, auto and under autopilot; an unsure ghost stays a desk card as today. When she has a line
for them (support, the minor), it posts with `visible_to` as a private reply, the way Kevin kept answering 19 of his 40.

B3. **His hand is her training.** The static list of 24 ghost lines in `kaitlyn-examples.ts` (frozen Oct 13) is replaced
by a view `kaitlyn_ghosts` (migration 038): for each by-hand ghost, the hidden line that triggered it (the first
`visibility = author` line at or before `ghosted_at`, else the last line before it), the person's two lines before it,
and the reason chip (B4). Newest 40 go into the prompt as LINES THE TEAM GHOSTED, with the two lines before each so she
sees the run-up, not just the trigger. An Unghost removes the row from the block. Cached with the rest of the system
prompt.

B4. **The desk's Ghost records why.** One tap chip on the Ghost confirmation: live test · price · nag · sneer · client ·
not a prospect · other (default other, one tap to skip). Stored as `registrants.auto_ghost_reason = "by hand: <chip>"`
(the column exists; by hand is null today) and the matching `kaitlyn_decisions` row set to status `ghosted`, `decided_by`.
The chip is what makes B3's block and E1's table say why (ask: worth the tap?).

B5. **A ghost class in the eval.** `docs/kaitlyn-eval-set.json` gains `expected: "ghost"` for the 40 by-hand trigger lines
(with the two lines before as `priorOwn`) and 10 must-not-ghost lines ("sounds robotic", "Is this recorded?", "Can't find
the camera", "Can you see my messages" with no prior answer, "I'm 70 years old…"). The eval scores a `ghost` row: recall on
his 40, false ghosts on the 10. Run before and after B1, numbers into `docs/kaitlyn-eval.md`.

## C. room-reply-seen
When a team line mentions the viewer (`mentionsMe`): the chat scrolls to it and the row flashes once, even if the reader
had scrolled up (today it sticks to the bottom only when already there). If the chat is hidden (`chatHidden`) or the row
is not on screen after 3 s, a pill at the top of the chat or over the video reads "Kaitlyn replied to you" (the author's
first name) and a tap scrolls to the row; it goes away on its own after 30 s or when the row is seen. A ghosted person gets
the same for their private replies. One component in `src/components/room/`, no dependency, nothing new on the wire
(`mentions` is already in the poll). Checked on an iPhone in portrait with the chat below the video and with it hidden.

## D. roll-call (REVISED Oct 20 night)
As shipped at noon Oct 20: Katherine's minute-2 line became "Drop your city in the chat 👇 the team checks how many agents
we have near you", and Kaitlyn answered a bare city drop with the directory count at any minute, one line per 10 s slot.
First night (Tue Oct 20): 18 city-drop drafts in minutes 0 to 2 (Sarasota, Santa Barbara, Queen Creek, Dallas, Toronto,
Vancouver, San Antonio, Long Beach...), every one skipped by William from the desk. His read: "for the first few minutes
when people are typing in what market they're from, she still wants to respond to them as if they're at the end asking
for market and I had to skip all of them." The drops land at 20 to 90 s, while he asks the room where they are from on
screen, before Katherine's line; a count back to each of them is noise in the roll-call and 18 cards on the desk.

New rule, replacing the paragraph above:
- **The roll-call window is the first five minutes** (`ROLL_CALL_WINDOW_S = 300`, offset from the session start). In it a
  bare city or state ("Sarasota", "Dallas TX", "Michelle in Florida", "Van., B.C. Moving to AZ") is answering him on
  screen: `skip`, `why` "roll-call", no card on the desk, no line in the room. A reaction is the most she does (decision
  4b: none by default).
- A direct market question in the window ("how many in Dallas?", "anyone in Toronto?", "is Calgary saturated?") still
  gets the count, one per slot, as any minute.
- **From minute five** a bare city drop gets the count as the noon rule says (one line per person, one per 10 s slot,
  no "exclusive" talk unless asked), because by then it is a question, not a roll-call answer.
- Katherine's minute-2 line stays as edited (the team does check on the call); the on-screen ask is his.
- Prompt rules that change: the "one exception is a city or state" sentence in the polls rule (it becomes: in the first
  five minutes a city or state is a poll answer like any other), and the "markets and the clock" rule (bare drops get
  the count from minute five, questions at any minute). `decide()` passes the offset; the eval set relabels its
  minute-0-to-2 city drops as `skip` (the market class scored 97% on the noon rule and must be re-run, target: no
  city-drop reply inside the window, counts on every direct question, bare drops answered after it).
- Audit line: the nightly audit counts "roll-call drops" separately from "unanswered", so the first five minutes stop
  reading as misses.

## E. kaitlyn-audit
E1. `npm run kaitlyn:audit -- --from 2026-10-11 [--out docs/kaitlyn-audit-<date>.md]`: the tables of the audit document
(per night: lines, wanted, by Kevin, by Kaitlyn, unanswered, hidden; the by-hand ghosts with trigger, chip and lag; the
"skipped me" complaints with whether they had been answered). The SQL of the audit as `scripts/kaitlyn-audit.ts`, read-only.
E2. The 9 AM digest gains two lines: "Last night N went unanswered: names" and "You ghosted M by hand: names (chips)".
`digestText` grows two optional fields; nothing else changes.

## Tech stack, commands, structure, style, testing, boundaries
Inherited from SPEC.md. Specifics:

```
Test:   npm test                       # adds: window rule (A1), shapes vs tells (A2), ghost view trigger pick (B3), digest lines (E2)
Eval:   npm run kaitlyn:eval -- --n 200 --seed 7 --out docs/kaitlyn-eval.md     # before and after B1, ghost row included
Audit:  npm run kaitlyn:audit -- --from 2026-10-11
DB:     npm run db:migrate             # 038_kaitlyn_ghosts.sql: corrections view + edited, kaitlyn_ghosts view
Walk:   test-run with the Fast Sample seat (the Oct 17 token in the scratchpad), desk at /mod/test-run
```

Files: `src/app/api/chat/route.ts` (B0: Kaitlyn runs for ghosted people), `src/lib/kaitlyn.ts` (A1 window, A2 lead-ins, A3 hand-off, B0 context and private posts, B1 bullet, B2 `ghostsItself`, B3 block), `src/lib/kaitlyn-kb.ts`
(ghost block text), `supabase/migrations/038_kaitlyn_ghosts.sql`, `src/app/api/mod/route.ts` (B4 chip on `case "ghost"`),
the desk's Ghost confirmation (B4), `src/components/room/ChatPanel.tsx` + one new component (C), the event's minute-2 line in
`events.prompts` (D, edited in the admin Settings, no code), `scripts/kaitlyn-audit.ts` (E1),
`src/app/api/cron/kaitlyn-digest/route.ts` (E2), `docs/kaitlyn-eval-set.json` (B5),
`src/lib/kaitlyn-examples.ts` (B3: the ghosts array goes, the 224 Q/A stay).

Testing: `node:test` next to each pure rule; the four production checks on test-run with real seconds: (1) "OC" → her
question → "OC california" both answered; (2) the price line, then "you're avoiding the question" → ghosted on the spot,
hidden from a second seat, Slack line, Unghost works; (3) a nag after an answer → the re-point, a second nag → ghost;
(4) chat hidden on the phone → the pill, tap → the row. Rows cleaned after, as on Oct 18 and 19.

Boundaries: no deploy between 3:30 and 7:45 PM MT; migrations additive; a ghost she is not sure of never acts; honest
feedback and sincere questions never ghost; a ghosted person still gets answers, privately; Unghost stays one tap; nothing
in the room reads a new column until the code does; the Katherine line (D) changes only on his yes.

## Success criteria
- The five Oct 19 misses, replayed on test-run, all get an answer (A1, A2, A3, A5).
- Eval: ghost recall ≥ 80% on the 40, 0 false ghosts on the 10, answer and market classes not worse than the Oct 19 run.
- Production, first week: unanswered among wanted < 10%; zero "can you see my messages" lines from Kevin; by-hand ghosts
  she had not proposed first < 1 a night; no Unghost needed on one of hers.
- The digest on the morning after names last night's unanswered and ghosted.

## Decisions (Oct 20, on William's go: "update the spec, then /plan /build /test /review"; the recommendations stand, say no to any)
1. A3: yes, the hand-off fires after 90 s idle even with a desk tab open.
2. B1 price: a price ask before the pitch gets the line; only the push after it ghosts.
3. B1 nag: his pattern, the re-point first, a ghost on the second complaint; C makes it rare.
4. D: yes, the roll-call changes (one Settings edit and one prompt rule; revert is the same edit and one commit).
   **Amended Oct 20 night (William): bare city drops in the first five minutes are skips with no desk card; counts on a
   direct question at any minute; bare drops answered from minute five. 4b (ask): a 👍 reaction on a roll-call drop, or
   nothing (default nothing).**
5. "Mortgage product coming January": not in her knowledge until it exists.
6. "booked, see you on the call" leaves the booked shapes.
7. Pittsburgh: not added here; `market_counts` is synced from the BMS directory, so the row belongs there (on William).
8. B4: yes, the reason chip, one tap, default "other".
9. `who-are-you`: handling `ignore` (he skipped her draft; Ken's "Wait, who are you?" at minute 72 was about the screen).
