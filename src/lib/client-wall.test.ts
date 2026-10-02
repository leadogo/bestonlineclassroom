import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClients, phoneKey } from "./client-wall.ts";
import { emailHash, nameFromEmail } from "./registrants.ts";

test("phoneKey keeps the last ten digits and drops anything shorter", () => {
  assert.equal(phoneKey("+1 (780) 555-0199"), "7805550199");
  assert.equal(phoneKey("17805550199"), "7805550199");
  assert.equal(phoneKey("555-0199"), null);
  assert.equal(phoneKey(null), null);
});

test("normalizeClients lowercases, hashes, dedupes and drops clients with no key", () => {
  const rows = normalizeClients([
    { id: "a", name: "Jane", status: "active", emails: [" Jane@Example.com ", "jane@example.com", "", null], phones: ["+1 780 555 0199", "bad"], since: "2026-07-15" },
    { id: "b", name: "No keys", emails: [null], phones: [""] },
    { id: "", emails: ["x@y.com"] },
    null,
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].emails, ["jane@example.com"]);
  assert.deepEqual(rows[0].email_hashes, [emailHash("jane@example.com")]);
  assert.deepEqual(rows[0].phones, ["7805550199"]);
  assert.equal(rows[0].client_since, "2026-07-15T00:00:00.000Z");
  assert.deepEqual(normalizeClients("nope"), []);
});

test("nameFromEmail gives a first name worth showing, else Guest", () => {
  assert.equal(nameFromEmail("sarah.k@example.com"), "Sarah");
  assert.equal(nameFromEmail("JDOE99@example.com"), "Jdoe");
  assert.equal(nameFromEmail("a1@example.com"), "Guest");
  assert.equal(nameFromEmail(null), "Guest");
});
