import { test } from "node:test";
import assert from "node:assert/strict";
import { tells, tidy } from "./humanize.ts";

test("tidy: dashes become commas, curly quotes straight, spacing kept sane", () => {
  assert.equal(tidy("Pricing depends on the market — that's what the call is for"), "Pricing depends on the market, that's what the call is for");
  assert.equal(tidy("Follow Up Boss – GoHighLevel -- Lofty all connect"), "Follow Up Boss, GoHighLevel, Lofty all connect");
  assert.equal(tidy("It’s “fine” — really"), "It's \"fine\", really");
  assert.equal(tidy("  two   spaces  "), "two spaces");
  assert.equal(tidy("no dashes here, none"), "no dashes here, none");
  assert.equal(tidy("the e-myth revisited"), "the e-myth revisited");
});

test("tells: the machine-checkable AI patterns, and none on William's approved lines", () => {
  assert.deepEqual(tells("It's not just a dialer, it's a whole follow-up system"), ["not X but Y"]);
  assert.deepEqual(tells("Not only does she call, but she texts too"), ["not X but Y"]);
  assert.deepEqual(tells("Great question! Pricing depends on your market"), ["chatbot residue"]);
  assert.deepEqual(tells("Of course! Yes, you can upload your own contacts"), ["chatbot residue"]);
  assert.deepEqual(tells("Let me know if you have any other questions"), ["chatbot residue"]);
  assert.deepEqual(tells("We delve into that on the call"), ["stock word: delve"]);
  assert.deepEqual(tells("It's a seamless, robust system"), ["stock word: seamless", "stock word: robust"]);
  assert.deepEqual(tells("She calls, texts and follows up. That's the real win."), ["closer"]);
  assert.deepEqual(tells("Honestly? It depends on your market"), ["staged opener"]);
  assert.deepEqual(tells("Here's the thing: it depends on your market"), ["staged opener"]);
  for (const line of [
    "It depends on your market area, the type of leads, and the cost per lead there, so that's exactly what the free call is for.",
    "Depends on the market, but you don't need much. Plenty of people start at $10 a day.",
    "No guarantee, and be wary of any company that offers one, because they can't actually uphold it.",
    "Conversion runs 1% to 5%, same as any brokerage, team or market. Some people are fine talking to AI and some aren't, and that's okay.",
    "of course",
    "Yes, I see you. Ask away and I'll help where I can.",
    "got it 🙌 confirmation's on its way",
  ]) assert.deepEqual(tells(line), [], line);
});
