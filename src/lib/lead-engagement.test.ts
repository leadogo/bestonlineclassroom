import { test } from "node:test";
import assert from "node:assert/strict";
import { testimonialsPct } from "./lead-engagement.ts";

test("testimonialsPct: minutes seen inside the testimonials range over its length", () => {
  assert.equal(testimonialsPct([100, 107, 108, 110, 139], 6420, 8385), Math.round((4 / 33) * 100));
  assert.equal(testimonialsPct([], 6420, 8385), 0);
  assert.equal(testimonialsPct([107], null, 8385), null);
  assert.equal(testimonialsPct([107], 6420, null), null);
  assert.equal(testimonialsPct(Array.from({ length: 40 }, (_, i) => 105 + i), 6420, 8385), 100);
});
