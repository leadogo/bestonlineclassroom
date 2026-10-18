import assert from "node:assert/strict";
import { test } from "node:test";
import { BROADCASTS, BROADCAST_LINK, isBroadcastMinute, pickBroadcast, wordCount } from "./skool-broadcast.ts";

test("Wednesday and Sunday get a post, other days none (Mountain time)", () => {
  assert.equal(pickBroadcast(new Date("2026-10-21T22:58:00Z"))?.weekday, "wednesday"); // Wed 16:58 MDT
  assert.equal(pickBroadcast(new Date("2026-10-25T22:58:00Z"))?.weekday, "sunday");
  assert.equal(pickBroadcast(new Date("2026-10-22T22:58:00Z")), null); // Thursday
  assert.equal(pickBroadcast(new Date("2026-10-22T04:30:00Z"))?.weekday, "wednesday"); // still Wed 22:30 Mountain
});

test("only the 16:58 Mountain minute window posts, in both DST states", () => {
  assert.equal(isBroadcastMinute(new Date("2026-10-21T22:58:00Z")), true); // MDT
  assert.equal(isBroadcastMinute(new Date("2026-10-21T23:58:00Z")), false); // 17:58 MDT
  assert.equal(isBroadcastMinute(new Date("2026-11-04T23:58:00Z")), true); // MST after Nov 1
  assert.equal(isBroadcastMinute(new Date("2026-11-04T22:58:00Z")), false); // 15:58 MST
});

test("copy fits Skool and carries the generic door", () => {
  for (const b of Object.values(BROADCASTS)) {
    assert.ok(b.title.length <= 70, b.title);
    assert.ok(wordCount(b.body) <= 130, `${b.weekday} body ${wordCount(b.body)} words`);
    assert.ok(b.body.includes(BROADCAST_LINK));
    assert.ok(!/\blive\b/i.test(b.title), "no live claim in the title");
    assert.ok(b.title.startsWith("🚨") && (b.title.match(/🚨/g) ?? []).length === 1, "one siren, no stacks");
    assert.ok(!/tonight at/i.test(b.title), "the post lands two minutes before the doors");
    assert.ok(!/\b(hours?|minutes?|twenty)\b/i.test(b.body), "the body never states the length (William, Oct 18)");
  }
});
