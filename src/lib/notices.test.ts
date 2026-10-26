// Every room post on the schema, from the posts as they landed Oct 23–26 2026 (the audit's fixtures). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { autopilotNotice, broadcastNotice, canaryNotice, clientWallNotice, complaintNotice, deskPassedNotice, ghostNotice, joinClickNotice, learnedNotice, needsYouNotice, nightlyNotice, qrScanNotice, wallCapNotice } from "./notices.ts";
import { noticeIssues, renderNotice, type Notice } from "./slack.ts";

const clean = (n: Notice) => { assert.deepEqual(noticeIssues(n), [], renderNotice(n)); return renderNotice(n); };
// The feed glyphs (🔔 📱 🚧) ride `notice.emoji`; the bridge renders ✅ until bms-dashboard's notification-schema PR (the emoji slot) deploys, so these assert what lands after it.

test("join click: 🔔 *Mani* · +1647… clicked *Join & Claim Bonus* at 1:15 into the session · click #1 tonight → one ✅ with the phone on the headline", () => {
  assert.equal(clean(joinClickNotice({ name: "Mani", phone: "+16475274777", label: "Join & Claim Bonus", at: "1:15", replay: false, nth: 1 })), "🔔 *Mani clicked Join & Claim Bonus at 1:15 · (647) 527-4777*\nclick #1 tonight");
  assert.equal(clean(joinClickNotice({ name: "Bo", phone: null, label: null, at: "0:40", replay: true, nth: 0 })), "🔔 *Bo clicked the offer on the replay*");
});

test("QR scan: 📱 QR scanned at 1:15 into the session (6:15 PM) → counts the night's scans", () => {
  assert.equal(clean(qrScanNotice({ at: "1:15", clock: "6:15 PM", nth: 4 })), "📱 *QR scanned at 1:15 · 6:15 PM · scan #4 tonight*");
});

test("client wall: 🚧 Client wall: Omayra (<email>) opened the join link for AI For Agents Masterclass 2026-10-25 and got the 404 → one shape; the cap refusal is a 🚨", () => {
  assert.equal(clean(clientWallNotice({ name: "Omayra", email: "omayra@example.com", path: "join", eventTitle: "AI For Agents Masterclass", date: "2026-10-25" })), "🚧 *Client wall: Omayra hit the 404 on the join link*\nomayra@example.com · AI For Agents Masterclass 2026-10-25");
  assert.equal(clean(wallCapNotice(412, 300)), "🚨 *Client wall: a sync would have walled 412 people, nobody was walled*\ncap 300; check the snapshot bms-dashboard sent.");
});

test("canary: 🟢 Canary: AI For Agents Masterclass runs at 5 PM Mountain. HTTP 206 … → a health check with a tick per check; a failure asks Will", () => {
  const checks = [
    { name: "video", ok: true, detail: "HTTP 206 on a byte range", short: "video" },
    { name: "open page", ok: true, detail: "HTTP 200", short: "open page" },
    { name: "crowd", ok: true, detail: "753 simulated messages", short: "753 simulated messages" },
    { name: "registered", ok: true, detail: "134 hold a link for today", short: "134 registered" },
  ];
  assert.equal(clean(canaryNotice({ title: "AI For Agents Masterclass", at: "5 PM Mountain", checks })), "✅ *Room health check: AI For Agents Masterclass is ready (5 PM Mountain)*\nvideo ✓ · open page ✓ · 753 simulated messages ✓ · 134 registered ✓");
  const failed = canaryNotice({ title: "AI For Agents Masterclass", at: "5 PM Mountain", checks: [{ ...checks[0], ok: false, detail: "HTTP 403 on a byte range" }, ...checks.slice(1)] });
  assert.equal(clean(failed), "🎯 *Room health check failed: video*\n→ @Will fix before 5 PM Mountain. ✅ here when done.\nvideo: HTTP 403 on a byte range");
  assert.deepEqual(failed.detail, ["✗ video: HTTP 403 on a byte range", "✓ open page: HTTP 200", "✓ crowd: 753 simulated messages", "✓ registered: 134 hold a link for today"]);
});

test("the 8:50 readout: 🔗 *Joins by source, …:* email 15 (4 booked) · sms 0 · skool 1 · calendar 1 (1 booked) · direct 23 (11 booked) + the open-link line + the wall total → one 📊", () => {
  const counts = (joined: number, booked = 0, clicked = 0) => ({ clicked, joined, at_pitch: 0, booked });
  const joins = { email: counts(15, 4, 22), sms: counts(0, 0, 0), skool: counts(1, 0, 3), calendar: counts(1, 1, 2), direct: counts(23, 11) };
  const n = nightlyNotice({ label: "Fri Oct 23", joins, openLink: { title: "AI For Agents Masterclass", date: "2026-10-23", tonight: { cards: 8, submitted: 9, joined: 0 }, baseline: { cards: 186, submitted: 82, joined: 64 }, nights: 7 }, wall: { held: 1, hit: 0 }, broadcast: { weekday: "sunday", date: "2026-10-23", title: "How many leads did you waste?", result: { emailed: 6200, doorClicks: 143, entered: 61, joined: 48, atPitch: 30, booked: 3 } } });
  assert.equal(clean(n), "📊 *Joins by source, Fri Oct 23: 40 joined, 16 booked*\nemail 15 (4 booked) · skool 1 · calendar 1 (1 booked) · direct 23 (11 booked) · open-link cards 8 → 9 emails → 0 joined · client wall 1 held, 0 hit");
  assert.equal(n.detail?.length, 3);
  assert.match(n.detail![0], /^link clicks: email 22 · sms 0 · skool 3 · calendar 2$/);
  assert.match(n.detail![1], /^⚪ Open link, AI For Agents Masterclass 2026-10-23: 8 cards/);
  assert.match(n.detail![2], /^📊 \*Skool sunday broadcast · 2026-10-23\*/);
  assert.equal(clean(nightlyNotice({ label: "Sat Oct 24", joins: { email: counts(0), sms: counts(0), skool: counts(0), calendar: counts(0), direct: counts(0) }, openLink: null, wall: { held: 0, hit: 0 }, broadcast: null })), "📊 *Joins by source, Sat Oct 24: 0 joined, 0 booked*\nnobody joined · client wall 0 held, 0 hit");
});

