// The zone arithmetic everything else trusts. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { ordinal, partsInTz, toIcsUtc, zoned } from "./tz.ts";

test("zoned: 5 PM Mountain across the DST change, and day overflow", () => {
  assert.equal(zoned(2026, 9, 19, 17, 0, "America/Edmonton").toISOString(), "2026-09-19T23:00:00.000Z", "MDT");
  assert.equal(zoned(2026, 11, 1, 17, 0, "America/Edmonton").toISOString(), "2026-11-02T00:00:00.000Z", "MST after Nov 1");
  assert.equal(zoned(2026, 9, 31, 17, 0, "America/Edmonton").toISOString(), "2026-10-01T23:00:00.000Z", "Sep 31 = Oct 1");
  assert.equal(zoned(2026, 9, 19, 19, 0, "America/New_York").toISOString(), "2026-09-19T23:00:00.000Z", "7 PM ET is the same instant");
});

test("partsInTz: the Mountain calendar date of a UTC instant, and the weekday", () => {
  const p = partsInTz(new Date("2026-11-02T00:00:00Z"), "America/Edmonton");
  assert.deepEqual([p.year, p.month, p.day, p.hour, p.minute], [2026, 11, 1, 17, 0]);
  assert.equal(p.weekday, 0, "Sunday");
});

test("ICS timestamps and ordinals", () => {
  assert.equal(toIcsUtc(new Date("2026-09-15T23:00:00.000Z")), "20260915T230000Z");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"]);
});
