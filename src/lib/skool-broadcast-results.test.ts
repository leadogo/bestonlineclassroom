import assert from "node:assert/strict";
import { test } from "node:test";
import { resultLine, reviewBrief } from "./skool-broadcast-results.ts";

test("the result line carries every stage and bolds bookings", () => {
  const line = resultLine("sunday", "2026-10-18", "🚨 How many leads did you waste last month?", { emailed: 6200, doorClicks: 143, entered: 61, joined: 48, atPitch: 30, booked: 3 });
  assert.match(line, /6,200 emailed · 143 door clicks \(2\.3%\) · 61 entered an email · 48 joined · 30 at the pitch · \*3 booked\*/);
});

test("the review brief groups by title and flags titles under four sends", () => {
  const r = { emailed: 6200, doorClicks: 100, entered: 40, joined: 30, atPitch: 20, booked: 2 };
  const brief = reviewBrief([{ date: "2026-10-18", weekday: "sunday", title: "A", result: r }, { date: "2026-10-25", weekday: "sunday", title: "A", result: r }, { date: "2026-10-21", weekday: "wednesday", title: "B", result: r }]);
  assert.match(brief, /"A" · 2 sends \(not yet a read\) · clicks 200/);
  assert.match(brief, /"B" · 1 send \(not yet a read\)/);
});
