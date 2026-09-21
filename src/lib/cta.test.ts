import { test } from "node:test";
import assert from "node:assert/strict";
import { ctaHref, phoneDigits } from "./cta.ts";

test("ctaHref keeps the target's query, adds iClosed's prefill names, skips empties, encodes", () => {
  const href = ctaHref("https://aiforagentsmasterclass.com/join-community?ref=room", { first_name: "Ana María", email: "ana@x.com", phone: "+1 (403) 555-0100", rid: "r1" }, { utm_source: "fb", src: "skool" });
  const u = new URL(href);
  assert.equal(u.origin + u.pathname, "https://aiforagentsmasterclass.com/join-community");
  assert.deepEqual(Object.fromEntries(u.searchParams), { ref: "room", utm_source: "fb", src: "skool", iclosedName: "Ana María", iclosedEmail: "ana@x.com", iclosedPhone: "14035550100", rid: "r1" });
  const guest = new URL(ctaHref("https://x.com/p", { first_name: "Bo", email: null, phone: null, rid: "r2" }, {}));
  assert.deepEqual(Object.fromEntries(guest.searchParams), { iclosedName: "Bo", rid: "r2" });
  assert.equal(phoneDigits(null), "");
});
