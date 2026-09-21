# Plan: phases 2 and 3 (after the 2026-09-21 launch)

Source: [SPEC.md](../SPEC.md) rows `admin`, `reminders`, `analytics`, `design-pass`, `ai-moderator`, plus William's
2026-09-20 evening asks: leadogo's Funnel Performance mapped to our routes, the numbers he wants (joined, retention,
live at the pitch), and ActiveCampaign / iClosed tags for the same events EasyWebinar tagged.

## Order and why
1. **admin** first: turns tonight's scripts into screens William uses during the day (video upload, CTA, chapters,
   simulated chat, team, copy). Everything after it is configured there.
2. **analytics** second: the numbers for tomorrow's session already exist in `attendance` and `chat_messages`;
   this phase reads them, feeds leadogo, and sends the tags. It needs no new capture.
3. **reminders** third: needs a Postmark account and a DNS record from William; can be built in parallel once he
   has them.
4. **design-pass** and **ai-moderator** last.

## Dependency graph
```
admin ──┬── reminders (rules edited in admin)
        ├── analytics UI (per-session page in admin)
        └── ac-tags (rules edited in admin)
analytics-core (metrics + leadogo events) ── ac-tags ── iclosed-tags
design-pass (independent) · ai-moderator (needs chat + moderator, independent of the rest)
```

## Slices
| Task | Path it completes | Verify |
|---|---|---|
| A1 | `/admin` shell: team-only, event list, event form (title, schedule, end URL, CTA at/hide/label/href, replay hours, chapters, copy) | edit tonight's event, see it in the room and replay |
| A2 | Video upload from the browser (multipart to Blob, faststart check, duration) | replace the recording without a script |
| A3 | Simulated chat: CSV upload, names list, remove a name | tonight's CSV re-imported from a browser |
| A4 | Team members: add, rename display name, reset password | a second moderator signs in |
| A5 | Per-session registrants: list, search, block, resend link | find a person by email |
| N1 | Analytics core: `session_metrics` view (registered, joined, live at 1:15, retention curve, CTA clicks, replay watched, chat volume) | numbers for 2026-09-21 match a hand count |
| N2 | Events to leadogo: `room_join`, `room_leave`, `cta_click`, `chat_message`, `replay_watch` into `funnel_page_events` (constraint widened there) | Funnel Performance shows tonight's joins from our rows |
| N3 | Per-session page in `/admin`: the numbers, a viewers timeline, chat export | William reads the night without SQL |
| N4 | Tags: rules table (`event → tag`), ActiveCampaign API (add tag by email), iClosed webhook; the nine EasyWebinar events: registered, attended, missed, watched replay, left early, stayed ≥ 40 min, asked a question, clicked offer, saw offer but did not click | a Test Sample gets the right tags in ActiveCampaign |
| R1 | Reminders: Postmark sender, templates, 50 and 30 minutes before, send log, bounces/unsubscribes, 5-minute cron | a Test Sample receives both emails |
| D1 | Design pass: Zoom-faithful room and replay in a design tool, applied without changing data flow | William approves on his phone |
| M1 | AI moderator: persona answers when no human is on; rate-limited; hands off | Test Sample gets an answer in the room |

## Checkpoints
- **CP5, after A1–A5**: William edits tonight's event, uploads a video and adds a teammate from `/admin`.
- **CP6, after N1–N3**: the 2026-09-21 numbers on the admin page match Slack's room-count post and a hand count.
- **CP7, after N4**: tags land in ActiveCampaign for a Test Sample across all nine events.
- **CP8, after R1**: both reminder emails received on a phone, from our domain, in the inbox not spam.

## Risks
| Risk | Mitigation |
|---|---|
| Browser upload of 1.2 GB | Blob client upload with multipart; resumable by re-trying the same path |
| Tags over-firing (a person tagged "missed" who joined late) | rules evaluated once per session at a fixed time after the end; "attended" wins over "missed" |
| ActiveCampaign rate limits | batch at session end, not per event |
| Postmark deliverability | domain authentication (DKIM, return-path) before the first send |
