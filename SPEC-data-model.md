# Spec: data-model

Module of [SPEC.md](SPEC.md). Depends on: nothing. Consumed by: every other module.

## Objective
One Supabase project holds everything: the event configuration that the admin UI will edit later, every
registrant with a unique join token, attendance per session, the chat, the simulated chat, and the team. Tonight
it is filled by three scripts; phase 2 replaces them with `/admin` without touching the tables.

## Tables (`supabase/migrations/001_init.sql`)
```sql
events        id uuid pk, slug text unique, title, host_name (default 'William Kabrall'),
              timezone text default 'America/Edmonton', start_time time default '17:00',
              video_url text, video_seconds int, cta_at_seconds int, cta_hide_seconds int, cta_label text,
              cta_href text, end_url text, simulated_names text[] default '{}', created_at
registrants   id uuid pk, event_id fk, session_date date, token text unique, first_name, email (null for
              guests), email_hash text (sha256 of trimmed lowercase email, '' for guests), phone, source text
              ('site' | 'zapier' | 'skool' | 'legacy' | 'guest' | 'test'), site_registration_id uuid,
              attribution jsonb default '{}', blocked_at timestamptz, created_at
              unique (event_id, session_date, email) where email is not null; index (event_id, session_date, email_hash)
attendance    registrant_id fk, session_date, kind text default 'live' ('live' | 'replay'), joined_at,
              last_seen_at, seconds_watched int default 0, max_offset int default 0, params jsonb default '{}',
              cta_clicked_at timestamptz; pk (registrant_id, session_date, kind)
chat_messages id bigserial pk, event_id, session_date, registrant_id null, team_member_id null,
              author_name, role text ('attendee' | 'moderator'), body, offset_seconds int,
              reactions jsonb default '{}' (emoji → count), deleted_at, created_at, updated_at
              index (event_id, session_date, id); index (event_id, session_date, updated_at)
simulated_messages  id serial, event_id, offset_seconds int, name, body; index (event_id, offset_seconds)
team_members  id uuid pk (= auth.users.id), email unique, display_name, created_at
```
RLS enabled on all six with no policies: only the service role reads or writes, always from server code.
Time columns are `timestamptz`; `session_date` is the event's local calendar date.

## Scripts (idempotent, `tsx`-free: plain `node --experimental-strip-types` or compiled by Next's toolchain)
- `scripts/seed-event.ts --event ailg-r`: upserts tonight's event: title "AI For Agents Masterclass",
  17:00 America/Edmonton, CTA "Book your call" at 4500 s (1:15:00) hidden at 8259 s (2:17:39, as EasyWebinar),
  href `https://aiforagentsmasterclass.com/join-community`, end URL
  `https://aiforagentsmasterclass.com/join-community-expired`. Video URL and seconds come from the upload script.
- `scripts/upload-video.ts --file <mp4> --event ailg-r`: reads the first MB to confirm the `moov` atom precedes
  `mdat` (else stops and says to remux with `ffmpeg -movflags +faststart`), reads the duration from `mvhd`,
  uploads with `@vercel/blob` `put(..., { access: "public", multipart: true })`, stores `video_url` and
  `video_seconds` on the event.
- `scripts/import-chat.ts --event ailg-r --file <csv>`: parses the EasyWebinar CSV (timestamp `mm:ss` or
  `h:mm:ss`, name, role, message), replaces the event's `simulated_messages`, and sets `simulated_names` from the
  distinct names (William's 110-name list can be passed with `--names <file>` instead).
- `scripts/team-add.ts --email <e> --name "<display>"`: creates the auth user with a generated password (printed
  once, never stored by us) and the `team_members` row.

## Testing
- `src/lib/csv.test.ts`: the three timestamp shapes, quoted commas, a blank line, order by offset.
- `src/lib/mp4.test.ts`: `moov` before `mdat` detected on a synthetic header; duration read from `mvhd`.
- Live: `supabase db push` on the new project; seed; import; a `select count(*)` per table matches the CSV.

## Boundaries
- Ask first: any column or table beyond these; any policy that lets the anon key read a table.
- Never: store a Supabase key in the browser bundle; store the chat CSV in the repo.

## Success criteria
Six tables, one event row, 754 simulated messages, the video URL and duration, and at least one team member
before the room is built against them.
