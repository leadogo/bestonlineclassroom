# Kaitlyn last night, and every ghost since launch (audit, 2026-10-20)

Read-only from production on Oct 20 morning: `chat_messages`, `kaitlyn_decisions`, `registrants.ghosted_at`, event
`ailg-r`, test seats excluded. Definitions used throughout:

- **Wanted**: a line Kaitlyn judged worth a reply or a hand-off (`action` reply or ask_william).
- **Unanswered**: wanted, and neither Kevin nor Kaitlyn mentioned that person in the next 15 minutes.
- **Ghosted**: `registrants.ghosted_at` set. *By hand* is the desk's Ghost (no reason stored); *by rule* is the chat
  filter (recording claim, live test, "scam", crude emoji), the heartbeat's third-night check, or Kaitlyn.
- **Hidden**: a line only its author sees (`visibility = author`), which is what a ghost does to the line it came from.

## 1. Last night, Oct 19 (first night with Autopilot On)

33 people wrote 231 lines. The team posted 77: Katherine AI's scripted 22, Kaitlyn 36 (32 on her own, the pitch link,
3 drafts Kevin edited and sent), Kevin 19 between 17:52 and 18:43. Kaitlyn decided on all 231 lines: 181 skips (poll
answers, bare cities before the pitch, reactions), 32 posted, 8 drafts dropped after the pause (6 "she replied to them a
moment ago", 2 "a moderator answered first"), 10 to the desk (3 edited and sent, 1 skipped by hand, 6 still pending).
Autopilot was On, so every decision ran as auto even after Kevin sat down; this morning it is back to Auto.

**Five people were left without an answer.**

| who | what happened |
|---|---|
| Heather Price, 17:08 to 17:10 | "Y can't I hear anything" → her refresh line. "I did multiple times" ×2, "Still nothing but a black screen" → three ask_william cards. Nobody on the desk yet (Kevin's first line is 17:52) and no hand-off line either: a desk tab was open, so presence read as "someone is there". Knowledge row `no-sound-after-refresh` is open, asked twice. |
| Kailash Chander, 18:20 | "Booked" → her "booked, see you on the call" (Kevin deleted it). "East Bay San Fran" 31 s later → her draft "just 1 in East Bay so far" was dropped by the 120 s per-person window. He never got the count. |
| Cindy Martin, 18:20 to 18:24 | "OC" → her "Orange County in California, or another OC?". "OC california" 7 s later → dropped by the same window. "well my market is OC California" → ask_william pending with the draft "9 in Orange County right now" that nobody sent. Three asks, no count. |
| Hamid R. Kazemi, 18:22 | "How much does it cost?" → the price line dropped by the window (his Newmarket reply was 104 s earlier). Nobody answered the price question. |
| Glenn Shumsky, 18:27 | "Can you give a price range?" → her draft "honestly, you need to book a call…" failed the bot-tell check ("staged opener") and went to the desk; still pending. The prompt's own VARIETY list suggests "honestly," as a price lead-in. |

**Kevin's corrections** (what she said → what he said):

- Kailash "Booked": "booked, see you on the call" → deleted (she is not on the call; confirm that was the reason).
- Jewels "Lofty": "Lofty connects, yes. If that's your CRM you're covered." → "Loftys a great CRM. We connect with them a lot for our clients".
- Hamid "I am in Toronto,Nemarket.": "18 in Toronto, Newmarket I'd want to double check first" → "18 in Toronto, Newmarket from what I can see".
- Glenn "Do you deal with the North East??? Pittsburgh": no draft (no Pittsburgh in the directory) → "I believe we have 1 there, so you'll be fine".
- Ken Hughes "Wait, who are you?": "Kaitlyn, I'm on William's team answering questions in the chat" → skipped by hand. Knowledge row `who-are-you` is open.

Only the delete reached her CORRECTIONS block. The three edits are status `edited`, which the `kaitlyn_corrections` view
leaves out, so his rewording of her drafts teaches her nothing today.

**Facts Kevin typed that she does not have:** mortgage agents ("more than 10… handle the pre-approvals first… a
dedicated partner to share the leads with and take a %"; her line said "a few lenders"); "our own mortgage product coming
out January" (a date, which the guard forbids); "first 10 is included for free" (Diana's "How much is it the 10?"); Ontario
is "our biggest Canadian market"; Pittsburgh has 1 (not in the directory).

**Nagging.** Hamid asked about Newmarket three times, got two Kaitlyn answers and two from Kevin, then "William, have
you received my messages?" three times → Kevin "can you see Kaitlyn", "Her answers are in the chat", "look at our messages"
→ ghosted at 18:42:41, 20 s after the third nag. Frankie asked Michigan three times (answered three times), then "I have
asked multiple times… Can I get an answer", then "sorry I was driving". 7 of Kevin's 19 lines were about people not seeing
answers.

## 2. Unanswered, per night since Oct 11

| night | lines | wanted | by Kevin | by Kaitlyn | unanswered | hidden lines |
|---|---|---|---|---|---|---|
| 10-11 (Sun, nobody on the desk) | 144 | 61 | 0 | 0 | 61 | 0 |
| 10-12 | 115 | 41 | 7 | 14 | 20 | 10 |
| 10-13 | 220 | 43 | 25 | 13 | 5 | 8 |
| 10-14 | 108 | 26 | 0 | 11 | 15 | 3 |
| 10-15 | 204 | 25 | 5 | 18 | 2 | 28 |
| 10-16 | 58 | 17 | 0 | 14 | 3 | 1 |
| 10-17 | 61 | 20 | 1 | 16 | 3 | 4 |
| 10-18 | 133 | 23 | 7 | 9 | 7 | 8 |
| 10-19 | 230 | 50 | 11 | 31 | 8 | 1 |

By minute of the session (all nine nights): minutes 0 to 5, 27 wanted, 27 unanswered (bare cities, skipped by design
since Oct 13); 5 to 30, 61% unanswered; 30 to 60, 37%; 60 to 75, 38%; 75 to 90 (the pitch), 24% of 149; after 90, 56%.
By category: market 62 of 141 unanswered, booking 11 of 34, tech 10 of 14, product 10 of 45, price 9 of 21.

Drafts Kevin skipped by hand (46): 19 chatter ("Nice!", "very good", "Let's Get It"), 14 product (all pre-Oct 14 drafts
in the old customer-service voice: "Great question, Leah! That's exactly what the call is for…"), 4 other, 4 market, 2
thanks, 1 each tech, integration, greeting. He does not want chatter answered, and he did not want the filler voice.

## 3. Every ghost since Sep 21: 50 people over 20 nights

40 by hand, 10 by rule (third night 5, said it's a recording 2, said scam 1, ghosted before 1, Kaitlyn's draft approved
1). Kaitlyn herself has proposed a ghost **twice** in nine nights (Oct 12, Oct 13, both approved by hand) and has never
ghosted anyone on her own; the chat filter and the heartbeat do the rule ghosts. In the same nine nights Kevin ghosted 13
by hand. Her ghost training is the static list of 24 lines in `kaitlyn-examples.ts`, frozen on Oct 13.

The 40 by hand, by what the last line before the ghost was:

| cause | n | people (trigger line) |
|---|---|---|
| says the room is a recording, tests it, or exposes the illusion | 14 | Bryan ("you're just watching the comments"), Hammy ("Is this a recording lol"), John 09-23 ("this has to be a recording because the bad air quality…"), John 09-27 ("Is this live or a pre-recorded video?"), Kim Ma ("is this call now liv or prior recording"), Frank Perna ("Are these comments from a pre recorded video?"), Edward ("because it's recorded"), Alfred ("Is this live"), Jesseka ("replay"), Teva ("Pre rec?"), David ("if you're live on here, say LIVE"), Skip ("is there a repeat of this or link to a recording"), Matt Leadogo ("She was AI"), Zeke ("Anyone else getting spammed to join the call even though you are in it?") |
| heckling, sneering, impatience, a racist line | 8 | Victor Ma ("Meow"), Jacob Barr ("booooo" after "waist of time"), Matt McFarlane ("sounds better than some one from inda"), Flavia ("Oh I hate this showing I'm rich thing"), Alex Seropian ("too much scam there"), Sheila ("tell us what you can do for us instead of… how much money you have made"), MoJo ("Why ask us to turn on cameras?"), Brett ("It's illegal to do that in my market") |
| pushes for the price, or names a figure in the open | 5 | Laura R (4th "Did you say the price?"), Shella ("Monthly cost is CAD $400 ?"), Jim ("Much be expensive because you're avoiding the question."), Teri (pre-pitch "What is the cost of your program?"), Saundra ("$400 a month is too steep… I will hold") |
| not a prospect, soliciting, a known face | 5 | Desiree (hiring out TCs, phone number), Santiago (17, unlicensed), Yvette (rambling @replies, "humans over tech"), Ken Dodds (Edmonton local, 16 s after "Edmonton!"), Daryl (never wrote; ghosted from the people list) |
| complains of being skipped, nags after being answered | 4 | Pratiti ("Why do you keep skipping me?"), Grant (3 answers, then "Chicagoland!!!!! - I can't get an answer :("), Hamid (4 answers, then "I am surprised if you receive my messages!!!"), Shiranie ("You only speak to some people not all", minute 4) |
| an existing client or a booked prospect complaining in the open (all before the client wall) | 4 | raj (no-shows, "phone number for the client team"), Sun Pio ("I purchased your program… need assistance"), Phyllis ("scheduled for 7:30 tonight but so far no show"), Hernando ("tired of loosing money to charlatans… we pay no more giving money upfront") |

**Tempo.** Lag from the trigger line to the ghost: median 20 s, 30 of 40 within 45 s, longest 225 s (Teri). Kaitlyn's
on-the-spot ghost is the right tempo.

**A ghost is a quarantine, not silence.** He kept answering 19 of the 40 privately after the ghost (Jacob Barr got 7
replies after his, Kim Marr 9, Grant 7, Phyllis 7). Kaitlyn already posts to a ghosted person with `visible_to`, so she
matches this. The one failure: Brett, ghosted at minute 57 for the legality line, then asked "Can we just sign up or do
we have to have a call first" thirteen times over eight minutes, hidden, and nobody answered ("are all these responses
bots? I've asked 10 times… can anyone else see this?"). A buyer lost to a ghost nobody was watching.

**Where his hand and her rules differ today.**

- A sincere "is this live / recorded?" was ghosted by hand five times before Oct 9 (John, Alfred, Hammy, Frank, Kim
  Ma) and not once since; only the bare "pre rec?" became a rule. Her rule (a sincere question is not a ghost) matches
  his recent hand. Keep it.
- The price push, the nag, the sneer, the client complaint and the minor are all in his hand and none has ever fired
  from hers: two ghost proposals in nine nights.

## 4. What makes him ghost (the question asked)

Reading the 40, the ghost is rarely about the person. It protects the room from four things, and three of the four are
produced by how the show runs.

1. **The live illusion invites its own test (14 of 40).** The recording reads the simulated chat's cities and asks the
   room to "type YES"; a real person expects to be read out. When the William on screen never says their name, the sharp
   ones conclude "he's just watching the comments" (Bryan), "he just read a comment" (Flavia), "you only speak to some
   people" (Shiranie), "why do you keep skipping me" (Pratiti). The complaint is the threat, so it gets hidden. Katherine
   AI's scripted minute-2 line, "Drop your city in the chat so William can shout out your market 👇", is a promise the
   recording cannot keep for a real person, and since Oct 13 Kaitlyn skips every real city drop before the pitch: 27 of 27
   lines in minutes 0 to 5 go unanswered, every night. That is where the "you skip me" feeling starts.
2. **Replies that do not land (4 nags, 7 Kevin lines last night).** The room tints a reply addressed to you but does not
   pin, scroll to or badge it; on a phone the chat sits below the video and scrolls away; drivers miss it. Eleven people
   have complained of being ignored since Sep 23; seven of them had already been answered two or three times. He answers,
   it does not land, they nag, he ghosts the nag.
3. **The price is withheld (5, plus the pre-pitch asks).** Every price answer is "book a call". Whoever pushes after it
   ("you're avoiding the question", "CAD $400?", the fourth "did you say the price?") is ghosted within 5 to 80 s. Price
   asks before the pitch are left (Oct 11) or hidden (Teri). Kaitlyn gives the line at any minute, and the push after it
   is in her ghost bullet, which has never fired.
4. **Clients and booked prospects complaining in the open (4, all before Oct 1).** The client wall removed this; none
   since. Keep a rule for the one who slips through.
5. **Nobody on the desk before minute 50.** Across nine nights, questions at minutes 5 to 30 are 61% unanswered, and the
   unanswered become the naggers. Autopilot covers it now, but her hand-off line is suppressed whenever a desk tab is open
   in a background browser (Heather, last night).

What to change is in `SPEC-kaitlyn-ghosts.md`.
