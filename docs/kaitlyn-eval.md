# Kaitlyn eval, 2026-10-19 04:23 UTC

160 of 494 lines from docs/kaitlyn-eval-set.json, seed 7, against the live fact sheet, 53 knowledge rows, 0 corrections, the class outline, and what William is saying on screen at each line's minute.

| expected | lines | as expected | replied | asked William | skipped | ghosted | median ms |
|---|---|---|---|---|---|---|---|
| answer | 132 | 69% | 101 | 26 | 4 | 1 | 3119 |
| market | 20 | 95% | 10 | 0 | 10 | 0 | 2314 |
| skip | 8 | 88% | 0 | 1 | 5 | 2 | 2143 |

## Before the transcript (same 160 lines, same seed, `--no-screen`)

| expected | lines | as expected | replied | asked William | skipped | ghosted | median ms |
|---|---|---|---|---|---|---|---|
| answer | 132 | 76% | 109 | 21 | 1 | 0 | 2835 |
| market | 20 | 95% | 8 | 0 | 12 | 0 | 2685 |
| skip | 8 | 75% | 1 | 1 | 3 | 3 | 1733 |

Misses 35 before, 43 after. Read with care: the eval set's `minute` is a placeholder for most lines (the Oct 17 clustering kept
the real minute for only 159 of 494 questions; 335 sit at minute 0 or 1), so the "after" run attaches the roll-call minute's
screen to questions that were really asked an hour later. The skip class moved the way the spec hoped (75% to 88%: lines that
answer him on screen are skipped); the answer class lost 7 points mostly to lines she now hands to the desk because the screen
at minute 1 does not match the question. The production checks on test-run with the real second passed all three: "value" 20 s
after he asks for it skipped ("typing 'value' as William asked on screen"); "wait what is a pixel?" a minute after his pixel
explanation answered from his words ("it's like a security camera on a website…"); "whats the offer, how do i get this?" 40 s
before the offer got "that's literally the next thing he shows, keep watching". Next: an eval class `onscreen` with real
seconds, pulled from the room's `offset_seconds` on the stored questions, before trusting the answer-class number either way.

Drafts with a bot tell left after tidy: 0 of 122.
Replies filed under a different key than the set expects: 10.

## Misses (first 40)

