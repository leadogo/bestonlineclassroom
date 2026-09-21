import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAttendance } from "./attendance.ts";

test("heartbeat accounting: first beat credits nothing, a regular beat 30 s, a long gap still 30 s", () => {
  const t0 = new Date("2026-09-21T23:10:00Z");
  const first = nextAttendance(null, t0, 600);
  assert.deepEqual([first.seconds_watched, first.max_offset], [0, 600]);
  const second = nextAttendance({ ...first }, new Date(t0.getTime() + 30_000), 630);
  assert.deepEqual([second.seconds_watched, second.max_offset], [30, 630]);
  const afterSleep = nextAttendance({ ...second }, new Date(t0.getTime() + 3_600_000), 4200);
  assert.deepEqual([afterSleep.seconds_watched, afterSleep.max_offset], [60, 4200]);
  const clockBack = nextAttendance({ ...afterSleep }, new Date(t0.getTime() + 3_500_000), 100);
  assert.deepEqual([clockBack.seconds_watched, clockBack.max_offset], [60, 4200], "never negative, offset never regresses");
});
