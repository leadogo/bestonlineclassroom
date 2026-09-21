# Plan: fixes from the 22:45 test run (2026-09-20, late)

Source: William's 24 notes after the test. Goal unchanged: tomorrow 17:00 MT, registrants land in a room that
works. Phase A ships tonight and gets a second test run (a new throwaway event 10 minutes after A is done).
Phase B is tomorrow daytime, only if it cannot hurt the session. Phase C is after launch. Decisions D1–D9 are
in the review artifact; anything not decided by build time takes the recommended answer.

## Phase A: tonight, before the second test
A1 Countdown page shows only the countdown (no chat, no people) until the start. (#1)
A2 Video comes back by itself: retry muted play when the tab becomes visible or the room flips to live; on
   return from another app, seek to the live minute and play at once; "Reconnecting…" only after 5 s of real
   stall; remember the sound choice and only ask again when Apple blocks it. (#9, #13)
A3 Lock screen: pause the video when the page is hidden or the phone locks, resume at the live minute on
   return; media-session handlers neutralised so nothing on the lock screen can scrub. (#16, D1)
A4 Full screen on the phone (upright and sideways): our own full screen, bottom right of the video; chat hidden;
   tap to leave. Landscape chat font 15 px with more line height. (#12, #15, D6)
A5 Blocked people see a courteous "You've been removed from this session" screen; the room stops; the link
   shows the same on reload. (#23, #24, D2)
A6 Moderator view: simulated chat on by default ("Hide simulated chat"); real messages on a green tint; the
   Unghost button reads red while someone is ghosted; @ picker with a dropdown that refines as you type and
   finalises on click; moderators can mention anyone including themselves. (#11, #14, #22)
A7 Same first names: pickers disambiguate (attendees: joined time; moderators: masked email). (#20, D7)
A8 Admin: "Moderate" is the primary button, first on the left; the live dot and "Live now" appear without a
   refresh; moderators land on their moderator page after sign-in and see one obvious button. (#5, #8)
A9 Signed-in clarity: the invite page says who you are signed in as and offers "sign out and continue";
   moderator and admin headers show the account and role; /login shows "already signed in as …". (#3)
A10 Test hygiene: test registrants removed from tomorrow's event (done: 10 removed, 40 real remain); the
   next test event is titled "Test run" without the time. (#6, #18)
A11 Mobile call to action as a banner: event icon, title, subtitle, button, dismiss; title and subtitle editable
   in settings; same banner on desktop over the video. Ships tonight if time allows, else B. (#12, D3)

Checkpoint CP-A: build, lint, tests, the throwaway-admin smoke, then a new test event starting 10 minutes
after "done", with a fresh checklist that includes joining 5 and 40 minutes late.

## Phase B: tomorrow before 17:00, only if safe
B1 People count curve for the simulated crowd (Jeremy consulted). (#10, D4)
B2 Tap-to-reveal card on the video: host avatar, name, title, one-line description; upright and sideways. (#12)
B3 Replay in-player nudge: keep or remove per D5. (#2)

## Phase C: after launch
C1 Options sheet: hide chat, closed captions from the transcript, quality (needs streaming), share the open
   link with the phone's share sheet. Cast is out: it needs the native player, which exposes the scrubber. (#12, D8)
C2 Full design pass on room and replay, designed in a tool first.
