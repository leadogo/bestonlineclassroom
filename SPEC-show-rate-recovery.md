# Spec: show-rate recovery (the 5:00 pm text, the watch domain, and the Wed/Sun invites)

Module of [SPEC.md](SPEC.md). Depends on: `reminders`, `registration-webhook`, `room`. Drafted 2026-10-18 13:45 MT with William; decisions recorded below. Diagnosis: `leadogo-app/docs/sales/FUNNEL_CEILING_DIAGNOSIS.md` sections 10–12.

## Objective
Tonight's 5:03 and 5:08 pm texts deliver to US numbers again, and the room's US join rate (site registrants, live joins) is back at 38% within 7 days of the fix. Then two cheap, measured volume adds: a Wednesday and Sunday Skool broadcast and an ActiveCampaign re-invite to past registrants.

## What the data says (Oct 18)
- Room join rate: 39% (Sep 22–Oct 2) → 33% (Oct 3–17). US 38 → 32, Canada 41 → 43. Registrants who sign up 2–5 pm: 60% → 34%; morning registrants flat at 32%. Not the ads (control ad fell identically), not the pages, not geography.
- Roezan (toll-free +1 833 784-1832, texts fired by the ActiveCampaign "AILGR (Perpetual 1–7, 2.1)" automations' Roezan steps, unchanged since Aug 8–9): since Oct 3 the 5:03 "We're LIVE!" and 5:08 "Doors close" texts are red for US numbers; the 4:03 "ONE HOUR" text with the same link delivers. Carrier filtering of toll-free/A2P traffic is US-only: hence US-only. William's GHL texts only pass on watch.bookmoreshowings.com.
- ActiveCampaign field `WebinarJoinLink` (id 47) holds 13,488 values: 10,826 generic `bestonlineclassroom.com/w/ailg-r`, 1,730 personal `/j/<token>`, 930 dead EasyWebinar logins (something outside AC still writes ~35 EasyWebinar links a day at 10:03 am, 663 in October). `ReplayLink` (id 49): 11,636 dead EasyWebinar replays, 1,853 classroom. 8,291 contacts created in the last 90 days.
- Skool-sourced registrants join at 77–83%; SMS-push registrants at 17%.
- Open question for the record: the personal classroom links were in the field from Sep 21 (719 values set Sep 21–Oct 2). If a Sep 25 contact's 5:03 text was teal, the carriers began blocking on Oct 3, not on first appearance. William checks one Roezan thread. Either way the fix is the same.

## Decisions (William, Oct 18)
1. `watch.bookmoreshowings.com` forwards to the room through Cloudflare. The rule that exists forwards a bare token to `/j/<token>`; a second, path-preserving rule (T1) is added for `/w/`, `/replay/` and `/j/` paths. bms-website PR #25 (`/watch` route) is closed as redundant.
2. Retro-update: personal links for the last 90 days of contacts (done 2:17 pm); **extended 2:45 pm on William's call** to EVERY contact for the generic open link and dead EasyWebinar join/replay links (the re-engagement automation's audience is older contacts; nothing is lost on those values). Personal links are never overwritten with the generic door.
3. New registrants: the site writes the watch domain into the Zap payload (`classroom_join_link`, `classroom_replay_link`), one line in `futurerealestateagent/src/lib/optin.ts`.
4. Skool: Postiz with a Skool channel, posting to Book More Showings Free (skool.com/bms-agent-accelerator) as an Announcement with "Send email to all members" on, Wed + Sun 5 pm Mountain, title + body, generic link. No custom bot.
5. Texts keep a link (watch domain); Jeremy's no-link variant is a later A/B.

## Work items

