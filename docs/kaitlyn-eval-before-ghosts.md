# Kaitlyn eval, 2026-10-20 17:19 UTC

200 of 545 lines from docs/kaitlyn-eval-set.json, seed 7, against the live fact sheet, 55 knowledge rows, 23 corrections, the class outline, and what William is saying on screen at each line's minute.

| expected | lines | as expected | replied | asked William | skipped | ghosted | median ms |
|---|---|---|---|---|---|---|---|
| answer | 121 | 67% | 89 | 24 | 6 | 2 | 3721 |
| market | 24 | 96% | 7 | 1 | 16 | 0 | 2103 |
| skip | 12 | 75% | 1 | 2 | 7 | 2 | 1857 |
| ghost | 39 | 54% | 11 | 2 | 5 | 21 | 2805 |
| keep | 4 | 75% | 0 | 0 | 3 | 1 | 3003 |

Drafts with a bot tell left after tidy: 0 of 122.
Replies filed under a different key than the set expects: 8.

## Misses (first 40)

- [ghost → skip] "1" (bare '1', answering William's poll on screen; no answer needed)
- [ghost → ask_william / support] "William...no one showed up in the last follow up appointment. Katherine did a follow up bu" (Sounds like an existing client with a Katherine follow-up issue; needs desk.)
- [ghost → reply / market-count] "Chicagoland!!!!! - I can't get an answer :(" → "3 in Chicagoland right now, so you're good" (Repeat market ask, directory has 3 in Chicagoland)
- [ghost → ask_william / support] "Hi, I purchased your program, but I haven’t been able to use it at all. I need some assist" → "I'll pass this to the team so they reach out to you directly. Have you done your onboardin" (existing client needs setup help, support issue for the desk)
- [ghost → reply / price] "Did you say the price?" → "Short answer: you need to book a call because it depends on your market area, type of lead" (price asked, no earlier answer to Sam, FACTS sentence)
- [ghost → skip] "Edmonton!" (answering William's where-are-you-from prompt on screen, bare city before pitch)
- [ghost → reply / see-me] "Why do you keep skipping me?" → "yes, I see you. What's your question?" (Asks why they're skipped; KB says yes we see you.)
- [ghost → skip] "sounds better than some one from inda" (answering him on screen about how the AI voice sounds)
- [ghost → reply / price] "Monthly cost is CAD $400 ?" → "that figure came from an ad budget question. Our price depends on your market, lead type a" (Price question; the 400 was an ad budget figure, not BMS pricing)
- [ghost → reply / replay] "replay" → "yes, it goes out by email after the class" (Replay question, answered from KNOWLEDGE; Katherine AI not involved.)
- [ghost → skip] "She was AI" (statement about Katherine's voice, no question, nothing to answer)
- [ghost → reply / beginner] "I have a question, I currently 17 yrs old already have pre licensing courses done and just" → "Lots of clients set up right before they go live, so you can start now and run the day you" (New-agent question matches beginner KB answer; earlier ask went unanswered.)
- [ghost → reply / price] "Much be expensive because you're avoiding the question." → "short answer: you need to book a call because it depends on your market area, type of lead" (Price pushback, nobody answered yet; gave the standard price line.)
- [ghost → reply / price] "What is the cost of your program?" → "It depends on your market area, the type of leads, and the cost per lead there, so that's " (price question; FACTS sentence, no figure, call covers it)
- [ghost → reply / replay] "Moderator....is there a repeat of this or link to a recording of this webinar?" → "yes, the replay goes out by email after the class" (replay question, KNOWLEDGE answers it, Katherine not involved)
- [ghost → reply / see-me] "You only speak to some people not all" → "I see your messages, ask away and I'll help where I can." (mild skipped-me complaint, KB see-me answer, first time tonight)
- [ghost → skip] "william,I am surprised if you receive my messages!!!" (Sam saying messages are being received; statement, no question to answer)
- [ghost → reply / what-is-this] "Can you tell us what you can do for us instead of telling us all of your and all that you " → "he gets to what the system actually does around minute 32" (wants the point; class shows system walkthrough at minute 32)
- [keep → ghost / live] "Is this live or a pre-recorded video?" (live vs recorded test question; team ghosts these on the spot)
- [answer → ask_william / ad-spend-example] "Was that $850/day or $850/mo?" (Asks about $841 ad spend example period; no figure allowed, FACTS silent)
- [answer → ask_william / how-long] "How long will this service remain?" (Unclear if asking session length or how long the service lasts)
- [answer → ask_william / price-point-closed] "what was the price point you closed ?" (Unclear if home price or BMS price; no figure in facts)
- [answer → ask_william / calls] "Do they all use AI Agent to call" → "Katherine AI calls the leads for clients, he plays her on a call around minute 52" (Unclear whether 'they' means all clients; FACTS don't say everyone uses it)
- [answer → ask_william / repeat] "choppy and a little robotic" → "try refreshing the page, that usually clears up choppy sound" (unclear if stream audio or Katherine's voice; desk decide)
- [answer → ask_william / demo-team-name] "why was the team's name beep out at first and then it said William's team the last time?" → "that demo was set up for a client, William was a team member on it when testing" (Demo call naming question; not in FACTS, Kevin answered before; desk confirm.)
- [answer → reply / data-retention] "do you also retain buyers information after it’s sent to my CRM ?" → "No, buyer info isn't kept once it goes to your CRM, and there's a data deletion policy." (Matches FACTS data retention; Kevin answered same question earlier)
- [answer → ask_william / lead-source] "how is FB better than Tiktok?" → "Facebook and Instagram are our main lead sources, we sometimes run Google too." (Facebook vs TikTok comparison isn't in FACTS; desk should answer)
- [answer → ask_william / lead-source] "what if u turn of ads  block it" → "ads run inside Facebook and Instagram, so ad blockers don't touch them" (Question unclear: ad blockers or turning ads off? Desk to confirm.)
- [answer → ask_william / pixel] "does FB know it even if i do the search directly from realtor site" (Asks if FB tracks searches on realtor sites; FACTS don't say.)
- [answer → ask_william / lead-cap] "What's the limit?" (Ambiguous 'limit' (leads, ads, markets?); not answering William's prompts)
- [answer → reply / split-buyers-sellers] "can 2 areas be split 1 for sellers vs buyers?" → "yes, two areas can be split that way, just explain it clearly on your onboarding call" (FACTS: two areas can be split buyers and sellers; say so onboarding)
- [answer → reply / market-count] "Seller's Boston Massachusetts open?" → "Boston's at 3 right now, so there's room. Sellers work too, just tell the team on your cal" (Direct market question; directory has 3 in Boston, sellers supported)
- [answer → ask_william / property-types] "How does it work if someone targets for SF, MF or land?" → "the call covers how it's set up for each property type, and some of our people do run comm" (Property-type targeting specifics not in FACTS; SF could mean San Francisco)
- [answer → reply / results] "would this be a turn off for older consumers" → "some people are fine with it and some aren't, but the bigger complaint is realtors never c" (Consumer reaction to AI calls; matches results answer and Kevin's reply)
- [answer → ask_william / offer] "Did I understand that you provide the FB Ads if you are in the Private community?" → "we run all the ads for you, nothing for you to do on that side" (asks if ads depend on private community; facts unclear on link)
- [answer → ask_william / support] "Hi, I purchased your program, but I haven’t been able to use it at all. I need some assist" → "I'll pass this to the team so they reach out to you directly. Have you done your onboardin" (existing client needs setup help, support handoff for the desk)
- [answer → ask_william / support] "Coaching and help?" → "there are four group calls a week and a support team on standby" (Unclear if prospect or client asking about coaching; desk decides)
- [market → skip] "Pat Dinkens are you in Houston?" (Sam is asking another attendee, Pat Dinkens, not the team)
- [answer → ask_william / dnc-registry] "How do I get on the DNC list" → "there's a national registry, you can look it up and sign up online" (DNC registry sign-up not in FACTS; ambiguous intent, draft offered)
- [answer → ask_william / resend-message] "@Kevin from William's Team sorry didn’t see it can you send again?" (Unclear what Sam wants resent; nothing posted yet this early)

## Tells

