import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTENDED_SECONDS, funnelWeeks, lookupAnswer, weekStart, type Reg } from "./social.ts";

const reg = (id: string, email: string, date: string, medium = "ig_dm"): Reg => ({ id, email, session_date: date, attribution: { utm_source: "social", utm_medium: medium } });

test("lookupAnswer: yes/no only, 15 live minutes is attended, a cancelled booking is not booked", () => {
  assert.deepEqual(lookupAnswer([], [], []), { registered: false, attended: false, booked: false, last_event_date: null });
  const regs = [reg("a", "x@y.com", "2026-10-20"), reg("b", "x@y.com", "2026-10-28")];
  assert.deepEqual(lookupAnswer(regs, [{ registrant_id: "a", seconds_watched: ATTENDED_SECONDS - 1 }], [{ registrant_id: null, email: "x@y.com", status: "cancelled" }]),
    { registered: true, attended: false, booked: false, last_event_date: "2026-10-28" });
  const yes = lookupAnswer(regs, [{ registrant_id: "b", seconds_watched: ATTENDED_SECONDS }], [{ registrant_id: "b", email: null, status: "scheduled" }]);
  assert.equal(yes.attended, true);
  assert.equal(yes.booked, true);
  assert.equal(lookupAnswer(regs, [{ registrant_id: "other", seconds_watched: 5000 }], []).attended, false, "someone else's attendance");
});

test("weekStart: Monday of the week", () => {
  assert.equal(weekStart("2026-10-26"), "2026-10-26"); // Monday
  assert.equal(weekStart("2026-11-01"), "2026-10-26"); // Sunday
  assert.equal(weekStart("2026-10-27"), "2026-10-26");
});

test("funnelWeeks: by week and medium, one person once a week, bookings by registrant or email", () => {
  const regs = [
    reg("a", "a@x.com", "2026-10-27", "ig_dm"), reg("a2", "A@x.com", "2026-10-29", "ig_dm"), // same person twice: counts once
    reg("b", "b@x.com", "2026-10-28", "fb_comment"),
    reg("c", "c@x.com", "2026-10-20", "ig_dm"),
  ];
  const weeks = funnelWeeks(regs, [{ registrant_id: "a2", seconds_watched: 1000 }, { registrant_id: "b", seconds_watched: 100 }],
    [{ registrant_id: null, email: "b@x.com", status: "scheduled" }, { registrant_id: "c", email: null, status: "canceled" }]);
  assert.deepEqual(weeks.map((w) => w.week_start), ["2026-10-26", "2026-10-19"]);
  assert.deepEqual(weeks[0].total, { registered: 2, attended: 1, booked: 1 }, "a attended on their second registration that week");
  assert.deepEqual(weeks[0].by_medium.ig_dm, { registered: 1, attended: 1, booked: 0 });
  assert.deepEqual(weeks[0].by_medium.fb_comment, { registered: 1, attended: 0, booked: 1 });
  assert.deepEqual(weeks[1].total, { registered: 1, attended: 0, booked: 0 });
});
