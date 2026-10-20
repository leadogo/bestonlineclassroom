# Plan: kaitlyn-ghosts (William's go, Oct 20 2026 ~11 AM MT: "update the spec, then /plan /build /test /review")

Spec: `SPEC-kaitlyn-ghosts.md`; evidence: `docs/kaitlyn-ghost-audit-2026-10-20.md`. One commit per task, tests first.
Deploy before 3:30 PM MT today (tonight's session is 5 PM; nothing deploys in the 3:30 to 7:45 window). The Oct 17 plan
is now `tasks/plan-kaitlyn-autopilot.md`.

## Overview
Fix last night's five misses, make Kaitlyn answer ghosted people privately and ghost the way William does (acting when
sure, trained by his by-hand ghosts), surface replies to the person in the room, change the roll-call minute, and put the
audit in the morning digest. Every rule is pure and tested; every behaviour is checked on test-run with real seats.

## Architecture decisions
- **Views, not tables, for training data** (migration 038): `kaitlyn_corrections` gains `edited` rows; `kaitlyn_ghosts`
  derives the trigger line of each by-hand ghost from `chat_messages.visibility` and `registrants.ghosted_at`. Nothing to
  keep in sync; Unghost drops the row by itself.
- **`sure` rides on every decision.** A ghost the model is sure of acts in assisted, auto and under autopilot; an unsure
  one is a desk card, as today. The never-ghost list stays in the prompt and in the eval's must-not set.
- **The per-person window keys on the knowledge key**, not on time alone: a repeat of the same question holds 120 s; a
  different question, or an answer to her own question, posts after the normal pause.
- **Ghosted people are ordinary people to Kaitlyn**; privacy is `visible_to` at post time (already there), not a branch.
- **The room keeps the chat panel mounted when hidden** so the poll keeps running and a reply can raise the pill.
- **Roll-call answers are rate-limited before the pitch** (one city line per 30 s room-wide; `ponytail:` a global slot,
  per-minute budget if it ever matters) so minute 0 does not become ten Kaitlyn lines.
- **The audit script uses the Management API read-only** like `scripts/migrate.ts`, because the SQL needs CTEs that
  supabase-js cannot express.

## Task list

### Phase 1: foundations and last night's misses
- [x] T1 Migration 038: `kaitlyn_corrections` + `edited`; view `kaitlyn_ghosts`; applied.
- [x] T2 `kaitlyn.ts` tune: window by key (A1), "honestly," out and a shapes-vs-tells test (A2), "see you on the call" out (A6).
- [x] T3 Hand-off on an idle desk (A3): pending 90 s with no moderator reply or action → the line, once per person.
- [x] T4 Eval set + script: `ghost` class from the view (40 triggers with prior lines) + 10 must-nots; baseline run saved.

### Checkpoint 1
- [ ] `npm test`, `npm run lint`, `npm run build` clean; baseline eval written to `docs/kaitlyn-eval-before-ghosts.md`.

### Phase 2: ghosting the way he does
- [x] T5 B0: Kaitlyn runs for ghosted people; private posts; "(ghosted)" on the desk card and the Slack line.
- [x] T6 B1 + B2: the ghost bullet from the audit; `sure` on decisions; sure ghosts act; private line + intel Slack for a client complaint.
- [x] T7 B3: `kaitlyn_ghosts` → GHOSTED block in the prompt; the static list leaves `kaitlyn-examples.ts`.
- [x] T8 B4: the reason chip on the desk's Ghost (message row and people row); the decision row marked.

### Checkpoint 2
- [ ] Tests, lint, build clean; eval after: ghost recall ≥ 80%, 0 false ghosts, answer/market/skip not below the Oct 19 run.

### Phase 3: the room, the roll-call, the audit
- [x] T9 C: reply-to-you scroll + flash in the chat; the pill when the chat is hidden or on the People tab.
- [x] T10 D + A5: the roll-call rule with its rate; the KB rows (SQL, recorded here); Katherine's minute-2 line on ailg-r and test-run.
- [x] T11 E1 + E2: `scripts/kaitlyn-audit.ts`; two digest lines; dry run against production.

### Checkpoint 3: production
- [x] T12 Deployed before noon MT; eight checks on test-run with five seats (see tasks/todo.md); rows cleaned. William's phone walk still his.
- [ ] T13 `/review` over the diff; fixes; docs (`docs/kaitlyn-eval.md`, `tasks/todo.md`, memory).

