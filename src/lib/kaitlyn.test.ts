import { test } from "node:test";
import assert from "node:assert/strict";
import { ASSISTED, asAutopilot, asMode, delayMs, engaged, extractJson, ghostsItself, guard, HANDOFF_AFTER_MS, handoffDue, holdsReply, marketLine, parseDecision, PER_PERSON_MS, postsItself, SHAPES, systemPrompt, userTurn, withoutMention } from "./kaitlyn.ts";
import { tells } from "./humanize.ts";
import { EXAMPLES } from "./kaitlyn-examples.ts";

test("parseDecision: the tool input checked; a wordless reply skips, a guarded reply becomes ask_william with the draft kept", () => {
  assert.deepEqual(parseDecision({ action: "reply", category: "market", text: "  weve got 10 in LA,   youre good 🙌 ", react: "🔥", why: "named a market" }), { action: "reply", category: "market", text: "weve got 10 in LA, youre good 🙌", react: "🔥", why: "named a market", kb: null, sure: true });
  assert.equal(parseDecision({ action: "reply", category: "market", text: "", react: "", why: "" }).action, "skip");
  assert.equal(parseDecision({ action: "dance", category: "nope", text: "x", react: "🎉", why: "" }).action, "skip");
  assert.equal(parseDecision({ action: "skip", category: "nope", text: "x", react: "🎉", why: "" }).react, "");
  assert.equal(parseDecision({ action: "skip", category: "chatter", text: "ignored", react: "👍", why: "" }).text, "");
  // A ghost's text is the private line they still get (SPEC-kaitlyn-ghosts.md, B1 and B2); a line the guard refuses is dropped, the ghost stands.
  assert.deepEqual(parseDecision({ action: "ghost", category: "support", text: "I'll have the team reach out to you", sure: true, react: "", why: "client complaint" }), { action: "ghost", category: "support", text: "I'll have the team reach out to you", react: "", why: "client complaint", kb: null, sure: true });
  assert.equal(parseDecision({ action: "ghost", category: "negative", text: "it's $400 a month", sure: true, react: "", why: "price push" }).text, "");
  assert.equal(parseDecision({ action: "ghost", category: "negative", text: "", react: "", why: "heckling" }).sure, false);
  assert.equal(parseDecision({ action: "reply", category: "market", text: "3 in Boston", sure: true, react: "", why: "" }).sure, true);
  assert.equal(parseDecision({ action: "ask_william", category: "product", text: "", react: "", why: "" }).sure, false);
  const priced = parseDecision({ action: "reply", category: "price", text: "it's $400 a month", react: "", why: "asked the price" });
  assert.equal(priced.action, "ask_william");
  assert.equal(priced.text, "it's $400 a month");
  assert.match(priced.why, /^draft mentions a price; asked the price/);
  const unsure = parseDecision({ action: "reply", category: "product", text: "the pixel reads personal posts too", sure: false, react: "", why: "pixel question" });
  assert.equal(unsure.action, "ask_william");
  assert.equal(unsure.text, "the pixel reads personal posts too");
  assert.match(unsure.why, /^not sure; pixel question/);
  assert.equal(parseDecision({ action: "reply", category: "market", text: "3 in Boston", sure: true, react: "", why: "" }).action, "reply");
  assert.equal(parseDecision({ action: "reply", category: "market", text: "3 in Boston", react: "", why: "" }).action, "reply");
  assert.equal(parseDecision(null).action, "skip");
  assert.equal(parseDecision({ action: "reply", category: "other", text: "a".repeat(400), react: "", why: "" }).text.length, 300);
});

test("extractJson: the object inside a fence or prose, null when there is none or it is broken", () => {
  assert.deepEqual(extractJson('```json\n{"action":"skip","why":"chatter"}\n```'), { action: "skip", why: "chatter" });
  assert.deepEqual(extractJson('{"action":"reply","text":"hey {you} :)"} trailing words'), { action: "reply", text: "hey {you} :)" });
  assert.equal(extractJson("no json here"), null);
  assert.equal(extractJson('{"action": '), null);
});

