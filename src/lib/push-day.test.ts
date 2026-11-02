import assert from "node:assert/strict";
import { test } from "node:test";
import { HOT_DAILY_CAP, groupFor, isPushDay, isPushMinute, pickHot, pickToday, smallestGroup } from "./push-day.ts";

test("groups run in order Mon–Thu from Nov 2 2026 and come back exactly 14 days later", () => {
  assert.equal(groupFor("2026-11-02"), 1); // Mon
  assert.equal(groupFor("2026-11-03"), 2);
  assert.equal(groupFor("2026-11-05"), 4); // Thu
  assert.equal(groupFor("2026-11-06"), null); // Fri
  assert.equal(groupFor("2026-11-08"), null); // Sun
  assert.equal(groupFor("2026-11-09"), 5);
  assert.equal(groupFor("2026-11-12"), 8);
  assert.equal(groupFor("2026-11-16"), 1); // 14 days after its first push
  assert.equal(groupFor("2026-11-17"), 2);
  assert.equal(groupFor("2026-11-01"), null); // before the anchor
  for (let day = 0; day < 120; day++) {
    const d = new Date(Date.UTC(2026, 10, 2 + day)).toISOString().slice(0, 10);
    const g = groupFor(d);
    if (g === null) continue;
    const back = new Date(Date.UTC(2026, 10, 2 + day + 14)).toISOString().slice(0, 10);
    assert.equal(groupFor(back), g, `${d} → ${back}`);
  }
  assert.equal(isPushDay("2026-11-07"), false);
});

test("only the 5:50 pm Eastern run pushes, in both DST states", () => {
  assert.equal(isPushMinute(new Date("2026-11-02T22:50:00Z")), true); // 17:50 EST
  assert.equal(isPushMinute(new Date("2026-11-02T21:50:00Z")), false); // 16:50 EST
  assert.equal(isPushMinute(new Date("2027-04-06T21:50:00Z")), true); // 17:50 EDT
  assert.equal(isPushMinute(new Date("2027-04-06T22:50:00Z")), false); // 18:50 EDT
});

test("new contacts join the smallest group", () => {
  assert.equal(smallestGroup([503, 503, 503, 503, 503, 502, 502, 502]), 6);
  assert.equal(smallestGroup([5, 5, 5, 5, 5, 5, 5, 5]), 1);
  assert.equal(smallestGroup([9, 9, 9, 9, 9, 9, 9, 1]), 8);
});

test("today's list leaves out re-engagement contacts and anyone inside the hold, once each", () => {
  const r = pickToday(["a", "b", "c", "d", "a"], new Set(["b"]), new Set(["c"]));
  assert.deepEqual(r.push, ["a", "d"]);
  assert.equal(r.skippedReengagement, 1);
  assert.equal(r.skippedHold, 1);
});

test("hot track: first invites capped, watched-40 first; second invite at 7 days; graduates after two", () => {
  const none = new Set<string>();
  const today = "2026-11-10";
  const cands = [{ id: "a", watched40: false }, { id: "b", watched40: true }, { id: "c", watched40: false }];
  const r = pickHot(cands, new Map(), none, new Map(), today, 2);
  assert.deepEqual(r.first, ["b", "a"]);
  assert.deepEqual(r.second, []);
  assert.deepEqual(r.graduate, []);

  const hot = new Map([["a", ["2026-11-03"]], ["b", ["2026-11-04"]], ["c", ["2026-10-20", "2026-10-27"]]]);
  const r2 = pickHot(cands, hot, none, new Map(), today, HOT_DAILY_CAP);
  assert.deepEqual(r2.second, ["a"]); // 7 days ago yes, 6 days ago (b) not yet
  assert.deepEqual(r2.first, []);
  assert.deepEqual(r2.graduate, ["c"]);
});

test("hot track: re-engagement and any push in the last 6 days sit out; duplicates once", () => {
  const cands = [{ id: "a", watched40: true }, { id: "b", watched40: true }, { id: "c", watched40: true }, { id: "a", watched40: true }];
  const lastAny = new Map([["c", "2026-11-05"]]);
  const r = pickHot(cands, new Map(), new Set(["b"]), lastAny, "2026-11-10", 10);
  assert.deepEqual(r.first, ["a"]);
  const r2 = pickHot(cands, new Map(), new Set(["b"]), new Map([["c", "2026-11-04"]]), "2026-11-10", 10);
  assert.deepEqual(r2.first, ["a", "c"]);
});
