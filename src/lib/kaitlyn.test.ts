import { test } from "node:test";
import assert from "node:assert/strict";
import { ASSISTED, asMode, delayMs, extractJson, ghostsItself, guard, marketLine, parseDecision, postsItself, systemPrompt, userTurn, withoutMention } from "./kaitlyn.ts";
import { EXAMPLES } from "./kaitlyn-examples.ts";

test("parseDecision: the tool input checked; a wordless reply skips, a guarded reply becomes ask_william with the draft kept", () => {
  assert.deepEqual(parseDecision({ action: "reply", category: "market", text: "  weve got 10 in LA,   youre good 🙌 ", react: "🔥", why: "named a market" }), { action: "reply", category: "market", text: "weve got 10 in LA, youre good 🙌", react: "🔥", why: "named a market" });
  assert.equal(parseDecision({ action: "reply", category: "market", text: "", react: "", why: "" }).action, "skip");
  assert.equal(parseDecision({ action: "dance", category: "nope", text: "x", react: "🎉", why: "" }).action, "skip");
  assert.equal(parseDecision({ action: "skip", category: "nope", text: "x", react: "🎉", why: "" }).react, "");
  assert.equal(parseDecision({ action: "skip", category: "chatter", text: "ignored", react: "👍", why: "" }).text, "");
  assert.equal(parseDecision({ action: "ghost", category: "negative", text: "ignored", react: "", why: "heckling" }).text, "");
  const priced = parseDecision({ action: "reply", category: "price", text: "it's $400 a month", react: "", why: "asked the price" });
  assert.equal(priced.action, "ask_william");
  assert.equal(priced.text, "it's $400 a month");
  assert.match(priced.why, /^draft mentions a price; asked the price/);
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
  const reply = (category: (typeof ASSISTED extends Set<infer C> ? C : never)) => ({ action: "reply" as const, category, text: "x", react: "", why: "" });
  assert.equal(postsItself("shadow", reply("market")), false);
  assert.equal(postsItself("assisted", reply("market")), true);
  assert.equal(postsItself("assisted", reply("product")), false);
  assert.equal(postsItself("assisted", reply("price")), true);
  assert.equal(postsItself("auto", reply("product")), true);
  assert.equal(postsItself("auto", { action: "ghost", category: "negative", text: "", react: "", why: "" }), false);
  // Reading 5 s, typing 80 characters at 4 a second, never busy at pick 0; at pick 0.999 the busy tail lands and the cap holds a long line at two minutes.
  assert.equal(delayMs("shadow", 80), 0);
  assert.equal(delayMs("assisted", 80, () => 0), 25_000);
  const slow = delayMs("auto", 80, () => 0.999);
  assert.ok(slow > 85_000 && slow < 95_000, String(slow));
  assert.equal(delayMs("assisted", 300, () => 0.999), 120_000);
  const ghost = (category: "negative" | "other") => ({ action: "ghost" as const, category, text: "", react: "", why: "" });
  assert.equal(ghostsItself("shadow", ghost("negative")), false);
  assert.equal(ghostsItself("assisted", ghost("negative")), true);
  assert.equal(ghostsItself("auto", ghost("negative")), true);
  assert.equal(ghostsItself("assisted", ghost("other")), false);
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
  assert.ok(EXAMPLES.qa.length > 150 && EXAMPLES.ghosts.length > 15);
  assert.ok(s.includes(EXAMPLES.qa[0].a) && s.includes(EXAMPLES.ghosts[0]));
  assert.ok(systemPrompt(null).includes("No fact sheet"));
  assert.ok(s.includes("before the pitch, a bare city or state with no question") && s.includes("Katherine AI's polls"));
  assert.ok(s.includes("YOU ALREADY SAID TONIGHT is in every turn") && s.includes("No customer-service phrases") && !s.includes("bubblier"));
  const t = userTurn({ minute: 82, pitchMinute: 75, name: "Ana", body: "LA", priorOwn: ["hi from LA"], modReplies: [], said: ["7 in Massachusetts so you're good", "nobody in Chelan yet"], recent: ["[attendee] Bo: Chicago"], market: "directory says 10 clients in Los Angeles, CA", katherine: false });
  assert.match(t, /minute 82, the pitch started at minute 75/);
  assert.match(t, /PERSON: Ana, earlier tonight: "hi from LA"/);
  assert.match(t, /MODERATORS TO THEM TONIGHT: nothing yet/);
  assert.match(t, /YOU ALREADY SAID TONIGHT \(oldest first\): "7 in Massachusetts so you're good" \| "nobody in Chelan yet"/);
  assert.match(t, /MESSAGE TO DECIDE ON: Ana: "LA"$/);
  assert.match(userTurn({ minute: 3, pitchMinute: 75, name: "Bo", body: "hi", priorOwn: [], modReplies: ["@Bo welcome!"], said: [], recent: [], market: null, katherine: true }), /before the pitch[\s\S]*\nMARKET DATA: none \(no place named\)\nKATHERINE AI: will answer[\s\S]*YOU ALREADY SAID TONIGHT \(oldest first\): nothing yet/);
});