test("guard: prices, guarantees, live or recorded, dates and bot talk never reach the room", () => {
  for (const s of ["around $290", "as low as 6 cents usd", "400 a month", "it's 500 per month", "we guarantee results", "this is live!", "it's recorded", "the pre-recorded video", "see you Oct 12", "back in 2025", "I'm an AI", "im a real person"]) assert.ok(guard(s), s);
  for (const s of ["weve got 10 in LA youre good", "the replay email goes out tonight", "the team confirms by text and email", "great question, that's exactly what the call is for", "you'd be the first there 🙌"]) assert.equal(guard(s), null, s);
});

test("postsItself and delayMs: shadow never posts, assisted posts the routine categories, auto posts every reply", () => {
  const reply = (category: (typeof ASSISTED extends Set<infer C> ? C : never)) => ({ action: "reply" as const, category, text: "x", react: "", why: "", kb: null, sure: true });
  assert.equal(postsItself("shadow", reply("market")), false);
  assert.equal(postsItself("assisted", reply("market")), true);
  assert.equal(postsItself("assisted", reply("product")), false);
  assert.equal(postsItself("assisted", reply("price")), true);
  assert.equal(postsItself("auto", reply("product")), true);
  assert.equal(postsItself("auto", { action: "ghost", category: "negative", text: "", react: "", why: "", kb: null, sure: true }), false);
  assert.equal(delayMs("shadow"), 0);
  assert.equal(delayMs("assisted", () => 0), 8_000);
  assert.equal(delayMs("auto", () => 0.999), 14_993);
  // A ghost she is sure of acts in assisted and auto whatever its category; an unsure one waits on the desk; shadow never acts (B2).
  const ghost = (sure: boolean, category: "negative" | "support" = "negative") => ({ action: "ghost" as const, category, text: "", react: "", why: "", kb: null, sure });
  assert.equal(ghostsItself("shadow", ghost(true)), false);
  assert.equal(ghostsItself("assisted", ghost(true)), true);
  assert.equal(ghostsItself("auto", ghost(true, "support")), true);
  assert.equal(ghostsItself("assisted", ghost(false)), false);
  assert.equal(ghostsItself("assisted", reply("market")), false);
  assert.equal(asMode("assisted"), "assisted");
  assert.equal(asMode("sideways"), "off");
});

test("withoutMention: the model's own leading @Name goes, anything else stays", () => {
  assert.equal(withoutMention("@Lovia Starry Publico Lovia, none in Hilo yet", "Lovia Starry Publico"), "Lovia, none in Hilo yet");
  assert.equal(withoutMention("@lovia starry publico: none in Hilo yet", "Lovia Starry Publico"), "none in Hilo yet");
  assert.equal(withoutMention("Lovia, none in Hilo yet", "Lovia Starry Publico"), "Lovia, none in Hilo yet");
  assert.equal(withoutMention("@Lovia none yet", "Ana"), "@Lovia none yet");
  assert.equal(withoutMention("@Ana", "Ana"), "@Ana");
  assert.equal(withoutMention("@J.R. (Bo) hi there", "J.R. (Bo)"), "hi there");
});

test("marketLine: the directory's answer worded for the model, or null when no place is named", () => {
  const markets = [{ name: "Los Angeles, CA", clients: 10, live: 7 }, { name: "Hoboken, NJ", clients: 1, live: 1 }, { name: "Central New Jersey, NJ", clients: 2, live: 2 }];
  assert.equal(marketLine("LA", markets), "directory says 10 clients in Los Angeles, CA");
  assert.equal(marketLine("New Jersey", markets), "directory says 3 across New Jersey (Central New Jersey 2, Hoboken 1)");
  assert.equal(marketLine("Cape Coral Florida?", markets), "directory has no market by that name; the state has 0 across Florida");
  assert.equal(marketLine("how many agents in Nashville", markets), "directory has no market by that name (none there yet)");
  assert.equal(marketLine("thanks so much!", markets), null);
  assert.equal(marketLine("LA", []), null);
});

