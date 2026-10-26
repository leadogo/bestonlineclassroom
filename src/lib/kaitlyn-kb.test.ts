import { test } from "node:test";
import assert from "node:assert/strict";
import { noticeIssues, renderNotice, type Notice } from "./slack.ts";
import { ANSWER_WINDOW_MS, answeredWithin, correctionsBlock, digestDue, digestNotice, factsLost, ghostBlock, kbKey, kbQuestion, knowledgeBlock, OWED_FLOOR, postedFrom, type KbRow } from "./kaitlyn-kb.ts";

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
    // An edit of a card she sent to the desk without a draft (migration 038): his answer with nothing of hers to unlearn.
    { asked: "Do you deal with the North East ??? Pittsburgh", said: "", fixed: "I believe we have 1 there, so you'll be fine" },
  ]);
  assert.match(b, /^CORRECTIONS \(/);
  assert.match(b, /Q: is it per lead or monthly\?\n\s*you said: You need to book a call[^\n]*\n\s*William: per lead, and the call/);
  assert.match(b, /Q: do you do rentals\?\n\s*you said: yep, rentals work too\n\s*removed by the team/);
  assert.match(b, /Q: Do you deal with the North East \?\?\? Pittsburgh\n\s*you said: \(nothing, you handed it to the desk\)\n\s*William: I believe we have 1 there/);
  assert.equal(correctionsBlock([]), "");
});

test("digestDue: from 9 AM in Edmonton for the rest of the day (a failed 9 AM post is retried at 10), once a day, across the clock change", () => {
  // 2026-10-18 15:00 UTC is 9:00 AM MDT
  assert.deepEqual(digestDue(new Date("2026-10-18T15:00:00Z"), null), { due: true, today: "2026-10-18" });
  assert.deepEqual(digestDue(new Date("2026-10-18T15:40:00Z"), null), { due: true, today: "2026-10-18" });
  assert.deepEqual(digestDue(new Date("2026-10-18T15:00:00Z"), "2026-10-18"), { due: false, today: "2026-10-18" });
  assert.equal(digestDue(new Date("2026-10-18T14:00:00Z"), null).due, false);
  assert.equal(digestDue(new Date("2026-10-18T16:00:00Z"), null).due, true, "10 AM still posts when 9 failed");
  assert.equal(digestDue(new Date("2026-10-18T16:00:00Z"), "2026-10-18").due, false, "but once a day");
  // After Nov 1 Edmonton is MST: 9 AM is 16:00 UTC
  assert.equal(digestDue(new Date("2026-11-03T15:00:00Z"), null).due, false);
  assert.deepEqual(digestDue(new Date("2026-11-03T16:00:00Z"), null), { due: true, today: "2026-11-03" });
});


const url = "https://www.bestonlineclassroom.com/admin/knowledge";
const clean = (n: Notice | null) => { assert.ok(n); assert.deepEqual(noticeIssues(n), [], renderNotice(n)); return renderNotice(n); };

test("digestNotice: nothing to say, answers waiting, one question, several with counts (Oct 23 2026: 'Kaitlyn couldn't answer 10 questions last night (6 people asked): … 3 answers are waiting for your OK' → a 🎯 with the questions in the thread)", () => {
  assert.equal(digestNotice({ questions: [], people: 0, waiting: 0, url }), null);
  const waiting = digestNotice({ questions: [], people: 0, waiting: 2, url });
  assert.equal(clean(waiting), "🎯 *Kaitlyn: 2 answers need your OK*\n→ @Will approve them before tonight's room. ✅ here when done.");
  assert.deepEqual(waiting!.detail, [`Approve: ${url}`]);
  const one = digestNotice({ questions: [{ question: "Do you work with Redfin agents?", asked: 1 }], people: 1, waiting: 0, url });
  assert.equal(clean(one), "🎯 *Kaitlyn couldn't answer 1 question last night (1 asked)*\n→ @Will answer them before tonight's room. ✅ here when done.");
  assert.deepEqual(one!.detail, ["• Do you work with Redfin agents?", `Answer it: ${url}`]);
  assert.deepEqual(digestNotice({ questions: [{ question: "ping <!here>?", asked: 1 }], people: 1, waiting: 0, url, unanswered: ["<@U1>"] })!.detail, ["• ping &lt;!here&gt;?", `Answer it: ${url}`, "Last night 1 person went unanswered: &lt;@U1&gt;."], "attendee text never reads as mrkdwn");
  const many = digestNotice({ questions: [{ question: "Does it text in Spanish?", asked: 3 }, { question: "Do you work with Redfin agents?", asked: 1 }], people: 6, waiting: 2, url });
  assert.equal(clean(many), "🎯 *Kaitlyn: 2 answers need your OK · 2 questions she couldn't answer*\n→ @Will approve them before tonight's room. ✅ here when done.");
  assert.deepEqual(many!.detail, ["• Does it text in Spanish? (×3)", "• Do you work with Redfin agents?", `Answer them: ${url}`]);
});

