# Spec: admin

Module of [SPEC.md](SPEC.md). Depends on: `moderator` (team sign-in), `data-model`. Built 2026-09-20 evening
(phase 2, task A1 to A5 in `tasks/plan-phase2.md`).

## Objective
Everything the scripts did tonight, as screens the team uses during the day, without touching the room's data
flow: the event's settings, its video, its simulated chat, its replay copy, the team, and who registered.

## Screens (team only; `/admin/*` redirects to `/login` otherwise)
- `/admin`: the events, each with its next session, and links to settings, registrants and the moderator view.
- `/admin/events/<slug>`: video upload from the browser (straight to Blob, multipart, progress bar; the server
  then checks fast-start and reads the duration before storing the URL, and refuses a file whose index is at the
  end); settings (title, host, start time, timezone, CTA label / link / appears at / hides at, end URL, replay
  window in hours, chapters one per line); simulated chat (CSV import that replaces all messages, the people
  list, remove one name and their messages); replay page copy (every field of `REPLAY_COPY`, blank = default).
- `/admin/events/<slug>/sessions/<date>`: registrants for a session with live minutes, replay minutes, CTA click,
  join and replay links, block / unblock, search by name or email, counts at the top, previous / next day.
- `/admin/team`: members with rename, reset password (shown once), remove; add a member (password shown once).

## Data
- `events.replay_copy jsonb`: overrides merged over `REPLAY_COPY` defaults (`replayCopy()`); the event cache is
  dropped on every save so the room and replay see edits at once.
- No new tables. Uploads use `/api/admin/blob-upload` (team-gated token endpoint) and `setVideo()`.

## Testing
- `src/lib/admin.test.ts`: chapter text round-trip, seconds parsing, names parsing.
- Live (William, CP5): edit the CTA time, see it in a preview; upload a video; add a teammate; block a
  registrant; change a replay headline and see it on `/replay/<token>`.

## Boundaries
- Ask first: a role below "team member"; deleting a registrant; editing testimonials (they must stay verbatim).
- Never: a screen that shows a registrant's phone to someone not on the team; an upload path outside `videos/`.