## Tasks

### T1 Migration 038 (S)
`supabase/migrations/038_kaitlyn_ghosts.sql`: recreate `kaitlyn_corrections` with `d.status in ('fixed','deleted','edited')`
and `said = case when status='edited' then d.text else sent_body…`, `fixed = case when status='edited' then sent_body else
improved_text`; create `kaitlyn_ghosts` (security_invoker, revoked from anon/authenticated): one row per ghosted registrant
(not test, `auto_ghost_reason is null or like 'by hand%'`): `trigger` = the first `visibility='author'` attendee line at or
before `ghosted_at` else the last line before it, `before` = their two lines before the trigger, `reason` (the chip or
null), `ghosted_at`, `event_id`.
- Acceptance: `select count(*) from kaitlyn_corrections where status='edited'` ≥ 3 (Oct 19); `kaitlyn_ghosts` returns ~40 rows with Hamid's "I am surprised…" and Grant's "I can't get an answer".
- Verify: `npm run db:migrate`; two read-only selects through the scratchpad helper.

### T2 kaitlyn.ts tune (S)
Pure helper `holdsReply(last: {kb_key, text} | null, next: {kb_key}, ageMs)`: true only when `ageMs < PER_PERSON_MS` and the
keys match and her last line to them did not end with "?". `takenBy` uses it (reads her last auto row to that person).
Prompt: "honestly," removed from the price lead-ins; "booked, see you on the call" removed. Test: every shape string in the
VARIETY block passes `tells()`; the three Oct 19 sequences hold or post as the spec says.
- Verify: `npm test`.

### T3 Hand-off on an idle desk (S)
`handoff`: after the pause, post unless (a) a moderator line to them exists, (b) the decision is no longer pending, or
(c) a prior hand-off tonight; the presence check becomes "the desk acted", not "the desk polled". The 90 s is the pause
floor for this line. Pure helper `handoffNow(...)` + test.
- Verify: `npm test`; production check on test-run with the desk open in a background tab.

### T4 Eval set and script (S)
Scratchpad script reads `kaitlyn_ghosts` → 40 items `{key:"ghost", expected:"ghost", body, minute, prior:[…]}` + 10
must-nots hand-written → appended to `docs/kaitlyn-eval-set.json`. `scripts/kaitlyn-eval.ts`: `prior` → `priorOwn`, a
`ghost` group (ok when action is ghost), the GHOSTED block read from the view (T7 lands the block; before that the script
passes none). Baseline run (current prompt) → `docs/kaitlyn-eval-before-ghosts.md`.
- Verify: the run completes; the ghost row shows today's recall (expected near 0).

### T5 B0 ghosted people (S)
`chat/route.ts`: Kaitlyn's call no longer gated on `!ghosted`; `reg.ghosted` passed. `kaitlyn.ts`: `priorOwn` from their
own lines regardless of visibility; the Slack "needs you" line prefixed "(ghosted)"; the ghost branch on an already
ghosted person only records the decision. Desk card: "ghosted" chip from the people list.
- Verify: production, a ghosted seat asks the price and a market → both answered to that seat only; the second seat sees neither.

### T6 B1 + B2 rules and acting (M)
PERSONA ghost bullet rewritten (the eight cases and the never-list, SPEC B1). `Decision.sure`; `parseDecision` keeps a
ghost's text as its private line (guarded like a reply; a tell drops the text, not the ghost); `ghostsItself` = ghost and
sure and mode in assisted/auto. After a sure ghost: the private line posts via `postAsKaitlyn` (visible_to), and for
category `support` one `postToIntel` line with name and email. Tests for `parseDecision` and `ghostsItself`.
- Verify: `npm test`; eval after T7.

### T7 B3 live ghost block (S)
`ghostBlock(rows)` in `kaitlyn-kb.ts` (+ test); `systemPrompt(..., ghosts)`; `kaitlynHandle` and the eval read the view
(newest 40). `EXAMPLES.ghosts` and its type leave `kaitlyn-examples.ts`; the prompt test updates.
- Verify: `npm test`; eval: ghost recall ≥ 80%, 0 false ghosts.

