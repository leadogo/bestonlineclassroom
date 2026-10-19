# Spec: kaitlyn-transcript

Module of [SPEC.md](SPEC.md). Depends on: Kaitlyn as shipped Oct 11 to 18 (`src/lib/kaitlyn.ts`), `room` (the captions
track: `events.captions_url`, `src/lib/captions.ts`), `kaitlyn-knowledge` (the table her answers live in). Proposed
Oct 18 2026 late; William approved it the same night ("please /build your proposed /spec") and A to E were built and
deployed Oct 19 early (tasks/todo.md has the commits; `docs/kaitlyn-eval.md` the before/after).

## Objective
William, Oct 18: "she needs to have context on what is being said on the webinar player. Sometimes people ask
questions and I think it would help the context of her ability to answer the question if she actually knew what I was
saying at that point during the webinar."

Today her turn says "minute 34 of the session, before the pitch" and nothing else about the screen. So a line like
"yes" at minute 12 (him: "type YES if that makes sense") reads as chatter she has to guess at, "what was that tool
called?" is an ask_william, and "does it do buyers?" gets the fact sheet when he is thirty seconds from answering it
on screen.

## What we already have (nothing to record)
- **The transcript is in the app.** `events.captions_url` is the Zoom transcript of the recording as WebVTT; the room
  serves it as closed captions. ailg-r: 862 cues, about 33,000 words over 2 h 20 min, `captions_offset_seconds` 0.
  `parseVtt` in `src/lib/captions.ts` already turns it into `{start, end, text}` cues.
- **Every message knows its second.** `chat_messages.offset_seconds` is where the attendee's player was when they
  sent the line (the room's clock; the desk, the Questions page and Kaitlyn's "minute N" read it).
- **Chapters.** `events.chapters` names seven segments (Start 0:00, Who William is 5:00, How the system works 27:00,
  Live demo 34:00, The AI appointment setter 53:00, Offer and next steps 75:00, Q&A and agent stories 84:00).
- **A measure.** `docs/kaitlyn-eval-set.json` has a `minute` on each of the 494 real questions, so the change can be
  scored offline before it touches the room.

## A. What he just said (the window) — build first
- **The pure part.** `src/lib/transcript.ts`: `windowAt(cues, offset, back = 90, ahead = 120)` returns `{ said, next }`:
  `said` is the text of every cue that ends after `offset - 90` and starts at or before `offset` (what he said in the
  last minute and a half, ending the moment they typed); `next` is the cues from `offset` to `offset + 120` (what he
  is about to say). Tested on the ailg-r file at minute 0, the pitch minute, the last minute, and an empty VTT.
