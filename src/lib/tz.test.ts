// The zone arithmetic everything else trusts. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cronDue, ordinal, partsInTz, toIcsUtc, zoned } from "./tz.ts";

test("zoned: 7 PM Eastern across the DST change, and day overflow", () => {
  assert.equal(zoned(2026, 9, 19, 19, 0, "America/New_York").toISOString(), "2026-09-19T23:00:00.000Z", "EDT");
  assert.equal(zoned(2026, 11, 1, 19, 0, "America/New_York").toISOString(), "2026-11-02T00:00:00.000Z", "EST after Nov 1");
  assert.equal(zoned(2026, 9, 31, 19, 0, "America/New_York").toISOString(), "2026-10-01T23:00:00.000Z", "Sep 31 = Oct 1");
  assert.equal(zoned(2027, 3, 14, 19, 0, "America/New_York").toISOString(), "2027-03-14T23:00:00.000Z", "EDT again from Mar 14 2027");
});

test("partsInTz: the Eastern calendar date of a UTC instant, and the weekday", () => {
  const p = partsInTz(new Date("2026-11-02T00:00:00Z"), "America/New_York");
  assert.deepEqual([p.year, p.month, p.day, p.hour, p.minute], [2026, 11, 1, 19, 0]);
  assert.equal(p.weekday, 0, "Sunday");
});

test("ICS timestamps and ordinals", () => {
  assert.equal(toIcsUtc(new Date("2026-09-15T23:00:00.000Z")), "20260915T230000Z");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"]);
});

test("cronDue: a cron with two UTC entries runs on the one that is the hour in the zone, in both DST states (F4)", () => {
  assert.equal(cronDue(new Date("2026-10-23T21:45:00Z"), 15), true, "3:45 PM MDT (the default zone, Alberta)");
  const NY = "America/New_York";
  assert.equal(cronDue(new Date("2026-10-23T20:45:00Z"), 16, NY), true, "4:45 PM EDT");
  assert.equal(cronDue(new Date("2026-10-23T21:45:00Z"), 16, NY), false, "5:45 PM EDT: the second entry skips");
  assert.equal(cronDue(new Date("2026-11-03T20:45:00Z"), 16, NY), false, "3:45 PM EST: the first entry skips");
  assert.equal(cronDue(new Date("2026-11-03T21:45:00Z"), 16, NY), true, "4:45 PM EST");
});
