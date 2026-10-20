# Kaitlyn eval, 2026-10-20 17:41 UTC

231 of 525 lines from docs/kaitlyn-eval-set.json, seed 7, against the live fact sheet, 55 knowledge rows, 23 corrections, 39 by-hand ghosts (each ghost line scored without itself in the prompt), the class outline, and what William is saying on screen at each line's minute.

| expected | lines | as expected | replied | asked William | skipped | ghosted (sure) | median ms |
|---|---|---|---|---|---|---|---|
| answer | 151 | 71% | 120 | 23 | 8 | 0 (0) | 3237 |
| market | 38 | 97% | 37 | 0 | 1 | 0 (0) | 2047 |
| skip | 11 | 91% | 0 | 1 | 9 | 1 (1) | 2446 |
| ghost | 22 | 82% | 0 | 1 | 3 | 18 (17) | 4094 |
| keep | 9 | 78% | 2 | 0 | 5 | 2 (2) | 4303 |

Drafts with a bot tell left after tidy: 0 of 182.
Replies filed under a different key than the set expects: 13.

## Misses (first 40)

- [ghost → skip] "Meow" (one-word 'Meow', not a question, nothing to answer, not clearly ghostable)
- [ghost → ask_william / hard-sell] "Im helping my wife how to get more leads, we are tired of loosing money to charlatans, we " → "the call is free and not a hard sell, so you can see how it works first" (Wants no upfront payment; skeptic wording resembles ghost line, desk decides)
- [ghost → skip] "@iPhone oh I wear ChatGPT out, but I don’t want to be stealing water in the process. Human" (chatter with another attendee about ChatGPT, no question to answer)
- [ghost → skip] "william,I am surprised if you receive my messages!!!" (Sam's see-me statement, already answered in chat; needs no reply)
- [keep → ghost (sure) / live] "Is this a recording lol" (Same line and run-up the team ghosted by hand: recording jab)
- [keep → ghost (sure) / live] "I mean is this call now liv or prior recording" (Repeat live-or-recorded test, earlier 'if no answer' line; team ghosted this)
- [answer → ask_william / ad-spend-example] "Was that $850/day or $850/mo?" (Asks about the $841 ad spend example; period unknown, figure not allowed)
- [answer → ask_william / price-point-closed] "what was the price point you closed ?" (ambiguous: home price William closed, or our price; no approved figure)
- [answer → ask_william / how-long] "How long will this service remain?" (Ambiguous: webinar length, replay access, or service lifespan. Desk decides.)
- [answer → ask_william / repeat] "choppy and a little robotic" → "try refreshing the page, that usually clears the sound up" (Unclear if stream quality or Katherine's voice; desk decides)
- [answer → ask_william / demo-team-name-beep] "why was the team's name beep out at first and then it said William's team the last time?" → "that demo was a client's agent, and William was a team member on it when testing" (Katherine demo name question; only Kevin's old answer covers it, not FACTS)
- [answer → ask_william / voice] "The voice is really low key" → "her tone is yours to set, she can be upbeat, and you can clone your own voice too" (not sure; Voice reaction, unclear if Katherine or the testimonial speaker; voice answer)
- [answer → reply / training-data] "do you also retain buyers information after it’s sent to my CRM ?" → "no, buyer info isn't kept after it goes to your CRM, and we have a data deletion policy" (FACTS data: buyer info not kept after CRM; deletion policy)
- [answer → ask_william / lead-source] "how is FB better than Tiktok?" (FB vs TikTok comparison not in FACTS; only FB/IG and Google covered)
- [answer → ask_william / pixel] "does FB know it even if i do the search directly from realtor site" (Pixel tracking on realtor sites, not covered by FACTS outright)
- [answer → reply / sellers] "can 2 areas be split 1 for sellers vs buyers?" → "yes, we can do that. Just explain it clearly on the onboarding call." (FACTS: two areas can be split buyers/sellers, say on onboarding call)
- [answer → ask_william / lead-cap] "What's the limit?" → "limit on what, leads or ad budget?" (Ambiguous 'limit', could be leads, budget or markets; desk to clarify)
- [answer → reply / market-count] "Seller's Boston Massachusetts open?" → "3 in Boston right now, and sellers work too, so you're good" (market question Boston, directory count 3, sellers work)
- [answer → ask_william / property-types] "How does it work if someone targets for SF, MF or land?" → "there are different ads for each type of property, and the call covers how it'd look for y" (SF/MF/land mechanics not in FACTS; could also mean San Francisco)
- [answer → reply / results] "would this be a turn off for older consumers" → "younger people take to it more, but most people like it since the big complaint is realtor" (Matches team's real answer on older consumers and AI calls)
- [answer → ask_william / materials] "Where can i see the course?" (Unclear which course Sam means; not covered by facts)
- [answer → reply / replay] "Will this info be send to our email?" → "yes, the replay goes out by email after the class" (replay question, KNOWLEDGE answers it, Katherine not involved)
- [answer → reply / setup] "where can we find folks to setup the system" → "the call covers setup step by step for your market" (setup question, FACTS say the call covers setup)
- [market → skip] "Pat Dinkens are you in Houston?" (Sam asking another attendee, Pat, about Houston; attendee chatter)
- [answer → reply / dnc-registry] "How do I get on the DNC list" → "there's a registry, search it on google and you can sign up online" (DNC registry signup, matches the team's earlier answer)
- [answer → skip] "Generating lead for European realestate" (statement about their market, no question asked)
- [answer → ask_william / unclear-resend-request] "@Kevin from William's Team sorry didn’t see it can you send again?" → "which one do you need? I can resend it" (unclear what 'it' refers to, nothing sent yet tonight)
- [answer → ask_william / replay] "Could I get a replay of this? I had to take a call so I missed a lot of this." (KNOWLEDGE says replay emailed; William coming up says no recording. Conflict, desk decides.)
- [answer → ask_william / call-from-team] "Would you already be calling me? Lol" (unclear if asking about team call or Katherine AI, joking tone)
- [answer → reply / camera] "Can you not see me? Lol" → "yep, we see your message here. cameras are off for everyone, so nothing to turn on" (Camera or see-me question; cameras are off for attendees, message seen)
- [answer → skip] "Poverty mentality?" (Unclear fragment, not a product question, probably chatter or answering him)
- [answer → skip] "why ai isnt promoting for you" (unclear line, likely replying to his AI question on screen)
- [answer → ask_william / next-event] "William quick question when is your next in person event?" → "he runs them online now, 1 to 4 a month in our private community" (draft mentions a price; next-event question, answered from approved KNOWLEDGE)
- [answer → reply / market-count] "naming the number of agents who use your system in each area? Or number of for sellers?" → "which market are you in? I can look up the count for your area" (market question with no place named, asking which market)
- [answer → ask_william / legal] "How is that legal even if we aren’t on fb" → "it's just the reality of these big companies today, which is why privacy is such an import" (Ambiguous: Facebook tracking non-users or calling legality; not in FACTS)
- [answer → skip] "The Porsche? Ahhaha" (Joking aside about something else, no question, nothing to answer)
- [answer → ask_william / ad-budget] "Minimum to start?" → "if you mean ads, plenty start at $10 a day. our pricing depends on your market, the call c" (ambiguous: ad budget or BMS price, desk should pick)
- [answer → skip] "call me tomorrow and we can discuss" (Vague statement, no question; unclear who it's for, needs no answer.)
- [skip → ask_william / booking-link] "How can i use systems" → "the button in the room books a free call, and they go through setup there" (not sure; vague line, likely asking how to get the system; booking answer)
- [answer → skip] "sounds robotic" (answering William's robotic poll on screen; honest reaction, no reply needed)

## Tells

