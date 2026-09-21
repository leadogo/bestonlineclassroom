# Capability Map: bestonlineclassroom (our webinar platform)

Status: **approved by William 2026-09-20 evening.** Domain `bestonlineclassroom.com`; a new Supabase project William creates; Slack relay kept. Intent confirmed in the spec chat the same
evening. Module specs live next to this file as `SPEC-<module-id>.md`, written in build order.
Verified against `~/orca/futurerealestateagent` (site), `~/orca/leadogo-app` `origin/main` (analytics) and
EasyWebinar event 206685's admin on 2026-09-20.

## Intent (confirmed)
- **Outcome:** our own platform replaces EasyWebinar for the AI For Agents Masterclass. The site's opt-in reaches
  our registration webhook; we store the registrant and return a unique join URL that rides into ActiveCampaign.
  Every day at 5:00 PM Mountain the room plays the MP4 as if live: open chat (simulated CSV + real attendees +
  named moderators), people list, full screen, click for sound, a CTA at exactly 1:15:00 that carries URL
  parameters through to a link we set. Logged-in teammates moderate: reply as a configured name, delete, block,
  react. Zoom's layout and vocabulary from day one; a proper design pass after launch.
- **User:** William and his team. Attendees are real-estate agents who opted in on the site. Nobody else logs in.
- **Why now:** EasyWebinar bounced over 100 people on 2026-09-20; its chat, logging and moderation are unreliable.
- **Success:** tomorrow at 5:00 PM Mountain every join link opens the room at the right offset, the chat feels
  alive, a moderator can reply as "Sam from William's team", the CTA fires at 1:15:00, the numbers are in our DB.
- **Constraint:** live for 2026-09-21's session. Night one runs on ActiveCampaign email and off-platform SMS
  reminders; the platform's own reminders (50 and 30 minutes before, Postmark) are the first thing after launch.
- **Out of scope:** selling to other businesses, billing, tenant isolation, EasyWebinar's integrations tab, polls,
  Q&A, an AI moderator (moderation is human for now).

