import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAttribution, emailHash, isTestIdentity, joinUrl, newToken, normalizeEmail, parseRegisterBody, TOKEN_RE } from "./registrants.ts";

test("tokens: 12 chars from the look-alike-free alphabet, no repeats in a thousand", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const t = newToken();
    assert.match(t, TOKEN_RE);
    seen.add(t);
  }
  assert.equal(seen.size, 1000);
  assert.equal(joinUrl("abcdefghjkmn", "https://bestonlineclassroom.com/"), "https://bestonlineclassroom.com/j/abcdefghjkmn");
});

test("email identity: normalised, hashed like the site, test identity detected", () => {
  assert.equal(normalizeEmail("  Will@Example.COM "), "will@example.com");
  assert.equal(normalizeEmail("nope"), null);
  assert.equal(normalizeEmail(""), null);
  assert.equal(emailHash(" Will@Example.COM "), emailHash("will@example.com"));
  assert.equal(emailHash(""), "");
  assert.equal(emailHash("a@b.co").length, 64);
  assert.equal(isTestIdentity("room-join-test-sample@thefuturerealestateagent.com"), true);
  assert.equal(isTestIdentity("someone@gmail.com"), false);
});

test("attribution: allowlist, strings only, capped", () => {
  const out = cleanAttribution({ utm_source: " facebook ", email: "leak@x.com", fbclid: "x".repeat(300), utm_medium: 7, session_id: "" });
  assert.deepEqual(Object.keys(out).sort(), ["fbclid", "utm_source"]);
  assert.equal(out.utm_source, "facebook");
  assert.equal(out.fbclid.length, 200);
  assert.deepEqual(cleanAttribution("nope"), {});
});

test("parseRegisterBody: the contract's 422s and a clean input", () => {
  assert.equal(parseRegisterBody(null).ok, false);
  assert.match((parseRegisterBody({ first_name: "A", email: "a@b.co" }) as { error: string }).error, /event/);
  assert.match((parseRegisterBody({ event: "ailg-r", email: "a@b.co" }) as { error: string }).error, /first_name/);
  assert.match((parseRegisterBody({ event: "ailg-r", first_name: "A", email: "bad" }) as { error: string }).error, /email/);
  const r = parseRegisterBody({ event: "ailg-r", first_name: " Ana ", email: "Ana@X.com", phone: "+1 403 555 0100", session_date: "2026-09-21", registration_id: "3F2504E0-4F89-11D3-9A0C-0305E82C3301", source: "zapier", attribution: { utm_source: "fb" } });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.input, { event: "ailg-r", first_name: "Ana", email: "ana@x.com", phone: "+1 403 555 0100", session_date: "2026-09-21", registration_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", source: "zapier", attribution: { utm_source: "fb" } });
  }
  const loose = parseRegisterBody({ event: "ailg-r", first_name: "B", email: "b@x.com", session_date: "tomorrow", registration_id: "nope", source: "other" });
  assert.ok(loose.ok);
  if (loose.ok) assert.deepEqual([loose.input.session_date, loose.input.registration_id, loose.input.source], [null, null, "site"]);
});
