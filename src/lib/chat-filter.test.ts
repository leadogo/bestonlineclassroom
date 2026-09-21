import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMessage } from "./chat-filter.ts";

test("chat filter: links, swearing, scam lines and shouting are refused; ordinary questions pass", () => {
  assert.equal(checkMessage("Great session, thanks William!").ok, true);
  assert.equal(checkMessage("How do I get the AI to book showings for me?").ok, true);
  assert.equal(checkMessage("Where do I sign up?").ok, true);
  assert.deepEqual(checkMessage("check https://example.com now"), { ok: false, kind: "link", reason: "Links can't be shared in the chat." });
  assert.equal(checkMessage("go to bestdeals.co for leads").ok, false);
  assert.equal(checkMessage("www.something.net").ok, false);
  assert.equal(checkMessage("this is fucking great").ok, false);
  assert.equal(checkMessage("DM me for guaranteed returns on crypto").ok, false);
  assert.equal(checkMessage("text me on WhatsApp").ok, false);
  assert.equal(checkMessage("YESSSSSSSSSSSSSSSSSSS").ok, false);
  assert.equal(checkMessage("Is it 5 pm ET or MT?").ok, true, "no false positive on plain text");
  assert.equal(checkMessage("kick ass session").ok, false, "milder swearing too");
  assert.equal(checkMessage("email me at jane@example.com").ok, false, "no contact details");
  assert.equal(checkMessage("call 403-555-1234").ok, false, "no phone numbers");
  assert.equal(checkMessage("I closed 12 deals in 2025").ok, true, "numbers in sentences are fine");
  assert.equal(checkMessage("I use Google Sheets and a CRM").ok, true, "product names are fine");
});
