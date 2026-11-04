import { test } from "node:test";
import assert from "node:assert/strict";
import { latestDate, MISSED_RERUNS_PER_RUN, missedAction, missedOwed, orderTags, PUSH_BUDGET_MS, withinBudget, type Planned } from "./outcome-push.ts";

const p = (session_date: string, tag: string, end: boolean, n: number): Planned => ({ registrant_id: `r${n}`, email: `p${n}@example.com`, first_name: `P${n}`, tag, session_date, end });

test("orderTags: newest session first, session-end tags before the rest, the given order kept inside a group (SPEC-post-session.md, A)", () => {
  const items = [p("2026-10-19", "ailgr_registered", false, 1), p("2026-10-20", "ailgr_registered", false, 2), p("2026-10-20", "ailgr_missed", true, 3), p("2026-10-19", "ailgr_attended", true, 4), p("2026-10-20", "ailgr_attended", true, 5), p("2026-10-20", "ailgr_askedquestion", false, 6)];
  assert.deepEqual(orderTags(items).map((x) => `${x.session_date} ${x.tag}`), ["2026-10-20 ailgr_missed", "2026-10-20 ailgr_attended", "2026-10-20 ailgr_registered", "2026-10-20 ailgr_askedquestion", "2026-10-19 ailgr_attended", "2026-10-19 ailgr_registered"]);
  assert.deepEqual(orderTags([]), []);
});

test("withinBudget: the run stops at the budget, counted from its start", () => {
  assert.equal(PUSH_BUDGET_MS, 240_000);
  assert.equal(withinBudget(0, 239_999), true);
  assert.equal(withinBudget(0, 240_000), false);
  assert.equal(withinBudget(1_000, 1_500, 1_000), true);
  assert.equal(withinBudget(1_000, 2_000, 1_000), false);
});

test("missedAction: first miss adds the tag; a repeat 14+ days on re-runs the follow-up; inside 14 days nothing (SPEC-bookings-recovery.md M2)", () => {
  assert.equal(missedAction({ lastRun: null, tagged: false, today: "2026-11-04" }), "first");
  assert.equal(missedAction({ lastRun: null, tagged: true, today: "2026-11-04" }), "rerun"); // tagged in Aug–Oct, before the log existed
  assert.equal(missedAction({ lastRun: "2026-10-21", tagged: true, today: "2026-11-04" }), "rerun"); // 14 days
  assert.equal(missedAction({ lastRun: "2026-10-22", tagged: true, today: "2026-11-04" }), "skip"); // 13 days
  assert.equal(missedAction({ lastRun: "2026-10-01", tagged: false, today: "2026-11-04" }), "first"); // tag gone (attended since): adding fires
  assert.equal(missedAction({ lastRun: "2026-11-04", tagged: true, today: "2026-11-04" }), "skip");
});

test("missedOwed: a missed tag is owed again for a later session even when the same registrant row was tagged before", () => {
  assert.equal(missedOwed(undefined, "2026-11-03", "2026-11-04"), true);
  assert.equal(missedOwed("2026-10-21T02:01:00Z", "2026-11-03", "2026-11-04"), true); // earlier session (moved-in row), yesterday
  assert.equal(missedOwed("2026-11-04T03:01:00Z", "2026-11-03", "2026-11-04"), false); // tagged after this session ended (10 PM ET Nov 3)
  assert.equal(missedOwed("2026-10-21T02:01:00Z", "2026-10-27", "2026-11-04"), false); // a week-old session: no stale replay
  assert.equal(missedOwed(undefined, "2026-10-27", "2026-11-04"), true); // never tagged at all: unchanged behaviour
});

test("the last missed follow-up is the later of our log and ActiveCampaign's own 172 entry (people mid-sequence on the first night are not re-run)", () => {
  assert.equal(latestDate(null, null), null);
  assert.equal(latestDate("2026-10-01", null), "2026-10-01");
  assert.equal(latestDate(null, "2026-11-02"), "2026-11-02");
  assert.equal(latestDate("2026-10-01", "2026-11-02"), "2026-11-02");
  assert.equal(missedAction({ lastRun: latestDate(null, "2026-11-02"), tagged: true, today: "2026-11-04" }), "skip");
  assert.ok(MISSED_RERUNS_PER_RUN > 0 && MISSED_RERUNS_PER_RUN <= 50);
});
