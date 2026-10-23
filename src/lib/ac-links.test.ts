import assert from "node:assert/strict";
import { test } from "node:test";
import { linkPlan, linkSlot, sessionDateFor, sweepLine } from "./ac-links.ts";

const c = (id: string, email: string, cdate = "2026-10-21T17:00:00-05:00") => ({ id, email, cdate });

test("linkPlan: a personal link is left alone; a door link, an EasyWebinar link, an empty field and a missing row each get a write; a test sample and a contact without an email are skipped", () => {
  const fields = new Map([
    ["1", { join: { id: "a", value: "https://watch.bookmoreshowings.com/abcdefghjkmn" } }],
    ["2", { join: { id: "b", value: "https://watch.bookmoreshowings.com/w/ailg-r?src=email&eh=00" } }],
    ["3", { join: { id: "c", value: "https://william1.easywebinar.live/login?key=x" } }],
    ["4", { join: { id: "d", value: "" } }],
  ]);
  const tokens = new Map([["two@x.com", "tok2tok2tok2"]]);
  const plan = linkPlan([c("1", "one@x.com"), c("2", "two@x.com"), c("3", "three@x.com"), c("4", "four@x.com"), c("5", "five@x.com"), c("6", "a-test-sample@thefuturerealestateagent.com"), c("7", "")], fields, tokens);
  assert.deepEqual(plan.map((t) => [t.contact.id, t.token]), [["2", "tok2tok2tok2"], ["3", null], ["4", null], ["5", null]]);
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

test("sweepLine: OK when nothing is left, 'still blank' otherwise", () => {
  assert.match(sweepLine({ scanned: 100, pending: 3, written: 3, created: 1, failed: 0, truncated: false, sample: [], scope: "3 days" }, "2026-10-23T15"), /^Links OK .*3 days.*3 repaired, 1 room rows created, 0 of 100/);
  assert.match(sweepLine({ scanned: 100, pending: 5, written: 2, created: 0, failed: 3, truncated: true, sample: [], scope: "full" }, null), /^Links: still blank .*full.*3 of 100 .*3 failed.*budget hit/);
});
