import { test } from "node:test";
import assert from "node:assert/strict";
import { crowdNames, crowdShare, waitingCount } from "./crowd.ts";

test("crowdShare follows Jeremy's points on the real session and never climbs", () => {
  const S = 8385, P = 4500;
  assert.equal(crowdShare(0, P, S), 1);
  assert.equal(crowdShare(300, P, S), 1);
  assert.ok(Math.abs(crowdShare(922, P, S) - 0.85) < 0.01);
  assert.ok(Math.abs(crowdShare(P, P, S) - 0.8) < 0.001);
  assert.ok(Math.abs(crowdShare(6289, P, S) - 0.6) < 0.01);
  assert.equal(crowdShare(S, P, S), 0.4);
  assert.equal(crowdShare(S + 999, P, S), 0.4);
  let last = 1;
  for (let t = 0; t <= S; t += 60) { const v = crowdShare(t, P, S); assert.ok(v <= last + 1e-9, `rises at ${t}`); last = v; }
  assert.equal(crowdShare(100, null, 0), 1);
});

test("crowdNames keeps the front of the list", () => {
  const names = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  assert.deepEqual(crowdNames(names, 0.4), ["a", "b", "c", "d"]);
  assert.deepEqual(crowdNames(names, 1), names);
  assert.deepEqual(crowdNames(names, 2), names);
});

test("waitingCount: starts at the floor, climbs, and never passes the crowd the room shows", () => {
  assert.equal(waitingCount(0, 188, 0), 90);
  assert.ok(waitingCount(0.5, 188, 0) > 90 && waitingCount(0.5, 188, 0) < 188);
  assert.equal(waitingCount(1, 188, 0), 188);
  assert.equal(waitingCount(1, 188, 40), 188);
  assert.equal(waitingCount(0.9, 188, 500), 188);
  assert.equal(waitingCount(0, 60, 0), 60);
  assert.equal(waitingCount(0.3, 60, 10), 60 >= waitingCount(0.3, 60, 10) ? waitingCount(0.3, 60, 10) : 60);
  for (let i = 0; i <= 30; i++) { const a = waitingCount(i / 30, 188, 3), b = waitingCount((i + 1) / 30, 188, 3); assert.ok(b >= a, `climbs at ${i}`); assert.ok(a <= 188); }
});
