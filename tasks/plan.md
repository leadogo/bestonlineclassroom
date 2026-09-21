# Plan: phase 1, the room replaces EasyWebinar by 5:00 PM Mountain 2026-09-21

Source: [SPEC.md](../SPEC.md) and the seven `SPEC-*.md` module specs (approved 2026-09-20 evening).
Written 2026-09-20 evening. Repos: **this** (new), **site** = `~/orca/futurerealestateagent`.

## Dependency graph
```
T1 scaffold ─┬─ T2 schedule ──────────┬─ T5 registration webhook ─┐
             └─ T3 migration ── T4 data scripts ─┬─ T6 room + video ─── T7 attendance + CTA + people ─┐
                                                 └────────────────────── T8 chat ── T9 moderator ─────┤
                                                                                                      T10 site cutover ── T11 launch
External (William): Supabase MCP auth + service key (before T3) · Vercel project, Blob store, DNS (before T4 upload and T10)
```
Parallel pairs: T2 with T3; T5 with T6; T8 can start as soon as T6 renders a room.

## Slices (each one is a complete path someone can try)
| Task | Path it completes | Verify |
|---|---|---|
| T1 | Repo builds and deploys an empty page | `npm run build`; Vercel preview URL |
| T2 | "What is the room's state right now?" answered by pure code | `npm test` |
| T3 | Six tables exist in Supabase | `list_tables` via MCP |
| T4 | Tonight's event, its video, its chat and its team are in the database | row counts |
| T5 | An opt-in becomes a join link | `curl` with Test Sample → `/j/<token>` |
| T6 | A join link opens the room and the video plays at the right minute | phone + laptop at `?at=4490` |
| T7 | Attendance is recorded and the CTA opens the booking page prefilled | `attendance` row; CTA click |
| T8 | Two phones chat with each other inside the simulated crowd | side-by-side test |
| T9 | William replies, deletes, blocks and reacts from his phone | live moderation test |
| T10 | A real opt-in on the site lands in our room through the calendar link | production Test Sample |
| T11 | Go / no-go at 16:30 MT | checklist |

## Checkpoints (human review before the next slice starts)
- **CP0, after T1** (William): authenticate the Supabase MCP (`/mcp`), put the service-role key in `.env.local`
  and Vercel, create the Vercel project from the pushed repo, add a Blob store, point `bestonlineclassroom.com`
  at it. Nothing after T2 can be verified without these.
- **CP1, after T4**: data in place. Counts: 1 event, 754 simulated messages, 1 team member, video URL set.
- **CP2, after T7**: William opens `/w/ailg-r?at=4490` on his phone: video at 1:14:50, CTA at 1:15:00, sound on
  tap, full screen, ended redirect at `?at=8380`. Layout accepted for tonight.
- **CP3, after T9**: William moderates from his phone while a second browser watches as Test Sample.
- **CP4, after T10**: Test Sample opt-in on the live site → thank-you page → calendar link → our room.
  EasyWebinar still registers in parallel. Go / no-go.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Supabase MCP not authenticated or service key missing | CP0 is first; until then only T1 and T2 proceed |
| No Vercel project, Blob store or DNS | William creates them at CP0; the upload script takes the Blob token from `.env.local` |
| 1.2 GB upload stalls | multipart upload, resumable by re-running; start it early in T4 |
| iOS autoplay or full screen behaves differently | CP2 on William's actual phone; video-element fallback in the spec |
| Site cutover breaks a live funnel | one commit, parallel flag on, revert restores everything; Test Sample only |
| Time: about 22 hours to the session | T2‖T3, T5‖T6 in parallel; T11 checklist frozen at 16:30 MT |

## What is not in this plan
Phase 2 (`reminders`, `admin`, `replay`) and phase 3 (`analytics`, `design-pass`, `ai-moderator`) get their own
task breakdown after CP4; their module rows in SPEC.md are the scope.