test("Skool broadcast: as is, through the bridge", () => {
  assert.equal(clean(broadcastNotice({ weekday: "sunday", dry: false, ok: true, group: "bms-agent-accelerator", emailToggle: "on", postUrl: "https://www.skool.com/x/post" })), "✅ *Skool sunday broadcast posted*\nbms-agent-accelerator · email toggle on · https://www.skool.com/x/post");
  assert.equal(clean(broadcastNotice({ weekday: "wednesday", dry: false, ok: false, group: "bms-agent-accelerator", error: "login wall", sessionId: "abc" })), "🚨 *Skool wednesday broadcast failed*\nbms-agent-accelerator · login wall · Browserbase session abc");
});

test("Kaitlyn's desk lines: autopilot, ghost, the 90 s post, a fact learned, a client complaint", () => {
  assert.equal(clean(autopilotNotice({ on: true, by: "switch" })), "✅ *Autopilot on: Kaitlyn is answering on her own tonight*");
  assert.equal(clean(autopilotNotice({ on: true, by: "empty_desk" })), "✅ *Autopilot on: nobody on the desk for 3 min, Kaitlyn is answering*");
  assert.equal(clean(autopilotNotice({ on: false, name: "Danielle" })), "✅ *Autopilot off: Danielle is back on the desk*");
  // Now: Kaitlyn ghosted Roger Hahn: "Nothing but fluff..." (sneer, impatience). Unghost on the desk if that was wrong.
  assert.equal(clean(ghostNotice({ name: "Roger", message: "Nothing but fluff...", why: "sneer, impatience" })), "✅ *Kaitlyn ghosted Roger: sneer, impatience*\n\"Nothing but fluff...\" · unghost on the desk if that was wrong.");
  assert.equal(clean(deskPassedNotice({ name: "Ana", text: "yes it will be sent afterwards" })), "✅ *Kaitlyn posted after 90 s on the desk: Ana*\n\"yes it will be sent afterwards\".");
  assert.equal(clean(learnedNotice({ name: "William", fact: "The bonus is Katherine AI for 90 days" })), "✅ *Kaitlyn learned a fact from William*\nThe bonus is Katherine AI for 90 days.");
  assert.equal(clean(complaintNotice({ name: "Teri", email: null, message: "my ads have not run in a week" })), "🚨 *A client complaint in the room, answered privately: Teri*\nno email\n\"my ads have not run in a week\" · someone should follow up tomorrow.");
});

test("Kaitlyn needs you: Wayne Williams: \"What are your thoughts on the Close crm?\" → ask william \"Zapier covers most CRMs…\" → one 🎯, the repeat says how often it was asked", () => {
  const first = needsYouNotice({ name: "Wayne", ghosted: false, question: "What are your thoughts on the Close crm?", action: "ask_william", draft: "Zapier covers most CRMs, so Close works through that", asked: 1 });
  assert.equal(clean(first), "🎯 *Kaitlyn needs you — Wayne: \"What are your thoughts on the Close…\"*\n→ @Will answer on the desk or reply here. ✅ here when done.\n\"What are your thoughts on the Close crm?\" · her draft: \"Zapier covers most CRMs, so Close works through that\".");
  const again = needsYouNotice({ name: "Wayne", ghosted: true, question: "Close crm?", action: "ask_william", draft: "", asked: 3 });
  assert.equal(clean(again), "🎯 *Kaitlyn needs you — (ghosted) Wayne: \"Close crm?\"*\n→ @Will answer on the desk or reply here. ✅ here when done.\nshe would ask william · asked 3×.");
  assert.match(renderNotice(needsYouNotice({ name: "Wayne", ghosted: false, question: "Close crm?", action: "ghost", draft: "", asked: 2 })), /she would ghost · asked twice\.$/);
  // Attendee text never reads as mrkdwn, and a long draft stays under bms's note cap.
  const markup = needsYouNotice({ name: "<!channel>", ghosted: false, question: "ping <!here>?", action: "ask_william", draft: "x".repeat(600), asked: 1 });
  assert.equal(renderNotice(markup).split("\n")[0], "🎯 *Kaitlyn needs you — &lt;!channel&gt;: \"ping &lt;!here&gt;?\"*");
  assert.ok(markup.note!.length < 400 && markup.note!.endsWith("…"));
  assert.ok(deskPassedNotice({ name: "Ana", text: "y".repeat(600) }).note!.length < 400);
  process.env.SLACK_WILLIAM_USER_ID = "U04MLPJAVUH";
  assert.match(renderNotice(needsYouNotice({ name: "Wayne", ghosted: false, question: "Close crm?", action: "ghost", draft: "", asked: 1 })), /\n→ <@U04MLPJAVUH> answer on the desk or reply here\./);
  delete process.env.SLACK_WILLIAM_USER_ID;
});
