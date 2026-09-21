import { test } from "node:test";
import assert from "node:assert/strict";
import { AILG_R, sessionFor } from "./daily-schedule.ts";
import { fill } from "./email-templates.ts";
import { sessionWords } from "./mailer.ts";

test("session words in the site's wording; both placeholder styles fill", () => {
  const s = sessionFor(AILG_R, "2026-09-21")!;
  assert.deepEqual(sessionWords(s, "America/Edmonton"), { time: "7:00 PM ET / 5:00 PM MT", date: "Monday, September 21st" });
  assert.deepEqual(sessionWords(sessionFor(AILG_R, "2026-11-02")!, "America/Edmonton"), { time: "7:00 PM ET / 5:00 PM MT", date: "Monday, November 2nd" }, "after DST ends the wall clock is the same");
  assert.equal(fill("Hi #FIRST_NAME#, {{title}} at #WEBINAR_TIME# #NOPE#", { first_name: "Ana", title: "T", webinar_time: "7 PM" }), "Hi Ana, T at 7 PM #NOPE#");
});