test("systemPrompt and userTurn: the fact sheet, Kevin's answers and the ghosted lines are in; the turn carries the room", () => {
  const s = systemPrompt("PRICE: never in chat.");
  assert.ok(s.includes("PRICE: never in chat."));
  assert.ok(s.includes("Kaitlyn from William's Team"));
  assert.ok(EXAMPLES.qa.length > 150);
  assert.ok(s.includes(EXAMPLES.qa[0].a) && !s.includes("LINES THE TEAM GHOSTED"));
  // The ghosts come from the view now (B3), per call, so the prompt only carries them when given.
  assert.ok(systemPrompt(null, [], [], null, [{ line: "Is this a recording lol", context: null, reason: null }]).includes("LINES THE TEAM GHOSTED (the line that got the person ghosted by hand"));
  assert.ok(systemPrompt(null).includes("No fact sheet"));
  assert.ok(s.includes("before the pitch, a bare city or state with no question") && s.includes("Katherine AI's polls"));
  assert.ok(s.includes("YOU ALREADY SAID TONIGHT is in every turn") && s.includes("No customer-service phrases") && !s.includes("bubblier"));
  assert.ok(s.includes('"sure": true only when FACTS, KNOWLEDGE or MARKET DATA give this answer outright') && s.includes("Never a filler reply") && !s.includes("can't answer that one here"));
  // The ghost bullet was rewritten from the audit (SPEC-kaitlyn-ghosts.md, B1): the live test and the honesty exemption are still there, in their new words.
  assert.ok(s.includes("if you're live say LIVE") && s.includes("the webinar asks for that honesty"));
  const t = userTurn({ minute: 82, pitchMinute: 75, name: "Ana", body: "LA", priorOwn: ["hi from LA"], modReplies: [], said: ["7 in Massachusetts so you're good", "nobody in Chelan yet"], recent: ["[attendee] Bo: Chicago"], market: "directory says 10 clients in Los Angeles, CA", katherine: false });
  assert.match(t, /minute 82, the pitch started at minute 75/);
  assert.match(t, /PERSON: Ana, earlier tonight: "hi from LA"/);
  assert.match(t, /MODERATORS TO THEM TONIGHT: nothing yet/);
  assert.match(t, /YOU ALREADY SAID TONIGHT \(oldest first\): "7 in Massachusetts so you're good" \| "nobody in Chelan yet"/);
  assert.match(t, /MESSAGE TO DECIDE ON: Ana: "LA"$/);
  assert.match(userTurn({ minute: 3, pitchMinute: 75, name: "Bo", body: "hi", priorOwn: [], modReplies: ["@Bo welcome!"], said: [], recent: [], market: null, katherine: true }), /before the pitch[\s\S]*\nMARKET DATA: none \(no place named\)\nKATHERINE AI: will answer[\s\S]*YOU ALREADY SAID TONIGHT \(oldest first\): nothing yet/);
});

test("guard: the two approved figures and the replay wording pass; other prices, this-is-live and pre-recorded still do not", () => {
  for (const s of ["Katherine AI included free instead of $250 a month", "plenty of people start at $10 a day", "it's a replayable recording, it goes out by email tonight", "yes, it goes out by email after the class"]) assert.equal(guard(s), null, s);
  for (const s of ["$400 a month", "it's 500 per month", "$250 a month plus $50 setup", "this is live", "it's recorded", "the pre-recorded video", "we're live right now", "we guarantee results", "results are guaranteed", "it's 250/mo on her own", "about 500 monthly", "yes he's live", "we're live right now", "live right now"]) assert.notEqual(guard(s), null, s);
  for (const s of ["No guarantee, and be wary of any company that offers one, because they can't actually uphold it.", "we don't guarantee deals, nobody can", "William does more presentations in our private community, one to four a month."]) assert.equal(guard(s), null, s);
});

test("engaged: on always, off never, auto when the desk has been empty 3 minutes or nobody opened it by minute 5", () => {
  const now = 1_000_000_000;
  assert.equal(engaged("on", now, 1, now), true);
  assert.equal(engaged("off", null, 60, now), false);
  assert.equal(engaged("auto", null, 4, now), false);
  assert.equal(engaged("auto", null, 5, now), true);
  assert.equal(engaged("auto", now - 60_000, 40, now), false);
  assert.equal(engaged("auto", now - 180_000, 40, now), true);
  assert.equal(engaged("auto", now - 181_000, 2, now), true);
  assert.equal(asAutopilot("on"), "on");
  assert.equal(asAutopilot("sideways"), "auto");
  assert.equal(asAutopilot(null), "auto");
});

