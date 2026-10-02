# Plan: phase 7, the client wall (proposed 2026-10-01; awaiting approval; no code until then)

Guardrails as phase 5. Room-lane tasks are marked; each gets the test-run walk before a morning deploy.

## 7.0 wall-sync + wall-trigger (desk + DB)
- [ ] W1 Migration 028: `client_wall`, `registrants.block_reason` (backfill `mod`), `events.open_link_field`,
      `events.open_link_email_since`, trigger `registrants_client_wall()` (never raises).
      Verify: `npm run db:migrate`; insert tests in `src/lib/client-wall.test.ts` against prd-shaped seed.
- [ ] W2 `src/lib/client-wall.ts`: normalizer (emails, hashes, phones) + flag/unflag statements; `POST /api/client-wall`
      (Bearer REGISTER_SECRET). Verify: tests; curl with a two-row snapshot; `{clients, flagged, released}`.
- [ ] W3 bms-dashboard `app/api/cron/classroom-client-wall/route.ts` + vercel.json `*/30 * * * *` +
      `CLASSROOM_WALL_SECRET` in Doppler bms-dashboard prd. Verify: dry-run flag → counts; first real run flags ~50.
- [ ] CP-1 `/admin/blocked` shows the flagged rows; the two moderator blocks keep `mod`; canary still green.

## 7.1 wall-page + open-link-email (room lane, one walk)
- [ ] W4 `j/[token]`: client 404 page (HTTP 404, plain copy), `link_clicks` outcome `walled`, intel line.
- [ ] W5 `replay/[token]`: `blocked_at` check (client → 404, mod → Removed).
- [ ] W6 Settings toggle `open_link_field`; card renders the email field when on; `/api/guest` takes `email`, derives
      the name when blank. Tests for the route and the name derivation.
- [ ] W7 Test-run walk: seeded client email → 404 on join and replay; normal registrant fine; card with the switch on
      on William's phone; Block button still says removed. Then morning deploy; flip the switch for ailg-r before 3:30.

## 7.2 wall-monitor + wall-visibility (desk)
- [ ] W8 `src/lib/open-link.ts` rate/baseline/verdict (+ tests with the Sep 23 / Sep 27 numbers);
      `GET /api/cron/open-link-report` at `50 1 * * *`; vercel.json entry.
- [ ] W9 Desk Attendees chip "client"; `/admin/blocked` Clients section with last sync; canary check "client wall".
- [ ] W10 `/api/metrics` opt-ins exclude `block_reason = 'client'` (tracker and Brandon follow).
- [ ] CP-2 First 7:50 PM post reads right; review after three blast nights; decide whether the field stays.