test("digestNotice: last night's unanswered people and the by-hand ghosts ride in the thread, with or without open questions (SPEC-kaitlyn-ghosts.md, E2); with nothing to answer the first audit line is the headline of a 📊", () => {
  const quiet = digestNotice({ questions: [], people: 0, waiting: 0, url, unanswered: ["Heather", "Cindy", "Glenn"], ghosted: [{ name: "Hamid", reason: "nag" }, { name: "Teri", reason: null }] });
  assert.equal(clean(quiet), "📊 *Last night 3 people went unanswered: Heather, Cindy, Glenn*");
  assert.deepEqual(quiet!.detail, ["Last night 3 people went unanswered: Heather, Cindy, Glenn.", "You ghosted 2 by hand: Hamid (nag), Teri."]);
  const one = digestNotice({ questions: [{ question: "Do you work with Redfin agents?", asked: 1 }], people: 1, waiting: 0, url, unanswered: ["Heather"], ghosted: [] });
  assert.equal(one!.kind, "ask");
  assert.deepEqual(one!.detail, ["• Do you work with Redfin agents?", `Answer it: ${url}`, "Last night 1 person went unanswered: Heather."]);
  assert.equal(digestNotice({ questions: [], people: 0, waiting: 0, url, unanswered: [], ghosted: [] }), null);
});