test("parseDecision: drafts are tidied, a bot tell goes to the desk, the kb key is kept when it is a slug", () => {
  const dashed = parseDecision({ action: "reply", category: "price", text: "depends on your market — that's what the call is for", sure: true, react: "", why: "price", kb: { key: "Price", question: "How much does it cost?" } });
  assert.equal(dashed.action, "reply");
  assert.equal(dashed.text, "depends on your market, that's what the call is for");
  assert.deepEqual(dashed.kb, { key: "price", question: "How much does it cost?" });
  const residue = parseDecision({ action: "reply", category: "product", text: "Great question! Yes, she texts too", sure: true, react: "", why: "texting" });
  assert.equal(residue.action, "ask_william");
  assert.equal(residue.text, "Great question! Yes, she texts too");
  assert.match(residue.why, /^sounds like a bot: chatbot residue; texting/);
  assert.equal(parseDecision({ action: "reply", category: "product", text: "yes she texts", react: "", why: "", kb: { key: "Texting!", question: "x" } }).kb, null);
  assert.equal(parseDecision({ action: "skip", category: "chatter", text: "", react: "", why: "", kb: { key: "price", question: "x" } }).kb, null);
  assert.deepEqual(parseDecision({ action: "ask_william", category: "other", text: "", react: "", why: "new one", kb: { key: "redfin-agents", question: "  Do you work with Redfin agents?  " } }).kb, { key: "redfin-agents", question: "Do you work with Redfin agents?" });
});

test("delayMs: the pause grows with the line, 40 ms a character, never past 25 s, still nothing in shadow", () => {
  assert.equal(delayMs("auto", () => 0, 100), 12_000);
  assert.equal(delayMs("auto", () => 0.999, 1000), 25_000);
  assert.equal(delayMs("shadow", () => 0, 1000), 0);
});

test("systemPrompt: the WRITING block, the are-you-AI rule, the KNOWLEDGE block from rows, and no Katherine-answers-replay line", () => {
  const plain = systemPrompt("PRICE: never in chat.");
  assert.ok(plain.includes("WRITING") && plain.includes("no dashes") && plain.includes("Never say whether you are AI or human"));
  assert.ok(!plain.includes("Katherine AI answers replay questions") && !plain.includes("KNOWLEDGE (William's approved answers"));
  assert.ok(plain.includes('"kb"'));
  const withKb = systemPrompt("PRICE: never in chat.", [{ key: "price", question: "How much does it cost?", answer: null, approved: "It depends on your market, so that's what the call is for.", approved_at: "2026-10-17T00:00:00Z", handling: "answer", asked: 24 }]);
  assert.ok(withKb.includes("KNOWLEDGE (William's approved answers") && withKb.includes("A: It depends on your market"));
  assert.ok(withKb.indexOf("PRICE: never in chat.") < withKb.indexOf("KNOWLEDGE (William's approved answers"));
  // The team's corrections (Fix and Delete on her lines, Oct 18) sit after the knowledge and before Kevin's replies; none when there are none.
  assert.ok(!plain.includes("CORRECTIONS ("));
  const withFix = systemPrompt("PRICE: never in chat.", [], [{ asked: "do you do rentals?", said: "yep, rentals work too", fixed: "sales only, no rentals" }]);
  assert.ok(withFix.includes("CORRECTIONS (") && withFix.includes("William: sales only, no rentals"));
  assert.ok(withFix.indexOf("CORRECTIONS (") < withFix.indexOf("HOW THE TEAM HAS ANSWERED"));
});

