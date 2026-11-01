import { test } from "node:test";
import assert from "node:assert/strict";
import { acChecks, clockChecks, icsStart, isZone, triggerInstant } from "./clock-agreement.ts";

const NY = "America/New_York";
const winter = new Date("2026-11-02T00:00:00Z"); // Sun Nov 1, 7 PM EST
const summer = new Date("2027-04-06T23:00:00Z"); // Tue Apr 6, 7 PM EDT
const min = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

test("clockChecks: agreement, an hour off, unreachable, late call slots", () => {
  const [site, kat, leadogo, slow] = clockChecks(winter, NY, [
    { system: "site", start: winter },
    { system: "Katherine", start: winter, slots: [min(winter, -90), min(winter, -45)] },
    { system: "Leadogo", start: null, error: "HTTP 404" },
    { system: "old", start: min(winter, -60) },
  ]);
  assert.equal(site.ok, true);
  assert.match(kat.detail, /agrees: 7:00 PM EST, calls -90 min \/ -45 min/);
  assert.equal(leadogo.ok, true, "unreachable is a warning");
  assert.match(leadogo.detail, /⚠ unreachable/);
  assert.equal(slow.ok, false);
  assert.match(slow.detail, /6:00 PM EST, 60 min early/);
  const [late] = clockChecks(summer, NY, [{ system: "Katherine", start: summer, slots: [min(summer, 15)] }]);
  assert.equal(late.ok, false);
  assert.match(late.detail, /7:15 PM EDT/);
});

test("triggerInstant: hour or HH:MM in the trigger's own zone, both seasons", () => {
  assert.equal(triggerInstant("2026-11-01", { automation: 191, type: "date", params: { time: 18, timezone: NY } })?.toISOString(), "2026-11-01T23:00:00.000Z");
  assert.equal(triggerInstant("2027-04-06", { automation: 199, type: "scheduled", params: { time: "17:50", timezone: NY } })?.toISOString(), "2027-04-06T21:50:00.000Z");
  assert.equal(triggerInstant("2026-11-01", { automation: 1, type: "date", params: {} }), null);
});

test("acChecks: account zone must be the room's; a trigger after the start fails; another zone warns", () => {
  const ok = acChecks(winter, NY, "2026-11-01", NY, [{ automation: 191, type: "date", params: { time: 18, timezone: NY } }]);
  assert.deepEqual(ok.map((c) => c.ok), [true, true]);
  const bad = acChecks(winter, NY, "2026-11-01", "America/Edmonton", [
    { automation: 191, type: "date", params: { time: 19, timezone: NY } },
    { automation: 174, type: "date", params: { time: 8, timezone: "America/Edmonton" } },
  ]);
  assert.equal(bad[0].ok, false);
  assert.equal(bad[1].ok, false);
  assert.match(bad[1].detail, /191 at 7:00 PM EST/);
  assert.match(bad[1].detail, /⚠ not on America\/New_York: 174/);
  assert.equal(acChecks(winter, NY, "2026-11-01", null, [])[0].ok, true);
});

test("icsStart and isZone", () => {
  assert.equal(icsStart("BEGIN:VEVENT\nDTSTART:20261102T000000Z\nDTEND:x")?.toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(icsStart("nothing"), null);
  assert.equal(isZone(NY), true);
  assert.equal(isZone("America/Nework"), false);
});