- [answer → ask_william / ad-spend-example-period] "Was that $850/day or $850/mo?" (asks if $850 example was per day or month; figure not in KNOWLEDGE)
- [answer → ask_william / service-duration-unclear] "How long will this service remain?" (Ambiguous: webinar length, offer window, or company longevity. Needs a moderator.)
- [answer → ask_william / price-point-closed] "what was the price point you closed ?" (Unclear if home price or BMS price; no figure in FACTS)
- [answer → ask_william / calls] "Do they all use AI Agent to call" (Unclear if 'they' means clients; FACTS don't say all use Katherine.)
- [answer → reply / repeat] "choppy and a little robotic" → "try refreshing the page, that usually clears up the audio" (choppy audio read as tech trouble; refresh is the approved fix)
- [answer → reply / data-retention] "do you also retain buyers information after it’s sent to my CRM ?" → "no, buyer info isn't kept once it goes to your CRM, and there's a data deletion policy" (Data retention answered in FACTS: not kept after CRM, deletion policy.)
- [answer → ask_william / demo-team-name-beep] "why was the team's name beep out at first and then it said William's team the last time?" → "that demo was set up for a client, William was a team member on it while testing the agent" (Demo call team-name question; not in FACTS, only Kevin's past answer)
- [answer → ask_william / facebook-vs-tiktok] "how is FB better than Tiktok?" (FB vs TikTok comparison not in FACTS; moderator should answer)
- [answer → ask_william / pixel] "does FB know it even if i do the search directly from realtor site" (Realtor-site search and Facebook tracking is not in FACTS; needs desk answer)
- [answer → reply / sellers] "can 2 areas be split 1 for sellers vs buyers?" → "yes, two areas can be split buyers and sellers, just say so on the onboarding call" (FACTS: two areas can be split buyers/sellers; say on onboarding call)
- [answer → ask_william / lead-cap] "What's the limit?" → "limit on what, leads or ad budget?" (Ambiguous 'limit', could be lead cap or ad budget; unclear.)
- [answer → reply / market-count] "Seller's Boston Massachusetts open?" → "3 in Boston so far, and sellers work fine. Just tell the team on the call." (Direct market question; Boston count 3, sellers supported per FACTS)
- [answer → ask_william / property-types] "How does it work if someone targets for SF, MF or land?" → "we do different ads for each type of property, the call is where they map out yours" (Property-type targeting mechanics not fully in FACTS; desk should confirm)
- [answer → reply / replay] "Will this info be send to our email?" → "yes, the replay goes out by email later tonight" (replay email question, KNOWLEDGE answers it)
- [answer → ask_william / support] "Hi, I purchased your program, but I haven’t been able to use it at all. I need some assist" (Existing client needs onboarding help, support issue for the desk)
- [answer → ask_william / support] "Coaching and help?" → "there are four group calls a week and a support team on standby" (Unclear if Sam is a client or prospect asking about coaching)
- [market → skip] "Pat Dinkens are you in Houston?" (Sam is asking another attendee, Pat Dinkens, not the team)
- [answer → ask_william / legal] "How do I get on the DNC list" → "there's a registry, you can look it up on google and register online" (DNC registry sign-up not in FACTS; unclear if personal or product question)
- [answer → skip] "Generating lead for European realestate" (Statement about their own business, no question asked)
- [answer → ask_william / resend-request] "@Kevin from William's Team sorry didn’t see it can you send again?" → "what was it you missed? happy to resend" (Asks Kevin to resend something unknown; no context, desk must check)
- [answer → ask_william / booked] "Did you see my booking?" → "the team confirms your spot by text and email, so keep an eye on your phone" (Booking at minute 1, before booking opens; can't verify it)
- [answer → ask_william / call-from-team] "Would you already be calling me? Lol" (Unclear if joking about AI calls or a team call; not booked yet)
- [answer → ask_william / replay] "Could I get a replay of this? I had to take a call so I missed a lot of this." (Replay asked; William says no recording coming up, contradicts KNOWLEDGE. Desk decides.)
- [answer → ghost / see-me] "Why do you keep skipping me?" ('Why do you keep skipping me?' matches the team's ghost list; first message tonight)
- [answer → reply / beginner-buyers-or-sellers] "What is the easier for a  beginner" → "buyers, they're the easier start for a beginner" (Buyers are easier start for beginners, per FACTS and Kevin's earlier answer)
- [answer → skip] "Poverty mentality?" (unclear line, likely reacting to Vancouver affordability talk; no answer needed)
- [answer → skip] "why ai isnt promoting for you" (unclear line, likely answering William's AI question on screen)
- [skip → ask_william / unclear-clarity-question] "is it clear like that" (Unclear what 'clear' refers to (audio, video, slides); desk should check)
- [answer → ask_william / price] "Much be expensive because you're avoiding the question." (Accusation about price at minute 1, nobody asked before; unsure if heckling)
- [answer → reply / offer] "How much is Katherine if you aren't 1 of the lucky 10" → "it's $250 a month, and the bonus with booking is getting it free instead" (Katherine subscription $250 a month is allowed KNOWLEDGE figure)
- [answer → reply / lead-info-consent] "Do people agree to enter all of their information?" → "yes, they opt in through the ad, then answer the 14 qualifying questions" (Qualifunnel opt-in and 14 questions per FACTS; Kevin answered same before)
- [answer → ask_william / booked] "Sanaz booked" (Booked at minute 1, before booking opens; name mismatch, unclear meaning)
- [answer → ask_william / replay] "are we going to get a recording of this class?" (William just said no recording goes out; KNOWLEDGE says replay email. Conflict, desk decides.)
- [answer → ask_william / replay] "Are you recording?" → "a replay goes out by email after the class" (Ambiguous: replay question or live-or-recorded test, William just addressed it)
- [answer → skip] "booked" (Bare 'booked' at minute 1, before booking opens; unclear meaning, no question.)
- [answer → reply / calls] "Please automate me!" → "Katherine can take the calls and texts off your plate, paperwork isn't there yet 😊" (Playful request; answered from calls and contracts facts.)
- [answer → ask_william / how-long] "how long is this??" (Unclear if webinar or call length; 78 minutes in, 'about an hour' may mislead)
- [answer → reply / older] "I am 70 years old, I have been very successful at real estate ultimately 20 years ago and " → "we have clients in their sixties and seventies doing just fine, and we handle a lot of the" (Older agent returning; KNOWLEDGE older clients answer matches outright)
- [answer → ask_william / software-used] "Which software did you use" (Unclear which software; testimonial agent's tools not in FACTS)
- [answer → ask_william / leads-no-close] "was there an instance that one got lots of leads and not closed at all" → "it comes down to how the leads get handled, and whether you're the one booking them" (asks for specific failure cases, not in FACTS; desk should answer)

## Tells