test("digestNotice and postedFrom: the agreement numbers on the number line, the stale staged answers and the owed tags in the thread (SPEC-kaitlyn-solo.md, F and G)", () => {
  const rows = [...Array(52).fill({ status: "auto" }), ...Array(6).fill({ status: "fixed" }), ...Array(2).fill({ status: "deleted" }), { status: "skipped", skip_reason: "wrong" }, { status: "skipped", skip_reason: "roll-call" }, { status: "pending" }, { status: "sent" }, { status: "edited" }];
  const p = postedFrom(rows);
  assert.deepEqual(p, { posted: 63, stood: 53, fixed: 6, deleted: 2, edited: 1, wrong: 1 });
  const read = digestNotice({ questions: [], people: 0, waiting: 0, url, posted: p });
  assert.equal(clean(read), "📊 *Kaitlyn posted 63 last night, 53 stood (84% agreement)*\n63 posted last night · 53 stood · 84% agreement");
  assert.deepEqual(read!.detail, ["Kaitlyn posted 63 last night: 53 stood, 6 you fixed, 2 you deleted, 1 you edited before sending, 1 you skipped as wrong (agreement 84%)."]);
  assert.equal(digestNotice({ questions: [], people: 0, waiting: 0, url, posted: postedFrom([{ status: "pending" }]) }), null, "nothing posted, nothing said");
  // Stale answers are waiting answers: they ride the 🎯 (waiting counts them) and the thread names them.
  const stale = digestNotice({ questions: [], people: 0, waiting: 2, url, stale: ["brokers", "contact-number"] });
  assert.equal(stale!.kind, "ask");
  assert.deepEqual(stale!.detail, [`Approve: ${url}`, `2 answers have waited over a week for your OK: brokers, contact-number. ${url}`]);
  // The owed line (SPEC-post-session.md, B): only from the floor.
  assert.equal(OWED_FLOOR, 50);
  assert.equal(digestNotice({ questions: [], people: 0, waiting: 0, url, owed: 49 }), null);
  assert.equal(clean(digestNotice({ questions: [], people: 0, waiting: 0, url, owed: 2700 })), "📊 *Outcome tags owed to ActiveCampaign: 2700 (the push is behind)*");
  assert.equal(clean(digestNotice({ questions: [], people: 0, waiting: 0, url, owed: -1 })), "📊 *Outcome tags owed to ActiveCampaign: unknown (the plan failed; check the push)*");
  const full = digestNotice({ questions: [{ question: "Does it text in Spanish?", asked: 3 }], people: 2, waiting: 1, url, unanswered: ["Heather"], posted: postedFrom([{ status: "sent" }]), stale: ["brokers"], owed: 2700, links: { written: 3, created: 1, pending: 4 } });
  assert.equal(clean(full), "🎯 *Kaitlyn: 1 answer needs your OK · 1 question she couldn't answer*\n→ @Will approve them before tonight's room. ✅ here when done.\n1 posted last night · 1 stood · 100% agreement");
  assert.deepEqual(full!.detail, ["• Does it text in Spanish? (×3)", `Answer it: ${url}`, "Last night 1 person went unanswered: Heather.", "Kaitlyn posted 1 last night: 1 stood (agreement 100%).", `1 answer has waited over a week for your OK: brokers. ${url}`, "Links: the sweep gave 3 contacts a personal link yesterday (1 needed a room row); 1 still blank.", "Outcome tags owed to ActiveCampaign: 2700 (the push is behind)."]);
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

test("ghostBlock: the line that got them ghosted, what they said before it, and the desk's reason; nothing when there are none (SPEC-kaitlyn-ghosts.md, B3)", () => {
  const b = ghostBlock([
    { line: "william,I am surprised if you receive my messages!!!", context: ["William,Have you received my messages?", "William,it looks like that you receivbe my messages!"], reason: "nag", answered: 4 },
    { line: "Is this a recording lol", context: null, reason: null },
  ]);
  assert.match(b, /^LINES THE TEAM GHOSTED \(/);
  assert.match(b, /- william,I am surprised if you receive my messages!!! \(nag; answered 4 times before; before it: "William,Have you received my messages\?" \| "William,it looks like that you receivbe my messages!"\)/);
  assert.match(b, /- Is this a recording lol$/m);
  assert.equal(ghostBlock([]), "");
});



test("answeredWithin: a moderator line to the person inside 15 minutes counts, her hand-off line does not, nor a line before theirs or too late (SPEC-kaitlyn-ghosts.md, E; review of Oct 20)", () => {
  const t0 = Date.parse("2026-10-19T23:09:00Z");
  const at = (ms: number) => new Date(t0 + ms).toISOString();
  const told = [
    { id: 1, mentions: ["p1"], created_at: at(60_000) },
    { id: 2, mentions: ["p2"], created_at: at(60_000) },
    { id: 3, mentions: ["p3"], created_at: at(ANSWER_WINDOW_MS + 1) },
    { id: 4, mentions: ["p4"], created_at: at(-1) },
  ];
  assert.equal(answeredWithin(t0, "p1", told), true);
  assert.equal(answeredWithin(t0, "p2", told, new Set([2])), false);
  assert.equal(answeredWithin(t0, "p3", told), false);
  assert.equal(answeredWithin(t0, "p4", told), false);
  assert.equal(answeredWithin(t0, "p5", told), false);
});

test("digestNotice: the link sweep's line (SPEC-friday-unattended.md, E4) only when it wrote something or left blanks", () => {
  const base = { questions: [], people: 0, waiting: 0, url: "u" };
  const line = (o: Parameters<typeof digestNotice>[0]) => digestNotice(o)!.detail![0];
  assert.equal(digestNotice({ ...base, links: { written: 0, created: 0, pending: 0 } }), null);
  assert.match(line({ ...base, links: { written: 12, created: 2, pending: 12 } }), /gave 12 contacts a personal link yesterday \(2 needed a room row\)\./);
  assert.match(line({ ...base, links: { written: 1, created: 0, pending: 4 } }), /gave 1 contact a personal link yesterday; 3 still blank\./);
  // Both runs of the day add up; a run older than a day does not.
  const now = new Date("2026-10-24T15:00:00Z");
  assert.match(line({ ...base, now, links: { at: "2026-10-24T09:20:00Z", written: 2, created: 0, pending: 2, prev: { at: "2026-10-23T21:20:00Z", written: 5, created: 1, pending: 5 } } }), /gave 7 contacts a personal link yesterday \(1 needed a room row\)\./);
  assert.match(line({ ...base, now, links: { at: "2026-10-24T09:20:00Z", written: 2, created: 0, pending: 2, prev: { at: "2026-10-22T21:20:00Z", written: 5, created: 1, pending: 5 } } }), /gave 2 contacts a personal link yesterday\./);
});
