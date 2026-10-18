# Spec: kaitlyn-knowledge

Module of [SPEC.md](SPEC.md). Depends on: `kaitlyn-autopilot` (same build; this module is where its approved
answers live), `admin` (the sidebar), `moderator` (the desk's decisions). Proposed Oct 17 2026 late. Nothing here
changes until William approves this spec.

## Objective
William, Oct 17: "a knowledge base section on the left-hand side where you can keep track of all the different
questions that come in, and then a spot for me to put in the answer. Once I answer it, it can improve our
knowledge base over time so she can get smarter … Every single day in the auto web-intel channel (my Slack), it
can notify me in the morning at 9:00 am if there are any answers from the previous day that were not answered …
Eventually we'll know how to answer everything."

The loop we ran by hand tonight (every question of the month → folded by meaning → his answer → humanizer
rewrite → his approval → her knowledge), inside the app, running every night on its own.

## What it replaces
- The two artifacts (Knowledge Base, Answer Review) become one page at `/admin/knowledge`.
- The "paste the approved answers into the fact sheet" step in `SPEC-kaitlyn-autopilot.md` goes: approved
  answers live in a table and her prompt reads them from there. The fact sheet keeps WHO WE ARE and the rules.

## Data
`supabase/migrations/032_kaitlyn_knowledge.sql`, additive:
```sql
create table if not exists kaitlyn_kb (
  event_id uuid not null references events(id) on delete cascade,
  key text not null,                       -- slug, e.g. price, crm, pixel; coined by the model for a new question
  question text not null,                  -- the question in plain words (William can edit it)
  answer text,                             -- William's own words
  approved text,                           -- the line she uses: the humanizer rewrite he approved, or his edit of it
  handling text not null default 'open' check (handling in ('open', 'answer', 'me', 'ignore')),
  asked integer not null default 0,        -- how many times the room asked it
  last_asked_at timestamptz,
  answered_at timestamptz, answered_by uuid references team_members(id), approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (event_id, key)
);
alter table kaitlyn_decisions add column if not exists kb_key text;
alter table events add column if not exists kaitlyn_digest_on date;   -- the last day the 9 AM digest went out
```
Seed (a script run once after the migration, not SQL by hand): the 48 approved lines from
`docs/kaitlyn-answers-2026-10-17.md` into `kaitlyn_kb` for `ailg-r` and `test-run`, `answer` = his words from
the Knowledge Base page where he wrote them, `approved` = the line, `handling` = `answer` (`live` = `ignore`),
`asked` = the month's count per question (143 for markets, 24 for price, and so on).

## How a question gets in
- **The model names it.** Her decision JSON gains `"kb": {"key": "<slug>", "question": "<plain words>"}`. The
  prompt's KNOWLEDGE block lists every key with its question (answered and open), so she picks the existing key
  when the meaning matches ("Did you even say the price?" → `price`) and coins a new slug plus a one-line
  question when nothing matches. `parseDecision` checks the slug (lowercase, digits, hyphens, 3 to 40 chars) and
  drops a bad one rather than failing the decision.
- **Every non-skip decision touches the row**: new key → a row with `handling = 'open'`; existing key →
  `asked + 1`, `last_asked_at`. The decision stores `kb_key`. A `skip` never creates a row (chatter is not a
  question).
- **Open means she could not answer it well**: a key whose row has no `approved` line and received an
  `ask_william`, a draft a moderator skipped or edited, or a line of hers a moderator deleted. Keys with an
  approved line only accumulate counts.

## What she knows
`systemPrompt` builds a KNOWLEDGE block from `kaitlyn_kb` for the event at call time: approved answers
(`handling = 'answer'`) as `Q:` / `A:` pairs she rewords to fit the line; `me` keys listed as "always
ask_william, William answers these"; `ignore` keys as "skip". The block is part of the cached system text, so
the API cache only misses when the knowledge changed. The fact sheet stays above it unchanged.

## The page: Admin → Knowledge base
Sidebar item "Knowledge base" with a count of open questions, admins only (moderators read-only later).
Three lists, one card shape:
- **Needs you**: open rows, most asked first, then newest. Card: the question (editable), "asked 12 times by 9
  people, last Oct 17 5:41 PM", the latest five raw asks with name and time (decisions → `chat_messages`),
  what the team replied to those people, her draft if she had one. An answer box and the handling choice:
  she answers it herself / always hand it to me / ignore. Save stores `answer`, `answered_at`, `answered_by`.
- **Waiting for your OK**: answered, not approved. His words on the left, the rewrite on the right in an
  editable box, Approve. The rewrite is one model call at save time with the humanizer rules as the system
  prompt (`src/lib/humanizer-rules.ts`, the MIT SKILL.md text vendored with its attribution, embedded mode:
  final text only) and a check that every number, dollar figure, URL and proper noun in his words survives;
  if one is missing the rewrite is shown with a flag and his words stay the default. Approve stores
  `approved`, `approved_at`; it is live for the next message in the room.
- **Live**: approved rows, searchable, each with the line, asked count, Edit (back to Waiting with a new
  rewrite) and Retire (handling → `me`). "Merge into …" on any card folds a duplicate key into another: its
  decisions move, counts add, the duplicate row goes.
Moderator corrections show on the matching card as context ("Kevin changed her line: … → …"); nothing learns
from them on its own in this version.

## The 9 AM Slack line
`GET /api/cron/kaitlyn-digest`, cron `0 * * * *` (hourly, so daylight saving never moves it). The handler posts
only when it is 9 AM in America/Edmonton and `events.kaitlyn_digest_on` is not today, per event with Kaitlyn on,
through `postToIntel` (the intel channel, `SLACK_INTEL_CHANNEL_ID`, today `C0BNUAWDURL`). The text:
"Kaitlyn couldn't answer 4 questions last night (6 people asked): • Does it text in Spanish? (×3) • Do you
work with Redfin agents? • … Answer them: https://www.bestonlineclassroom.com/admin/knowledge" plus "2 answers
are waiting for your OK" when there are. Counts cover open rows asked since the previous day's 9 AM. Nothing
posts when there is nothing to say. `?dry=1` returns the text without posting, for the production check.

## This repo
`supabase/migrations/032_kaitlyn_knowledge.sql`, `scripts/seed-kaitlyn-kb.mjs` (the 48), `src/lib/kaitlyn.ts`
(the `kb` field, the KNOWLEDGE block, the row upsert), `src/lib/kaitlyn-kb.ts` (+ test: slug check, block
builder, digest text and time rule, the rewrite's fact check), `src/lib/humanizer-rules.ts`,
`src/app/admin/knowledge/page.tsx` + `actions.ts` + `kb-forms.tsx`, `src/app/admin/admin-nav.tsx` and
`layout.tsx` (the item and its count), `src/app/api/cron/kaitlyn-digest/route.ts`, `vercel.json` (the cron),
`src/lib/slack.ts` unchanged (`postToIntel` exists). About eleven files; nothing under `src/components/room/`.

## Testing
- `kaitlyn-kb.test.ts`: slug check accepts `price`, `redfin-agents`, rejects `Price!`, 2 chars, 41 chars;
  KNOWLEDGE block from rows (answer / me / ignore each worded right, empty table → no block); `digestDue(now,
  lastOn)` true only at 9 AM Edmonton once a day across the DST change on Nov 1; digest text with 0, 1 and 4
  questions; the rewrite fact check catches a dropped "$250" and a dropped "getkatherine.ai".
- `kaitlyn.test.ts`: `parseDecision` keeps a good `kb`, drops a bad one, never fails on it; `systemPrompt`
  carries the KNOWLEDGE block when rows are given.
- `node --no-warnings --test src/lib/*.test.ts`, `npx tsc --noEmit`, `npx eslint` on touched files.
- Production on the test webinar with a test seat: a novel question → an open row with a coined key and
  `asked = 1`; answer it on the page → rewrite appears → approve → ask again from the seat → she answers it
  herself (autopilot On on test-run); `?dry=1` on the digest returns the expected text; cleanup as always.

## Rollout
Day 1, with `kaitlyn-autopilot`: the migration, the seed, the KNOWLEDGE block, `kb_key` on decisions. From that
deploy the 48 approved answers are live without touching the fact sheet. Day 2: the page, the rewrite call, the
sidebar item, the digest cron. Both deploys before noon Mountain. Rollback: the table is additive and the
prompt falls back to the fact sheet alone when it is empty.

## Boundaries
- Always: his words are the source; the rewrite never adds a fact, and a flagged rewrite is never approved by
  default; nothing posts in the room from this module, it only changes what she knows.
- Ask first: letting moderators answer (not only approve); learning from moderator edits automatically; a
  second webinar sharing one knowledge base.
- Never: deploy in the window; a destructive migration; a digest to a channel other than the intel channel
  without his say.

## Decisions proposed (say no to any)
1. The knowledge base is per webinar; `test-run` gets a copy of the seed so tests never touch `ailg-r`.
2. The model names the key inside the same decision call; no second call per message.
3. The digest goes to the intel channel at 9 AM Edmonton, once a day, only when there is something to say.
4. The rewrite is one model call with the vendored humanizer rules, with a fact check; a flagged rewrite
   shows his words as the default.
5. Open means "no approved line yet and she needed a human on it"; questions she answered with confidence are
   not listed as needing him, their counts show on the Live list.
6. Moderators see the page read-only for now; admins answer and approve.
