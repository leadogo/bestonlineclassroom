import { test } from "node:test";
import assert from "node:assert/strict";
import { isPerson, median, nightCounts, nightReportDue, nightReportText, PERSON_SECONDS, type LiveRow } from "./night-report.ts";

const start = Date.parse("2026-10-20T23:00:00Z"); // 5 PM Mountain
const at = (ms: number) => new Date(start + ms).toISOString();
const row = (n: number, joinedMs: number, seconds: number, cta = false, source = "site"): LiveRow => ({ registrant_id: `r${n}`, joined_at: at(joinedMs), last_seen_at: at(joinedMs + seconds * 1000), seconds_watched: seconds, cta_clicked_at: cta ? at(joinedMs + seconds * 1000) : null, source });

test("nightCounts: persons by the two-minute rule, peak and at-the-pitch over persons, scanners and test rows out", () => {
  assert.equal(PERSON_SECONDS, 120);
  assert.equal(isPerson({ seconds_watched: 119, cta_clicked_at: null }), false);
  assert.equal(isPerson({ seconds_watched: 120, cta_clicked_at: null }), true);
  assert.equal(isPerson({ seconds_watched: 10, cta_clicked_at: "2026-10-20T23:10:00Z" }), true, "a click is a person whatever the seconds");
  const rows = [
    row(1, 0, 8000, true), row(2, 60_000, 5000), row(3, 120_000, 2400), row(4, 0, 40), row(5, 0, 35), // two scanners
    row(6, 4_000_000, 1000), row(7, 0, 200, false, "test"), row(8, 0, 20, true),
  ];
  const pitch = start + 4500 * 1000;
  const c = nightCounts(rows, pitch);
  assert.equal(c.visits, 7);
  assert.equal(c.people, 5, "1, 2, 3, 6 and the clicker 8");
  assert.equal(c.clicked, 2);
  assert.equal(c.stayed_40, 3);
  assert.equal(c.at_pitch, 3, "1, 2 and 6 cover the pitch instant; 3 left before it, 8 left after 20 s");
  assert.equal(c.peak, 4, "1, 2, 3 and 8 overlap in the first minutes");
  assert.deepEqual([...c.people_ids].sort(), ["r1", "r2", "r3", "r6", "r8"]);
  assert.equal(nightCounts(rows, null).at_pitch, null);
});

test("median and the text, with and without medians and the email line", () => {
  assert.equal(median([]), null);
  assert.equal(median([40]), 40);
  assert.equal(median([61, 40, 37, 28, 31, 38, 47]), 38);
  assert.equal(median([10, 20]), 15);
  const counts = nightCounts([row(1, 0, 8000, true), row(2, 0, 3000), row(3, 0, 50)], start + 4500 * 1000);
  // Row 2 leaves at 50 minutes, before the 75-minute pitch: one at the pitch.
  assert.equal(nightReportText({ label: "Tue Oct 20", counts, booked: 37, medians: { people: 40, booked: 13, nights: 7 } }), "Tue Oct 20 · 2 people (7-night median 40) · peak 2 · 1 at the pitch · 1 offer clicks · 2 stayed 40+ · 37 booked (7-night median 13)");
  assert.match(nightReportText({ label: "Tue Oct 20", counts, booked: 37, medians: { people: 40, booked: 13, nights: 3 } }), /\(3-night median 40\)/, "the median names its nights");
  assert.doesNotMatch(nightReportText({ label: "Tue Oct 20", counts, booked: 37, medians: { people: 40, booked: 13, nights: 0 } }), /median/, "no nights, no median");
  assert.equal(nightReportText({ label: "Tue Oct 20", counts: nightCounts([], null), booked: 0, medians: { people: null, booked: null, nights: 0 } }), "Tue Oct 20 · 0 people · peak 0 · 0 offer clicks · 0 stayed 40+ · 0 booked");
  assert.match(nightReportText({ label: "Tue Oct 20", counts, booked: 37, medians: { people: 40, booked: 13, nights: 7 }, emails: { taps: 59, watched: 13, booked: 5 } }), /\nEmails: 59 human taps → 13 watched → 5 booked$/);
  assert.doesNotMatch(nightReportText({ label: "Wed Oct 21", counts, booked: 9, medians: { people: 40, booked: 13, nights: 7 }, emails: { taps: 0, watched: 0, booked: 0 } }), /Emails/, "no promo taps, no line");
});

test("nightReportDue: from 7:45 PM in the zone for the rest of the day (a failed 7:50 post is retried at 8:50), after the session's end, once a day", () => {
  const end = Date.parse("2026-10-21T01:20:00Z"); // 7:20 PM Mountain on Oct 20
  assert.deepEqual(nightReportDue(new Date("2026-10-21T01:50:00Z"), null, end, "America/Edmonton"), { due: true, today: "2026-10-20" });
  assert.equal(nightReportDue(new Date("2026-10-21T01:50:00Z"), "2026-10-20", end, "America/Edmonton").due, false, "already posted today");
  assert.equal(nightReportDue(new Date("2026-10-21T01:40:00Z"), null, end, "America/Edmonton").due, false, "7:40 PM is early");
  assert.equal(nightReportDue(new Date("2026-10-21T02:50:00Z"), null, end, "America/Edmonton").due, true, "8:50 PM still posts when 7:50 failed");
  assert.equal(nightReportDue(new Date("2026-10-21T05:50:00Z"), null, end, "America/Edmonton").due, true, "11:50 PM too");
  assert.deepEqual(nightReportDue(new Date("2026-10-21T06:50:00Z"), null, end, "America/Edmonton"), { due: false, today: "2026-10-21" }, "12:50 AM is the next day, before 7:45 PM");
  assert.equal(nightReportDue(new Date("2026-10-21T01:50:00Z"), null, end + 3_600_000, "America/Edmonton").due, false, "the session has not ended");
});