- **The fetch.** The VTT is fetched once per event per function instance and kept for an hour (190 KB; the same
  instance answers the night's messages). A fetch failure means no block, never an error.
- **The turn** gains three lines, in the user turn so the cached system prompt is untouched:
  ```
  WILLIAM ON SCREEN (the last 90 seconds, ending as they typed): "…what he said…"
  COMING UP (the next 2 minutes): "…what he says next…"
  SEGMENT: Live demo: the ad and the qualifunnel (minute 36 of 140)
  ```
  About 700 extra tokens a message, uncached: under a dollar a night at 150 messages.
- **The rules** (a new PERSONA block, WHAT HE IS SAYING):
  1. Read their line as a reply to him first. An answer to something he just asked the room ("type YES", "where
     are you from", "S, B or SB", "what do you use AI for now") is a skip whatever the words. This replaces the two
     special cases in the prompt today (Katherine's polls, bare cities before the pitch) with the general rule; both
     stay as examples.
  2. When his words on screen answer the question outright, answer from them in your own words, one sentence, and
     count it as sure ("he just said the pixel reads the listing pages, not anyone's personal posts"). A product
     claim must still agree with FACTS and KNOWLEDGE; `guard()` runs as always, so a figure he said on screen
     still never posts unless it is one of the two approved ones.
  3. When COMING UP covers the question, say so instead of answering: "he's getting to that in a sec", "he covers
     that in a minute, hang on" (shapes added to VARIETY, never the same one twice a night). Only when the
     transcript shows it inside the next two minutes; otherwise today's rule holds (the call, or ask_william).
  4. "What was that called?", "what did he say the budget was?", "can you repeat the three ingredients?": questions
     about what he just showed are answered from the transcript, same guard.
  5. Nothing on screen changes the ghost rules or the are-you-AI rule.
- **Plumbing.** `Context` gains `onScreen: { said: string; next: string; segment: string | null } | null`;
  `userTurn` prints the block only when present; `src/app/api/chat/route.ts` passes `captions_url`, `chapters` and
  `video_seconds` with the event. An event without captions behaves exactly as today.

## B. What he covers later (the outline) — second
The whole transcript is about 45,000 tokens: too much for every turn, and she would start quoting him. Instead a
one-time outline: `events.outline text`, 10 to 15 lines of "minute → what he covers", generated once from the
transcript by `scripts/outline.ts` (one model call, run by hand after a new recording is uploaded) and editable on the
event's Settings page under the chapters. It goes in the system prompt as TONIGHT'S CLASS (cached, a few hundred
tokens). It lets her say "he gets to the offer around minute 75" to a question the class answers later, where today
she says the call covers it or hands it to the desk. The full transcript in the cached system prompt is the fallback
if the eval shows the outline misses too much; it costs about two dollars a night and is a decision for William.

## C. The desk sees the same screen — third, cheap
Kaitlyn's cards on the desk ("reply", "needs you") and the Knowledge page's latest asks carry one grey line, "on
screen: …" (the last 20 seconds), so William answers with the context without rewinding the monitor. Read from the
same cached cues through the mod route; no new storage.

## D. His own answers are already on the tape — one-time, worth doing early
From minute 84 the recording is William answering that night's chat live (the Q&A segment, about 56 minutes). A
one-off script folds those answers by meaning against the 48 knowledge keys and the open rows, and puts his
transcript answer in the `answer` box of any row that has none, with the minute it came from. They land in "Waiting
for your OK" on the Knowledge page like any other answer: the rewrite, his approval, then live. Nothing posts
without him; it just fills the boxes with words he already said.

## E. Measure before it ships
`scripts/kaitlyn-eval.ts` gains the window at each item's minute. Report before and after per expected class
(`answer`, `market`, `skip`), with the numbers in `docs/kaitlyn-eval.md`. The gains to look for: more `skip` on the
lines that answer him on screen (the eval's skip class is 88% today), and sure answers on questions about what he
just showed, which are ask_william today. A new eval class `onscreen` of real lines of that shape, pulled by hand
from the month's questions, goes into the set so a later prompt change cannot quietly lose it.

## Data
A: none. B: `supabase/migrations/037_outline.sql`, additive: `alter table events add column if not exists outline text;`

## This repo
A: `src/lib/transcript.ts` (+ test), `src/lib/kaitlyn.ts` (Context, userTurn, the PERSONA block, the cached fetch),
`src/app/api/chat/route.ts` (three fields in the event select), `scripts/kaitlyn-eval.ts`, `docs/kaitlyn-eval.md`,
`src/lib/kaitlyn.test.ts`. B: the migration, `scripts/outline.ts`, `src/app/admin/events/[slug]/page.tsx` + `actions.ts`
(the field). C: `src/app/api/mod/route.ts`, `src/app/mod/mod-view.tsx`, `src/app/admin/knowledge/page.tsx`.
D: `scripts/kaitlyn-qa-from-transcript.ts`. Nothing under `src/components/room/`.

## Testing
- `transcript.test.ts`: the window at second 0 (nothing before, two minutes after), at the pitch minute (the cue
  that spans the moment is in `said`), at the last second (nothing after), an empty VTT (both empty), and the cue
  boundary (a cue ending exactly at `offset - 90` is out).
- `kaitlyn.test.ts`: `userTurn` carries the three lines when `onScreen` is set and nothing when null; the PERSONA has
  the five rules; VARIETY has the "getting to that" shapes.
- The eval run, before and after, numbers recorded.
- Production on test-run with the Fast Sample seat (no Slack): "yes" thirty seconds after he asks the room to type
  it → skipped with "answering him on screen" in `why`; a question he answered on screen a minute earlier → her reply
  cites it and posts itself; a question he answers in the next minute → "he's getting to that"; the same three
  with captions off for test-run → today's behaviour. Rows cleaned, as always.

## Rollout
Build the morning after approval, A alone first, deploy before noon Mountain, never between 3:30 and 7:45 PM. B, C
and D follow once a night of A has been read on the desk. Rollback is a revert: the block is additive and the prompt
without it is exactly today's.

## Boundaries
- Always: product claims from FACTS and KNOWLEDGE only; `guard()` on every line; one sentence from the screen at most,
  in her words, never a quote; the transcript never makes her say whether the session is live.
- Ask first: the full transcript in the system prompt; a second model call to summarise the window; any change to
  what the room's captions show.
- Never: deploy in the window; a destructive migration; a change to `src/components/room/*`.

## Decisions proposed (say no to any)
1. The window is 90 seconds back and 2 minutes ahead on the attendee's own player clock (`offset_seconds`), not the
   server's: a late joiner is where their player is.
2. The window lives in the user turn, not the system prompt, so the API cache stays warm.
3. An answer taken from his words on screen counts as sure and posts under autopilot, with the guard unchanged.
4. "He's getting to that" is allowed only when COMING UP shows it inside two minutes.
5. The outline (B) is a generated text William can edit, not a per-message summary and not the full transcript.
6. The Q&A segment (D) fills answer boxes for his approval; nothing from the tape goes live on its own.
