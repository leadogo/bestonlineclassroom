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
2. `src/app/api/register/route.ts`: call `registerWithClassroom` first, then EasyWebinar as today while
   `EASYWEBINAR_PARALLEL=1`. Both results ride in the payload: `easywebinar_join_link` keeps EasyWebinar's link
   (ActiveCampaign's emails use it and William will re-point the Zap later), and a new field
   `classroom_join_link` carries ours. The flag stays on until the Zap is re-pointed.
3. `src/lib/join-link.ts`: `joinHash` becomes `joinToken` (accepts our 12-char token from a
   `${CLASSROOM_URL}/j/<token>` link); `trackedJoinUrl` unchanged in shape (`/join?k=<token>&rid=&sd=`);
   `easyWebinarJoinUrl` becomes `roomUrl(token)`. `calendar-links.ts`'s `isJoinLink` accepts ours.
4. `src/app/join/route.ts`: a 12-char `k` → `302` to `${CLASSROOM_URL}/j/<k>`; a legacy 32-hex `k` (links sent
   before cutover) → `302` to `${CLASSROOM_URL}/w/ailg-r?rid=<rid>&sd=<sd>&src=legacy`. `room_join` is still
   recorded for leadogo either way.
5. `src/app/live/route.ts`: `302` to `${CLASSROOM_URL}/w/ailg-r?src=<src>&eh=<email hash>` (closed → the
   landing page as today). The seat-pool claim and `registerSeat` fallback are removed from this route; the
   pool files stay until a cleanup commit William approves.
6. `src/lib/optin.ts`: no field renamed or repurposed. New fields `classroom_join_link`, `classroom_registered`.
   `join_link_tracked` wraps our link (the thank-you page and calendar entry use it, so those go to our room).
7. Tests: `join-link.test.ts` re-pinned to the token form; a `classroom.test.ts` for the request builder.
8. Env (Vercel + Doppler `futurerealestateagent`): `CLASSROOM_URL=https://bestonlineclassroom.com`,
   `CLASSROOM_REGISTER_SECRET`, `EASYWEBINAR_PARALLEL=1`.

## Rollback
Revert the commit; unset nothing. EasyWebinar is still registering everyone in parallel and its emails still
go out, so a registrant always has a working link.

## Testing
Test Sample opt-in on production: the thank-you page's calendar entry carries `/join?k=<token>…`, clicking it
lands in our room with the name shown; the Zapier task shows the new link in `easywebinar_join_link`; `/live`
opens the room. The old-style link `/join?k=<32 hex>&rid=…` lands in the room's name prompt.

## Boundaries
- Ask first: removing the EasyWebinar module or the pool; any change to the Zap or ActiveCampaign templates.
- Never: change or repurpose a Zapier payload field; turn the parallel flag off before the Zap is re-pointed.

## Decisions (William, 2026-09-20 evening)
1. ActiveCampaign keeps sending EasyWebinar's link for now; William re-points the Zap to `classroom_join_link`
   when ready. Until then the thank-you page, the calendar entry and `/live` are the paths into our room, and
   email clicks still land in EasyWebinar.
2. EasyWebinar's own reminder emails stay on during the parallel run.
3. Found at CP4 (2026-09-20 evening): `CLASSROOM_URL` must be the host that answers without a redirect. The bare
   domain 308-redirected to `www`, and a redirect across hosts drops the `Authorization` header, so the webhook
   saw no bearer (401) and the site fell back to EasyWebinar. The site now calls `https://www.bestonlineclassroom.com`;
   once the bare domain is primary in Vercel either host works (`joinKey` accepts both).

## Success criteria
A Test Sample opt-in at 16:50 MT tomorrow lands in our room at 17:00 through the calendar link, and a Skool
`/live` click at 17:30 lands at minute 30.
