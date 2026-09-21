# Spec: chat

Module of [SPEC.md](SPEC.md). Depends on: `room`. Consumed by: `moderator`, later `analytics` and `replay`.

## Objective
An open chat that feels like a full room: the simulated messages stream in on the video's clock, real attendees
see each other and the moderators, and every real message reaches Slack in the format the team already reads.

## Data flow
- **Simulated**: `GET /api/simulated?event=<slug>` returns all rows `{ offset_seconds, name, body }` ordered,
  `Cache-Control: public, max-age=3600`. The room keeps a cursor: every second it appends rows with
  `offset_seconds ≤ current offset`. A late joiner therefore sees the history up to now on open (rendered at
  once, scrolled to the bottom), then the live trickle. Simulated rows are never written to `chat_messages`.
- **Real**: `POST /api/chat { token, body, offset }` → `chat_messages` (`role = attendee`, `author_name =
  first_name`). Limits: 1 to 500 chars, one message per 2 s per registrant (checked against the last row),
  blocked registrants get `403 { error: "Chat is unavailable." }`. Also relayed in `after()` to
  Slack through the same persona bridge the site uses (`BMS_OPS_URL/api/internal/persona-post`, bearer
  `LARRY_BRIDGE_SECRET`, persona `SLACK_PERSONA`, channel `SLACK_CHAT_CHANNEL_ID` = `C0BP5KW3J75`) as
  `<first_name> / <email or "guest"> / <body>`; failure logged, never surfaced.
- **Poll**: `GET /api/chat?token=&after=<id>&since=<iso>` every 3 s →
  `{ new: [{ id, author_name, role, body, offset_seconds, reactions, created_at }], updated: [{ id, reactions,
  deleted }], now }`. `new` = rows with `id > after` and `deleted_at is null`; `updated` = rows with
  `updated_at > since` (a delete or a reaction). The first poll uses `after = 0` and gets the session's history
  (capped at the last 300 rows). Responses are `Cache-Control: no-store`.
- Real and simulated messages interleave in one list ordered by the time they appeared on this client. A
  moderator message shows the display name with a small "Moderator" tag; simulated and attendee messages look
  identical (avatar initials, name, time).

## UI
The Chat tab of the right panel: message list, composer at the bottom ("Type your message here…"), send on
Enter, 500-char cap with a counter past 400, unread badge on the tab when hidden. Reactions render as small
emoji + count under a message (set by moderators only tonight).

## This repo
`src/app/api/chat/route.ts`, `src/app/api/simulated/route.ts`, `src/components/room/ChatPanel.tsx`,
`src/lib/chat.ts` (`simulatedCursor(rows, offset, lastIndex)`, `mergeUpdates(list, updated)`, `canPost(lastAt,
now)`, `slackLine(...)`), `src/lib/slack.ts` (the site's `postAsBrandon` with the channel and persona from env).

## Testing
- `src/lib/chat.test.ts`: cursor returns exactly the rows crossed since the last tick and all history on the
  first call; a delete removes the row and a reaction updates in place; the 2 s rule; the Slack line masks
  nothing but never includes the phone.
- Live: post as Test Sample → appears in a second browser within 3 s and in #autoweb-chat; blocked registrant
  gets 403.

## Boundaries
- Never: send the simulated messages to Slack; block the video on a chat failure; accept a post without a valid
  token; expose an email in the poll response.

## Success criteria
Two phones side by side see the same stream; a message sent on one shows on the other within 3 s; the
simulated chat is at the same point as the video on both.
