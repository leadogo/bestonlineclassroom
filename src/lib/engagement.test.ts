import { test } from "node:test";
import assert from "node:assert/strict";
import { engagementScore, rankEngagement } from "./engagement.ts";

test("engagementScore: weights add to one, capped at the pitch and five messages", () => {
  assert.equal(engagementScore({ minutes: 75, atPitch: true, messages: 5, clicked: true }, 75), 1);
  assert.equal(engagementScore({ minutes: 200, atPitch: true, messages: 50, clicked: true }, 75), 1);
  assert.equal(engagementScore({ minutes: 0, atPitch: false, messages: 0, clicked: false }, 75), 0);
  assert.equal(engagementScore({ minutes: 37.5, atPitch: false, messages: 0, clicked: false }, 75), 0.2);
  assert.equal(engagementScore({ minutes: 0, atPitch: false, messages: 0, clicked: true }, 0), 0.15);
});

test("rankEngagement: a watched click that has not booked leads, then score, then minutes", () => {
  const r = rankEngagement([
    { n: "a", minutes: 90, atPitch: true, messages: 10, clicked: true, booked: true },
    { n: "b", minutes: 20, atPitch: false, messages: 0, clicked: true, booked: false },
    { n: "c", minutes: 0, atPitch: false, messages: 0, clicked: true, booked: false },
    { n: "d", minutes: 60, atPitch: true, messages: 2, clicked: false, booked: false },
  ], 75);
  assert.deepEqual(r.map((x) => x.n), ["b", "a", "d", "c"]);
  assert.deepEqual(r.map((x) => x.rank), [1, 2, 3, 4]);
});