test("userTurn and PERSONA: what William is saying on screen rides in the turn when the transcript is known, and the rules are in the prompt", () => {
  const base = { minute: 2, pitchMinute: 75, name: "Sam", body: "yes", priorOwn: [], modReplies: [], said: [], recent: [], market: null, katherine: false };
  const plain = userTurn(base);
  assert.ok(!plain.includes("WILLIAM ON SCREEN") && !plain.includes("COMING UP"));
  const t = userTurn({ ...base, onScreen: { said: "Type YES if that makes sense.", next: "Now the pixel.", segment: "Start (minute 2 of 139)" } });
  assert.match(t, /ROOM: minute 2[^\n]*\nWILLIAM ON SCREEN \(the last 90 seconds, ending as they typed\): "Type YES if that makes sense\."\nCOMING UP \(the next 2 minutes\): "Now the pixel\."\nSEGMENT: Start \(minute 2 of 139\)\n/);
  const quiet = userTurn({ ...base, onScreen: { said: "", next: "", segment: null } });
  assert.ok(quiet.includes("(silence)") && quiet.includes("(nothing yet)") && !quiet.includes("SEGMENT:"));
  const s = systemPrompt("PRICE: never in chat.");
  assert.ok(s.includes("WHAT HE IS SAYING") && s.includes("answering him on screen") && s.includes("he's getting to that in a sec") && s.includes("never a quote"));
});

test("systemPrompt: tonight's class by minute rides in the prompt when the event has an outline", () => {
  const s = systemPrompt("PRICE: never in chat.", [], [], "minute 5: who William is\nminute 75: the offer and how to book");
  assert.ok(s.includes("TONIGHT'S CLASS (what William covers") && s.includes("minute 75: the offer and how to book"));
  assert.ok(s.indexOf("TONIGHT'S CLASS (what William covers") < s.indexOf("HOW THE TEAM HAS ANSWERED"));
  assert.ok(!systemPrompt("PRICE: never in chat.", [], [], "  ").includes("TONIGHT'S CLASS (what William covers"));
});

test("holdsReply: a repeat of the same question inside the window holds; a different question, an answer to her own question, or an old one posts (SPEC-kaitlyn-ghosts.md, A1)", () => {
  const last = { kb_key: "market-count", text: "@Frankie 3 across Michigan" };
  assert.equal(holdsReply(last, "market-count", 30_000), true);
  assert.equal(holdsReply(last, "price", 30_000), false);
  assert.equal(holdsReply(last, "market-count", PER_PERSON_MS), false);
  assert.equal(holdsReply(null, "market-count", 1_000), false);
  // Cindy, Oct 19: "OC" → her "Orange County in California, or another OC?" → "OC california" 7 s later must post.
  assert.equal(holdsReply({ kb_key: "market-count", text: "@Cindy Orange County in California, or another OC?" }, "market-count", 7_000), false);
  // A line with no key (a bare thanks) inside the window still holds against the same person.
  assert.equal(holdsReply(last, null, 30_000), true);
});

test("the prompt never suggests a shape the bot-tell check refuses, and the shapes she is not on the call for are gone (A2, A6)", () => {
  for (const [group, list] of Object.entries(SHAPES)) for (const s of list) assert.deepEqual(tells(s), [], `${group}: ${s}`);
  assert.ok(!SHAPES.price.some((s) => /^honestly/i.test(s)));
  assert.ok(!SHAPES.booked.some((s) => /see you on the call/i.test(s)));
  assert.match(systemPrompt(null), /3 in Boston, 7 across the state/);
});

test("handoffDue: a card left pending 90 s with no hand-off tonight and no human reply gets the line; acted on, answered, or younger cards do not (A3)", () => {
  const t0 = Date.parse("2026-10-19T23:09:00Z");
  const card = (status: string, ageMs: number) => ({ status, created_at: new Date(t0 - ageMs).toISOString() });
  assert.equal(handoffDue(card("pending", HANDOFF_AFTER_MS), t0, false, false), true);
  assert.equal(handoffDue(card("pending", HANDOFF_AFTER_MS - 1), t0, false, false), false);
  assert.equal(handoffDue(card("edited", HANDOFF_AFTER_MS * 2), t0, false, false), false);
  assert.equal(handoffDue(card("pending", HANDOFF_AFTER_MS * 2), t0, true, false), false);
  assert.equal(handoffDue(card("pending", HANDOFF_AFTER_MS * 2), t0, false, true), false);
});

test("the ghost bullet carries William's cases and the never-list (SPEC-kaitlyn-ghosts.md, B1)", () => {
  const p = systemPrompt(null);
  for (const phrase of ["you're just watching the comments", "you're avoiding the question", "it's illegal to do that in my market", "my rep didn't show", "why do you keep skipping me", "Never a ghost", "sounds robotic", "can you see it?"]) assert.ok(p.includes(phrase), phrase);
});
