import { test } from "node:test";
import assert from "node:assert/strict";
import { ctaHref } from "./cta.ts";

test("ctaHref keeps the target's query, appends fields and params, skips empties, encodes", () => {
  const href = ctaHref("https://aiforagentsmasterclass.com/join-community?ref=room", { first_name: "Ana María", email: "ana@x.com", phone: null, rid: "r1" }, { utm_source: "fb", src: "skool" });
  const u = new URL(href);
  assert.equal(u.origin + u.pathname, "https://aiforagentsmasterclass.com/join-community");
  assert.deepEqual(Object.fromEntries(u.searchParams), { ref: "room", utm_source: "fb", src: "skool", first_name: "Ana María", email: "ana@x.com", rid: "r1" });
});
