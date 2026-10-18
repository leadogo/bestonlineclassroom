import assert from "node:assert/strict";
import { test } from "node:test";
import { joinSources, joinSourcesLine } from "./join-sources.ts";

const clicks = [
  { registrant_id: "a", at: "2026-10-18T22:50:00Z", src: "email", outcome: "countdown" },
  { registrant_id: "a", at: "2026-10-18T23:04:00Z", src: "sms", outcome: "live" },
  { registrant_id: "b", at: "2026-10-18T23:01:00Z", src: "email", outcome: "live" },
  { registrant_id: "c", at: "2026-10-18T23:02:00Z", src: null, outcome: "live" },
  { registrant_id: "d", at: "2026-10-18T23:30:00Z", src: "sms", outcome: "live" },
];
const joins = [
  { registrant_id: "a", joined_at: "2026-10-18T23:04:10Z", max_offset: 5000 },
  { registrant_id: "b", joined_at: "2026-10-18T23:01:20Z", max_offset: 1200 },
  { registrant_id: "c", joined_at: "2026-10-18T23:02:30Z", max_offset: 4800 },
  { registrant_id: "e", joined_at: "2026-10-18T23:00:00Z", max_offset: 300, source: "skool" },
];

test("a join is credited to the last tagged click before it; untagged is direct; Skool guests are skool", () => {
  const r = joinSources({ clicks, joins, bookings: [{ registrant_id: "a" }, { registrant_id: "c" }, { registrant_id: "zzz" }], ctaAtSeconds: 4500 });
  assert.deepEqual(r.sms, { clicked: 2, joined: 1, at_pitch: 1, booked: 1 }); // a: email then sms, joined after sms
  assert.deepEqual(r.email, { clicked: 2, joined: 1, at_pitch: 0, booked: 0 }); // b
  assert.deepEqual(r.direct, { clicked: 0, joined: 1, at_pitch: 1, booked: 2 }); // c, plus a booking with no click or join
  assert.deepEqual(r.skool, { clicked: 0, joined: 1, at_pitch: 0, booked: 0 }); // e
  assert.equal(r.calendar.joined, 0);
});

test("the line reads joins per source with bookings in brackets", () => {
  const r = joinSources({ clicks, joins, bookings: [{ registrant_id: "a" }], ctaAtSeconds: 4500 });
  assert.match(joinSourcesLine("AI For Agents Masterclass", "2026-10-18", r), /sms 1 \(1 booked\) · skool 1 · calendar 0 · direct 1 · link clicks: email 2 · sms 2/);
});
