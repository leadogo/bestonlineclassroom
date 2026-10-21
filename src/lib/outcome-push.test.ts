import { test } from "node:test";
import assert from "node:assert/strict";
import { orderTags, PUSH_BUDGET_MS, withinBudget, type Planned } from "./outcome-push.ts";

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
