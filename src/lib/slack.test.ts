// The notice slots the bridge renders, mirrored for dry runs and the builder tests. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { clipChars, clipWords, NOTE_MAX_CHARS, noticeIssues, renderNotice, williamMention } from "./slack.ts";
import { prettyPhone } from "./chat.ts";

test("renderNotice: the kind's emoji, the headline bold, the ask line, three numbers on one line, the note with its period", () => {
  const text = renderNotice({ kind: "ask", headline: "Kaitlyn: 3 answers need your OK", ask: { who: "Will", action: "approve them before tonight's room" }, numbers: ["63 posted last night", "48 stood", "76% agreement", "a fourth is cut"], note: "the questions are in the thread" });
  assert.equal(text, "🎯 *Kaitlyn: 3 answers need your OK*\n→ @Will approve them before tonight's room. ✅ here when done.\n63 posted last night · 48 stood · 76% agreement\nthe questions are in the thread.");
  assert.equal(renderNotice({ kind: "receipt", headline: "Autopilot on: Kaitlyn is answering on her own tonight." }), "✅ *Autopilot on: Kaitlyn is answering on her own tonight*");
  assert.equal(renderNotice({ kind: "receipt", emoji: "🔔", headline: "a feed with its own sign" }), "🔔 *a feed with its own sign*", "a per-event feed's emoji replaces the kind's");
});

test("noticeIssues: the headline cap, an emoji of its own, an ask on the wrong kind, too many numbers, too many lines", () => {
  assert.deepEqual(noticeIssues({ kind: "read", headline: "Fri Oct 23: 40 people (median 57), 15 booked (median 10)", numbers: ["peak 36"] }), []);
  assert.match(noticeIssues({ kind: "read", headline: "one two three four five six seven eight nine ten eleven twelve thirteen" })[0], /13 words/);
  assert.match(noticeIssues({ kind: "read", headline: "🔔 a click" })[0], /own emoji/);
  assert.match(noticeIssues({ kind: "ask", headline: "no ask line" })[0], /needs an ask/);
  assert.match(noticeIssues({ kind: "receipt", headline: "x", ask: { who: "Will", action: "do" } })[0], /carries an ask/);
  assert.match(noticeIssues({ kind: "read", headline: "x", numbers: ["1", "2", "3", "4"] })[0], /4 numbers/);
});

test("prettyPhone and clipWords", () => {
  assert.equal(prettyPhone("+16475274777"), "(647) 527-4777");
  assert.equal(prettyPhone("647-527-4777"), "(647) 527-4777");
  assert.equal(prettyPhone("+44 20 7946 0958"), "+44 20 7946 0958");
  assert.equal(prettyPhone(null), "");
  assert.equal(clipWords("What are your thoughts on the Close crm?", 7), "What are your thoughts on the Close…");
  assert.equal(clipWords("short", 7), "short");
  assert.equal(clipChars("x".repeat(NOTE_MAX_CHARS + 50)).length, NOTE_MAX_CHARS, "a note stays under bms's 400-char cap, with its ellipsis");
  assert.equal(clipChars("short"), "short");
});

test("williamMention: the real mention when SLACK_WILLIAM_USER_ID is set, plain Will until then", () => {
  delete process.env.SLACK_WILLIAM_USER_ID;
  assert.equal(williamMention(), "Will");
  process.env.SLACK_WILLIAM_USER_ID = "U04MLPJAVUH";
  assert.equal(williamMention(), "<@U04MLPJAVUH>");
  assert.match(renderNotice({ kind: "ask", headline: "x", ask: { who: williamMention(), action: "fix it" } }), /^🎯 \*x\*\n→ <@U04MLPJAVUH> fix it\. ✅ here when done\.$/);
  delete process.env.SLACK_WILLIAM_USER_ID;
});
