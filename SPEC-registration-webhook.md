# Spec: registration-webhook

Module of [SPEC.md](SPEC.md). Depends on: `schedule`, `data-model`. Consumed by: the site (`site-cutover`),
Zapier for future landing pages.

## Objective
One endpoint turns an opt-in into a registrant with a unique join link, in the shape the site's Zapier payload
already carries, so the thank-you page, the calendar entry and ActiveCampaign all get the link with no change
downstream.

## Contract
`POST /api/register`, header `Authorization: Bearer REGISTER_SECRET`, JSON:
```
{ event: "ailg-r", first_name, email, phone?, session_date?: "YYYY-MM-DD", registration_id?: uuid,
  source?: "site" | "zapier", attribution?: { utm_*, referrer, page_path, ... ≤ 20 keys, ≤ 200 chars each } }
```
Response `200`:
```
{ registrant_id, token, join_url: "https://bestonlineclassroom.com/j/<token>", replay_url: "",
  session_date, session_start_iso, session_end_iso }
```
- `session_date` defaults to `nextSession(now)` for the event (an opt-in at 17:01 MT is for tomorrow).
- Idempotent on `(event, session_date, lower(email))`: a retry returns the existing token.
- Test identities (`*-test-sample@thefuturerealestateagent.com`) get `source = "test"` and are never counted.
- `401` wrong bearer, `404` unknown event, `422` missing first name or bad email, `500` on DB failure with no
  body detail. Responds within 1 s (one upsert).
- Token: 12 chars from `crypto.randomBytes`, base32 without look-alikes, unique by table constraint.

## This repo
- `src/app/api/register/route.ts`; `src/lib/registrants.ts` (`upsertRegistrant`, `newToken`, `emailHash`
  copied from the site's `email-hash.ts`); `src/lib/events.ts` (`getEvent(slug)`, cached for 60 s in module
  scope).

## Testing
- `src/lib/registrants.test.ts`: token alphabet and length; email normalisation; attribution allowlist and caps;
  test identity detection.
- Live: `curl` with the Test Sample identity twice → same token; wrong bearer → 401; the row shows `source = test`.

## Boundaries
- Never: return another registrant's token for a different email; accept an event slug not in `events`.

## Success criteria
The site's register route, pointed at this endpoint, puts a `bestonlineclassroom.com/j/…` link in the Zapier
payload and on the thank-you page for a Test Sample opt-in.
