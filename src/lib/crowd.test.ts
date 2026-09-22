import { test } from "node:test";
import assert from "node:assert/strict";
import { crowdNames, crowdShare } from "./crowd.ts";

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
