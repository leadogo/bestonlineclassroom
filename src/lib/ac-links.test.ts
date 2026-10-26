import assert from "node:assert/strict";
import { test } from "node:test";
import { linkPlan, linkSlot, linkSources, sessionDateFor, sweepFailedNotice, sweepNotice } from "./ac-links.ts";
import { noticeIssues, renderNotice } from "./slack.ts";

test("linkSources: incremental filters the tag by created_after and the lists by updated_after; full has no window", () => {
  const inc = linkSources(false, "2026-10-20");
  assert.equal(inc.length, 3);
  assert.match(inc[0], /tagid=304.*created_after\]=2026-10-20/);
  assert.ok(inc.slice(1).every((p) => /listid=\d+&status=1.*updated_after\]=2026-10-20/.test(p)));
  assert.ok(linkSources(true, "2026-10-20").every((p) => !/_after/.test(p)));
});

const c = (id: string, email: string, cdate = "2026-10-21T17:00:00-05:00") => ({ id, email, cdate });

test("linkPlan: a personal link is left alone; a door link, an EasyWebinar link, an empty field and a missing row each get a write; a test sample and a contact without an email are skipped", () => {
  const fields = new Map([
    ["1", { join: { id: "a", value: "https://watch.bookmoreshowings.com/abcdefghjkmn" } }],
    ["2", { join: { id: "b", value: "https://watch.bookmoreshowings.com/w/ailg-r?src=email&eh=00" } }],
    ["3", { join: { id: "c", value: "https://william1.easywebinar.live/login?key=x" } }],
    ["4", { join: { id: "d", value: "" } }],
  ]);
  const tokens = new Map([["two@x.com", "tok2tok2tok2"]]);
  const plan = linkPlan([c("1", "one@x.com"), c("2", "two@x.com"), c("3", "three@x.com"), c("4", "four@x.com"), c("5", "five@x.com"), c("6", "a-test-sample@thefuturerealestateagent.com"), c("7", ""), c("8", "  Mixed.Case@X.com "), c("9", "not an email")], fields, tokens);
  assert.deepEqual(plan.map((t) => [t.contact.id, t.token]), [["2", "tok2tok2tok2"], ["3", null], ["4", null], ["5", null], ["8", null]]);
  assert.equal(plan[4].email, "mixed.case@x.com", "normalized like a registration");
});

test("sessionDateFor: a past AC session date wins, an ISO one too; today or later and a missing one fall to yesterday or the created day", () => {
  assert.equal(sessionDateFor("10/18/2026", "2026-10-01T00:00:00-05:00", "2026-10-23"), "2026-10-18");
  assert.equal(sessionDateFor("2026-10-20T17:00:00", "2026-10-01T00:00:00-05:00", "2026-10-23"), "2026-10-20");
  assert.equal(sessionDateFor("10/23/2026", "2026-10-01T00:00:00-05:00", "2026-10-23"), "2026-10-22");
  assert.equal(sessionDateFor(undefined, "2026-10-21T17:00:00-05:00", "2026-10-23"), "2026-10-21");
  assert.equal(sessionDateFor(undefined, "2026-10-23T09:00:00-05:00", "2026-10-23"), "2026-10-22");
});

test("linkSlot: the 3 AM slot from 3 to 14 Edmonton, the 3 PM slot from 15, none before 3", () => {
  assert.equal(linkSlot(new Date("2026-10-23T09:20:00Z")), "2026-10-23T03");
  assert.equal(linkSlot(new Date("2026-10-23T20:20:00Z")), "2026-10-23T03");
  assert.equal(linkSlot(new Date("2026-10-23T21:20:00Z")), "2026-10-23T15");
  assert.equal(linkSlot(new Date("2026-10-24T05:59:00Z")), "2026-10-23T15");
  assert.equal(linkSlot(new Date("2026-10-23T07:30:00Z")), null);
});

test("sweepNotice: a sweep that leaves every contact with a link posts nothing, a repair included (Oct 26 2026, 'Links OK (… sweep, 3 days): 1 repaired, 0 room rows created, 0 of 10022 …' is gone; the 9 AM digest's thread carries the repair count); a contact still blank or a failed write is a 🚨", () => {
  assert.equal(sweepNotice({ scanned: 10022, pending: 0, written: 0, created: 0, failed: 0, truncated: false, sample: [], scope: "3 days" }, "2026-10-23T03"), null);
  assert.equal(sweepNotice({ scanned: 10022, pending: 1, written: 1, created: 0, failed: 0, truncated: false, sample: [], scope: "3 days" }, "2026-10-23T03"), null, "a repair is the sweep working");
  const blank = sweepNotice({ scanned: 100, pending: 5, written: 2, created: 0, failed: 3, truncated: true, sample: [], scope: "full" }, null)!;
  assert.deepEqual(noticeIssues(blank), []);
  assert.equal(renderNotice(blank), "🚨 *Links sweep: 3 contacts still have no personal link*\n2 repaired · 0 room rows created · 3 of 100 checked still blank\nforced sweep, full · 3 failed · budget hit, the next run continues.");
  assert.equal(renderNotice(sweepFailedNotice("ActiveCampaign read failed: /contacts")), "🚨 *Links sweep failed: contacts may get a blank promo*\nActiveCampaign read failed: /contacts · next try in an hour.");
});
