# Spec: replay

Module of [SPEC.md](SPEC.md). Depends on: `room`, `data-model`. Pulled into phase 1 on 2026-09-20 evening at
William's request. Consumed by: the site (`classroom_replay_link` in the Zapier payload), `analytics`.

## Objective
Everyone who registered gets a link that plays the recording any time, on their phone, with real controls, and
leads to one thing: booking the call. Jeremy's brief (KB topic `frea-replay-page-sep2026`, 2026-09-20) sets the
shape; William's rule "viewable 24/7" wins over Jeremy's 72-hour expiry.

## Page: `/replay/<token>`
- The registrant's token, same as the room. Unknown token or no video → a plain "link isn't valid" page.
- Above the video: one line saying what this is, the headline, one line under it, and the CTA button (desktop).
- The video with native controls, `playsInline`, `preload="metadata"`, no autoplay. "You were at 43 min. Pick up
  there / Start over" when this device has watched before (localStorage; never a server value).
- An in-player nudge at the pitch moment (`cta_at_seconds`, 1:15:00): one line and the same button, dismissable.
- Chapters ("Jump to"): `events.chapters` `[{ at, label }]`, five to seven big jumps when William supplies the
  timestamps; tonight: Start, Offer and next steps.
- Below: the CTA block (three-bullet recap of what the call is, the same button), a three-question FAQ, one line
  on how to get help. On phones a bar with the button is pinned to the bottom the whole time.
- One CTA, repeated; no navigation, no external links, no testimonials until William provides real ones.
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
- Never: autoplay with sound; a second offer on the page; an expiry the server does not enforce.
- Ask first: expiry or bonus deadline (Jeremy recommends 72 h from first open; needs William's decision);
  testimonials and headshots; the headline claim.

## Success criteria
A registrant who missed the session watches on her phone, sees the button the whole time, and lands on the
booking page with her details filled in.
