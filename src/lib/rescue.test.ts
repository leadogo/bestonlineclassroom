import assert from "node:assert/strict";
import { test } from "node:test";
import { inRescueWindow, rescueReady, secondRing } from "./rescue.ts";

const click = { id: "r1", clickedAt: "2026-11-05T01:20:00Z", booked: false, blocked: false };

test("rescue: ready 15 minutes after the click, never once booked or blocked (SPEC-bookings-recovery.md M4)", () => {
  assert.equal(rescueReady(click, Date.parse("2026-11-05T01:34:00Z")), false); // 14 min
  assert.equal(rescueReady(click, Date.parse("2026-11-05T01:35:00Z")), true); // 15 min
  assert.equal(rescueReady({ ...click, booked: true }, Date.parse("2026-11-05T02:00:00Z")), false); // booked at minute 12
  assert.equal(rescueReady({ ...click, blocked: true }, Date.parse("2026-11-05T02:00:00Z")), false);
});

test("rescue texts go out 8:15–10:45 PM Eastern only, in both DST states", () => {
  assert.equal(inRescueWindow(new Date("2026-11-05T01:15:00Z")), true); // 8:15 PM EST
  assert.equal(inRescueWindow(new Date("2026-11-05T03:45:00Z")), true); // 10:45 PM EST
  assert.equal(inRescueWindow(new Date("2026-11-05T03:50:00Z")), false); // 10:50 PM EST
  assert.equal(inRescueWindow(new Date("2026-11-05T01:10:00Z")), false); // 8:10 PM EST
  assert.equal(inRescueWindow(new Date("2027-04-07T00:30:00Z")), true); // 8:30 PM EDT
});

test("second ring: stayed to the pitch, did not click, no booking, not blocked; newest registration first", () => {
  const rows = [
    { id: "a", maxOffset: 4600, clicked: false, booked: false, blocked: false, registeredAt: "2026-11-04T15:00:00Z" },
    { id: "b", maxOffset: 4400, clicked: false, booked: false, blocked: false, registeredAt: "2026-11-04T16:00:00Z" }, // left before the pitch
    { id: "c", maxOffset: 5000, clicked: true, booked: false, blocked: false, registeredAt: "2026-11-04T17:00:00Z" }, // clicked: rescue, not second ring
    { id: "d", maxOffset: 5000, clicked: false, booked: true, blocked: false, registeredAt: "2026-11-04T18:00:00Z" },
    { id: "e", maxOffset: 4500, clicked: false, booked: false, blocked: false, registeredAt: "2026-11-04T19:00:00Z" },
  ];
  assert.deepEqual(secondRing(rows).map((r) => r.id), ["e", "a"]);
});
