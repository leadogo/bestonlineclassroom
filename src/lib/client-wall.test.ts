import { test } from "node:test";
import assert from "node:assert/strict";
import { freeLocal, isDeviceTell, normalizeClients, phoneKey } from "./client-wall.ts";
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

test("freeLocal: the name part of a personal mailbox, long and specific enough to be one person (Brishen, Oct 28: combsrealtor@gmail walled, back as combsrealtor@icloud)", () => {
  assert.equal(freeLocal("combsrealtor@gmail.com"), "combsrealtor");
  assert.equal(freeLocal("CombsRealtor@iCloud.com"), "combsrealtor");
  assert.equal(freeLocal("buzz628@yahoo.com"), "buzz628");
  for (const e of ["andrew@andrewhaire.ca", "leslie@lunsfordgrp.com", "jeremy@bannackre.com"]) assert.equal(freeLocal(e), null, `${e}: a company domain's first name is many people`);
  for (const e of ["info@gmail.com", "realtor@yahoo.com", "sam@gmail.com", "", "not-an-email"]) assert.equal(freeLocal(e), null, e);
});

test("normalizeClients carries the personal-mailbox name parts for the look-alike match", () => {
  const [c] = normalizeClients([{ id: "1", emails: ["combsrealtor@gmail.com", "brishen@combsteam.com"], phones: [] }]);
  assert.deepEqual(c.free_locals, ["combsrealtor"]);
});

test("isDeviceTell: an address and browser that hit the 404 for one client only is that client's device; one seen for several is a scanner or proxy", () => {
  assert.equal(isDeviceTell(["233fbfb3"]), true);
  assert.equal(isDeviceTell(["233fbfb3", "233fbfb3", "233fbfb3"]), true, "the same client reloading");
  assert.equal(isDeviceTell(["233fbfb3", "86d4466f"]), false, "Gmail's link scanner checks many clients' emails");
  assert.equal(isDeviceTell([]), false);
});
