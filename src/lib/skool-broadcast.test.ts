import assert from "node:assert/strict";
import { test } from "node:test";
import { BROADCASTS, BROADCAST_LINK, isBroadcastMinute, pickBroadcast, wordCount } from "./skool-broadcast.ts";

test("Wednesday and Sunday get a post, other days none (Eastern time, the session's own zone since 1 Nov 2026)", () => {
  assert.equal(pickBroadcast(new Date("2026-10-21T22:58:00Z"))?.weekday, "wednesday"); // Wed 18:58 EDT
  assert.equal(pickBroadcast(new Date("2026-11-01T23:58:00Z"))?.weekday, "sunday"); // Sun 18:58 EST
  assert.equal(pickBroadcast(new Date("2026-10-22T22:58:00Z")), null); // Thursday
  assert.equal(pickBroadcast(new Date("2026-10-22T03:30:00Z"))?.weekday, "wednesday"); // still Wed 23:30 EDT
});

test("only the 6:58 pm Eastern minute window posts (two minutes before the 7 pm ET doors), in both DST states", () => {
  assert.equal(isBroadcastMinute(new Date("2026-10-21T22:58:00Z")), true); // 18:58 EDT
  assert.equal(isBroadcastMinute(new Date("2026-10-21T23:58:00Z")), false); // 19:58 EDT
  assert.equal(isBroadcastMinute(new Date("2026-11-04T23:58:00Z")), true); // 18:58 EST
  assert.equal(isBroadcastMinute(new Date("2026-11-04T22:58:00Z")), false); // 17:58 EST: an hour early, the bug of 1 Nov
});

test("copy fits Skool and carries the generic door", () => {
  for (const b of Object.values(BROADCASTS)) {
    assert.ok(b.title.length <= 70, b.title);
    assert.ok(wordCount(b.body) <= 130, `${b.weekday} body ${wordCount(b.body)} words`);
    assert.ok(b.body.includes(BROADCAST_LINK));
    assert.ok(!/\blive\b/i.test(b.title), "no live claim in the title");
    assert.ok(b.title.startsWith("🚨") && (b.title.match(/🚨/g) ?? []).length === 1, "one siren, no stacks");
    assert.ok(!/tonight at/i.test(b.title), "the post lands two minutes before the doors");
    assert.ok(!/runs about|two hours|twenty minutes|60 minutes|an hour/i.test(b.body), "the body never states the length (William, Oct 18); the 72-hour replay is not a length");
  }
});
