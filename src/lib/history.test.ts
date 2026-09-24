import { test } from "node:test";
import assert from "node:assert/strict";
import { projectBookings, typicalNight } from "./history.ts";

test("typicalNight: averages the curves, names the peak minute, the hold and the phase", () => {
  const a = [10, 20, 40, 60, 60, 55, 50, 30, 10];
  const b = [10, 20, 40, 60, 60, 45, 40, 20, 10];
  const t = typicalNight([a, b], 3)!;
  assert.equal(t.peak_minute, 3);
  assert.equal(t.peak, 60);
  assert.equal(t.hold_end_minute, 6);
  assert.equal(t.phase, "peak");
  assert.equal(typicalNight([a, b], 1)!.phase, "warming");
  assert.equal(typicalNight([a, b], 5)!.phase, "holding");
  assert.equal(typicalNight([a, b], 7)!.phase, "cooling");
  assert.equal(typicalNight([a, b], 5)!.typical_now, 50);
  assert.equal(typicalNight([], 5), null);
});

test("projectBookings: this weekday once it has four sessions, else every session", () => {
  const h = (weekday: number, at_pitch: number, booked: number) => ({ date: "", weekday, at_pitch, booked });
  const history = [h(1, 40, 10), h(1, 30, 6), h(2, 50, 5), h(2, 50, 5)];
  const all = projectBookings(history, 1, 36)!;
  assert.equal(all.byWeekday, false);
  assert.equal(all.sessions, 4);
  assert.ok(Math.abs(all.rate - 26 / 170) < 1e-9);
  assert.equal(all.projected, Math.round(36 * (26 / 170)));
  const mondays = [...history, h(1, 20, 6), h(1, 20, 6)];
  const mon = projectBookings(mondays, 1, 36)!;
  assert.equal(mon.byWeekday, true);
  assert.equal(mon.sessions, 4);
  assert.equal(projectBookings([], 1, 36), null);
});