| Module id | Responsibility | Depends on | Repo | Phase |
|---|---|---|---|---|
| `schedule` | The session rule copied from the site (`daily-schedule.ts`, `tz.ts`, tests): one session a day at the event's start time in its timezone. `roomState(event, now)` → `countdown \| live \| ended` with the session and the offset in seconds. Session length = the video's duration. | — | this | 1 |
| `data-model` | One new Supabase project (Postgres + Auth). Tables: `events` (title, slug, video URL and duration, start time, timezone, CTA at/hide/label/href, end redirect, simulated attendee names), `registrants` (event, session date, first name, email, phone, source, attribution, join token; unique per event + session + email), `attendance` (one row per registrant per session: joined, last seen, seconds watched, params), `chat_messages` (session, author, role attendee/moderator/simulated, body, offset, deleted, reactions), `simulated_messages` (event, offset, name, body), `team_members` (email, display name). Seed script for tonight's event; CSV import for the 754 simulated messages and 110 names. | — | this | 1 |
| `registration-webhook` | `POST /api/register` (bearer secret): name, email, phone, session date, attribution → registrant row → `{ registrant_id, join_url }`. Idempotent: same event + session + email returns the same link. Callable by the site (first, so the thank-you page and calendar carry the link) and by Zapier for any future landing page. | `schedule`, `data-model` | this | 1 |
| `room` | `/j/<token>` (registrant) and `/w/<slug>` (Skool and anyone: asks a first name, creates a guest registrant). Countdown that flips to live without a reload; `<video>` opened at the server-computed offset, autoplay muted, "Click for sound", LIVE pill with elapsed time, full screen; people panel (host + simulated names + real attendees seen in the last 2 minutes); CTA button at the configured offset with the registrant's fields and the room's query params appended to the href; heartbeat every 30 s and a leave beacon into `attendance`; after the end, redirect to the event's end URL. Dark, Zoom-shaped layout: video left, panel right. | `schedule`, `data-model` | this | 1 |
| `chat` | Open room. `POST /api/chat` (token, body; blocked registrants rejected), `GET /api/chat?after=<id>` polled every 3 s returning new messages, deletions and reaction counts. Simulated messages play client-side against the video offset, so a late joiner sees the history up to now. Moderator messages carry the moderator's display name. Optional relay of real messages to #autoweb-chat (existing `Name / Email / Question` format). | `room` | this | 1 |
| `moderator` | Team login by Supabase magic link, allowlisted in `team_members`. `/mod`: the live stream with reply box (posts as the member's display name), delete, block, react (emoji counts shown to everyone), and the real-attendee list. | `chat` | this | 1 |
| `site-cutover` | Site: `/api/register` calls our webhook instead of EasyWebinar (EasyWebinar kept behind a flag for one night of parallel run), `join-link.ts` wraps our join URL so the existing `/join` tracking and calendar entries keep working, `/live` forwards to `/w/<slug>?src=skool&e=…`. Zapier payload field keeps its name so the Zap and ActiveCampaign need no change. Rollback = revert one commit. | `registration-webhook`, `room` | site | 1 |
| `reminders` | Per-event rules (minutes before, subject, body) sent by Postmark from our domain at 50 and 30 minutes before the session, with a send log, bounce and unsubscribe handling. Cron every 5 minutes. | `data-model` | this | 2 |
| `admin` | `/admin`: events list and form (video upload to storage, schedule, CTA, end URL, simulated chat CSV and names, replay copy, chapters, replay window), team members and display names, per-session registrants. Replaces the scripts. Built 2026-09-20 evening; see `SPEC-admin.md`. Reminder rules arrive with `reminders`. | `moderator` | this | 2 |
| `replay` | `/replay/<token>`: the recording with normal controls, `replay` attendance rows, the link for follow-up emails (`classroom_replay_link`). Pulled into phase 1 on 2026-09-20 evening; see `SPEC-replay.md`. | `room` | this | 1 |
| `analytics` | Per session: registrants, attended, missed, show-up rate, watch-time distribution, CTA clicks, chat volume, viewers timeline. Attendance pushed back to the CRM (attended / missed / watched ≥ N%) through a webhook Zapier or ActiveCampaign consumes. `room_join` and friends forwarded to leadogo's ingest so Funnel Performance and the room-count cron keep their numbers. | `attendance` data, `admin` | this + leadogo | 3 |
| `design-pass` | Zoom-faithful UX designed in a tool, then applied to the room without changing its data flow. | `room`, `chat` | this | 3 |
| `ai-moderator` | A persona answering in chat when no human is on; rate-limited; hands off to the human. | `moderator` | this | 3 |

Build order (phase 1, tonight): `schedule` and `data-model` in parallel → `registration-webhook` and `room` in
parallel → `chat` → `moderator` → `site-cutover` (before 5:00 PM Mountain 2026-09-21).
Then `reminders` → `admin` → `replay` (phase 2) → `analytics`, `design-pass`, `ai-moderator` (phase 3).

## Decisions proposed (say no to any)
1. **The site calls the webhook first**, exactly where it calls EasyWebinar today, so the thank-you page and
   calendar entry carry the personal link and the Zapier payload is unchanged. Zapier can call the same endpoint
   for future landing pages.
2. **A new Supabase project** for this app (database and team auth), separate from leadogo's. Migrations are SQL
   files, pushed with the Supabase CLI.
3. **The MP4 is served as one progressive file from Vercel Blob** (remuxed with faststart, ~0.5 Mbps so phones
   cope). No HLS vendor for launch; Cloudflare R2 is the fallback if transfer cost bites.
4. **Chat polls every 3 s; simulated chat is played in the browser** from the list loaded at room open. Upgrade
   to Supabase Realtime only if the 3 s lag is felt.
5. **Team login is email + password** (accounts created by script, password shown once), because Supabase's
   built-in mailer allows only a couple of emails an hour. The allowlist is the `team_members` table.
6. **Join URL is `/j/<token>`**, a random unguessable token per registrant. The Skool link `/w/<slug>` asks for
   a first name and creates a guest registrant so the person can chat and be counted.
7. **After the end**, the room redirects to the event's end URL (tonight: the booking page
   `aiforagentsmasterclass.com/join-community-expired`, as EasyWebinar is configured).
8. **Session length = the video's duration** (02:19:45 today). Countdown before, redirect after.
9. **Tonight's event is seeded by a script**; the admin UI that replaces it is phase 2.
10. **Same conventions as the site**: Next 16, React 19, Tailwind 4, TypeScript strict, `node --test`, no test
    framework, no dependency added without asking, Test Sample identities for anything live.

## Inputs (William, 2026-09-20 evening)
1. MP4: `~/Downloads/1786148398463-AILG-Recording-QR-Fix.mp4`, 1.20 GB, `moov` before `mdat` (no remux needed),
   duration 8385.9 s (139m46s), about 1.15 Mbps. William wants a browser upload in `/admin` later.
2. Simulated chat: `~/Downloads/easywebinar_chat_fixed (1).csv`, columns `HH:MM:SS,Name,Role,Message`, 754
   rows, 109 distinct names (the attendee list is derived from them).
3. Supabase project `lcgzfljpzinucbgjpswr`, reached through the Supabase MCP server registered in `.mcp.json`
   (William authenticates it with `/mcp`). The service-role key goes into `.env.local` and Vercel by William.
4. Slack: the site's persona bridge (`BMS_OPS_URL` + `LARRY_BRIDGE_SECRET`, `src/lib/slack-brandon.ts`), posting
   to #autoweb-chat `C0BP5KW3J75`. Secrets copied from Doppler `futurerealestateagent`.
5. Team tonight: William only, `william@leadogo.com`, display name "William".
6. Vercel project and the `bestonlineclassroom.com` DNS record: William connects them once the repo is pushed.

