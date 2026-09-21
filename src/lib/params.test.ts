import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanParams, toQuery, withQuery } from "./params.ts";

test("cleanParams keeps only the allowlist, trims and caps", () => {
  const out = cleanParams({ utm_source: " fb ", src: "skool", eh: "abc", rid: "x", at: "4500", key: "k", fbclid: "y".repeat(300), utm_medium: ["a", "b"] });
  assert.deepEqual(Object.keys(out).sort(), ["fbclid", "src", "utm_medium", "utm_source"]);
  assert.equal(out.utm_source, "fb");
  assert.equal(out.utm_medium, "a");
  assert.equal(out.fbclid.length, 200);
  assert.deepEqual(cleanParams(new URLSearchParams("src=email&e=x")), { src: "email" });
});

test("toQuery and withQuery", () => {
  assert.equal(toQuery({}), "");
  assert.equal(toQuery({ src: "skool", utm_source: "a b" }), "?src=skool&utm_source=a+b");
  assert.equal(withQuery("https://x.com/p?keep=1", { email: "a@b.co", phone: "", first_name: "Ana" }), "https://x.com/p?keep=1&email=a%40b.co&first_name=Ana");
});
