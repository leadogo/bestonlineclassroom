import { test } from "node:test";
import assert from "node:assert/strict";
import { correctionsBlock, digestDue, digestText, factsLost, handoffLine, kbKey, kbQuestion, knowledgeBlock, type KbRow } from "./kaitlyn-kb.ts";

const row = (p: Partial<KbRow> & { key: string; question: string }): KbRow => ({ answer: null, approved: null, approved_at: p.approved ? "2026-10-17T00:00:00Z" : null, handling: "open", asked: 0, ...p });

test("kbKey and kbQuestion: a lowercase slug of 3 to 40 chars, a one-line question, or nothing", () => {
  assert.equal(kbKey("price"), "price");
  assert.equal(kbKey(" Redfin-Agents "), "redfin-agents");
  assert.equal(kbKey("Price!"), null);
  assert.equal(kbKey("ab"), null);
  assert.equal(kbKey("a".repeat(41)), null);
  assert.equal(kbKey("-leading"), null);
  assert.equal(kbKey(42), null);
  assert.equal(kbQuestion("  Do you work with Redfin\n agents?  "), "Do you work with Redfin agents?");
  assert.equal(kbQuestion("x".repeat(200)).length, 160);
  assert.equal(kbQuestion(null), "");
});

test("knowledgeBlock: approved answers as Q/A, hand-to-William keys, skip keys, and every key she may name", () => {
  const rows = [
    row({ key: "price", question: "How much does it cost?", approved: "It depends on your market, so that's what the call is for.", handling: "answer", asked: 24 }),
    row({ key: "legal-specifics", question: "Is AI calling legal in my state?", handling: "me", asked: 3 }),
    row({ key: "live", question: "Is this live or recorded?", handling: "ignore", asked: 6 }),
    row({ key: "redfin-agents", question: "Do you work with Redfin agents?", handling: "open", asked: 1 }),
  ];
  const b = knowledgeBlock(rows);
  assert.match(b, /^KNOWLEDGE \(William's approved answers/m);
  assert.match(b, /Q: How much does it cost\?\n\s*A: It depends on your market/);
  assert.match(b, /ALWAYS ASK_WILLIAM[^\n]*\n- legal-specifics: Is AI calling legal in my state\?/);
  assert.match(b, /SKIP[^\n]*\n- live: Is this live or recorded\?/);
  assert.match(b, /KEYS YOU MAY NAME[^\n]*\n[^\n]*price[^\n]*legal-specifics[^\n]*live[^\n]*redfin-agents/);
  assert.doesNotMatch(b, /A: null/);
  assert.equal(knowledgeBlock([]), "");
  // A rewrite waiting for his OK (approved text, no approved_at) is not in her answers, only in the keys she may name.
  const waiting = knowledgeBlock([row({ key: "rentals", question: "Do you do rentals?", answer: "no", approved: "Sales only, no rentals.", approved_at: null, handling: "answer", asked: 2 })]);
  assert.doesNotMatch(waiting, /A: Sales only/);
  assert.match(waiting, /\(none yet\)/);
  assert.match(waiting, /KEYS YOU MAY NAME[^\n]*\nrentals/);
});

test("correctionsBlock: the question, her line and William's; a removed line as a don't; nothing when there are none", () => {
  const b = correctionsBlock([
    { asked: "is it per lead or  monthly?", said: "You need to book a call because it depends on your market area", fixed: "per lead, and the call works out the number for your market" },
    { asked: "do you do rentals?", said: "yep, rentals work too", fixed: null },
  ]);
  assert.match(b, /^CORRECTIONS \(/);
  assert.match(b, /Q: is it per lead or monthly\?\n\s*you said: You need to book a call[^\n]*\n\s*William: per lead, and the call/);
  assert.match(b, /Q: do you do rentals\?\n\s*you said: yep, rentals work too\n\s*removed by the team/);
  assert.equal(correctionsBlock([]), "");
});

test("digestDue: 9 AM in Edmonton, once a day, across the clock change", () => {
  // 2026-10-18 15:00 UTC is 9:00 AM MDT
  assert.deepEqual(digestDue(new Date("2026-10-18T15:00:00Z"), null), { due: true, today: "2026-10-18" });
  assert.deepEqual(digestDue(new Date("2026-10-18T15:40:00Z"), null), { due: true, today: "2026-10-18" });
  assert.deepEqual(digestDue(new Date("2026-10-18T15:00:00Z"), "2026-10-18"), { due: false, today: "2026-10-18" });
  assert.equal(digestDue(new Date("2026-10-18T14:00:00Z"), null).due, false);
  assert.equal(digestDue(new Date("2026-10-18T16:00:00Z"), null).due, false);
  // After Nov 1 Edmonton is MST: 9 AM is 16:00 UTC
  assert.equal(digestDue(new Date("2026-11-03T15:00:00Z"), null).due, false);
  assert.deepEqual(digestDue(new Date("2026-11-03T16:00:00Z"), null), { due: true, today: "2026-11-03" });
});

test("digestText: nothing to say, one question, several with counts, and answers waiting", () => {
  const url = "https://www.bestonlineclassroom.com/admin/knowledge";
  assert.equal(digestText({ questions: [], people: 0, waiting: 0, url }), null);
  assert.equal(digestText({ questions: [], people: 0, waiting: 2, url }), `2 of Kaitlyn's answers are waiting for your OK: ${url}`);
  const one = digestText({ questions: [{ question: "Do you work with Redfin agents?", asked: 1 }], people: 1, waiting: 0, url })!;
  assert.match(one, /^Kaitlyn couldn't answer 1 question last night \(1 person asked\):\n• Do you work with Redfin agents\?\nAnswer it: https/);
  const many = digestText({ questions: [{ question: "Does it text in Spanish?", asked: 3 }, { question: "Do you work with Redfin agents?", asked: 1 }], people: 6, waiting: 2, url })!;
  assert.match(many, /^Kaitlyn couldn't answer 2 questions last night \(6 people asked\):\n• Does it text in Spanish\? \(×3\)\n• Do you work with Redfin agents\?\nAnswer them: https[^\n]+\n2 answers are waiting for your OK\.$/);
});

test("factsLost: a rewrite that drops a figure, a link or a name is caught; a faithful one passes", () => {
  const his = "The bonus is Katherine AI included for free instead of paying 250/mo, see getkatherine.ai, same as Zillow";
  assert.deepEqual(factsLost(his, "The bonus is Katherine AI included free instead of $250 a month, see getkatherine.ai, same as Zillow"), []);
  assert.deepEqual(factsLost(his, "The bonus is Katherine AI included free, see getkatherine.ai, same as Zillow"), ["250"]);
  assert.deepEqual(factsLost(his, "The bonus is Katherine AI included free instead of 250/mo, same as Zillow"), ["getkatherine.ai"]);
  assert.deepEqual(factsLost(his, "The bonus is Katherine AI included free instead of 250/mo, see getkatherine.ai"), ["Zillow"]);
  assert.deepEqual(factsLost("Conversion runs 1% to 5%. Yes, leads close.", "Conversion runs 1% to 5%, and yes, leads have closed."), []);
  assert.deepEqual(factsLost("We're based in Edmonton and so is William.", "We're based in Edmonton, and so is William."), []);
});

test("handoffLine: one of Kevin's shapes, never empty, picks by the draw", () => {
  const a = handoffLine(() => 0), b = handoffLine(() => 0.999);
  assert.ok(a.length > 10 && b.length > 10);
  assert.notEqual(a, b);
  assert.match(a + b, /team/);
});