### Today (order matters; 5:03 pm MT is the read)
| # | Who | Item | Done when |
|---|---|---|---|
| T1 | William (Cloudflare) — **DONE 2:35 pm, all four shapes verified by curl** | **Found at 1:52 pm: a rule already exists** — `watch.bookmoreshowings.com/<path>` → `www.bestonlineclassroom.com/j/<path>` (302). So a personal link is the BARE token: `https://watch.bookmoreshowings.com/<token>` works today with no change. For the open link and replay links, add ONE rule **above** it: hostname `watch.bookmoreshowings.com` AND (`starts_with(http.request.uri.path, "/w/")` or `starts_with(http.request.uri.path, "/replay/")` or `starts_with(http.request.uri.path, "/j/")`) → dynamic `concat("https://www.bestonlineclassroom.com", http.request.uri.path)`, 307, preserve query string ON. Not needed for tonight's texts. | `curl -I https://watch.bookmoreshowings.com/w/ailg-r?src=sms` → 307 to `https://www.bestonlineclassroom.com/w/ailg-r?src=sms`; bare token still → `/j/<token>`. |
| T2 | William (ActiveCampaign) — DONE ~2:20 pm, links verified clickable | In each **AILGR (Perpetual 1–7, 2.1)** automation, open the Roezan "Send SMS" steps that fire at 5:03 and 5:08; paste Jeremy's copy (appendix A); the link is the whole merge tag `%WEBINARJOINLINK%`, which T3 rewrites to `https://watch.bookmoreshowings.com/<token>`. Change the copy and the link in the same edit (time-boxed; the 2 pm test separates them). | Steps saved; a test contact receives the new text. |
| T3 | Claude — phase 1 DONE 2:17 pm (1,412 written, 0 failed); phase 2 started 2:37 pm | `scripts/ac-watch-links.ts` (this repo, AC key from Doppler), contacts created in the last 90 days. **Today (phase 1):** personal join links → `https://watch.bookmoreshowings.com/<token>` (1,411 values; the existing Cloudflare rule forwards them). **Phase 2, after T1's rule:** `--phase2` rewrites the generic open link, replay links and dead EasyWebinar links onto the watch host. Dry run prints counts; `--apply` writes at ≤ 5 req/s; `--plan FILE` saves the undo; `--revert FILE` undoes; idempotent. | Dry run 2:00 pm (full scope): 8,292 contacts, 12,967 values (join: 1,411 personal, 4,245 open-link, 828 EasyWebinar; replay: 1,458 classroom, 5,025 EasyWebinar). The first `--apply` was stopped before any write when the existing Cloudflare rule's shape was found; phase 1 then run with the bare-token form. Plan files in `tasks/runs/`. Re-run shows 0 pending. |
| T4 | Claude (PR futurerealestateagent #8 open) | Site: `classroom_join_link` in the Zap payload becomes `https://watch.bookmoreshowings.com/<token>` (`watchLink()` in `src/lib/join-link.ts`); replay link unchanged until T1's rule; tests updated. | PR merged and deployed before tonight's registrations, or Zapier Formatter as the stopgap. |
| T5 | William (Roezan, 2:00 pm) | Four texts to William's own US number: old copy/old link, old copy/new link, new copy/old link, new copy/new link. One text with the new link to one contact 60–120 days old. | Which combinations deliver is written down in the appendix. |
| T6 | William (Roezan, 5:10 pm) | Open three of tonight's US registrants: are the 5:03 and 5:08 bubbles teal? | Teal = T1–T3 worked. Red = the domain is not the (only) problem; next lever is dropping the link (Jeremy) and asking Roezan for the toll-free verification's listed URLs and sample messages. |

### This week
| # | Who | Item |
|---|---|---|
| W1 | William — DONE 2:25 pm: Zap "AILG Push New Session Link" (AC tag → EasyWebinar Register Attendee) turned off, tag steps removed from automation 192 | **Found (Oct 18, 2:30 pm): the writer is the Zap "AILG Push New Session Link" (ActiveCampaign tag added → EasyWebinar Register Attendee), fed by the tag below.** Automation **192 "AILGR Missed (Re-Engagement)"** adds the tag **`ailgr-pushnewjoinlink`** (tag 342, two steps: blocks 7703 and 7709) when a re-engaged contact's date wait releases (~10:03 am). EasyWebinar's ActiveCampaign integration, still live on EasyWebinar's side under the admin API key, listens for that tag, re-registers the contact into dead webinar #6, subscribes them to list 4740 "AI For Agents Masterclass" (via API, source 4) and writes `william1.easywebinar.live/login-6?key=` into WebinarJoinLink one second later. Fix: in automation 192 replace both "Add tag ailgr-pushnewjoinlink" steps with "Update a contact field → WebinarJoinLink = `https://watch.bookmoreshowings.com/w/ailg-r?src=sms`" (needs T1's rule live). Longer term: ask EasyWebinar to delete the integration, or rotate the AC API key in a planned window (Zapier, Roezan, the classroom's Doppler and any other key holder re-entered the same hour). |
| W2 | BUILT Oct 18 3:00 pm (PR #1): Browserbase persistent context (William logged in once via live view, context id in Doppler), `lib/skool-post.ts` drives the composer, cron `/api/cron/skool-broadcast` Wed/Sun 16:58 MT, dry run verified against the live group (Announcements + email toggle on, cancelled). First real post Wednesday Oct 21. | **Postiz facts (docs, Oct 18):** Skool is a cookie-based channel through the Postiz Chrome extension (session cookies refreshed every 24 h; Postiz's own doc warns it may breach Skool's terms); post settings are `group`, `label`, `title`; **no "send email to all members" setting is documented**, and that toggle is the whole point. Public API: `POST https://api.postiz.com/public/v1/posts` (`Authorization: <api key>`, `type` schedule/now, `date`, `posts[{integration:{id}, value:[{content}], settings:{__type:"skool", group, label, title}}]`), 100 create calls an hour. **Decision pending William's check:** does the Postiz composer show the email toggle for a Skool post? If yes → API cron in this repo (Wed/Sun 16:55 MT) with appendix B. If no → the reliable path is a hand post twice a week with the toggle ON, and a Slack DM from Brandon at 4:50 pm Wed/Sun carrying the ready-to-paste title + body (leadogo cron). |
| W3 | William (ActiveCampaign) | New automation "AILG-R Wed/Sun re-invite": segment = registered in the last 90 days AND no attendance tag AND no booked call; Wednesday and Sunday 4:00 pm Mountain: Jeremy's text (`?src=sms`) and email (`?src=email`) from appendix C. Exclude anyone with `sms_consent` false. |
| W4a | Claude | **Personal links for everyone who came through EasyWebinar** (William, Oct 18 2:30 pm): `scripts/ac-personal-links.ts` — contacts tagged `ailgr_registered` (304) created since Aug 1 whose WebinarJoinLink is not already a personal watch link get a room registrant (reused by email, else inserted with `source='legacy'`, a PAST session date so tonight's count and reminders are untouched, no confirmation email) and `https://watch.bookmoreshowings.com/<token>` + `/replay/<token>` written to AC. Dry run → apply after the all-contacts pass. |
| W4b | Claude | **EasyWebinar-write monitor**: `scripts/ac-ew-check.ts [--since ISO]` counts EasyWebinar links written to WebinarJoinLink since a time; run tonight after 10 pm and tomorrow after 10:05 am; both must read 0. |
| W4c | Claude (BUILT Oct 18 3:30 pm) | **Broadcast scoring + Jeremy loop.** Each posted broadcast is scored after the session by the 8:50 pm `open-link-report` cron from the room's own tables: emailed (6,200 members) → door clicks (`link_clicks` path w, prompt, src=skool) → entered an email (registrants source skool) → joined live → at the pitch (max_offset ≥ cta_at) → booked (bookings on those registrants); stored in `skool_broadcasts.result`, one 📊 line to #autoweb-intel. `scripts/skool-broadcast-review.ts` prints the brief for Jeremy's MCP. **Jeremy's rules:** bookings that night decide; clicks/joins lead and the pitch count is the strongest leading number; judge a title on ≥ 4 sends (two weeks of Wed+Sun); run the two fixed posts two weeks for separate Wed and Sun baselines, then champion in its slot vs one challenger title a week, same body, title the only change; a challenger that beats the champion on bookings over 4 sends takes the slot. Copy v2 (Oct 18 3:15 pm): doors-open-now framing, one 🚨 per title (never a row), because the email lands at 4:58 pm = 6:58 pm Eastern. First real broadcast: Sunday Oct 18 4:58 pm. |
| W4 | Claude | Measurement: the classroom's daily `session_metrics` plus registrants by `source`/`src` (skool, sms, email) on the 7 pm appointments post, so each invite path reports its own joins. |
| W5 | Jeremy's standing items | T-60 / T-15 texts; day-of emails onto the warm main domain; default 2–5 pm registrants to tomorrow with "join today instead"; Katherine reminder calls at T-60 to T-30. Each its own cycle, logged. |

## Acceptance
- Tonight: 5:03 and 5:08 texts teal for US registrants in Roezan.
- 7 days: US join rate (site registrants, live) ≥ 38%; the 2–5 pm cohort ≥ 50%; bookings per opt-in trending from 13% toward 17%.
- 14 days: Skool Wed/Sun posts show `src=skool` joins on the appointments post; re-invite shows `src=sms` / `src=email` joins; each path has its own number.

## Test plan
- T5 at 2:00 pm (four combinations + one old contact) settles domain vs copy.
- T6 at 5:10 pm is the production read; the Roezan thread list (REPLIED tab) is the evidence.
- `scripts/ac-watch-links.ts` dry run before apply; re-run after apply must report 0 pending.
- `curl -I` on three watch URLs after T1.

## Boundaries
- Never text a contact whose `sms_consent` is false; never add a contact to a sending automation from a script.
- Never replace a working link with a dead one; EasyWebinar links are already dead, the open link is strictly better.
- One change per Roezan step in one edit, so it can be reverted in one edit.
- No custom Skool bot; Postiz or by hand.
- The script writes only fields 47 and 49, only for contacts in scope, and logs every write.

## Open items
- Which carriers filter which pattern (domain vs copy) is settled by T5, not assumed.
- Whether Roezan's toll-free verification can list bestonlineclassroom.com, making the watch hop unnecessary later.
- Jeremy's no-link variant for the 5:03 text as the next A/B once delivery is back.

## Appendix A — SMS copy (Jeremy, Oct 18; paste with AC merge tags)
Merge tags: the link is the whole field `%WEBINARJOINLINK%` (after T3/T4 it reads `https://watch.bookmoreshowings.com/j/<token>`); the name is `%FIRSTNAME%`.

5:03 pm (under 300 chars):
> %FIRSTNAME%, your session just started. Here is your seat: %WEBINARJOINLINK% We hold your spot for a few minutes. Reply here if the link gives you any trouble.

5:08 pm (under 240 chars):
> %FIRSTNAME%, we are a few minutes in and the first takeaway is on screen now. Join here: %WEBINARJOINLINK% Replay runs 72 hours after, but the room is best right now.

4:03 pm: keep it. One addition if it is not there already: a line saying a second text comes at start time, so the 5:03 lands as expected.

## Appendix B — Skool posts (Jeremy, Oct 18; Announcements + "Send email to all members")
**Superseded 3:15 pm by the doors-open-now versions in `src/lib/skool-broadcast.ts` (🚨 Doors open in two minutes · 🚨 How many leads did you waste last month?). The first drafts below are kept for the record.**
Wednesday, proof angle. **Confirm the three proof numbers before the first post (600+ agents, 270 markets, 7,000 appointments are Jeremy's draft, not pulled from our data).**
> **Title:** 600+ agents, one system, tonight at 7 Eastern
> Quick one for you. The Book More Showings workshop runs today at 7 pm Eastern, 5 Mountain, 4 Pacific. It runs about two hours and twenty minutes. 600+ agents across 270 markets have been through this system and it has booked over 7,000 appointments. If you registered before and did not make it in, tonight is a clean restart. You will drop a name or email at the door, that is how the room holds your seat. Replay stays up for 72 hours after. Here is the door: https://watch.bookmoreshowings.com/w/ailg-r?src=skool See you at 7.

Sunday, question angle.
> **Title:** What happened to the leads you already paid for?
> Question for you: how many of the leads you already paid for turned into appointments last month? If the honest answer is low, that is the exact problem this workshop solves. It starts today at 7 pm Eastern, 5 Mountain, 4 Pacific, and runs about two hours and twenty minutes. You will see the full booking system agents use to turn leads into showings, and the replay stays up for 72 hours if tonight does not work. Drop a name or email at the door and you are in. Door is here: https://watch.bookmoreshowings.com/w/ailg-r?src=skool

Jeremy's cadence ruling: two broadcasts a week holds indefinitely if the two angles stay different; three or more on the same CTA breaks within a month. Watch announcement open rate and unsubscribes; under ~30% opens or two weeks of rising unsubscribes → one broadcast, the other a plain post without the email toggle. Never hit the same person with the Skool broadcast and the AC re-invite on the same day; stagger by a day.

## Appendix C — Wed/Sun re-invite (Jeremy, Oct 18)
Text, 4:00 pm Mountain (`?src=sms`):
> %FIRSTNAME%, you registered for the Book More Showings workshop and did not make it in. It starts again today at 7 pm Eastern. Door: https://watch.bookmoreshowings.com/w/ailg-r?src=sms Replay runs 72 hours.

Email (`?src=email`). Subject: **Your seat is still open, %FIRSTNAME%**
> Hi %FIRSTNAME%, you signed up for the Book More Showings workshop in the last few months and did not attend or book a call. No problem, it runs daily. Today it starts at 7 pm Eastern, 5 Mountain, 4 Pacific, and runs about two hours and twenty minutes. It covers the system agents use to turn leads into booked showings, and the replay stays up for 72 hours after. The room asks for a name or email at the door, that is how it holds your seat. Here is your door: https://watch.bookmoreshowings.com/w/ailg-r?src=email Talk soon, William

Later A/B (Jeremy): the no-link version on the 5:03 text only, one variable, two weeks, judged on join rate and downstream booking rate.