## Cost note (decision 3)
1.2 GB × every viewer who watches to the end is roughly 1 to 2 TB of transfer a month at today's attendance.
Check the Blob transfer line on the first invoice; Cloudflare R2 (no egress fee) is the switch if it bites, and
the room only needs a new `video_url`.

## Facts checked 2026-09-20 evening
- `bestonlineclassroom.com` was registered today (NameCheap, DNS on Cloudflare). Vercel needs one CNAME or A
  record there; the join links use it from the first registrant.
- Local tools: Node 24, npm 11, Supabase CLI 2.84, Vercel CLI 59.5, Doppler. No ffmpeg (needed only if the MP4
  lacks a faststart `moov` atom; checked by script before upload).
- The site's EasyWebinar call returns `{ ok, joinLink, replayLink, key, loginLink }`, and the Zapier payload
  carries `easywebinar_join_link`, `join_link_tracked`, `easywebinar_replay_link`, `easywebinar_registration_key`.
  Our webhook fills the same shape so the Zap and ActiveCampaign see no change.
- Supabase's built-in auth mailer is rate-limited to a couple of emails an hour, so **team login is email +
  password** (accounts created by script, password shown once), not a magic link. Decision 5 revised.

## Shared conventions (module specs inherit these)

**Commands**
```
Dev:      npm run dev
Build:    npm run build
Lint:     npm run lint
Test:     npm test                                  # node --test src/lib/*.test.ts
DB:       supabase db push                          # migrations in supabase/migrations/NNN_<name>.sql
Seed:     npm run seed -- --event ailg-r            # scripts/seed-event.ts, idempotent
Import:   npm run import:chat -- --event ailg-r --file <csv>   # scripts/import-chat.ts
Video:    npm run upload:video -- --file <mp4> --event ailg-r  # scripts/upload-video.ts (checks faststart, uploads to Blob, stores URL + duration)
Team:     npm run team:add -- --email <e> --name "Sam from William's team"
Deploy:   git push (Vercel project bestonlineclassroom, team leadogo); env in Vercel + .env.local
```

**Dependencies** (the whole list; anything else is ask-first): `next`, `react`, `react-dom`, `tailwindcss`,
`@supabase/supabase-js`, `@supabase/ssr`, `@vercel/blob`, `typescript`, `eslint`, `eslint-config-next`.

**Project structure**
```
src/app/j/[token]/page.tsx        → the room for a registrant
src/app/w/[slug]/page.tsx         → the room for a Skool click or a legacy link (name prompt → guest)
src/app/api/register/route.ts     → registration webhook (bearer)
src/app/api/chat/route.ts         → GET poll, POST send
src/app/api/heartbeat/route.ts    → attendance heartbeat and leave beacon
src/app/api/cta/route.ts          → cta click
src/app/api/people/route.ts       → real attendees seen in the last 2 minutes
src/app/api/simulated/route.ts    → the event's simulated messages (cached)
src/app/api/mod/route.ts          → moderator actions (reply, delete, block, react)
src/app/login/page.tsx            → team sign-in
src/app/mod/page.tsx              → moderator view
src/lib/                          → pure logic and integrations; tests as src/lib/<name>.test.ts
src/lib/daily-schedule.ts, tz.ts  → copied from the site, unchanged where possible
src/components/room/              → Room, VideoStage, ChatPanel, PeoplePanel, CtaBar; one component per file
supabase/migrations/              → SQL, sequential
scripts/                          → seed-event, import-chat, upload-video, team-add
```

**Code style.** Same as the site: a doc comment stating the rule in one paragraph, named exports, no classes,
no default exports outside Next conventions, Tailwind inline, copy in a content module, env read once at module
top with a documented default. Server code talks to Supabase with the service-role client in `src/lib/db.ts`;
the browser never holds a Supabase key.

**Testing strategy.** Pure logic gets a `node:test` file next to it pinning the instants and offsets that matter
(`roomState`, tokens, CTA href, simulated-chat cursor, chat poll cursor, heartbeat accounting). Routes get one
live check each with the Test Sample identity (`*-test-sample@thefuturerealestateagent.com`, `source = test`,
never counted). The room gets a team-only preview (`/w/<slug>?at=<seconds>` when signed in) checked on a phone
and a laptop before 5:00 PM Mountain. No test framework, no mocks of third parties.

**Boundaries**
- Always: `npm test` and `npm run lint` before a commit; read `node_modules/next/dist/docs/` before writing Next
  code; Test Sample identities for anything that reaches the site, Zapier, ActiveCampaign or Slack; mask email
  and phone in logs; RLS on every table with no policies (service role only).
- Ask first: any dependency beyond the list; any change to Zapier, ActiveCampaign or the site beyond
  `site-cutover`; deleting the EasyWebinar path from the site; anything that costs money.
- Never: commit secrets or the chat CSV; print a key; register a real person during a test; block the viewer's
  video on chat, heartbeat or Slack; expose another attendee's email or phone in the room; fire Meta pixel
  events from this app.
