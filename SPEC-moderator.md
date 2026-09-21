# Spec: moderator

Module of [SPEC.md](SPEC.md). Depends on: `chat`, `data-model`. Consumed by: `admin` (phase 2).

## Objective
A teammate signs in, sees the live room's real messages, and replies under a configured name ("Sam from
William's team"), deletes, blocks or reacts. Attendees see the result within one poll.

## Sign-in
Supabase Auth email + password, then, on a device we have not seen, a 6-digit code emailed through Postmark
(`src/lib/twofactor.ts`, 2026-09-20 late): 10 minutes to use it, five tries, one send a minute; a correct code
sets a signed `bc_device` cookie that marks the device trusted for 90 days (`trusted_devices`). Every team
check (`getTeamMember`) requires both the session and the trusted device. Accounts come from `scripts/team-add.ts`; `/login` posts the credentials to a
server action that calls `signInWithPassword` through `@supabase/ssr` and sets the session cookie. Every `/mod`
and `/api/mod` request checks the session user's email is in `team_members`; anyone else gets `/login`.
Sessions last a week. No sign-up page, no password reset tonight (an admin re-runs `team-add` to rotate).

## `/mod`
One screen, works on a phone: the event's current session (or `?date=`), the live stream of real messages
(newest at the bottom, the same 3 s poll, plus the simulated feed switched off by default with a toggle), a
reply box, and per message: delete, react (a fixed set: ❤️ 👍 🔥 😂 👏), block sender. A People strip shows the
real attendees in the last 2 minutes with first names and join times. The moderator's own messages show their
display name.

## `POST /api/mod` (team session required)
```
{ action: "reply", body, offset }           → chat_messages (role moderator, author_name = display_name)
{ action: "delete", id }                    → deleted_at = now, updated_at = now
{ action: "block", registrant_id }          → blocked_at = now; all their messages soft-deleted
{ action: "react", id, emoji }              → reactions[emoji] += 1, updated_at = now
```
Attendee polls pick up deletes and reactions through `updated`.

## This repo
`src/app/login/page.tsx`, `src/app/mod/page.tsx`, `src/app/api/mod/route.ts`, `src/lib/auth.ts`
(`requireTeam(request)` → member or a redirect), `src/lib/moderation.ts` (pure: `applyReaction`, the emoji set).

## Testing
- `src/lib/moderation.test.ts`: reaction increments; unknown emoji rejected; block marks all messages.
- Live: sign in on a phone; reply appears in the attendee room within 3 s under the display name; delete
  removes it there; block stops the Test Sample from posting.

## Boundaries
- Ask first: adding a role beyond "team member"; exposing attendee emails on `/mod` beyond the People strip's
  first names (tonight: first names only; emails arrive with `admin`).
- Never: a moderator action without a team session; a password stored anywhere but Supabase Auth.

## Success criteria
William (`william@leadogo.com`, display name "William") is signed in on his phone before 5 PM and a reply shows
in the attendee room within 3 s. A second teammate is one `team-add` away.