### T8 B4 reason chip (S)
`mod-view.tsx`: Ghost (message row, people row) opens a chip row: live test · price · nag · sneer · client · not a prospect ·
other; a tap ghosts with `reason`. `mod/route.ts` `case "ghost"`: `auto_ghost_reason = "by hand: <chip>"`, the decision for
that message (or the person's latest tonight) set `ghosted` + `decided_by`; Unghost clears the reason.
- Verify: production on test-run: ghost with "price" → the people row shows it; `kaitlyn_ghosts` carries it.

### T9 C reply-to-you (M)
`ChatPanel`: a polled row with `mentionsMe` → if not at bottom, scroll to it and flash (one keyframe class); call
`onReplyToMe(name)`. `Panel`: pass-through, badge as today. `Room`: Panel stays mounted with `hidden` when `chatHidden`;
a pill over the video "Kaitlyn replied to you · Show chat" for 30 s; tap → unhide, scroll. Also on the People tab.
- Verify: Chrome mobile emulation on test-run (chat hidden, scrolled up, People tab); William's phone.

### T10 D + A5 (S)
`kaitlyn.ts`: the markets-and-the-clock rule: a bare city before the pitch gets the count (one line per person; room-wide
one city line per 30 s, others skip with why "roll-call slot"); the "answering him on screen" rule excepts cities. KB rows by
SQL (recorded in this file when run): `no-sound-after-refresh` answered + approved, `who-are-you` ignore, `thanks` ignore,
`other-industries` approved text with the mortgage line, `offer` + "the first 10 who book get Katherine included free".
`events.prompts` minute-2 text on ailg-r and test-run.
- Verify: `npm test` (the slot helper); production: two seats drop cities at minute 1 → first answered, second within 30 s skipped with the slot reason.

### T11 E1 + E2 audit (M)
`scripts/kaitlyn-audit.ts` (Management API, read-only, `--from`, `--out`), `npm run kaitlyn:audit`. `digestText` gains
`unanswered: string[]` and `ghosted: Array<{name, reason}>` (+ test); the cron computes last night's from
`kaitlyn_decisions` (pending reply/ask_william, no moderator mention in 15 min) and `registrants` (ghosted last night, by hand).
- Verify: `npm run kaitlyn:audit -- --from 2026-10-11` reproduces the audit's per-night table; digest `?dry=1&force=1` on production shows the two lines.

### T12 Production (checkpoint)
Deploy; checks on test-run: (1) OC sequence, (2) price push ghost + Unghost, (3) nag → re-point → ghost, (4) ghosted seat
answered privately, (5) hidden-chat pill; (6) the hand-off with a background desk tab. Rows cleaned. Report to William
with what to click.

### T13 Review and docs
`/review` over the diff (fresh-context reviewer); fixes committed; `docs/kaitlyn-eval.md` updated with before/after;
`tasks/todo.md`; memory.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| The rewritten ghost bullet moves answer/market behaviour | High | Eval before/after on all four classes; revert is one commit |
| A sure ghost lands on honest feedback | High | The never-list in the prompt, the 10 must-nots in the eval, Unghost one tap, Slack line on every ghost |
| Window-by-key double-answers one person | Med | Same key still holds 120 s; test on the three Oct 19 sequences |
| Ten Kaitlyn city lines at minute 0 | Med | Room-wide 30 s slot; one line per person |
| The pill annoys | Low | 30 s auto-hide, once per reply, only when the row is not visible |
| The chat panel mounted while hidden costs polls | Low | The poll already stops on hidden tabs; one more fetch per 3 s on an open phone |
| Deploy after 3:30 PM MT | High | Phase 3 cuts to T9 + T11 if the clock runs out; T10's data part is SQL and can go any time |

## T10 data, applied Oct 20 2026 ~12:40 PM MT (revert = the inverse statements below, or the Knowledge page / Settings)
- `kaitlyn_kb` (ailg-r): `no-sound-after-refresh` → answer "try another browser or open your join link on your phone, and tap the video once for sound" (approved); `who-are-you`, `thanks` → handling ignore; `other-industries` approved += "More than ten mortgage agents use it too: they handle the pre-approvals first and share the leads with a partner agent."; `offer` approved += "It's for the first 10 who book."
- `events.prompts` (ailg-r) minute 2: "Drop your city in the chat so William can shout out your market 👇" → "Drop your city in the chat 👇 the team checks how many agents we have near you" (test-run has no minute-2 line).
