# Spec: site-cutover

Module of [SPEC.md](SPEC.md). Depends on: `registration-webhook`, `room`. Repo: `~/orca/futurerealestateagent`.

## Objective
The site keeps doing everything it does today, with our platform in EasyWebinar's seat: every opt-in is
registered with us and every link the site hands out opens our room. The Zapier payload keeps its field names.
One commit, one revert.

## Changes (the whole list)
1. `src/lib/classroom.ts` (new): `registerWithClassroom(input, session)` posts to
   `${CLASSROOM_URL}/api/register` with `CLASSROOM_REGISTER_SECRET`, 3 s timeout, one retry, and returns the
   existing `RegisterResult` shape: `{ ok: true, joinLink: join_url, replayLink: "", key: token, loginLink: "" }`
   or `{ ok: false, error }`.
2. `src/app/api/register/route.ts`: call `registerWithClassroom` where `registerAttendee` is called. EasyWebinar
   is still called afterwards while `EASYWEBINAR_PARALLEL=1` (result logged, not used), so the EasyWebinar event
   keeps its registrant count for a few days; unset the flag to stop.
3. `src/lib/join-link.ts`: `joinHash` becomes `joinToken` (accepts our 12-char token from a
   `${CLASSROOM_URL}/j/<token>` link); `trackedJoinUrl` unchanged in shape (`/join?k=<token>&rid=&sd=`);
   `easyWebinarJoinUrl` becomes `roomUrl(token)`. `calendar-links.ts`'s `isJoinLink` accepts ours.
4. `src/app/join/route.ts`: a 12-char `k` → `302` to `${CLASSROOM_URL}/j/<k>`; a legacy 32-hex `k` (links sent
   before cutover) → `302` to `${CLASSROOM_URL}/w/ailg-r?rid=<rid>&sd=<sd>&src=legacy`. `room_join` is still
   recorded for leadogo either way.
5. `src/app/live/route.ts`: `302` to `${CLASSROOM_URL}/w/ailg-r?src=<src>&eh=<email hash>` (closed → the
   landing page as today). The seat-pool claim and `registerSeat` fallback are removed from this route; the
   pool files stay until a cleanup commit William approves.
6. `src/lib/optin.ts`: no field renamed. `easywebinar_join_link` now carries our link, `join_link_tracked`
   wraps it, `easywebinar_replay_link` is "" until `replay` ships. `easywebinar_registered` reflects our call.
7. Tests: `join-link.test.ts` re-pinned to the token form; a `classroom.test.ts` for the request builder.
8. Env (Vercel + Doppler `futurerealestateagent`): `CLASSROOM_URL=https://bestonlineclassroom.com`,
   `CLASSROOM_REGISTER_SECRET`, `EASYWEBINAR_PARALLEL=1`.

## Rollback
Revert the commit; unset nothing. EasyWebinar was still registering everyone in parallel.

## Testing
Test Sample opt-in on production: the thank-you page's calendar entry carries `/join?k=<token>…`, clicking it
lands in our room with the name shown; the Zapier task shows the new link in `easywebinar_join_link`; `/live`
opens the room. The old-style link `/join?k=<32 hex>&rid=…` lands in the room's name prompt.

## Boundaries
- Ask first: removing the EasyWebinar module or the pool; any change to the Zap or ActiveCampaign templates.
- Never: change a Zapier payload field name; ship without the parallel flag on for the first night.

## Open questions
1. Which field do the ActiveCampaign emails use for the join link, `easywebinar_join_link` or
   `join_link_tracked`? Registrants from before cutover hold EasyWebinar links in their inbox either way; the
   parallel run covers them for as long as it stays on.
2. Keep EasyWebinar's own reminder emails on during the parallel run (they carry EasyWebinar links) or switch
   them off tonight so only ActiveCampaign's go out?

## Success criteria
A Test Sample opt-in at 16:50 MT tomorrow lands in our room at 17:00 through the calendar link, and a Skool
`/live` click at 17:30 lands at minute 30.
