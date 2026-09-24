import { test } from "node:test";
import assert from "node:assert/strict";
import { PHONE_RE } from "./call-requests.ts";

test("PHONE_RE finds North American numbers in the usual shapes and leaves prices and years alone", () => {
  for (const s of ["Contact me at (647) 785-3700", "call 403 555 1234 please", "text me 4035551234", "+1 587-555-0100"]) assert.ok(PHONE_RE.test(s), s);
  for (const s of ["I made $120,000 in 2024", "closed 37 deals in year one", "1650 transactions"]) assert.equal(PHONE_RE.test(s), false, s);
});
