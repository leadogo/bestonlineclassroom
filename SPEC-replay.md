# Spec: replay

Module of [SPEC.md](SPEC.md). Depends on: `room`, `data-model`. Pulled into phase 1 on 2026-09-20 evening at
William's request. Consumed by: the site (`classroom_replay_link` in the Zapier payload), `analytics`.

## Objective
Everyone who registered gets a link that plays the recording any time, on their phone, with real controls, and
leads to one thing: booking the call. Jeremy's brief (KB topic `frea-replay-page-sep2026`, 2026-09-20) sets the
shape. William (2026-09-20, later): a 72-hour window per replay link, honest and enforced.

## Page: `/replay/<token>`
- The registrant's token, same as the room. Unknown token or no video → a plain "link isn't valid" page.
- Above the video: one line saying what this is, the headline, one line under it, and the CTA button (desktop).
- Our own player (`ReplayPlayer`): starts by itself muted, one big "Tap to play with sound" button, a seek bar
  with the chapters marked on it and the current chapter named above it, time, sound, full screen, keyboard
  (space, arrows). "You were at 43 min. Pick up there / Start over" when this device has watched before
  (localStorage; never a server value).
- An in-player nudge at the pitch moment (`cta_at_seconds`, 1:15:00): one line and the same button, dismissable.
- Chapters ("Jump to"): `events.chapters` `[{ at, label }]`, seven placed from the transcript: Start 0:00, Who
  William is 0:05, How the system works 0:27, Live demo: the ad and the qualifunnel 0:34, The AI appointment
  setter 0:53, Offer and next steps 1:15, Q&A and agent stories 1:24.
- Below: the CTA block (three-bullet recap of what the call is, the same button), a three-question FAQ, one line
  on how to get help. On phones a bar with the button is pinned to the bottom the whole time.
- Three testimonials in the agents' own words, copied verbatim from bms-website (`lib/embed-testimonials.ts`),
  with the same headshots. One CTA, repeated; no navigation, no external links.
- **The window:** `events.replay_hours` (72). `registrants.replay_opened_at` is set at the first open of the link
  and never moved; the page shows "Your replay access ends in 71h 58m" and, after that, an expired page with the
  CTA and a link to register again. Per link, on the server, so a cleared browser or a second device changes
  nothing (William asked for a cookie; the stored instant is the same idea and stronger).
- Copy in `REPLAY_COPY` (ReplayView.tsx) until the admin UI edits it. Jeremy's "20–40 appointments a month"
  headline is not used: it is a claim William has to sign off on.

## Data
- `attendance` rows with `kind = 'replay'`: joined, last seen, seconds watched (a beat every 30 s while playing),
  max offset, params, `cta_clicked_at`.
- `POST /api/register` returns `replay_url = https://bestonlineclassroom.com/replay/<token>`; the site puts it in
  the payload as `classroom_replay_link`.

## Testing
- `npm run build`; a Test Sample token opens the page; play 40 s → an `attendance` row with `kind = replay`;
  the CTA opens the booking page prefilled; the chapter buttons seek.

## Boundaries
- Never: autoplay with sound; a second offer on the page; an expiry the server does not enforce; a paraphrased
  testimonial.
- Ask first: the headline claim ("20–40 appointments a month" is Jeremy's, not yet William's).

## Success criteria
A registrant who missed the session watches on her phone, sees the button the whole time, and lands on the
booking page with her details filled in.
